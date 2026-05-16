import httpx
import base64
import json
import logging
import re
import os
from typing import List, Dict, Optional
from datetime import datetime, timedelta
from dotenv import dotenv_values
from config import OPENPROJECT_BASE_URL, OPENPROJECT_API_TOKEN

log = logging.getLogger("openproject")
logging.basicConfig(
    level=logging.INFO,
    format="[%(asctime)s] [%(name)s] %(levelname)s — %(message)s",
    datefmt="%H:%M:%S",
)

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
        log.info("OpenProjectService init | base_url=%s | mock=%s", self.base_url, self._use_mock)

    def _refresh_auth_from_env_if_needed(self) -> None:
        """Allow long-running processes to recover from stale/empty token at startup."""
        if not self._use_mock and self.token:
            return

        env_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), ".env")
        if not os.path.exists(env_path):
            return

        try:
            values = dotenv_values(env_path)
            token = (values.get("OPENPROJECT_API_TOKEN") or "").strip()
            base_url = (values.get("OPENPROJECT_BASE_URL") or "").strip()
            if token:
                self.token = token
                self._use_mock = False
                if base_url:
                    self.base_url = base_url
                log.info("OpenProjectService auth refreshed from .env | mock=%s", self._use_mock)
        except Exception as e:
            log.warning("OpenProjectService auth refresh failed: %s", e)

    def _get_headers(self) -> Dict:
        credentials = base64.b64encode(f"apikey:{self.token}".encode()).decode()
        return {
            "Authorization": f"Basic {credentials}",
            "Content-Type": "application/json",
        }

    async def get_projects(self) -> List[Dict]:
        self._refresh_auth_from_env_if_needed()
        log.info("get_projects | mock=%s", self._use_mock)
        if self._use_mock:
            projects = [{"id": "1", "name": "IndiaMart Platform Q2", "identifier": "q2-platform"}]
            log.info("get_projects → returned %d mock project(s)", len(projects))
            return projects
        async with httpx.AsyncClient(timeout=30.0) as client:
            params = {"pageSize": 500}
            resp = await client.get(f"{self.base_url}/projects", headers=self._get_headers(), params=params)
            log.info("get_projects → HTTP %d from %s/projects", resp.status_code, self.base_url)
            if resp.status_code != 200:
                log.error("get_projects failed | status=%d | body=%s", resp.status_code, resp.text[:500])
                resp.raise_for_status()
            data = resp.json()
            elements = data.get("_embedded", {}).get("elements", [])
            log.info("get_projects → total in response=%s elements=%d", data.get("total", "?"), len(elements))
            projects = [
                {
                    "id": str(p["id"]),
                    "name": p.get("name", f"Project {p['id']}"),
                    "identifier": p.get("identifier", str(p["id"])),
                }
                for p in elements
            ]
            log.info("get_projects → returning %d project(s)", len(projects))
            return projects

    async def get_versions(self, project_id: str) -> List[Dict]:
        """Return versions (sprints/buckets) for a project."""
        self._refresh_auth_from_env_if_needed()
        log.info("get_versions | project_id=%s | mock=%s", project_id, self._use_mock)
        if self._use_mock:
            versions = [
                {"id": "1", "name": "Sprint 23", "status": "open"},
                {"id": "2", "name": "Sprint 22", "status": "closed"},
                {"id": "3", "name": "Backlog",   "status": "open"},
            ]
            log.info("get_versions → returned %d mock version(s)", len(versions))
            return versions
        async with httpx.AsyncClient(timeout=30.0) as client:
            url = f"{self.base_url}/projects/{project_id}/versions"
            log.info("get_versions → GET %s", url)
            resp = await client.get(url, headers=self._get_headers())
            resp.raise_for_status()
            data = resp.json()
            versions = [
                {"id": str(v["id"]), "name": v["name"], "status": v.get("status", "open")}
                for v in data.get("_embedded", {}).get("elements", [])
            ]
            log.info("get_versions → fetched %d version(s)", len(versions))
            return versions

    async def get_project_work_package_types(self, project_id: str) -> List[Dict]:
        """Return allowed work package categories/types for a project."""
        log.info("get_project_work_package_types | project_id=%s | mock=%s", project_id, self._use_mock)
        if self._use_mock:
            return [
                {"id": "1", "name": "Task", "color": "#6b7280", "is_default": True},
                {"id": "2", "name": "Bug", "color": "#ef4444", "is_default": False},
                {"id": "3", "name": "Feature", "color": "#10b981", "is_default": False},
            ]
        async with httpx.AsyncClient(timeout=30.0) as client:
            url = f"{self.base_url}/projects/{project_id}/types"
            resp = await client.get(url, headers=self._get_headers())
            resp.raise_for_status()
            data = resp.json()
            elements = data.get("_embedded", {}).get("elements", [])
            types = [
                {
                    "id": str(t.get("id")),
                    "name": t.get("name", "Task"),
                    "color": t.get("color"),
                    "is_default": bool(t.get("isDefault", False)),
                }
                for t in elements
                if t.get("name")
            ]
            return types

    async def get_work_packages(
        self,
        project_id: Optional[str] = None,
        version_id: Optional[str] = None,
    ) -> List[Dict]:
        self._refresh_auth_from_env_if_needed()
        log.info("get_work_packages | project_id=%s | version_id=%s | mock=%s", project_id, version_id, self._use_mock)
        if self._use_mock:
            tickets = MOCK_SPRINT_DATA["tickets"]
            log.info("get_work_packages → returned %d mock ticket(s)", len(tickets))
            return tickets
        params: Dict = {"pageSize": 100, "offset": 1}
        if version_id:
            import json as _json
            params["filters"] = _json.dumps(
                [{"version": {"operator": "=", "values": [version_id]}}]
            )
        if project_id:
            url = f"{self.base_url}/projects/{project_id}/work_packages"
        else:
            url = f"{self.base_url}/work_packages"

        def _map_wp(wp: Dict) -> Dict:
            assignee = wp.get("_embedded", {}).get("assignee")
            assignee_link = wp.get("_links", {}).get("assignee") or {}
            assignee_name = (assignee or {}).get("name") or assignee_link.get("title")
            assignee_email = (assignee or {}).get("email")
            status = wp.get("_embedded", {}).get("status")
            status_link = wp.get("_links", {}).get("status") or {}
            status_name = (status or {}).get("name") or status_link.get("title") or "Unknown"
            version = wp.get("_embedded", {}).get("version")
            version_link = wp.get("_links", {}).get("version") or {}
            version_href = version_link.get("href")
            resolved_version_id = (
                str((version or {}).get("id"))
                if (version or {}).get("id") is not None
                else (version_href.rstrip("/").split("/")[-1] if version_href else None)
            )
            version_name = (version or {}).get("name") or version_link.get("title")
            type_emb = wp.get("_embedded", {}).get("type") or {}
            type_link2 = wp.get("_links", {}).get("type") or {}
            type_name = type_emb.get("name") or type_link2.get("title") or "Task"
            return {
                "id": f"IM-{wp['id']}",
                "subject": wp.get("subject", ""),
                "status": status_name,
                "assignee": assignee_name,
                "assignee_email": assignee_email,
                "story_points": wp.get("storyPoints"),
                "due_date": wp.get("dueDate"),
                "is_blocked": False,
                "blocking": [],
                "version_id": resolved_version_id,
                "version_name": version_name,
                "type_name": type_name,
                "created_at": wp.get("createdAt"),
                "updated_at": wp.get("updatedAt"),
            }

        log.info("get_work_packages → GET %s params=%s", url, params)
        async with httpx.AsyncClient(timeout=30.0) as client:
            packages = []
            while True:
                resp = await client.get(url, headers=self._get_headers(), params=params)
                resp.raise_for_status()
                data = resp.json()
                elements = data.get("_embedded", {}).get("elements", [])
                total_in_resp = data.get("total", "?")
                log.info("get_work_packages → page offset=%s fetched=%d total=%s", params.get("offset"), len(elements), total_in_resp)

                for wp in elements:
                    packages.append(_map_wp(wp))

                if not elements:
                    break

                if isinstance(total_in_resp, int) and len(packages) >= total_in_resp:
                    break

                params["offset"] = int(params.get("offset", 1)) + len(elements)

                if len(elements) < int(params.get("pageSize", 100)):
                    break

            log.info("get_work_packages → parsed %d work package(s)", len(packages))
            return packages

    async def get_work_package(self, ticket_id: str) -> Optional[Dict]:
        log.info("get_work_package | ticket_id=%s | mock=%s", ticket_id, self._use_mock)
        if self._use_mock:
            ticket = next((t for t in MOCK_SPRINT_DATA["tickets"] if t["id"] == ticket_id), None)
            if not ticket:
                return None
            return {
                **ticket,
                "description": f"Mock detail for {ticket_id}",
                "created_at": datetime.now().isoformat(),
                "updated_at": datetime.now().isoformat(),
            }

        def _extract_text(value):
            if isinstance(value, dict):
                return value.get("raw") or value.get("html") or value.get("text") or ""
            return value or ""

        wp_id = ticket_id.replace("IM-", "")
        url = f"{self.base_url}/work_packages/{wp_id}"
        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.get(url, headers=self._get_headers())
            resp.raise_for_status()
            data = resp.json()

        assignee = data.get("_embedded", {}).get("assignee") or {}
        assignee_link = data.get("_links", {}).get("assignee") or {}
        status = data.get("_embedded", {}).get("status") or {}
        status_link = data.get("_links", {}).get("status") or {}
        version = data.get("_embedded", {}).get("version") or {}
        version_link = data.get("_links", {}).get("version") or {}
        type_emb = data.get("_embedded", {}).get("type") or {}
        type_link = data.get("_links", {}).get("type") or {}
        description = (
            _extract_text(data.get("description"))
            or _extract_text(data.get("_embedded", {}).get("description"))
            or _extract_text(data.get("_links", {}).get("description"))
        )
        subject = data.get("subject") or data.get("name") or ""

        return {
            "id": f"IM-{data.get('id')}",
            "subject": subject,
            "description": description,
            "status": (status or {}).get("name") or status_link.get("title") or "Unknown",
            "assignee": (assignee or {}).get("name") or assignee_link.get("title"),
            "assignee_email": (assignee or {}).get("email"),
            "story_points": data.get("storyPoints"),
            "due_date": data.get("dueDate"),
            "type_name": (type_emb or {}).get("name") or type_link.get("title") or "Task",
            "version_name": (version or {}).get("name") or (version_link or {}).get("title"),
            "created_at": data.get("createdAt"),
            "updated_at": data.get("updatedAt"),
            "raw": data,
        }

    async def get_ticket_comments(self, ticket_id: str) -> List[Dict]:
        log.info("get_ticket_comments | ticket_id=%s | mock=%s", ticket_id, self._use_mock)
        if self._use_mock:
            return [
                {"author": "Rahul Sharma", "created_at": datetime.now().isoformat(), "comment": "Mock note: progress is blocked on dependency X."},
                {"author": "Priya Mehta", "created_at": datetime.now().isoformat(), "comment": "Mock note: design approved and handed over."},
            ]

        def _find_text(value):
            if isinstance(value, str):
                text = value.strip()
                if text.lower() in {"markdown", "plain", "html", "textile"}:
                    return ""
                return text
            if isinstance(value, dict):
                for key in ("raw", "text", "html", "value", "title", "name", "displayString", "content"):
                    text = value.get(key)
                    if isinstance(text, str) and text.strip():
                        cleaned = text.strip()
                        if cleaned.lower() not in {"markdown", "plain", "html", "textile"}:
                            return cleaned
                for key, nested in value.items():
                    if str(key).lower() in {"format", "mimetype", "contenttype", "_type", "href", "id", "lockversion"}:
                        continue
                    text = _find_text(nested)
                    if text:
                        return text
            if isinstance(value, list):
                parts = []
                for item in value:
                    text = _find_text(item)
                    if text:
                        parts.append(text)
                return "; ".join(parts)
            return ""

        def _extract_text(value):
            return _find_text(value)

        wp_id = ticket_id.replace("IM-", "")
        url = f"{self.base_url}/work_packages/{wp_id}/activities"
        user_name_cache: Dict[str, str] = {}

        async def _resolve_user_name(href: Optional[str]) -> Optional[str]:
            if not href:
                return None
            if href in user_name_cache:
                return user_name_cache[href]
            if href.startswith("http://") or href.startswith("https://"):
                full_url = href
            elif href.startswith("/api/v3/"):
                full_url = f"{self.base_url}{href[len('/api/v3'):]}"
            elif href.startswith("/"):
                full_url = f"{self.base_url}{href}"
            else:
                full_url = f"{self.base_url}/{href}"
            try:
                async with httpx.AsyncClient(timeout=30.0) as user_client:
                    user_resp = await user_client.get(full_url, headers=self._get_headers())
                    user_resp.raise_for_status()
                    user_data = user_resp.json()
                name = _extract_text(user_data.get("name"))
                if name:
                    user_name_cache[href] = name
                    return name
            except Exception:
                return None
            return None

        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.get(url, headers=self._get_headers(), params={"pageSize": 100})
            resp.raise_for_status()
            data = resp.json()

        activities = []
        elements = data.get("_embedded", {}).get("elements", []) if isinstance(data, dict) else data
        for item in elements or []:
            format_value = _extract_text(item.get("format")) or _extract_text(item.get("contentType")) or _extract_text(item.get("mimeType"))
            details = item.get("details") or []
            detail_bits = []
            for detail in details:
                detail_raw = _extract_text(detail.get("raw"))
                if detail_raw:
                    detail_bits.append(detail_raw)
                    continue
                prop = _extract_text(detail.get("property")) or _extract_text(detail.get("name")) or _extract_text(detail.get("propertyName"))
                old_value = _extract_text(detail.get("oldValue")) or _extract_text(detail.get("oldData"))
                new_value = _extract_text(detail.get("newValue")) or _extract_text(detail.get("newData")) or _extract_text(detail.get("value")) or _extract_text(detail.get("rawValue"))
                if prop and (old_value or new_value):
                    if old_value and new_value and old_value != new_value:
                        detail_bits.append(f"{prop} changed from {old_value} to {new_value}")
                    else:
                        detail_bits.append(f"{prop} set to {new_value or old_value}")

            text = (
                _extract_text(item.get("comment"))
                or _extract_text(item.get("message"))
                or _extract_text(item.get("description"))
                or _extract_text(item.get("notes"))
                or _extract_text(item.get("text"))
            )
            if text and format_value and text.strip().lower() == format_value.strip().lower():
                text = ""
            if not text:
                if detail_bits:
                    text = "\n".join(f"- {bit}" for bit in detail_bits)
            if not text:
                activity_type = _extract_text(item.get("type")) or _extract_text(item.get("action"))
                subject = _extract_text(item.get("subject"))
                if activity_type and subject:
                    text = f"{activity_type}: {subject}"
                elif subject:
                    text = subject
            author = (
                item.get("_embedded", {}).get("user", {}).get("name")
                or item.get("_embedded", {}).get("author", {}).get("name")
                or item.get("_links", {}).get("user", {}).get("title")
                or item.get("_links", {}).get("author", {}).get("title")
                or item.get("user", {}).get("name")
                or item.get("author", {}).get("name")
                or "Unknown"
            )
            if author == "Unknown":
                user_href = item.get("_links", {}).get("user", {}).get("href")
                resolved_user = await _resolve_user_name(user_href)
                if resolved_user:
                    author = resolved_user
            if author == "Unknown":
                title = _extract_text(item.get("title")) or _extract_text(item.get("_links", {}).get("self", {}).get("title"))
                if title:
                    m = re.search(r"\bby\s+(.+)$", title, flags=re.IGNORECASE)
                    if m:
                        author = m.group(1).strip()
                    elif "created" in title.lower() or "updated" in title.lower():
                        author = title.strip()
            if text:
                activities.append({
                    "author": author,
                    "created_at": item.get("createdAt") or item.get("created_at"),
                    "comment": text,
                })
        if not activities:
            try:
                resp = await client.get(f"{self.base_url}/work_packages/{wp_id}", headers=self._get_headers())
                resp.raise_for_status()
                data = resp.json()
                notes = _extract_text(data.get("description")) or _extract_text(data.get("_embedded", {}).get("description"))
                if notes:
                    activities.append({
                        "author": "System",
                        "created_at": data.get("updatedAt") or data.get("createdAt"),
                        "comment": notes,
                    })
            except Exception as fallback_err:
                log.info("get_ticket_comments fallback failed for %s: %s", ticket_id, fallback_err)
        return activities

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
        responsible_id: Optional[str] = None,
        due_date: Optional[str] = None,
        start_date: Optional[str] = None,
        estimated_hours: Optional[float] = None,
        priority: str = "Normal",
        version_id: Optional[str] = None,
        work_package_type: Optional[str] = "Task",
    ) -> Dict:
        log.info("create_work_package | project=%s | version=%s | title=%r | mock=%s", project_id, version_id, title[:60], self._use_mock)
        if self._use_mock:
            import random
            mock_id = random.randint(4530, 5000)
            result = {"id": f"IM-{mock_id}", "subject": title, "status": "New", "created": True}
            log.info("create_work_package → mock created %s", result["id"])
            return result

        payload = {
            "subject": title,
            "description": {"raw": description},
            "_links": {
                "project": {"href": f"/api/v3/projects/{project_id}"},
            },
        }
        if assignee_id:
            payload["_links"]["assignee"] = {"href": f"/api/v3/users/{assignee_id}"}
        if responsible_id:
            payload["_links"]["responsible"] = {"href": f"/api/v3/users/{responsible_id}"}
        if version_id:
            payload["_links"]["version"] = {"href": f"/api/v3/versions/{version_id}"}
        if due_date:
            payload["dueDate"] = due_date
        if start_date:
            payload["startDate"] = start_date
        if estimated_hours is not None:
            try:
                hours = max(0.0, float(estimated_hours))
                payload["estimatedTime"] = f"PT{int(round(hours))}H"
            except Exception:
                pass

        async with httpx.AsyncClient(timeout=30.0) as client:
            # Resolve type by name (Task/Bug/Feature/...) from project type catalog.
            if work_package_type:
                try:
                    types_resp = await client.get(
                        f"{self.base_url}/projects/{project_id}/types",
                        headers=self._get_headers(),
                    )
                    types_resp.raise_for_status()
                    types_data = types_resp.json()
                    desired = str(work_package_type).strip().lower()
                    matched_href = None
                    for tp in types_data.get("_embedded", {}).get("elements", []):
                        tp_name = str(tp.get("name", "")).strip().lower()
                        if tp_name == desired:
                            matched_href = f"/api/v3/types/{tp['id']}"
                            break
                    if not matched_href and desired == "task":
                        for tp in types_data.get("_embedded", {}).get("elements", []):
                            tp_name = str(tp.get("name", "")).strip().lower()
                            if "task" in tp_name or "story" in tp_name:
                                matched_href = f"/api/v3/types/{tp['id']}"
                                break
                    if matched_href:
                        payload["_links"]["type"] = {"href": matched_href}
                except Exception as type_err:
                    log.warning("create_work_package → type resolution failed for %r: %s", work_package_type, type_err)

            resp = await client.post(
                f"{self.base_url}/work_packages",
                headers=self._get_headers(),
                json=payload,
            )
            resp.raise_for_status()
            data = resp.json()
            result = {"id": f"IM-{data['id']}", "subject": data["subject"], "status": "New", "created": True}
            log.info("create_work_package → real ticket created %s in project %s version %s", result["id"], project_id, version_id)
            return result

    async def add_comment_to_ticket(self, ticket_id: str, comment: str) -> bool:
        log.info("add_comment | ticket=%s | mock=%s", ticket_id, self._use_mock)
        if self._use_mock:
            log.info("add_comment → mock comment added to %s: %s", ticket_id, comment[:80])
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

    async def add_attachment_to_ticket(
        self,
        ticket_id: str,
        filename: str,
        content: bytes,
        content_type: Optional[str] = None,
    ) -> bool:
        """Attach a file to an existing work package. Returns True on success."""
        if self._use_mock:
            log.info("add_attachment_to_ticket → mock attached %r to %s", filename, ticket_id)
            return True

        wp_id = ticket_id.replace("IM-", "")
        url = f"{self.base_url}/work_packages/{wp_id}/attachments"
        headers = dict(self._get_headers())
        headers.pop("Content-Type", None)  # let multipart boundary be set automatically

        files = {
            "file": (filename, content, content_type or "application/octet-stream"),
        }
        data = {
            "description": "Attached during ticket creation",
        }

        async with httpx.AsyncClient(timeout=60.0) as client:
            resp = await client.post(url, headers=headers, files=files, data=data)
            if resp.status_code in (200, 201):
                log.info("add_attachment_to_ticket → attached %r to %s", filename, ticket_id)
                return True
            log.warning("add_attachment_to_ticket → failed %s for %s (status=%s)", filename, ticket_id, resp.status_code)
            return False

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
            if project_id:
                import json as _json
                filters = _json.dumps([
                    {"project": {"operator": "=", "values": [str(project_id)]}}
                ])
                memberships_url = f"{self.base_url}/memberships"
                try:
                    resp = await client.get(
                        memberships_url,
                        headers=self._get_headers(),
                        params={"filters": filters, "pageSize": 200},
                    )
                    resp.raise_for_status()
                except httpx.HTTPStatusError as e:
                    log.warning("get_users(project=%s) membership lookup blocked: %s", project_id, e)
                    return []

                data = resp.json()
                users = []
                seen = set()
                for m in data.get("_embedded", {}).get("elements", []):
                    principal = m.get("_embedded", {}).get("principal") or {}
                    principal_link = m.get("_links", {}).get("principal") or {}

                    p_href = principal_link.get("href") or ""
                    is_user = principal.get("_type") == "User" or "/users/" in p_href
                    if not is_user:
                        continue

                    pid = principal.get("id")
                    if pid is None and p_href:
                        try:
                            pid = int(p_href.rstrip("/").split("/")[-1])
                        except Exception:
                            pid = None
                    if pid is None:
                        continue

                    uid = str(pid)
                    if uid in seen:
                        continue
                    seen.add(uid)
                    users.append({
                        "id": uid,
                        "name": principal.get("name") or principal_link.get("title") or f"User {uid}",
                        "email": principal.get("email"),
                    })
                return users

            try:
                resp = await client.get(f"{self.base_url}/users", headers=self._get_headers(), params={"pageSize": 200})
                resp.raise_for_status()
                data = resp.json()
                return [
                    {"id": str(u["id"]), "name": u.get("name"), "email": u.get("email")}
                    for u in data.get("_embedded", {}).get("elements", [])
                ]
            except httpx.HTTPStatusError as e:
                log.warning("get_users(all) blocked by permissions: %s", e)
                return []

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
