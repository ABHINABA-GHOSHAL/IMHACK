# Architecture Reference

## Purpose

This repository is a full-stack internal project operations tool. It combines:

- React + Vite frontend for the user workflows
- FastAPI backend for orchestration and API delivery
- OpenProject as the live operational source of truth
- ChromaDB + sentence-transformers for historical retrieval
- An internal LLM gateway for generation, analysis, and synthesis

Use this reference when you need to understand where behavior is computed, which layer owns a decision, and how a frontend action maps to backend services.

## System Layers

### 1. Frontend Layer

The frontend is responsible for:

- route navigation
- user input collection
- rendering AI outputs as Markdown
- invoking backend APIs through a shared Axios client
- exporting rendered report and analysis views as PDFs

Primary entry points:

- `frontend/src/App.jsx` — app shell, navigation, protected routes
- `frontend/src/api/client.js` — all frontend-to-backend API bindings
- `frontend/src/context/AuthContext.jsx` — JWT storage and authentication state

### 2. Backend Router Layer

The router layer is responsible for:

- request validation
- selecting the right service calls
- combining OpenProject, RAG, and LLM results
- shaping responses for frontend consumption

Primary routers:

- `backend/routers/documents.py`
- `backend/routers/sprint.py`
- `backend/routers/reports.py`
- `backend/routers/auth.py`

### 3. Service Layer

The service layer is responsible for integrations and reusable computation:

- `backend/services/openproject_service.py` — live project, sprint, ticket, comment, and attachment operations
- `backend/services/rag_service.py` — ingestion and retrieval of historical document context
- `backend/services/llm_service.py` — prompt execution, retries, runtime env refresh, and content generation

### 4. Data Layer

Persistent data in this repository is split across:

- OpenProject remote API data
- local ChromaDB vector store in `backend/data/chroma_db`
- local uploads in `backend/data/uploads`
- local auth user store in `backend/data/users.json`

## Request And Data Flow

Typical flow for an AI-assisted feature:

1. Frontend page sends a request through `frontend/src/api/client.js`.
2. FastAPI router validates request inputs.
3. Router fetches live ticket/project data from OpenProject when needed.
4. Router fetches historical context from RAG when needed.
5. Router passes current data plus historical context to the LLM service.
6. Router returns a response shaped for direct frontend rendering.

This split matters because behavior is often controlled in the router, not in the page component.

## Frontend Page To Backend Mapping

### Dashboard

Frontend:

- `frontend/src/pages/Dashboard.jsx`

Primary API calls:

- `GET /api/reports/quick-summary`
- `GET /api/sprint/projects`
- `GET /api/sprint/versions`
- `GET /api/sprint/stats`

Purpose:

- show a high-level sprint health snapshot
- show ticket category stats
- route the user into downstream workflows

### Document Copilot

Frontend:

- `frontend/src/pages/DocumentCopilot.jsx`

Primary API calls:

- `POST /api/documents/generate`
- `POST /api/documents/refine`
- `POST /api/documents/preview-tickets`
- `POST /api/documents/confirm-tickets`
- `POST /api/documents/confirm-tickets-with-files`
- `POST /api/documents/ingest`

Purpose:

- generate BRDs from business context
- preview extracted tasks before creation
- create OpenProject work packages
- optionally ingest finalized material into RAG

### Sprint Monitor

Frontend:

- `frontend/src/pages/SprintMonitor.jsx`

Primary API calls:

- `GET /api/sprint/health`
- `GET /api/sprint/projects`
- `GET /api/sprint/versions`
- `GET /api/sprint/retrospective`
- `POST /api/sprint/tickets/{ticket_id}/comment`

Purpose:

- compute live sprint KPIs
- surface blockers and scope creep
- generate AI retrospective content
- post AI blocker comments into OpenProject

### Ticket Analysis

Frontend:

- `frontend/src/pages/TicketAnalysis.jsx`

Primary API calls:

- `GET /api/sprint/tickets`
- `GET /api/sprint/tickets/{ticket_id}`
- `GET /api/sprint/tickets/{ticket_id}/analysis`
- `POST /api/sprint/tickets/{ticket_id}/comment/user`
- `POST /api/sprint/tickets/{ticket_id}/attachment`

Purpose:

- inspect one ticket deeply
- fetch live comments and ticket metadata
- generate AI analysis from current state
- add comments and attachments back to OpenProject

### Status Reports

Frontend:

- `frontend/src/pages/StatusReports.jsx`

Primary API calls:

- `POST /api/reports/generate`
- `GET /api/reports/quick-summary`
- `GET /api/sprint/projects`
- `GET /api/sprint/versions`

Purpose:

- build a structured sprint report
- combine current sprint metrics with historical examples
- support PDF export from rendered DOM

## Router Ownership By Concern

Use this to decide where to debug:

- document and BRD extraction issues → `backend/routers/documents.py`
- sprint KPI mismatches → `backend/routers/sprint.py` plus `openproject_service.py`
- retrospective fallback behavior → `backend/routers/sprint.py` plus `llm_service.py`
- report content and assignee analysis → `backend/routers/reports.py`
- stale or missing AI credentials → `backend/services/llm_service.py`
- retrieval quality or missing historical examples → `backend/services/rag_service.py`

## Important Architectural Constraints

### OpenProject Is The Source Of Truth

Do not treat frontend state or generated AI content as authoritative when live ticket/project state exists in OpenProject.

### Router Layer Combines Systems

Most important behavior happens where routers combine:

- current OpenProject state
- historical RAG context
- LLM prompt generation

When debugging output quality, inspect the router inputs before changing UI rendering.

### PDF Export Uses Rendered DOM

PDF generation for reports and ticket analysis must use cloned rendered DOM nodes, not `innerHTML` extraction.

### Reminders Are Removed

The reminder/email/nudge subsystem is intentionally gone. Do not assume hidden routes or background schedulers still exist.

## Authentication Boundary

Authentication is enforced through:

- JWT issuance and validation in `backend/routers/auth.py`
- session token storage in frontend auth context
- protected layout routing in `frontend/src/App.jsx`

Only `@indiamart.com` accounts are allowed.

## Suggested Debugging Order

When a feature is broken, use this order:

1. confirm the frontend page and action being used
2. identify the API call in `frontend/src/api/client.js`
3. inspect the owning backend router
4. check whether the router depends on OpenProject, RAG, or both
5. inspect the service that actually computes or fetches the data
