from datetime import datetime, date
from fastapi import APIRouter, HTTPException
from models.schemas import StatusReportRequest, StatusReportResponse
from services.openproject_service import openproject_service
from services.llm_service import llm_service
from services.rag_service import rag_service

router = APIRouter(prefix="/api/reports", tags=["reports"])


def _parse_due_date(value):
    if not value:
        return None
    try:
        return date.fromisoformat(str(value)[:10])
    except Exception:
        return None


def _build_assignee_analysis(tickets: list) -> list:
    today = date.today()
    closed_words = ("closed", "done", "resolved", "completed", "cancelled", "rejected")
    not_started_words = ("new", "open", "to do", "todo", "backlog")

    per_person = {}
    for t in tickets or []:
        assignee = t.get("assignee") or "Unassigned"
        status = (t.get("status") or "").lower()
        is_closed = any(word in status for word in closed_words)
        is_blocked = "blocked" in status or bool(t.get("is_blocked"))
        is_not_started = any(word in status for word in not_started_words)
        due_raw = t.get("due_date")
        due_date = _parse_due_date(due_raw)
        is_overdue = bool(due_date and due_date < today and not is_closed)

        item = per_person.setdefault(
            assignee,
            {
                "assignee": assignee,
                "total_tickets": 0,
                "open_tickets": 0,
                "blocked_tickets": 0,
                "overdue_tickets": 0,
                "not_started_tickets": 0,
                "risk_level": "Low",
                "next_actions": [],
                "problem_ticket_ids": [],
            },
        )
        item["total_tickets"] += 1
        if not is_closed:
            item["open_tickets"] += 1
        if is_blocked:
            item["blocked_tickets"] += 1
            item["problem_ticket_ids"].append(str(t.get("id")))
        if is_overdue:
            item["overdue_tickets"] += 1
            item["problem_ticket_ids"].append(str(t.get("id")))
        if is_not_started and not is_closed:
            item["not_started_tickets"] += 1

    analysis = []
    for assignee, item in per_person.items():
        score = item["blocked_tickets"] * 3 + item["overdue_tickets"] * 2 + max(0, item["open_tickets"] - 4)
        if score >= 5:
            item["risk_level"] = "High"
        elif score >= 2:
            item["risk_level"] = "Medium"
        else:
            item["risk_level"] = "Low"

        actions = []
        if item["blocked_tickets"] > 0:
            actions.append(f"Resolve blockers on {item['blocked_tickets']} ticket(s) today and escalate dependencies.")
        if item["overdue_tickets"] > 0:
            actions.append(f"Recover {item['overdue_tickets']} overdue ticket(s) with revised ETA by end of day.")
        if item["not_started_tickets"] > 0 and item["open_tickets"] > 0:
            actions.append("Start highest-priority not-started ticket and post kickoff update in comments.")
        if not actions:
            actions.append("Continue execution and close in-progress items; keep updates current.")

        dedup_ids = []
        seen = set()
        for tid in item["problem_ticket_ids"]:
            if tid and tid not in seen:
                seen.add(tid)
                dedup_ids.append(tid)
        item["problem_ticket_ids"] = dedup_ids[:6]
        item["next_actions"] = actions
        analysis.append(item)

    analysis.sort(key=lambda x: ({"High": 0, "Medium": 1, "Low": 2}.get(x["risk_level"], 3), -x["open_tickets"]))
    return analysis


@router.post("/generate")
async def generate_status_report(req: StatusReportRequest):
    try:
        tickets = await openproject_service.get_work_packages(req.project_id, req.version_id)
        sprint_info = await openproject_service.get_sprint_info(req.project_id)
        health = openproject_service.compute_sprint_health(tickets, sprint_info)

        # Build sprint data dict for LLM
        sprint_data = {
            "sprint_name": sprint_info.get("name", "Current Sprint"),
            "week_of": datetime.now().strftime("Week of %B %d, %Y"),
            "total_story_points": health.get("total_story_points"),
            "completed_story_points": health.get("completed_story_points"),
            "completion_percentage": health.get("completion_percentage"),
            "health_status": health.get("health_status"),
            "scope_creep_percentage": health.get("scope_creep_percentage"),
            "blocked_tickets": health.get("blocked_tickets"),
            "total_tickets": health.get("total_tickets"),
            "completed_tickets": health.get("completed_tickets"),
            "velocity_vs_average": health.get("velocity_vs_average"),
            "alerts": health.get("alerts", []),
        }

        # Historical comparison from RAG
        historical = ""
        if req.include_history:
            historical = rag_service.retrieve_for_document_generation(
                problem=f"sprint status report {sprint_info.get('name', '')}",
                doc_type="status_report",
            )

        # Blocker context with RAG patterns
        blocker_context = ""
        if health.get("blockers"):
            blocker_desc = " ".join(
                f"{b.get('id')} {b.get('subject', '')}" for b in health["blockers"]
            )
            blocker_context = rag_service.retrieve_blocker_patterns(blocker_desc)

        assignee_analysis = _build_assignee_analysis(tickets)

        full_report = await llm_service.generate_status_report(
            sprint_data=sprint_data,
            historical_comparison=historical,
            blocker_context=blocker_context,
            tickets=tickets,
            assignee_analysis=assignee_analysis,
        )

        return {
            "sprint_name": sprint_info.get("name", "Current Sprint"),
            "week_of": datetime.now().strftime("Week of %B %d, %Y"),
            "health_status": health.get("health_status"),
            "completion_percentage": health.get("completion_percentage"),
            "blocked_tickets": health.get("blocked_tickets"),
            "assignee_analysis": assignee_analysis,
            "full_report": full_report,
            "generated_at": datetime.now().isoformat(),
            "sprint_data": sprint_data,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/quick-summary")
async def quick_summary(project_id: str = None):
    try:
        tickets = await openproject_service.get_work_packages(project_id)
        sprint_info = await openproject_service.get_sprint_info(project_id)
        health = openproject_service.compute_sprint_health(tickets, sprint_info)
        return {
            "sprint_name": sprint_info.get("name"),
            "completion_percentage": health["completion_percentage"],
            "health_status": health["health_status"],
            "blocked_tickets": health["blocked_tickets"],
            "alerts_count": len(health["alerts"]),
            "scope_creep": health["scope_creep_percentage"],
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
