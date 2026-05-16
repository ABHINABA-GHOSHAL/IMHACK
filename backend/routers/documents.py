import uuid
import logging
from fastapi import APIRouter, HTTPException, UploadFile, File, Form
from fastapi.responses import StreamingResponse

log = logging.getLogger("documents")
from models.schemas import (
    GenerateDocumentRequest,
    RefineDocumentRequest,
    IngestDocumentRequest,
    DocumentResponse,
    CreateTicketsRequest,
    PreviewTicketsRequest,
    ConfirmTicketsRequest,
)
from services.llm_service import llm_service
from services.rag_service import rag_service
from services.openproject_service import openproject_service
import json
import asyncio
import re

router = APIRouter(prefix="/api/documents", tags=["documents"])


def _clean_brd_context(raw_text: str) -> str:
    text = (raw_text or "").strip()
    if not text:
        return ""

    # Remove common BRD metadata/preamble lines that should not be copied into tickets.
    text = re.sub(r"^\s*AI\s*BRD\s*Draft\s*Context\s*$", "", text, flags=re.IGNORECASE | re.MULTILINE)
    text = re.sub(r"^\s*BRD\s*:\s*.*$", "", text, flags=re.IGNORECASE | re.MULTILINE)
    text = re.sub(r"^\s*Priority\s*:\s*.*$", "", text, flags=re.IGNORECASE | re.MULTILINE)
    text = re.sub(r"^\s*Status\s*:\s*.*$", "", text, flags=re.IGNORECASE | re.MULTILINE)
    text = re.sub(r"\n{3,}", "\n\n", text).strip()

    # Keep only structured BRD content when present.
    marker = "## BUSINESS PROBLEM"
    idx = text.find(marker)
    if idx >= 0:
        text = text[idx:]

    # Drop Source References tail block entirely (supports both heading and inline variants).
    text = re.sub(
        r"(^|\n)\s*(?:##\s*)?Source\s+References\s*:?\s*[\s\S]*$",
        "",
        text,
        flags=re.IGNORECASE,
    ).strip()
    return text


def _compose_ticket_description(task: dict) -> str:
    base = (task.get("description") or "").strip()
    draft = _clean_brd_context(task.get("ai_brd_draft") or "")
    if not draft:
        return base
    # Only include the cleaned draft, no meta lines or headings
    prefix = "\n\n" if base else ""
    return f"{base}{prefix}{draft}"


@router.post("/generate", response_model=DocumentResponse)
async def generate_document(req: GenerateDocumentRequest):
    log.info("generate_document | doc_type=%s | problem=%r", req.doc_type.value, req.problem[:80])
    try:
        # RAG retrieval
        examples = rag_service.retrieve_for_document_generation(
            problem=req.problem, doc_type=req.doc_type.value
        )

        # Generate via LLM
        content = await llm_service.generate_document(
            doc_type=req.doc_type.value,
            problem=req.problem,
            users=req.users,
            success_metric=req.success_metric,
            deadline=req.deadline,
            teams=req.teams,
            priority=req.priority,
            retrieved_examples=examples,
            additional_context=req.additional_context or "",
        )

        # Extract source references
        sources = []
        retrieved = rag_service.retrieve(query=req.problem, top_k=3)
        for r in retrieved:
            sources.append({
                "title": r["metadata"].get("title", "Unknown"),
                "doc_type": r["metadata"].get("doc_type", ""),
                "relevance": r["score"],
            })

        return DocumentResponse(
            content=content,
            sources=sources,
            doc_type=req.doc_type.value,
        )
    except Exception as e:
        log.error("generate_document failed: %s", e)
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/generate/stream")
async def generate_document_stream(req: GenerateDocumentRequest):
    examples = rag_service.retrieve_for_document_generation(
        problem=req.problem, doc_type=req.doc_type.value
    )

    system_prompt = f"""You are an expert Product Manager and Technical Writer at IndiaMart.
Generate a high-quality {req.doc_type.value} grounded in the retrieved historical examples.
Return complete Markdown document."""

    user_prompt = f"""Generate a complete {req.doc_type.value}:

Problem: {req.problem}
Users: {req.users}
Success Metric: {req.success_metric}
Deadline: {req.deadline}
Teams: {req.teams}
Priority: {req.priority}

Historical Examples:
{examples}"""

    if str(req.doc_type).strip().upper() == "BRD":
        system_prompt = f"""You are an expert Product Manager and Technical Writer at IndiaMart.
Create a structured BRD in Markdown with EXACTLY these top-level headings in this order:

## BUSINESS PROBLEM
## BUSINESS REQUIREMENTS
## EXPECTED IMPACT

Rules:
- Always include all three headings.
- Under BUSINESS REQUIREMENTS, use numbered bullet points.
- Under EXPECTED IMPACT, do NOT use tables.
- Format EXPECTED IMPACT as three short subsections only:
  1. Conversion & Engagement KPIs
  2. User Experience Outcomes
  3. Operational / Business Outcomes
- Under each subsection, use 2-4 bullets in the form: Metric / Direction / Why it matters.
- Keep the BRD concise, concrete, and business-focused.
"""

        user_prompt = f"""Create a BRD from the following details:

Problem Statement: {req.problem}
Target Users: {req.users}
Success Metrics: {req.success_metric}
Deadline: {req.deadline}
Teams Involved: {req.teams}
Priority: {req.priority}

Retrieved Historical Examples:
{examples}

Additional Context:
{req.additional_context or ""}
"""

    messages = [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": user_prompt},
    ]

    async def event_generator():
        try:
            async for chunk in llm_service.chat_stream(messages, temperature=0.5):
                yield f"data: {json.dumps({'chunk': chunk})}\n\n"
        except Exception as e:
            yield f"data: {json.dumps({'error': str(e)})}\n\n"
        yield "data: [DONE]\n\n"

    return StreamingResponse(event_generator(), media_type="text/event-stream")


@router.post("/refine", response_model=DocumentResponse)
async def refine_document(req: RefineDocumentRequest):
    try:
        content = await llm_service.refine_document(
            current_document=req.current_document,
            refinement_instruction=req.refinement_instruction,
            doc_type=req.doc_type.value,
        )
        return DocumentResponse(content=content, doc_type=req.doc_type.value)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/ingest")
async def ingest_document(req: IngestDocumentRequest):
    doc_id = str(uuid.uuid4())
    success = rag_service.ingest_document(
        doc_id=doc_id,
        content=req.content,
        title=req.title,
        doc_type=req.doc_type,
        team=req.team or "All",
        project_id=req.project_id or "",
    )
    if not success:
        raise HTTPException(status_code=500, detail="Failed to ingest document")
    return {"success": True, "doc_id": doc_id, "message": "Document ingested into knowledge base"}


@router.post("/ingest/file")
async def ingest_file(file: UploadFile = File(...)):
    content = await file.read()
    text = content.decode("utf-8", errors="ignore")
    doc_id = str(uuid.uuid4())
    success = rag_service.ingest_document(
        doc_id=doc_id,
        content=text,
        title=file.filename or "Uploaded Document",
        doc_type="uploaded",
        team="All",
    )
    if not success:
        raise HTTPException(status_code=500, detail="Failed to ingest file")
    return {"success": True, "doc_id": doc_id, "filename": file.filename}


@router.get("/knowledge-base/stats")
async def get_kb_stats():
    return rag_service.get_stats()


@router.post("/create-tickets")
async def create_tickets_from_brd(req: CreateTicketsRequest):
    try:
        # Extract tasks using LLM
        raw_tasks = await llm_service.extract_tasks_from_brd(req.brd_content)

        # Parse JSON
        try:
            # Strip markdown code blocks if present
            clean = raw_tasks.strip()
            if clean.startswith("```"):
                clean = clean.split("\n", 1)[1]
            if clean.endswith("```"):
                clean = clean.rsplit("\n", 1)[0]
            tasks = json.loads(clean)
        except json.JSONDecodeError:
            raise HTTPException(status_code=422, detail="LLM returned invalid JSON for task extraction")

        created_tickets = []
        from datetime import datetime, timedelta
        import asyncio

        for task in tasks:
            due_date = (datetime.now() + timedelta(days=task.get("estimatedDays", 7))).strftime("%Y-%m-%d")
            ticket = await openproject_service.create_work_package(
                project_id=req.project_id,
                title=task.get("title", "Untitled Task"),
                description=task.get("description", ""),
                assignee_id=task.get("assignee_id"),
                due_date=due_date,
                work_package_type=task.get("type", "Task"),
            )
            created_tickets.append({**ticket, "team": task.get("team"), "priority": task.get("priority")})
            await asyncio.sleep(0.3)  # Rate limit

        return {"created": len(created_tickets), "tickets": created_tickets}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/preview-tickets")
async def preview_tickets_from_brd(req: PreviewTicketsRequest):
    """Extract a single ticket draft from a BRD using AI — does NOT create anything in OpenProject yet."""
    log.info("preview_tickets | brd_length=%d chars", len(req.brd_content))
    try:
        raw = await llm_service.extract_tasks_from_brd(req.brd_content, req.ticket_preferences or {})
        log.info("preview_tickets → LLM returned %d chars of raw JSON", len(raw))
        clean = raw.strip()
        if clean.startswith("```"):
            clean = clean.split("\n", 1)[1]
        if clean.endswith("```"):
            clean = clean.rsplit("\n", 1)[0]
        parsed = json.loads(clean)
        # Support both single object and legacy array (take first element)
        if isinstance(parsed, list):
            t = parsed[0] if parsed else {}
        else:
            t = parsed
        t.setdefault("id", 0)
        t.setdefault("title", "Untitled Task")
        t.setdefault("description", "")
        t.setdefault("team", "Engineering")
        t.setdefault("priority", "Medium")
        t.setdefault("estimatedDays", 7)
        t.setdefault("type", "Task")
        t.setdefault("component", "General")
        t.setdefault("effortPoints", 3)
        t.setdefault("risk", "Medium")
        t.setdefault("assignee_id", None)
        t.setdefault("assignee_name", None)
        t.setdefault("responsible_id", None)
        t.setdefault("responsible_name", None)
        t.setdefault("estimatedHours", max(1, int(t.get("estimatedDays", 7) or 7) * 8))
        # Always sanitize BRD draft text regardless of whether AI returned this field.
        t["ai_brd_draft"] = _clean_brd_context(t.get("ai_brd_draft") or req.brd_content)
        log.info("preview_tickets → returning single draft ticket: %r", t.get("title", "")[:60])
        return {"ticket": t}
    except json.JSONDecodeError:
        log.error("preview_tickets → JSON decode failed on LLM output")
        raise HTTPException(status_code=422, detail="AI returned invalid JSON — try regenerating")
    except Exception as e:
        log.error("preview_tickets failed: %s", e)
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/confirm-tickets")
async def confirm_tickets(req: ConfirmTicketsRequest):
    """PM-approved: create the reviewed tickets in OpenProject."""
    log.info("confirm_tickets | project=%s | version=%s | count=%d", req.project_id, req.version_id, len(req.tickets))
    try:
        created_tickets = []
        from datetime import datetime, timedelta
        import asyncio

        for task in req.tickets:
            due_date = (datetime.now() + timedelta(days=int(task.get("estimatedDays", 7)))).strftime("%Y-%m-%d")
            log.info("confirm_tickets → creating ticket: %r due=%s", task.get("title", "")[:60], due_date)
            ticket = await openproject_service.create_work_package(
                project_id=req.project_id,
                title=task.get("title", "Untitled Task"),
                description=_compose_ticket_description(task),
                assignee_id=task.get("assignee_id"),
                responsible_id=task.get("responsible_id"),
                due_date=due_date,
                estimated_hours=task.get("estimatedHours"),
                version_id=req.version_id,
                work_package_type=task.get("type", "Task"),
            )
            created_tickets.append({**ticket, "team": task.get("team"), "priority": task.get("priority")})
            await asyncio.sleep(0.3)

        log.info("confirm_tickets → done. %d ticket(s) created.", len(created_tickets))
        return {"created": len(created_tickets), "tickets": created_tickets}
    except Exception as e:
        log.error("confirm_tickets failed: %s", e)
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/confirm-tickets-with-files")
async def confirm_tickets_with_files(
    project_id: str = Form(...),
    version_id: str = Form(None),
    tickets_json: str = Form(...),
    files: list[UploadFile] = File(default=[]),
):
    """PM-approved: create reviewed tickets in OpenProject and attach uploaded files."""
    try:
        tickets = json.loads(tickets_json)
        if not isinstance(tickets, list):
            raise ValueError("tickets_json must be a JSON array")

        buffered_files = []
        for f in files or []:
            content = await f.read()
            if content:
                buffered_files.append((f.filename or "attachment.bin", content, f.content_type))

        created_tickets = []
        from datetime import datetime, timedelta

        for task in tickets:
            due_date = (datetime.now() + timedelta(days=int(task.get("estimatedDays", 7)))).strftime("%Y-%m-%d")
            ticket = await openproject_service.create_work_package(
                project_id=project_id,
                title=task.get("title", "Untitled Task"),
                description=_compose_ticket_description(task),
                assignee_id=task.get("assignee_id"),
                responsible_id=task.get("responsible_id"),
                due_date=due_date,
                estimated_hours=task.get("estimatedHours"),
                version_id=version_id,
                work_package_type=task.get("type", "Task"),
            )

            attached = []
            failed_attachments = []
            for filename, content, content_type in buffered_files:
                ok = await openproject_service.add_attachment_to_ticket(
                    ticket_id=ticket["id"],
                    filename=filename,
                    content=content,
                    content_type=content_type,
                )
                if ok:
                    attached.append(filename)
                else:
                    failed_attachments.append(filename)

            created_tickets.append(
                {
                    **ticket,
                    "team": task.get("team"),
                    "priority": task.get("priority"),
                    "attached_files": attached,
                    "failed_attachments": failed_attachments,
                }
            )
            await asyncio.sleep(0.3)

        return {
            "created": len(created_tickets),
            "tickets": created_tickets,
            "uploaded_files": [f[0] for f in buffered_files],
        }
    except Exception as e:
        log.error("confirm_tickets_with_files failed: %s", e)
        raise HTTPException(status_code=500, detail=str(e))
