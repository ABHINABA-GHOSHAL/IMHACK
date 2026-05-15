from fastapi import APIRouter, HTTPException
from models.schemas import SprintHealthRequest, SprintHealthResponse
from services.openproject_service import openproject_service, MOCK_SPRINT_DATA
from services.llm_service import llm_service
from services.rag_service import rag_service

router = APIRouter(prefix="/api/sprint", tags=["sprint"])


@router.get("/health")
async def get_sprint_health(project_id: str = None):
    try:
        tickets = await openproject_service.get_work_packages(project_id)
        sprint_info = await openproject_service.get_sprint_info(project_id)
        health = openproject_service.compute_sprint_health(tickets, sprint_info)

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
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/tickets")
async def get_tickets(project_id: str = None):
    try:
        tickets = await openproject_service.get_work_packages(project_id)
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


@router.get("/retrospective")
async def generate_retrospective(project_id: str = None):
    try:
        tickets = await openproject_service.get_work_packages(project_id)
        sprint_info = await openproject_service.get_sprint_info(project_id)
        health = openproject_service.compute_sprint_health(tickets, sprint_info)
        retro = await llm_service.generate_retrospective(health, tickets)
        return {"retrospective": retro, "sprint_name": sprint_info.get("name")}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
