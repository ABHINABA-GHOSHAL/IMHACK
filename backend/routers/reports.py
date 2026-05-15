from datetime import datetime
from fastapi import APIRouter, HTTPException
from models.schemas import StatusReportRequest, StatusReportResponse
from services.openproject_service import openproject_service
from services.llm_service import llm_service
from services.rag_service import rag_service

router = APIRouter(prefix="/api/reports", tags=["reports"])


@router.post("/generate")
async def generate_status_report(req: StatusReportRequest):
    try:
        tickets = await openproject_service.get_work_packages(req.project_id)
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

        full_report = await llm_service.generate_status_report(
            sprint_data=sprint_data,
            historical_comparison=historical,
            blocker_context=blocker_context,
        )

        return {
            "sprint_name": sprint_info.get("name", "Current Sprint"),
            "week_of": datetime.now().strftime("Week of %B %d, %Y"),
            "health_status": health.get("health_status"),
            "completion_percentage": health.get("completion_percentage"),
            "blocked_tickets": health.get("blocked_tickets"),
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
