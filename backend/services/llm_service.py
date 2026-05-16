import httpx
import json
import asyncio
import os
from typing import List, Dict, AsyncGenerator, Optional
from dotenv import dotenv_values
from config import LLM_API_KEY, LLM_BASE_URL, LLM_MODEL


class LLMService:
    def __init__(self):
        self.api_key = LLM_API_KEY
        self.base_url = LLM_BASE_URL
        self.model = LLM_MODEL
        self.headers = self._build_headers()

    def _build_headers(self) -> Dict[str, str]:
        return {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
        }

    def _refresh_config_from_env_if_needed(self) -> None:
        # Recover from startup without env loaded (e.g., launched from different cwd).
        if self.api_key:
            return
        env_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), ".env")
        if not os.path.exists(env_path):
            return
        try:
            values = dotenv_values(env_path)
            key = (values.get("LLM_API_KEY") or "").strip()
            base = (values.get("LLM_BASE_URL") or "").strip()
            model = (values.get("LLM_MODEL") or "").strip()
            if key:
                self.api_key = key
            if base:
                self.base_url = base
            if model:
                self.model = model
            self.headers = self._build_headers()
        except Exception:
            # Keep existing config if refresh fails.
            pass

    async def chat(
        self,
        messages: List[Dict[str, str]],
        temperature: float = 0.7,
        max_tokens: int = 4096,
    ) -> str:
        self._refresh_config_from_env_if_needed()
        payload = {
            "model": self.model,
            "messages": messages,
            "temperature": temperature,
            "max_tokens": max_tokens,
        }
        last_err = None
        # Retry transient provider/network failures to reduce intermittent fallback responses.
        for attempt in range(3):
            try:
                async with httpx.AsyncClient(timeout=120.0) as client:
                    response = await client.post(
                        f"{self.base_url}/chat/completions",
                        headers=self.headers,
                        json=payload,
                    )
                    response.raise_for_status()
                    data = response.json()
                    return data["choices"][0]["message"]["content"]
            except (httpx.TimeoutException, httpx.NetworkError, httpx.HTTPStatusError) as e:
                last_err = e
                status = getattr(getattr(e, "response", None), "status_code", None)
                retriable = status in (429, 500, 502, 503, 504) or status is None
                if attempt < 2 and retriable:
                    await asyncio.sleep(1.0 * (attempt + 1))
                    continue
                raise

        raise last_err if last_err else RuntimeError("LLM request failed")

    async def chat_stream(
        self,
        messages: List[Dict[str, str]],
        temperature: float = 0.7,
        max_tokens: int = 4096,
    ) -> AsyncGenerator[str, None]:
        self._refresh_config_from_env_if_needed()
        payload = {
            "model": self.model,
            "messages": messages,
            "temperature": temperature,
            "max_tokens": max_tokens,
            "stream": True,
        }
        async with httpx.AsyncClient(timeout=120.0) as client:
            async with client.stream(
                "POST",
                f"{self.base_url}/chat/completions",
                headers=self.headers,
                json=payload,
            ) as response:
                response.raise_for_status()
                async for line in response.aiter_lines():
                    if line.startswith("data: "):
                        data_str = line[6:]
                        if data_str.strip() == "[DONE]":
                            break
                        try:
                            data = json.loads(data_str)
                            delta = data["choices"][0]["delta"].get("content", "")
                            if delta:
                                yield delta
                        except (json.JSONDecodeError, KeyError, IndexError):
                            continue

    async def generate_document(
        self,
        doc_type: str,
        problem: str,
        users: str,
        success_metric: str,
        deadline: str,
        teams: str,
        priority: str,
        retrieved_examples: str = "",
        additional_context: str = "",
    ) -> str:
        is_brd = str(doc_type).strip().upper() == "BRD"
        system_prompt = f"""You are an expert Product Manager and Technical Writer at IndiaMart.
Your task is to generate a high-quality, professional {doc_type}.
Ground every section in the retrieved historical examples below.
Do NOT hallucinate — use the structure and quality from real past documents.
Return a complete, well-structured document in Markdown format."""

        examples_section = ""
        if retrieved_examples:
            examples_section = f"\n\n## Retrieved Historical Examples (use these as grounding):\n{retrieved_examples}\n"

        additional_section = ""
        if additional_context:
            additional_section = f"\n\n## Additional Context:\n{additional_context}"

        user_prompt = f"""Generate a complete {doc_type} based on the following inputs:

**Problem Statement:** {problem}
**Target Users:** {users}
**Success Metrics:** {success_metric}
**Deadline:** {deadline}
**Teams Involved:** {teams}
**Priority:** {priority}{examples_section}{additional_section}

Generate a complete, professional {doc_type} with all standard sections.
Include specific, measurable details. Avoid generic statements."""

        if is_brd:
            user_prompt = f"""The user may provide BRD details in natural language. Create a structured BRD using EXACTLY these top-level headings in this order:

    ## BUSINESS PROBLEM
    ## BUSINESS REQUIREMENTS
    ## EXPECTED IMPACT

    Input from user:

    **Natural Language Brief / Problem Statement:** {problem}
    **Target Users:** {users}
    **Success Metrics:** {success_metric}
    **Deadline:** {deadline}
    **Teams Involved:** {teams}
    **Priority:** {priority}{examples_section}{additional_section}

    Rules:
    - Always include all three headings above, even if details are partial.
    - Keep content concise, concrete, and implementation-ready.
    - Under BUSINESS REQUIREMENTS, use numbered bullet points with acceptance-oriented language.
        - Under EXPECTED IMPACT, do NOT use tables.
        - Format EXPECTED IMPACT as three short subsections only:
            1. Conversion & Engagement KPIs
            2. User Experience Outcomes
            3. Operational / Business Outcomes
        - Under each subsection, use 2-4 bullets in the form: Metric / Direction / Why it matters.
        - Keep every impact bullet tied to the BRD context, not generic marketing language.
        - If a metric is not directly knowable, use a proxy metric that the team can actually measure.
    - Write ONLY from a Product Manager perspective.
    - Do NOT include code snippets, pseudo-code, APIs payloads, endpoint definitions, library names, or technical implementation steps.
    - Do NOT reference Meta docs, SDK docs, or any external technical documentation.
    - Focus on business context, user behavior, product requirements, scope, constraints, and measurable impact.
    """

        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ]
        return await self.chat(messages, temperature=0.5, max_tokens=6000)

    async def refine_document(
        self,
        current_document: str,
        refinement_instruction: str,
        doc_type: str,
    ) -> str:
        messages = [
            {
                "role": "system",
                "content": f"You are an expert editor refining a {doc_type}. Apply the requested changes precisely. Return the complete updated document in Markdown.",
            },
            {
                "role": "user",
                "content": f"Here is the current {doc_type}:\n\n{current_document}\n\n---\n\nRefinement instruction: {refinement_instruction}\n\nReturn the complete updated document.",
            },
        ]
        return await self.chat(messages, temperature=0.4, max_tokens=6000)

    async def generate_sprint_alert(
        self,
        blocker_description: str,
        historical_patterns: str,
        sprint_context: str,
    ) -> str:
        messages = [
            {
                "role": "system",
                "content": "You are a Sprint Intelligence Agent. Generate a precise, actionable blocker alert with historical context and specific recommendations. Be concise and direct.",
            },
            {
                "role": "user",
                "content": f"""Blocker detected: {blocker_description}

Sprint Context:
{sprint_context}

Historical Patterns from similar past blockers:
{historical_patterns}

Generate a structured alert message (max 200 words) with:
1. What is blocked and impact
2. Historical pattern match (cite specific past sprints)
3. Recommended resolution action
4. Urgency level""",
            },
        ]
        return await self.chat(messages, temperature=0.3, max_tokens=500)

    async def generate_status_report(
        self,
        sprint_data: dict,
        historical_comparison: str,
        blocker_context: str,
        tickets: list = None,
        assignee_analysis: list = None,
    ) -> str:
        from datetime import date
        today = date.today().isoformat()

        # Categorise tickets for the prompt
        problem_tickets = []
        if tickets:
            for t in tickets:
                issues = []
                status = (t.get("status") or "").lower()
                not_started_statuses = {"new", "open", "to do", "todo", "backlog"}
                active_statuses = not_started_statuses | {"in progress", "in-progress", "doing"}
                is_closed = any(
                    s in status
                    for s in ("closed", "done", "resolved", "completed", "cancelled")
                )
                due = t.get("due_date")
                if "blocked" in status or t.get("is_blocked"):
                    issues.append("BLOCKED")
                if due and due < today and not is_closed:
                    issues.append(f"OVERDUE (due {due})")
                if status in active_statuses and due and due <= today and not is_closed:
                    issues.append("DUE TODAY / OVERDUE")
                if status in not_started_statuses and not is_closed:
                    issues.append("NOT STARTED")
                if issues:
                    problem_tickets.append({
                        "id": t.get("id"),
                        "title": t.get("subject"),
                        "status": t.get("status"),
                        "assignee": t.get("assignee") or "Unassigned",
                        "due_date": due,
                        "issues": issues,
                    })

        ticket_summary_lines = []
        if tickets:
            for t in tickets:
                due = t.get("due_date") or "no due date"
                assignee = t.get("assignee") or "Unassigned"
                ticket_summary_lines.append(
                    f"- {t.get('id')} | {t.get('subject','')[:80]} | {t.get('status')} | Assignee: {assignee} | Due: {due}"
                )

        messages = [
            {
                "role": "system",
                "content": (
                    "You are a Project Management AI that generates concise, data-driven sprint status reports. "
                    "Return CLEAN, READABLE GitHub-Flavored Markdown only.\n\n"
                    "STRICT FORMAT RULES:\n"
                    "- Use Markdown headings (`##`, `###`) for section structure.\n"
                    "- Put every table row on its own line.\n"
                    "- Keep columns aligned and consistent.\n"
                    "- Do not place multiple table rows on the same line.\n"
                    "- Avoid overlong paragraphs; use bullets for clarity.\n"
                    "- Always include assignee names for problem tickets.\n"
                    "- Use this exact section order:\n"
                    "  1) Sprint Summary\n"
                    "  2) Problem Tickets\n"
                    "  3) Progress\n"
                    "  4) Blockers and Risks\n"
                    "  5) Historical Comparison\n"
                    "  6) Person-wise Analysis and Actions\n"
                    "  7) Recommendations\n\n"
                    "For Problem Tickets, use grouped subsections and this exact table header:\n"
                    "| Ticket ID | Title | Issue | Assignee | Due Date | Recommended Action |\n"
                    "For Person-wise Analysis and Actions, use this exact table header:\n"
                    "| Person | Open | Blocked | Overdue | Risk | What They Should Do Next |"
                ),
            },
            {
                "role": "user",
                "content": f"""Generate a complete sprint status report from this data:

**Sprint Metrics:**
{json.dumps(sprint_data, indent=2)}

**Problem Tickets ({len(problem_tickets)} identified):**
{json.dumps(problem_tickets, indent=2) if problem_tickets else "None identified"}

**All Tickets ({len(tickets) if tickets else 0} total):**
{chr(10).join(ticket_summary_lines) if ticket_summary_lines else "No ticket data"}

**Assignee Analysis (deterministic baseline, refine but do not contradict counts):**
{json.dumps(assignee_analysis or [], indent=2)}

**Historical Comparison:**
{historical_comparison}

**Blocker Context:**
{blocker_context}

Generate a professional status report that a PM can send to leadership immediately. For every problem ticket, name the assignee and say exactly what action is needed. In the person-wise section, include every assignee from the input and assign explicit owner actions.""",
            },
        ]
        return await self.chat(messages, temperature=0.4, max_tokens=3000)

    async def analyze_ticket(self, ticket: dict, comments: list, project_name: str = "", bucket_name: str = "") -> str:
        messages = [
            {
                "role": "system",
                "content": (
                    "You are a senior product delivery analyst. Write a concise, practical analysis of one ticket in clean Markdown only. "
                    "Use the exact section order below and do not add preamble text.\n\n"
                    "Required structure:\n"
                    "# Ticket Analysis — <Ticket ID>\n\n"
                    "## Original Ticket\n"
                    "Summarize the ticket in 4-6 bullets using the exact ticket data.\n\n"
                    "## Comment History\n"
                    "Summarize what each person is saying or doing. Mention the author names.\n\n"
                    "## Current Status Assessment\n"
                    "Explain whether the ticket is healthy, blocked, stalled, or needs escalation.\n\n"
                    "## Risks / Gaps\n"
                    "List 3-5 bullets. Focus on missing details, unclear ownership, dependency risk, or comment signals.\n\n"
                    "## Recommended Next Actions\n"
                    "Use a Markdown table with columns: Owner / Action / Why / Priority.\n\n"
                    "Rules:\n"
                    "- Use only the provided ticket and comment data.\n"
                    "- Tie every recommendation to the ticket context and comments.\n"
                    "- If comments are sparse, say so clearly.\n"
                    "- Keep the analysis direct and operational."
                ),
            },
            {
                "role": "user",
                "content": f"""Analyze this single ticket using the ticket data and comment history only.

Project: {project_name}
Bucket: {bucket_name}

Ticket:
{json.dumps(ticket, indent=2)}

Comments:
{json.dumps(comments, indent=2)}

Return the analysis in the required structure. The original ticket must be shown first, then the analysis sections.
""",
            },
        ]
        return await self.chat(messages, temperature=0.35, max_tokens=2200)

    async def extract_tasks_from_brd(self, brd_content: str, ticket_preferences: dict = None) -> str:
        prefs = ticket_preferences or {}
        messages = [
            {
                "role": "system",
                "content": """You extract the single most important work ticket from a BRD and return ONLY valid JSON.
Return a single JSON object (NOT an array) with these fields:
{
  "title": "string — concise, execution-ready ticket title",
  "description": "string — 3-6 lines describing the work, acceptance criteria, and why it matters",
  "team": "string (Product/Engineering/Design/Data Science/QA)",
  "priority": "string (High/Medium/Low)",
  "estimatedDays": number,
  "type": "string (Feature/Bug/Task/Epic/Spike/Improvement)",
  "component": "string",
  "effortPoints": number (1/2/3/5/8/13),
  "risk": "string (Low/Medium/High)",
  "assignee_id": null,
  "assignee_name": null
}
Return ONLY the JSON object, no array brackets, no extra text.""",
            },
            {
                "role": "user",
                "content": f"""Create ONE ticket that captures the core deliverable of this BRD. Return ONLY the JSON object, no other text.

BRD:
{brd_content}

Ticket preferences (use as defaults/guidance when BRD does not specify):
{json.dumps(prefs, indent=2)}

Rules:
- ONE ticket only — the single most important deliverable.
- Prefer `type` = "Feature" for new capabilities, "Task" for process/infra work.
- Keep title crisp and execution-ready (max 10 words).
- Description must include: what to build, acceptance criteria, business impact.
- Set `assignee_id` and `assignee_name` as null (PM will select before creation).
""",
            },
        ]
        return await self.chat(messages, temperature=0.1, max_tokens=1500)

    async def generate_retrospective(self, sprint_data: dict, ticket_data: list, sprint_name: str = "Current Sprint") -> str:
        assignee_totals = {}
        assignee_problem_tickets = {}
        for ticket in ticket_data:
            assignee = ticket.get("assignee") or "Unassigned"
            assignee_totals[assignee] = assignee_totals.get(assignee, 0) + 1
            status = str(ticket.get("status") or "").lower()
            is_closed = any(word in status for word in ("closed", "done", "resolved", "completed", "cancelled"))
            if not is_closed:
                assignee_problem_tickets.setdefault(assignee, []).append(ticket.get("id"))

        messages = [
            {
                "role": "system",
                "content": (
                    "You are a senior Scrum Master. Generate a concise, structured sprint retrospective in clean Markdown only. "
                    "Use the exact section order below and do not add any preamble or closing note.\n\n"
                    "Required structure:\n"
                    "# Sprint Retrospective — <Sprint Name>\n\n"
                    "## Sprint Summary\n"
                    "Use a Markdown table with one metric per row.\n\n"
                    "## What Went Well\n"
                    "Use 3-5 bullets only. Include concrete ticket examples.\n\n"
                    "## What Did Not Go Well\n"
                    "Use 3-5 bullets only. Include concrete ticket examples.\n\n"
                    "## Blockers and Risks\n"
                    "Use a Markdown table with columns: Blocker / Impact / Affected Tickets / Action.\n\n"
                    "## Key Learnings\n"
                    "Use 3-5 bullets only. Make each learning actionable.\n\n"
                    "## Action Items for Next Sprint\n"
                    "Use a Markdown table with columns: # / Action Item / Owner / Priority / Details.\n\n"
                    "Rules:\n"
                    "- Only reference the selected sprint/bucket data provided by the caller.\n"
                    "- If data is sparse, say so explicitly instead of inventing details.\n"
                    "- Keep wording direct and leadership-ready.\n"
                    "- Make tables valid GitHub-Flavored Markdown with one row per line.\n"
                    "- For Action Items, use the assignee data to assign the right owner when a person is clearly responsible.\n"
                    "- If a ticket is tied to a single assignee with many unfinished items, call that out as a workload risk.\n"
                    "- Do not reuse the same generic action item for every ticket; tailor each entry to the actual issue."
                ),
            },
            {
                "role": "user",
                "content": f"""Generate a retrospective for the selected sprint/bucket exactly as structured above.

Sprint Name: {sprint_name}

Sprint Data:
{json.dumps(sprint_data, indent=2)}

Tickets (selected bucket only):
{json.dumps(ticket_data[:20], indent=2)}

Assignee workload summary:
{json.dumps(assignee_totals, indent=2)}

Open / incomplete tickets by assignee:
{json.dumps(assignee_problem_tickets, indent=2)}

Important:
- Use the sprint/bucket name above in the title.
- Do not mention tickets outside the selected bucket data.
- Do not output duplicated tables or long paragraphs.
""",
            },
        ]
        return await self.chat(messages, temperature=0.5, max_tokens=2000)


llm_service = LLMService()
