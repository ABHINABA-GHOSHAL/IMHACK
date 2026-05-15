from fastapi import APIRouter, HTTPException
from models.schemas import SendReminderRequest
from services.openproject_service import openproject_service
from services.reminder_service import (
    evaluate_and_generate_reminders,
    get_all_reminders,
    acknowledge_reminder,
    get_reminder_stats,
)

router = APIRouter(prefix="/api/reminders", tags=["reminders"])


@router.get("/")
async def list_reminders():
    reminders = get_all_reminders()
    return {"reminders": reminders, "total": len(reminders)}


@router.post("/evaluate")
async def evaluate_reminders(project_id: str = None):
    try:
        tickets = await openproject_service.get_work_packages(project_id)
        sprint_info = await openproject_service.get_sprint_info(project_id)
        health = openproject_service.compute_sprint_health(tickets, sprint_info)
        sprint_summary = f"{health['completion_percentage']}% completion velocity, {health['health_status']}"

        reminders = await evaluate_and_generate_reminders(tickets, sprint_summary)
        return {
            "generated": len(reminders),
            "reminders": reminders,
            "message": f"{len(reminders)} new reminder(s) generated",
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/{reminder_id}/acknowledge")
async def acknowledge(reminder_id: str):
    success = acknowledge_reminder(reminder_id)
    if not success:
        raise HTTPException(status_code=404, detail="Reminder not found")
    return {"success": True, "reminder_id": reminder_id}


@router.get("/stats")
async def reminder_stats():
    return get_reminder_stats()
