import uuid
from fastapi import APIRouter, HTTPException, UploadFile, File
from fastapi.responses import StreamingResponse
from models.schemas import (
    GenerateDocumentRequest,
    RefineDocumentRequest,
    IngestDocumentRequest,
    DocumentResponse,
    CreateTicketsRequest,
)
from services.llm_service import llm_service
from services.rag_service import rag_service
from services.openproject_service import openproject_service
import json
import asyncio

router = APIRouter(prefix="/api/documents", tags=["documents"])


@router.post("/generate", response_model=DocumentResponse)
async def generate_document(req: GenerateDocumentRequest):
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
                due_date=due_date,
            )
            created_tickets.append({**ticket, "team": task.get("team"), "priority": task.get("priority")})
            await asyncio.sleep(0.3)  # Rate limit

        return {"created": len(created_tickets), "tickets": created_tickets}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
