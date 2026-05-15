import httpx
import json
from typing import List, Dict, AsyncGenerator
from config import LLM_API_KEY, LLM_BASE_URL, LLM_MODEL


class LLMService:
    def __init__(self):
        self.api_key = LLM_API_KEY
        self.base_url = LLM_BASE_URL
        self.model = LLM_MODEL
        self.headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
        }

    async def chat(
        self,
        messages: List[Dict[str, str]],
        temperature: float = 0.7,
        max_tokens: int = 4096,
    ) -> str:
        payload = {
            "model": self.model,
            "messages": messages,
            "temperature": temperature,
            "max_tokens": max_tokens,
        }
        async with httpx.AsyncClient(timeout=120.0) as client:
            response = await client.post(
                f"{self.base_url}/chat/completions",
                headers=self.headers,
                json=payload,
            )
            response.raise_for_status()
            data = response.json()
            return data["choices"][0]["message"]["content"]

    async def chat_stream(
        self,
        messages: List[Dict[str, str]],
        temperature: float = 0.7,
        max_tokens: int = 4096,
    ) -> AsyncGenerator[str, None]:
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
Include specific, measurable details. Avoid generic statements.
At the end, add a "## Source References" section listing which past documents influenced this output."""

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

    async def generate_contextual_reminder(
        self,
        ticket_id: str,
        ticket_subject: str,
        assignee_name: str,
        reminder_type: str,
        sprint_health: str,
        dependencies: str,
    ) -> str:
        messages = [
            {
                "role": "system",
                "content": "You are an intelligent reminder generator. Generate a professional, contextual reminder message. Be specific, helpful, and motivating. Max 100 words.",
            },
            {
                "role": "user",
                "content": f"""Generate a {reminder_type} reminder for:
- Assignee: {assignee_name}
- Ticket: {ticket_id} — {ticket_subject}
- Sprint Health: {sprint_health}
- Dependencies: {dependencies}

The message should be specific, professional, and include the impact of this ticket on the team.""",
            },
        ]
        return await self.chat(messages, temperature=0.6, max_tokens=200)

    async def generate_status_report(
        self,
        sprint_data: dict,
        historical_comparison: str,
        blocker_context: str,
    ) -> str:
        messages = [
            {
                "role": "system",
                "content": "You are a Project Management AI that generates concise, data-driven sprint status reports. Format in clean Markdown with sections for Progress, Health, Blockers, Scope, Prediction, and Recommendations.",
            },
            {
                "role": "user",
                "content": f"""Generate a complete sprint status report from this data:

Sprint Metrics:
{json.dumps(sprint_data, indent=2)}

Historical Comparison:
{historical_comparison}

Blocker Context (with RAG-retrieved patterns):
{blocker_context}

Generate a professional status report that a PM can send to leadership immediately.""",
            },
        ]
        return await self.chat(messages, temperature=0.4, max_tokens=2000)

    async def extract_tasks_from_brd(self, brd_content: str) -> str:
        messages = [
            {
                "role": "system",
                "content": """You extract actionable tasks from BRDs and return ONLY valid JSON.
Return a JSON array where each item has:
{
  "title": "string",
  "description": "string", 
  "team": "string (Product/Engineering/Design/Data Science/QA)",
  "priority": "string (High/Medium/Low)",
  "estimatedDays": number,
  "type": "string (Feature/Bug/Task/Epic)"
}""",
            },
            {
                "role": "user",
                "content": f"Extract all actionable tasks from this BRD. Return ONLY the JSON array, no other text:\n\n{brd_content}",
            },
        ]
        return await self.chat(messages, temperature=0.1, max_tokens=3000)

    async def generate_retrospective(self, sprint_data: dict, ticket_data: list) -> str:
        messages = [
            {
                "role": "system",
                "content": "You generate sprint retrospectives in Markdown format covering: What Went Well, What Didn't Go Well, Blockers Encountered, Key Learnings, Action Items for Next Sprint.",
            },
            {
                "role": "user",
                "content": f"Generate a retrospective for this sprint:\n\nSprint Data:\n{json.dumps(sprint_data, indent=2)}\n\nTickets:\n{json.dumps(ticket_data[:20], indent=2)}",
            },
        ]
        return await self.chat(messages, temperature=0.5, max_tokens=2000)


llm_service = LLMService()
