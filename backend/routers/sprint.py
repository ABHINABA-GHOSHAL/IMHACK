import logging
from fastapi import APIRouter, HTTPException, UploadFile, File, Form
from models.schemas import SprintHealthRequest, SprintHealthResponse
from services.openproject_service import openproject_service, MOCK_SPRINT_DATA
from services.llm_service import llm_service
from services.rag_service import rag_service

log = logging.getLogger("sprint")

router = APIRouter(prefix="/api/sprint", tags=["sprint"])


@router.get("/health")
async def get_sprint_health(project_id: str = None, version_id: str = None):
    log.info("GET /sprint/health | project_id=%s | version_id=%s", project_id, version_id)
    try:
        tickets = await openproject_service.get_work_packages(project_id, version_id)
        log.info("/sprint/health → got %d ticket(s)", len(tickets))
        sprint_info = await openproject_service.get_sprint_info(project_id)
        health = openproject_service.compute_sprint_health(tickets, sprint_info)
        log.info("/sprint/health → health=%s completion=%.1f%% blockers=%d",
                 health["health_status"], health["completion_percentage"], health["blocked_tickets"])

        # Generate AI summary for blockers
        ai_summary = ""
        if health["blockers"]:
            blocker_desc = f"{len(health['blockers'])} ticket(s) blocked: " + ", ".join(
                f"{b.get('id')} ({b.get('subject', '')})" for b in health["blockers"]
            )
            patterns = rag_service.retrieve_blocker_patterns(blocker_desc)
            sprint_context = f"Sprint: {sprint_info.get('name')} | Completion: {health['completion_percentage']}% | Scope creep: {health['scope_creep_percentage']}%"
            try:
                ai_summary = await llm_service.generate_sprint_alert(
                    blocker_description=blocker_desc,
                    historical_patterns=patterns,
                    sprint_context=sprint_context,
                )
            except Exception as e:
                ai_summary = f"Blockers detected: {blocker_desc}. Review historical patterns for resolution guidance."

        log.info("/sprint/health → ai_summary length=%d chars", len(ai_summary))
        return {
            **health,
            "sprint_name": sprint_info.get("name", "Current Sprint"),
            "sprint_dates": {
                "start": sprint_info.get("start_date"),
                "end": sprint_info.get("end_date"),
            },
            "all_tickets": tickets,
            "ai_summary": ai_summary,
        }
    except Exception as e:
        log.error("/sprint/health failed: %s", e)
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/tickets")
async def get_tickets(project_id: str = None, version_id: str = None):
    try:
        tickets = await openproject_service.get_work_packages(project_id, version_id)
        return {"tickets": tickets, "total": len(tickets)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/projects")
async def get_projects():
    try:
        projects = await openproject_service.get_projects()
        return {"projects": projects}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/versions")
async def get_versions(project_id: str):
    try:
        versions = await openproject_service.get_versions(project_id)
        return {"versions": versions}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/users")
async def get_users(project_id: str = None):
    try:
        users = await openproject_service.get_users(project_id)
        return {"users": users}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/work-package-types")
async def get_work_package_types(project_id: str):
    try:
        types = await openproject_service.get_project_work_package_types(project_id)
        return {"types": types}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


CLOSED_STATUSES = {"closed", "done", "resolved", "completed", "cancelled", "rejected"}
BUG_TYPES = {"bug", "defect", "error", "fix"}


@router.get("/stats")
async def get_ticket_stats(project_id: str = None, version_id: str = None):
    """Return ticket category counts: open, closed, bugs open, bugs closed."""
    try:
        tickets = await openproject_service.get_work_packages(project_id, version_id)
        open_tickets, closed_tickets, bugs_open, bugs_closed = [], [], [], []
        for t in tickets:
            status_lower = (t.get("status") or "").lower()
            type_lower   = (t.get("type_name") or "").lower()
            is_closed = any(w in status_lower for w in CLOSED_STATUSES)
            is_bug    = any(w in type_lower   for w in BUG_TYPES)
            if is_closed:
                closed_tickets.append(t)
                if is_bug:
                    bugs_closed.append(t)
            else:
                open_tickets.append(t)
                if is_bug:
                    bugs_open.append(t)
        return {
            "open": len(open_tickets),
            "closed": len(closed_tickets),
            "bugs_open": len(bugs_open),
            "bugs_closed": len(bugs_closed),
            "bug_tickets_open": bugs_open,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/tickets/{ticket_id}/comment")
async def add_ai_comment(ticket_id: str, project_id: str = None):
    try:
        tickets = await openproject_service.get_work_packages(project_id)
        ticket = next((t for t in tickets if t["id"] == ticket_id), None)
        if not ticket:
            raise HTTPException(status_code=404, detail="Ticket not found")

        blocker_desc = f"Ticket {ticket_id} ({ticket.get('subject')}) is blocked"
        patterns = rag_service.retrieve_blocker_patterns(blocker_desc)
        sprint_info = await openproject_service.get_sprint_info(project_id)
        health = openproject_service.compute_sprint_health(tickets, sprint_info)

        comment = await llm_service.generate_sprint_alert(
            blocker_description=blocker_desc,
            historical_patterns=patterns,
            sprint_context=f"Completion: {health['completion_percentage']}%",
        )
        success = await openproject_service.add_comment_to_ticket(ticket_id, comment)
        return {"success": success, "comment": comment}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/tickets/{ticket_id}/comment/user")
async def add_user_comment(ticket_id: str, comment: str = Form(...)):
    try:
        if not comment.strip():
            raise HTTPException(status_code=400, detail="Comment cannot be empty")
        success = await openproject_service.add_comment_to_ticket(ticket_id, comment)
        return {"success": success, "comment": comment}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/tickets/{ticket_id}/attachment")
async def attach_file_to_ticket(ticket_id: str, file: UploadFile = File(...)):
    try:
        content = await file.read()
        if not content:
            raise HTTPException(status_code=400, detail="File is empty")
        ok = await openproject_service.add_attachment_to_ticket(
            ticket_id=ticket_id,
            filename=file.filename or "attachment.bin",
            content=content,
            content_type=file.content_type or "application/octet-stream",
        )
        return {"success": ok, "filename": file.filename}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/retrospective")
async def generate_retrospective(project_id: str = None, version_id: str = None):
    try:
        tickets = await openproject_service.get_work_packages(project_id, version_id)
        sprint_info = await openproject_service.get_sprint_info(project_id)
        selected_version_name = None
        if version_id and project_id:
            versions = await openproject_service.get_versions(project_id)
            selected_version = next((v for v in versions if str(v.get("id")) == str(version_id)), None)
            selected_version_name = selected_version.get("name") if selected_version else None
        health = openproject_service.compute_sprint_health(tickets, sprint_info)
        sprint_name = selected_version_name or sprint_info.get("name") or "Current Sprint"

        generation_mode = "ai"
        fallback_reason = None
        try:
            retro = await llm_service.generate_retrospective(health, tickets, sprint_name)
        except Exception as llm_err:
            log.warning("/sprint/retrospective LLM failed, using fallback: %s", llm_err)
            generation_mode = "fallback"
            fallback_reason = str(llm_err)
            blocked = int(health.get("blocked_tickets", 0) or 0)
            completion = float(health.get("completion_percentage", 0) or 0)
            total = int(health.get("total_tickets", 0) or 0)
            done = int(health.get("completed_tickets", 0) or 0)
            top_blockers = [
                f"- {b.get('id', 'N/A')}: {b.get('subject', 'No subject')}"
                for b in (health.get("blockers") or [])[:5]
            ]
            blocker_md = "\n".join(top_blockers) if top_blockers else "- No active blockers identified"
            retro = (
                f"# Sprint Retrospective - {sprint_name}\n\n"
                f"## Snapshot\n"
                f"- Health: **{health.get('health_status', 'Unknown')}**\n"
                f"- Completion: **{completion:.1f}%** ({done}/{total} tickets closed)\n"
                f"- Blocked Tickets: **{blocked}**\n"
                f"- Scope Creep: **{health.get('scope_creep_percentage', 0)}%**\n\n"
                f"## What Went Well\n"
                f"- Team maintained progress on active work items.\n"
                f"- Ticket visibility and assignee ownership are available across the sprint board.\n\n"
                f"## What Needs Attention\n"
                f"{blocker_md}\n\n"
                f"## Action Plan\n"
                f"- Prioritize blocker resolution for highest-impact tickets first.\n"
                f"- Recheck bucket scope to reduce scope creep in the next cycle.\n"
                f"- Add daily updates on delayed tasks and unassigned work.\n"
            )

        return {
            "retrospective": retro,
            "sprint_name": sprint_name,
            "project_id": project_id,
            "version_id": version_id,
            "generation_mode": generation_mode,
            "fallback_reason": fallback_reason,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/tickets/{ticket_id}")
async def get_ticket_detail(ticket_id: str):
    try:
        ticket = await openproject_service.get_work_package(ticket_id)
        if not ticket:
            raise HTTPException(status_code=404, detail="Ticket not found")
        comments = await openproject_service.get_ticket_comments(ticket_id)
        return {"ticket": ticket, "comments": comments}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/tickets/{ticket_id}/analysis")
async def analyze_ticket(ticket_id: str, project_id: str = None, version_id: str = None):
    try:
        ticket = await openproject_service.get_work_package(ticket_id)
        if not ticket:
            raise HTTPException(status_code=404, detail="Ticket not found")
        comments = await openproject_service.get_ticket_comments(ticket_id)
        project_name = None
        bucket_name = None

        if project_id:
            projects = await openproject_service.get_projects()
            project = next((p for p in projects if str(p.get("id")) == str(project_id)), None)
            project_name = project.get("name") if project else None

        if version_id and project_id:
            versions = await openproject_service.get_versions(project_id)
            version = next((v for v in versions if str(v.get("id")) == str(version_id)), None)
            bucket_name = version.get("name") if version else None

        analysis = await llm_service.analyze_ticket(
            ticket=ticket,
            comments=comments,
            project_name=project_name or "Current Project",
            bucket_name=bucket_name or ticket.get("version_name") or "Current Bucket",
        )
        return {
            "ticket": ticket,
            "comments": comments,
            "analysis": analysis,
            "project_name": project_name,
            "bucket_name": bucket_name,
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
