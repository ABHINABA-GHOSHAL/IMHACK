import httpx
import base64
import json
from typing import List, Dict, Optional
from datetime import datetime, timedelta
from config import OPENPROJECT_BASE_URL, OPENPROJECT_API_TOKEN

# Mock data for demo when OpenProject is not configured
MOCK_SPRINT_DATA = {
    "project": {"id": "1", "name": "IndiaMart Platform Q2"},
    "tickets": [
        {"id": "IM-4521", "subject": "Implement Payments Webhook Handler", "status": "In Progress", "assignee": "Rahul Sharma", "assignee_email": "rahul@example.com", "story_points": 5, "due_date": (datetime.now() + timedelta(days=1)).strftime("%Y-%m-%d"), "is_blocked": True, "blocking": ["IM-4523", "IM-4525"]},
        {"id": "IM-4522", "subject": "Design Mobile Checkout Screens", "status": "In Review", "assignee": "Priya Mehta", "assignee_email": "priya@example.com", "story_points": 3, "due_date": (datetime.now() + timedelta(days=2)).strftime("%Y-%m-%d"), "is_blocked": False, "blocking": []},
        {"id": "IM-4523", "subject": "Integrate Payment Gateway Frontend", "status": "New", "assignee": "Vikram Patel", "assignee_email": "vikram@example.com", "story_points": 4, "due_date": (datetime.now() + timedelta(days=3)).strftime("%Y-%m-%d"), "is_blocked": True, "blocking": []},
        {"id": "IM-4524", "subject": "Write API Documentation", "status": "Closed", "assignee": "Ananya Singh", "assignee_email": "ananya@example.com", "story_points": 2, "due_date": (datetime.now() - timedelta(days=1)).strftime("%Y-%m-%d"), "is_blocked": False, "blocking": []},
        {"id": "IM-4525", "subject": "QA Testing - Payment Flow", "status": "New", "assignee": "Dev Kumar", "assignee_email": "dev@example.com", "story_points": 3, "due_date": (datetime.now() + timedelta(days=4)).strftime("%Y-%m-%d"), "is_blocked": True, "blocking": []},
        {"id": "IM-4526", "subject": "Performance Testing - Load", "status": "In Progress", "assignee": "Riya Joshi", "assignee_email": "riya@example.com", "story_points": 3, "due_date": (datetime.now() + timedelta(days=2)).strftime("%Y-%m-%d"), "is_blocked": False, "blocking": []},
        {"id": "IM-4527", "subject": "Setup CI/CD Pipeline", "status": "Closed", "assignee": "Arjun Nair", "assignee_email": "arjun@example.com", "story_points": 5, "due_date": (datetime.now() - timedelta(days=2)).strftime("%Y-%m-%d"), "is_blocked": False, "blocking": []},
        {"id": "IM-4528", "subject": "Security Audit - Payment Module", "status": "In Progress", "assignee": "Rahul Sharma", "assignee_email": "rahul@example.com", "story_points": 4, "due_date": (datetime.now() + timedelta(days=5)).strftime("%Y-%m-%d"), "is_blocked": False, "blocking": []},
    ],
    "sprint": {
        "name": "Sprint 23",
        "start_date": (datetime.now() - timedelta(days=5)).strftime("%Y-%m-%d"),
        "end_date": (datetime.now() + timedelta(days=9)).strftime("%Y-%m-%d"),
        "initial_story_points": 25,
        "current_story_points": 29,
        "historical_avg_velocity": 85,
    }
}


class OpenProjectService:
    def __init__(self):
        self.base_url = OPENPROJECT_BASE_URL
        self.token = OPENPROJECT_API_TOKEN
        self._use_mock = not bool(self.token)

    def _get_headers(self) -> Dict:
        credentials = base64.b64encode(f"apikey:{self.token}".encode()).decode()
        return {
            "Authorization": f"Basic {credentials}",
            "Content-Type": "application/json",
        }

    async def get_projects(self) -> List[Dict]:
        if self._use_mock:
            return [{"id": "1", "name": "IndiaMart Platform Q2", "identifier": "q2-platform"}]
        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.get(f"{self.base_url}/projects", headers=self._get_headers())
            resp.raise_for_status()
            data = resp.json()
            return [
                {"id": str(p["id"]), "name": p["name"], "identifier": p["identifier"]}
                for p in data.get("_embedded", {}).get("elements", [])
            ]

    async def get_work_packages(self, project_id: Optional[str] = None) -> List[Dict]:
        if self._use_mock:
            return MOCK_SPRINT_DATA["tickets"]
        params = {"pageSize": 100}
        if project_id:
            url = f"{self.base_url}/projects/{project_id}/work_packages"
        else:
            url = f"{self.base_url}/work_packages"

        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.get(url, headers=self._get_headers(), params=params)
            resp.raise_for_status()
            data = resp.json()
            packages = []
            for wp in data.get("_embedded", {}).get("elements", []):
                assignee = wp.get("_embedded", {}).get("assignee")
                packages.append({
                    "id": f"IM-{wp['id']}",
                    "subject": wp.get("subject", ""),
                    "status": wp.get("_embedded", {}).get("status", {}).get("name", "Unknown"),
                    "assignee": assignee.get("name") if assignee else None,
                    "assignee_email": assignee.get("email") if assignee else None,
                    "story_points": wp.get("storyPoints"),
                    "due_date": wp.get("dueDate"),
                    "is_blocked": False,
                    "blocking": [],
                })
            return packages

    async def get_sprint_info(self, project_id: Optional[str] = None) -> Dict:
        if self._use_mock:
            return MOCK_SPRINT_DATA["sprint"]
        return {
            "name": "Current Sprint",
            "start_date": datetime.now().strftime("%Y-%m-%d"),
            "end_date": (datetime.now() + timedelta(days=14)).strftime("%Y-%m-%d"),
            "initial_story_points": 0,
            "current_story_points": 0,
            "historical_avg_velocity": 80,
        }

    async def create_work_package(
        self,
        project_id: str,
        title: str,
        description: str,
        assignee_id: Optional[str] = None,
        due_date: Optional[str] = None,
        priority: str = "Normal",
    ) -> Dict:
        if self._use_mock:
            import random
            mock_id = random.randint(4530, 5000)
            return {"id": f"IM-{mock_id}", "subject": title, "status": "New", "created": True}

        payload = {
            "subject": title,
            "description": {"raw": description},
            "_links": {
                "project": {"href": f"/api/v3/projects/{project_id}"},
            },
        }
        if assignee_id:
            payload["_links"]["assignee"] = {"href": f"/api/v3/users/{assignee_id}"}
        if due_date:
            payload["dueDate"] = due_date

        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.post(
                f"{self.base_url}/work_packages",
                headers=self._get_headers(),
                json=payload,
            )
            resp.raise_for_status()
            data = resp.json()
            return {"id": f"IM-{data['id']}", "subject": data["subject"], "status": "New", "created": True}

    async def add_comment_to_ticket(self, ticket_id: str, comment: str) -> bool:
        if self._use_mock:
            print(f"[Mock] Comment added to {ticket_id}: {comment[:100]}")
            return True
        wp_id = ticket_id.replace("IM-", "")
        payload = {"comment": {"raw": comment}}
        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.post(
                f"{self.base_url}/work_packages/{wp_id}/activities",
                headers=self._get_headers(),
                json=payload,
            )
            return resp.status_code in (200, 201)

    async def get_users(self, project_id: Optional[str] = None) -> List[Dict]:
        if self._use_mock:
            return [
                {"id": "1", "name": "Rahul Sharma", "email": "rahul@example.com"},
                {"id": "2", "name": "Priya Mehta", "email": "priya@example.com"},
                {"id": "3", "name": "Vikram Patel", "email": "vikram@example.com"},
                {"id": "4", "name": "Ananya Singh", "email": "ananya@example.com"},
                {"id": "5", "name": "Dev Kumar", "email": "dev@example.com"},
            ]
        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.get(f"{self.base_url}/users", headers=self._get_headers())
            resp.raise_for_status()
            data = resp.json()
            return [
                {"id": str(u["id"]), "name": u.get("name"), "email": u.get("email")}
                for u in data.get("_embedded", {}).get("elements", [])
            ]

    def compute_sprint_health(self, tickets: List[Dict], sprint_info: Dict) -> Dict:
        total = len(tickets)
        closed = sum(1 for t in tickets if t.get("status", "").lower() in ("closed", "done", "resolved"))
        blocked = [t for t in tickets if t.get("is_blocked", False)]

        total_sp = sum(t.get("story_points") or 0 for t in tickets)
        completed_sp = sum(t.get("story_points") or 0 for t in tickets if t.get("status", "").lower() in ("closed", "done", "resolved"))

        completion_pct = round((completed_sp / total_sp * 100) if total_sp > 0 else 0, 1)
        initial_sp = sprint_info.get("initial_story_points", total_sp)
        scope_creep = round(((total_sp - initial_sp) / initial_sp * 100) if initial_sp > 0 else 0, 1)
        hist_avg = sprint_info.get("historical_avg_velocity", 80)
        velocity_ratio = round((completion_pct / hist_avg * 100) if hist_avg > 0 else 100, 1)

        if completion_pct >= hist_avg * 0.9:
            health = "On Track"
        elif completion_pct >= hist_avg * 0.7:
            health = "At Risk"
        else:
            health = "Critical"

        alerts = []
        if len(blocked) > 0:
            alerts.append(f"{len(blocked)} ticket(s) blocked — immediate action required")
        if scope_creep > 20:
            alerts.append(f"Scope creep at {scope_creep}% — consider deferring tickets")
        if completion_pct < hist_avg * 0.7:
            alerts.append("Sprint velocity critically below average — escalation needed")

        return {
            "total_tickets": total,
            "completed_tickets": closed,
            "blocked_tickets": len(blocked),
            "total_story_points": total_sp,
            "completed_story_points": completed_sp,
            "completion_percentage": completion_pct,
            "health_status": health,
            "scope_creep_percentage": scope_creep,
            "velocity_vs_average": velocity_ratio,
            "blockers": blocked,
            "alerts": alerts,
            "project_name": sprint_info.get("name", "Current Sprint"),
        }


openproject_service = OpenProjectService()
