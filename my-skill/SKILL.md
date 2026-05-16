---
name: myskill
description: Use this skill when working on the IM-Main repository—a project intelligence and documentation copilot that generates BRDs, monitors sprints, analyzes tickets, and produces status reports using OpenProject live data and RAG. Handles document generation workflows, sprint KPI tracking, ticket analysis, and AI-driven reporting for IndiaMart project operations.
---

# IM-Main Project Intelligence & Documentation Copilot Skill

## Overview

This is a specialized skill for working with the **IM-Main** repository, an internal IndiaMart project-operations copilot. The system helps project managers and teams generate intelligent documentation, monitor sprint health, analyze tickets, and create data-driven status reports.

### System Architecture

**Technology Stack:**

- **Frontend:** React 19 + Vite + Tailwind CSS (running on port 5173)
- **Backend:** FastAPI + Python 3.11 (running on port 8005)
- **Data Sources:** OpenProject REST API (live project/ticket data)
- **AI Context:** ChromaDB + sentence-transformers (RAG system)
- **LLM Integration:** Custom gateway (anthropic/claude-sonnet-4-6)

**Core Capabilities:**

1. **Document Generation** - Turns business requirements into structured BRDs and automatically generates OpenProject tickets
2. **Sprint Monitoring** - Real-time KPI tracking, blocker detection, and AI-driven retrospectives
3. **Ticket Analysis** - Deep analysis of individual work packages with comment/attachment management
4. **Status Reporting** - Synthesized sprint reports with historical pattern matching via RAG
5. **Authentication** - JWT-based with @indiamart.com domain validation

### Active Routes & Features

| Route        | Component       | Purpose                                        | Status    |
| ------------ | --------------- | ---------------------------------------------- | --------- |
| `/`          | Dashboard       | Overview metrics, KPIs, quick actions          | ✅ Active |
| `/documents` | DocumentCopilot | BRD generation → ticket creation flow          | ✅ Active |
| `/sprint`    | SprintMonitor   | KPI cards, ticket list, AI retrospective       | ✅ Active |
| `/analysis`  | TicketAnalysis  | Single-ticket deep dive, comments, attachments | ✅ Active |
| `/reports`   | StatusReports   | Report generation and PDF export               | ✅ Active |
| `/login`     | Login           | Email-based authentication                     | ✅ Active |

**Note:** The reminders subsystem (email nudges, scheduled alerts) has been **permanently removed** and should not be reintroduced.

---

## Progressive Disclosure: Working Your Way Through This Skill

This skill is organized in **three levels of detail** to help you find exactly what you need:

### Level 1: This Document (Quick Reference)

Start here for:

- What the system does and how it's structured
- Where files are located and what they do
- Common development commands and validation approaches
- When to dig deeper into referenced materials

### Level 2: Specialized Reference Files

Read these when you need to understand specific subsystems:

- **`references/architecture.md`** — Detailed system design, data flow, integration patterns
- **`references/workflows.md`** — User workflows, feature behavior, UI patterns
- **`references/rag-openproject.md`** — Deep dive on RAG ingestion/retrieval and OpenProject API usage

### Level 3: Prompt Templates & Scripts

Use these for specialized tasks:

- **`assets/retrospective-prompt-template.md`** — AI prompt shaping for sprint retrospectives
- **`assets/status-report-prompt-template.md`** — AI prompt shaping for status reports
- **`scripts/validate-frontend.ps1`** — Validation script for frontend
- **`scripts/validate-backend.ps1`** — Validation script for backend

---

## Key Concepts

### 1. The BRD-to-Ticket Flow

Document generation has a specific, validated flow:

```
User Input
    ↓
Generate BRD (LLM + RAG context)
    ↓
Preview Tickets (extracted from BRD)
    ↓
Confirm & Create (tickets stored in OpenProject)
    ↓
Ingest Document (BRD stored in RAG for future context)
```

**Important:** BRD metadata headers must be stripped from ticket descriptions before creation. The `_clean_brd_context()` function in `backend/routers/documents.py` handles this.

### 2. RAG as Context Layer

ChromaDB stores:

- User-ingested documents (project context)
- Sample internal-style documents (seeded on startup)

It serves two functions:

- **For document generation:** Retrieve similar past documents to inform new BRDs
- **For reporting:** Retrieve blocker patterns from historical sprints for trend analysis

Key file: `backend/services/rag_service.py`

### 3. OpenProject as Source of Truth

OpenProject is the **canonical data source** for all operational data:

- Projects and versions (sprints)
- Work packages (tickets)
- Comments and attachments
- Status and assignment tracking

All ticket creation, commenting, and analysis ultimately reads from or writes to OpenProject REST API.

Key file: `backend/services/openproject_service.py`

### 4. LLM Resilience Pattern

The LLM service includes runtime configuration refresh. If the API key becomes stale or missing at runtime:

```python
# In llm_service._refresh_config_from_env_if_needed()
if not api_key:
    reload env from disk
    use new key
```

This ensures long-running processes recover from deployment changes without restarting.

---

## Repository Map

### Frontend Structure

```
frontend/src/
├── App.jsx                    # Router config, sidebar nav, layout shell
├── api/client.js              # Axios instance with interceptors
├── pages/
│   ├── Dashboard.jsx          # KPI overview, quick action buttons
│   ├── DocumentCopilot.jsx    # BRD generation & ticket preview
│   ├── SprintMonitor.jsx      # Sprint KPIs, ticket list, retrospective modal
│   ├── TicketAnalysis.jsx     # Single-ticket view, analysis, comments
│   ├── StatusReports.jsx      # Report generation & PDF export
│   └── Login.jsx              # Email auth form
├── context/AuthContext.jsx    # JWT token & user state
└── components/                # Reusable UI components
```

**Frontend Stack:** React 19 + React Router 7 + Tailwind CSS 4 + jsPDF 2.5 (for PDF generation)

### Backend Structure

```
backend/
├── main.py                    # FastAPI app, router registration
├── config.py                  # Env-based configuration
├── models/schemas.py          # Pydantic models (request/response)
├── routers/
│   ├── auth.py               # JWT signup/login/validation
│   ├── documents.py          # BRD generation, ticket creation, ingestion
│   ├── sprint.py             # Sprint KPIs, retrospectives, ticket analysis
│   └── reports.py            # Status report generation
└── services/
    ├── llm_service.py         # LLM gateway, retry logic, config refresh
    ├── rag_service.py         # ChromaDB operations
    └── openproject_service.py # OpenProject REST API wrapper
```

**Backend Stack:** FastAPI + Uvicorn + Pydantic 2.7 + ChromaDB 0.5 + sentence-transformers 3.0

---

## Common Development Tasks

### Starting the Development Servers

**Frontend:**

```bash
cd frontend
npm run dev          # Starts on http://localhost:5173
```

**Backend:**

```bash
cd backend
python -m uvicorn main:app --reload --port 8005
```

### Building for Production

**Frontend:**

```bash
cd frontend
npm run build        # Creates dist/ folder
```

**Backend:**
No separate build needed; Uvicorn serves the app directly from source.

### Quick Validation

Run these from the repository root:

**Check frontend for syntax errors:**

```powershell
myskill/scripts/validate-frontend.ps1
```

**Check backend for syntax errors:**

```powershell
myskill/scripts/validate-backend.ps1
```

### Direct API Testing

```bash
# Check sprint health
curl http://127.0.0.1:8005/api/sprint/health \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"

# List projects
curl http://127.0.0.1:8005/api/sprint/projects \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

---

## Critical Design Patterns

### PDF Export Pattern (Frontend)

Status reports and ticket analysis both use this pattern for PDF generation:

```javascript
// 1. Get the actual DOM node (not innerHTML string)
const renderedNode = reportPdfRef.current

// 2. Clone the node to preserve styles
const container = document.createElement("div")
container.appendChild(renderedNode.cloneNode(true))

// 3. Wait for animation frame before calling pdf.html()
await new Promise((resolve) => requestAnimationFrame(() => resolve()))

// 4. Generate PDF
await pdf.html(container, { margin: [24, 24, 24, 24], ... })
```

**Why this matters:** Using `innerHTML` extraction loses styling and layout. Always clone the actual rendered DOM node.

### API Error Handling (Backend)

When LLM calls fail:

```python
try:
    return await llm_service.generate_retrospective(...)
except Exception as e:
    # Fallback: Generate from cached patterns instead of failing
    return generate_fallback_retrospective(...)
```

The system is resilient—it doesn't crash on LLM failure; it falls back to pattern-based generation.

### Environment Variable Refresh (Backend)

Long-running processes should refresh configuration:

```python
# In llm_service.chat()
self._refresh_config_from_env_if_needed()

# This reloads LLM_API_KEY from .env if it's missing or stale
```

---

## What Changed Recently

To understand the current codebase state:

1. **Reminders subsystem:** Fully removed (no email nudges, no scheduler, no reminder routes)
2. **BRD metadata:** Tickets no longer contain BRD heading metadata
3. **PDF exports:** Fixed to use cloned DOM instead of innerHTML extraction
4. **LLM resilience:** Runtime config refresh added for API key recovery
5. **Dashboard:** Removed live sprint status cards, replaced with Scope Creep KPI
6. **Sprint Monitor:** Now shows Scope Creep instead of Pending Reminders

---

## Guidelines When Modifying This Repository

✅ **DO:**

- Fix issues at their source (backend) rather than masking in frontend
- Keep all ticket/sprint/report data grounded in live OpenProject data
- Use the prompt templates when refining AI output
- Follow the BRD-to-ticket flow and metadata cleaning pattern
- Test PDF generation with cloned DOM nodes, not innerHTML extraction
- Keep the three-level progressive disclosure structure for docs

❌ **DON'T:**

- Reintroduce the reminders/nudge/email subsystem
- Allow BRD metadata to leak into ticket descriptions
- Use innerHTML extraction for PDF generation
- Assume stale environment variables—refresh config at runtime
- Break the OpenProject integration (it's the source of truth)
- Store generated content outside OpenProject (use comments/attachments)

---

## Security & Trust Boundaries

### Data Handling

- JWT tokens are stored in browser sessionStorage (cleared on logout)
- API keys (.env) are backend-only and never exposed to frontend
- OpenProject credentials are restricted by @indiamart.com domain validation
- RAG documents are stored locally in ChromaDB; no external embeddings service

### External Services

- **OpenProject:** Trust the project.intermesh.net domain; all ticket operations happen here
- **LLM Gateway:** Trust imllm.intermesh.net; this is internal to IndiaMart
- **Frontend:** Runs on localhost:5173 in development; deployed separately in production

---

## For More Context

When you're working on specific aspects of this system, read the corresponding reference:

- **Understanding the full architecture?** → `references/architecture.md`
- **Learning user workflows and features?** → `references/workflows.md`
- **Implementing RAG or OpenProject changes?** → `references/rag-openproject.md`
- **Tuning AI output for retrospectives?** → `assets/retrospective-prompt-template.md`
- **Tuning AI output for reports?** → `assets/status-report-prompt-template.md`

---

## When This Skill Applies

Use this skill when:

✅ Explaining the IM-Main repository or its capabilities
✅ Modifying document generation, BRD handling, or RAG logic
✅ Fixing OpenProject-backed workflows or ticket operations
✅ Changing sprint monitor, ticket analysis, or status report behavior
✅ Debugging frontend/backend integration points
✅ Updating documentation or implementation patterns
✅ Making infrastructure changes (environment variables, API calls, etc.)

❌ **Not applicable for:**

- General coding problems unrelated to this codebase
- Non-IndiaMart projects
- Requests to restore removed features (like reminders)
