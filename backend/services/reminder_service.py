import json
import uuid
from datetime import datetime, timedelta
from typing import List, Dict, Optional
from services.openproject_service import openproject_service
from services.llm_service import llm_service

# In-memory reminder log (replace with DB in production)
_reminder_log: List[Dict] = []

REMINDER_RULES = {
    "due_2_days": lambda t: t.get("due_date") and _days_until(t["due_date"]) == 2,
    "due_today": lambda t: t.get("due_date") and _days_until(t["due_date"]) == 0,
    "overdue": lambda t: t.get("due_date") and _days_until(t["due_date"]) < 0 and t.get("status", "").lower() not in ("closed", "done", "resolved"),
    "blocker": lambda t: t.get("is_blocked", False),
    "stale": lambda t: t.get("status", "").lower() == "in progress",  # simplified
}


def _days_until(date_str: str) -> int:
    try:
        due = datetime.strptime(date_str, "%Y-%m-%d")
        delta = (due.date() - datetime.now().date()).days
        return delta
    except Exception:
        return 99


def _already_sent(ticket_id: str, reminder_type: str, within_hours: int = 24) -> bool:
    cutoff = datetime.now() - timedelta(hours=within_hours)
    for log in _reminder_log:
        if (
            log["ticket_id"] == ticket_id
            and log["reminder_type"] == reminder_type
            and datetime.fromisoformat(log["sent_at"]) > cutoff
        ):
            return True
    return False


def _log_reminder(reminder: Dict):
    reminder["sent_at"] = datetime.now().isoformat()
    reminder["id"] = str(uuid.uuid4())
    _reminder_log.append(reminder)


async def evaluate_and_generate_reminders(
    tickets: List[Dict],
    sprint_health_summary: str = "70% completion velocity",
) -> List[Dict]:
    reminders = []

    for ticket in tickets:
        assignee = ticket.get("assignee", "Team Member")
        ticket_id = ticket.get("id", "")
        ticket_subject = ticket.get("subject", "")

        for rtype, rule_fn in REMINDER_RULES.items():
            if not rule_fn(ticket):
                continue
            if _already_sent(ticket_id, rtype):
                continue

            # Generate contextual AI message
            dependencies = ""
            if ticket.get("blocking"):
                dependencies = f"This ticket is blocking: {', '.join(ticket['blocking'])}"
            else:
                dependencies = "No downstream dependencies identified"

            try:
                message = await llm_service.generate_contextual_reminder(
                    ticket_id=ticket_id,
                    ticket_subject=ticket_subject,
                    assignee_name=assignee,
                    reminder_type=rtype.replace("_", " "),
                    sprint_health=sprint_health_summary,
                    dependencies=dependencies,
                )
            except Exception:
                message = _fallback_reminder_message(rtype, assignee, ticket_id, ticket_subject)

            reminder = {
                "ticket_id": ticket_id,
                "ticket_subject": ticket_subject,
                "assignee_name": assignee,
                "assignee_email": ticket.get("assignee_email", ""),
                "reminder_type": rtype,
                "message": message,
                "channel": "in_app",
                "acknowledged": False,
            }
            _log_reminder(reminder)
            reminders.append(reminder)

    return reminders


def _fallback_reminder_message(rtype: str, assignee: str, ticket_id: str, subject: str) -> str:
    messages = {
        "due_2_days": f"Hi {assignee}, your ticket {ticket_id} ({subject}) is due in 2 days. Please update status or flag any blockers.",
        "due_today": f"Hi {assignee}, ticket {ticket_id} ({subject}) is due TODAY. Please complete or escalate immediately.",
        "overdue": f"Hi {assignee}, ticket {ticket_id} ({subject}) is overdue. Please update the status or raise a blocker.",
        "blocker": f"Hi {assignee}, ticket {ticket_id} ({subject}) is currently blocked and impacting downstream work. Please resolve or escalate.",
        "stale": f"Hi {assignee}, ticket {ticket_id} ({subject}) hasn't been updated in 48 hours. Please update the status.",
    }
    return messages.get(rtype, f"Reminder: Please update ticket {ticket_id}.")


def get_all_reminders() -> List[Dict]:
    return sorted(_reminder_log, key=lambda x: x.get("sent_at", ""), reverse=True)


def acknowledge_reminder(reminder_id: str) -> bool:
    for r in _reminder_log:
        if r.get("id") == reminder_id:
            r["acknowledged"] = True
            return True
    return False


def get_reminder_stats() -> Dict:
    total = len(_reminder_log)
    acknowledged = sum(1 for r in _reminder_log if r.get("acknowledged"))
    by_type = {}
    for r in _reminder_log:
        rtype = r.get("reminder_type", "unknown")
        by_type[rtype] = by_type.get(rtype, 0) + 1
    return {
        "total_sent": total,
        "acknowledged": acknowledged,
        "pending": total - acknowledged,
        "by_type": by_type,
    }
