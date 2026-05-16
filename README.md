# IM-Main: Project Intelligence & Documentation Copilot

> An AI-powered project operations copilot for IndiaMart that generates intelligent business requirement documents, monitors sprint health in real-time, analyzes tickets, and produces data-driven status reports using OpenProject live data.

![Status](https://img.shields.io/badge/Status-Production-brightgreen)
![Python](https://img.shields.io/badge/Python-3.11-blue)
![React](https://img.shields.io/badge/React-19-61dafb)
![FastAPI](https://img.shields.io/badge/FastAPI-0.111-009688)
![License](https://img.shields.io/badge/License-Internal-inactive)

---

## 🎯 Quick Start

### Prerequisites

- **Python 3.11+** with venv
- **Node.js 20+** and npm 10+
- **OpenProject account** with API token
- **LLM API key** for Claude Sonnet

### 1. Setup Environment

```bash
# Clone and navigate
git clone <repository>
cd IM-Main

# Create Python virtual environment
python -m venv venv
# On Windows:
.\venv\Scripts\Activate.ps1
# On macOS/Linux:
source venv/bin/activate
```

### 2. Install Dependencies

```bash
# Backend
cd backend
pip install -r requirements.txt
cd ..

# Frontend
cd frontend
npm install
cd ..
```

### 3. Configure Environment

Create a `.env` file in the `backend/` directory:

```env
# LLM Configuration
LLM_API_KEY=<your-claude-api-key>
LLM_BASE_URL=https://imllm.intermesh.net/v1
LLM_MODEL=anthropic/claude-sonnet-4-6

# OpenProject Configuration
OPENPROJECT_BASE_URL=https://project.intermesh.net/api/v3
OPENPROJECT_API_TOKEN=<your-openproject-token>

# Application Configuration
FRONTEND_URL=http://localhost:5173
PORT=8005
JWT_SECRET=<your-jwt-secret>
JWT_ALGORITHM=HS256
JWT_EXPIRE_HOURS=24
ALLOWED_EMAIL_DOMAIN=indiamart.com

# Optional
SLACK_WEBHOOK_URL=<optional-slack-webhook>
CHROMA_DB_PATH=./data/chroma_db
UPLOADS_PATH=./data/uploads
```

### 4. Start Development Servers

**Terminal 1 - Backend:**

```bash
cd backend
python -m uvicorn main:app --reload --port 8005
```

**Terminal 2 - Frontend:**

```bash
cd frontend
npm run dev
```

**Access the application:**

- Frontend: http://localhost:5173
- Backend API: http://localhost:8005/api

---

## 📊 System Architecture

### High-Level Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    IM-Main Application                       │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌──────────────────────┐         ┌──────────────────────┐  │
│  │   React Frontend     │         │    FastAPI Backend   │  │
│  │  (Port 5173)         │         │    (Port 8005)       │  │
│  │                      │         │                      │  │
│  │  • Dashboard         │◄────────►  • Auth Router       │  │
│  │  • DocumentCopilot   │         │  • Documents Router  │  │
│  │  • SprintMonitor     │         │  • Sprint Router     │  │
│  │  • TicketAnalysis    │         │  • Reports Router    │  │
│  │  • StatusReports     │         │                      │  │
│  └──────────────────────┘         └──────────────────────┘  │
│           │                                    │             │
│           └────────────────┬────────────────────┘             │
│                            │                                 │
│        ┌───────────────────┼───────────────────┐             │
│        │                   │                   │             │
│        ▼                   ▼                   ▼             │
│   ┌─────────┐      ┌──────────────┐    ┌────────────┐      │
│   │ ChromaDB│      │ LLM Gateway  │    │OpenProject │      │
│   │ (RAG)   │      │(Claude API)  │    │(Live Data) │      │
│   │         │      │              │    │            │      │
│   │ Vector  │      │ Generation   │    │ • Projects │      │
│   │ Store   │      │ Analysis     │    │ • Sprints  │      │
│   │         │      │ Synthesis    │    │ • Tickets  │      │
│   └─────────┘      └──────────────┘    └────────────┘      │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### Technology Stack

| Component              | Technology            | Version |
| ---------------------- | --------------------- | ------- |
| **Frontend Framework** | React                 | 19.2.6  |
| **Frontend Build**     | Vite                  | 8.0.12  |
| **Styling**            | Tailwind CSS          | 4.3.0   |
| **Routing**            | React Router          | 7.15.1  |
| **PDF Export**         | jsPDF                 | 2.5.2   |
| **Backend Framework**  | FastAPI               | 0.111.0 |
| **ASGI Server**        | Uvicorn               | 0.30.0  |
| **Python**             | Python                | 3.11.9  |
| **Vector Store**       | ChromaDB              | 0.5.0   |
| **Embeddings**         | sentence-transformers | 3.0.1   |
| **Authentication**     | PyJWT                 | 2.8.1   |
| **HTTP Client**        | httpx                 | 0.27.0  |
| **Validation**         | Pydantic              | 2.7.1   |

---

## 📁 Project Structure

```
IM-Main/
├── README.md                           # This file
├── backend/
│   ├── main.py                        # FastAPI app & router setup
│   ├── config.py                      # Environment configuration
│   ├── requirements.txt                # Python dependencies
│   ├── models/
│   │   └── schemas.py                 # Pydantic request/response models
│   ├── routers/
│   │   ├── __init__.py
│   │   ├── auth.py                    # JWT authentication
│   │   ├── documents.py               # BRD generation & ticket creation
│   │   ├── sprint.py                  # Sprint health & analysis
│   │   └── reports.py                 # Status report generation
│   ├── services/
│   │   ├── __init__.py
│   │   ├── llm_service.py             # LLM gateway wrapper
│   │   ├── rag_service.py             # ChromaDB operations
│   │   └── openproject_service.py     # OpenProject API integration
│   └── data/
│       ├── users.json                 # User credentials store
│       ├── chroma_db/                 # ChromaDB vector store
│       └── uploads/                   # File uploads from tickets
│
├── frontend/
│   ├── index.html                     # Entry point
│   ├── package.json                   # NPM dependencies
│   ├── vite.config.js                 # Vite configuration
│   ├── tailwind.config.js             # Tailwind CSS config
│   ├── src/
│   │   ├── main.jsx                   # React root
│   │   ├── App.jsx                    # Router & layout shell
│   │   ├── App.css                    # Global styles
│   │   ├── api/
│   │   │   └── client.js              # Axios API client
│   │   ├── context/
│   │   │   └── AuthContext.jsx        # JWT & user state
│   │   ├── pages/
│   │   │   ├── Login.jsx              # Authentication
│   │   │   ├── Dashboard.jsx          # KPI overview
│   │   │   ├── DocumentCopilot.jsx    # BRD generation
│   │   │   ├── SprintMonitor.jsx      # Sprint tracking
│   │   │   ├── TicketAnalysis.jsx     # Ticket deep-dive
│   │   │   └── StatusReports.jsx      # Report generation
│   │   └── components/                # Reusable UI components
│   ├── public/                        # Static assets
│   └── dist/                          # Production build output
│
├── my-skill/
│   ├── SKILL.md                       # Agent skill definition
│   ├── assets/
│   │   ├── retrospective-prompt-template.md
│   │   └── status-report-prompt-template.md
│   ├── references/
│   │   ├── architecture.md
│   │   ├── workflows.md
│   │   └── rag-openproject.md
│   └── scripts/
│       ├── validate-frontend.ps1
│       └── validate-backend.ps1
│
├── venv/                              # Python virtual environment
└── .env                               # Environment configuration (git-ignored)
```

---

## 🚀 Running the Application

### Development Mode

**1. Start the backend:**

```bash
cd backend
python -m uvicorn main:app --reload --port 8005
```

**2. Start the frontend (new terminal):**

```bash
cd frontend
npm run dev
```

**3. Access the app:**

- Open http://localhost:5173
- Login with your @indiamart.com email

### Production Build

**1. Build the frontend:**

```bash
cd frontend
npm run build
```

**2. Run the backend with production settings:**

```bash
cd backend
python -m uvicorn main:app --port 8005 --workers 4
```

**3. Serve the built frontend:**
The frontend build output (`frontend/dist/`) should be served by your web server or deployment platform.

---

## 🔑 Core Features

### 1. Document Generation (DocumentCopilot)

- Generate structured Business Requirement Documents (BRDs) from project context
- Automatically extract actionable tickets from BRDs
- Store documents in RAG system for future reference
- Create tickets directly in OpenProject with cleaned descriptions

**Flow:** Business Requirements → BRD Generation → Ticket Preview → Confirm & Create

### 2. Sprint Monitoring (SprintMonitor)

- Real-time KPI tracking: completion rate, active blockers, scope creep
- View all tickets in the current sprint with filtering
- Generate AI-driven sprint retrospectives
- Receive blocker alerts with pattern matching from history

**Data Source:** Live OpenProject API with pagination support

### 3. Ticket Analysis (TicketAnalysis)

- Deep analysis of individual work packages
- View ticket details, comments, and attachments
- Add AI-generated analysis using ticket context
- Post comments and attach files directly
- **Export analysis as PDF** (fixed in latest version)

### 4. Status Reports (StatusReports)

- Generate comprehensive sprint status reports
- Synthesize KPIs, blockers, and trends
- Use RAG to identify historical patterns
- Export reports as formatted PDFs

**Uses:** OpenProject data + RAG context + LLM synthesis

### 5. Authentication

- Email-based signup and login
- JWT token management (24-hour expiration default)
- Domain validation: @indiamart.com only
- Session storage in browser

---

## 🔌 API Endpoints

All endpoints require JWT authorization header:

```
Authorization: Bearer <your_jwt_token>
```

### Authentication Routes

- `POST /api/auth/signup` — Create new account
- `POST /api/auth/login` — Authenticate and receive JWT
- `GET /api/auth/me` — Get current user profile

### Document Routes

- `POST /api/documents/generate` — Generate BRD from requirements
- `POST /api/documents/refine` — Refine generated BRD
- `POST /api/documents/preview-tickets` — Extract tickets from BRD
- `POST /api/documents/confirm-tickets` — Create tickets in OpenProject
- `POST /api/documents/ingest` — Store document in RAG

### Sprint Routes

- `GET /api/sprint/projects` — List all projects
- `GET /api/sprint/versions` — List sprint versions
- `GET /api/sprint/health` — Get sprint KPIs
- `GET /api/sprint/tickets` — Get sprint tickets (paginated)
- `POST /api/sprint/retrospective` — Generate AI retrospective
- `GET /api/sprint/ticket-detail` — Get single ticket details
- `POST /api/sprint/ticket-analysis` — Analyze specific ticket
- `POST /api/sprint/comments/add` — Add comment to ticket
- `POST /api/sprint/attachments/add` — Attach file to ticket

### Reports Routes

- `POST /api/reports/generate` — Generate status report
- `POST /api/reports/quick-summary` — Quick report summary

---

## 🧠 RAG System

The application uses **ChromaDB** as a vector store to ground AI generation in historical context.

### Seeding (On Startup)

- If ChromaDB is empty, seed with sample internal-style documents
- Provides initial context for BRD generation and retrospectives

### Ingestion

- User-supplied documents are embedded and stored
- Available for retrieval during document generation

### Retrieval

- **For BRD Generation:** Retrieve similar past documents to inform new BRDs
- **For Reports/Retrospectives:** Retrieve blocker patterns and trends

**Location:** `backend/data/chroma_db/`

---

## 🔐 Security & Authentication

### JWT Authentication

- Algorithm: HS256
- Expiration: 24 hours (configurable)
- Stored in browser sessionStorage
- Cleared on logout

### Domain Validation

- Only @indiamart.com email addresses allowed
- Enforced at signup and login

### Data Security

- API keys stored only in backend `.env` (never exposed to frontend)
- OpenProject token kept server-side
- User credentials stored locally in `backend/data/users.json` (development only)

### Trust Boundaries

- **Internal Services:** OpenProject (project.intermesh.net), LLM gateway (imllm.intermesh.net)
- **External:** None intentionally exposed
- **Frontend-to-Backend:** Authenticated via JWT over HTTP(S)

---

## 🛠️ Development & Debugging

### Common Development Commands

**Frontend:**

```bash
cd frontend
npm run dev           # Start dev server (port 5173)
npm run build         # Production build
npm run lint          # Run ESLint
npm run preview       # Preview production build
```

**Backend:**

```bash
cd backend
python -m uvicorn main:app --reload --port 8005        # Dev server
python -m uvicorn main:app --port 8005 --workers 4     # Production
pip install -r requirements.txt                         # Install dependencies
```

### Validation Scripts

**Quick health checks:**

```powershell
# Frontend validation
my-skill/scripts/validate-frontend.ps1

# Backend validation
my-skill/scripts/validate-backend.ps1
```

### Testing API Endpoints

```bash
# Get sprint health (requires JWT token)
curl -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  http://127.0.0.1:8005/api/sprint/health

# List projects
curl -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  http://127.0.0.1:8005/api/sprint/projects
```

### Debugging Backend Issues

**Enable verbose logging:**

```python
# In backend/main.py or relevant router
import logging
logging.basicConfig(level=logging.DEBUG)
```

**Check environment variables:**

```bash
# Backend directory
python -c "from config import *; print(LLM_API_KEY, OPENPROJECT_BASE_URL)"
```

**Test LLM connectivity:**

```python
# In backend
from services.llm_service import LLMService
llm = LLMService()
response = llm.chat("test", "Hello")
print(response)
```

---

## 🐛 Troubleshooting

### Frontend Issues

**Port 5173 already in use:**

```bash
cd frontend
npm run dev -- --port 5174
```

**Dependencies not installing:**

```bash
cd frontend
rm -rf node_modules package-lock.json
npm install
```

**Build errors with Tailwind:**

```bash
npm run build -- --force
```

### Backend Issues

**Module not found errors:**

```bash
# Ensure venv is activated
source venv/bin/activate  # macOS/Linux
.\venv\Scripts\Activate.ps1  # Windows

# Reinstall dependencies
pip install -r requirements.txt
```

**OpenProject API errors (401/403):**

- Verify `OPENPROJECT_API_TOKEN` in `.env`
- Check token hasn't expired
- Confirm token has proper permissions

**LLM API errors:**

- Verify `LLM_API_KEY` is set and valid
- Check `LLM_BASE_URL` is reachable
- Check system can reach imllm.intermesh.net
- Look for "Illegal header value" → token may be corrupted

**ChromaDB issues:**

- Ensure `backend/data/chroma_db/` directory exists and is writable
- Check `CHROMA_DB_PATH` in `.env` points to correct location

**JWT token errors:**

- Ensure email domain is @indiamart.com
- Check token hasn't expired (24 hours default)
- Clear browser sessionStorage and re-login

---

## 📚 Documentation & Resources

### Quick References

- **Agent Skill Definition:** [my-skill/SKILL.md](./my-skill/SKILL.md) — For AI agent interaction patterns
- **System Architecture:** [my-skill/references/architecture.md](./my-skill/references/architecture.md) — Deep technical design
- **User Workflows:** [my-skill/references/workflows.md](./my-skill/references/workflows.md) — Feature descriptions and user flows
- **RAG & OpenProject:** [my-skill/references/rag-openproject.md](./my-skill/references/rag-openproject.md) — Integration details

### Prompt Templates

- **Retrospective Prompts:** [my-skill/assets/retrospective-prompt-template.md](./my-skill/assets/retrospective-prompt-template.md)
- **Status Report Prompts:** [my-skill/assets/status-report-prompt-template.md](./my-skill/assets/status-report-prompt-template.md)

### External Resources

- [FastAPI Documentation](https://fastapi.tiangolo.com/)
- [React Documentation](https://react.dev/)
- [Tailwind CSS](https://tailwindcss.com/)
- [ChromaDB Documentation](https://docs.trychroma.com/)
- [OpenProject API Docs](https://www.openproject.org/docs/api/introduction/)

---

## 🤝 Contributing

### Code Guidelines

**DO:**

- Keep code modular and testable
- Document complex logic with comments
- Handle errors gracefully with fallbacks
- Test changes locally before committing
- Follow existing code style and patterns

**DON'T:**

- Add BRD metadata to ticket descriptions
- Use `innerHTML` extraction for PDF generation (always clone DOM nodes)
- Store sensitive data in version control
- Break the OpenProject integration (it's the source of truth)
- Reintroduce the reminders/nudge/email subsystem

### Making Changes

1. Create a feature branch: `git checkout -b feature/your-feature`
2. Make your changes
3. Run validation scripts to check for errors
4. Test locally on both frontend and backend
5. Commit with descriptive messages
6. Push and create a pull request

### Reporting Issues

When reporting bugs, include:

- Steps to reproduce
- Expected vs. actual behavior
- Error logs or console output
- Environment details (OS, Python/Node versions, etc.)

---

## 📋 Recent Changes

### Version Notes

- ✅ **Reminders subsystem:** Fully removed (email nudges, scheduler, reminders routes)
- ✅ **BRD metadata cleanup:** Tickets no longer contain BRD heading metadata
- ✅ **PDF export fixes:** Uses cloned DOM nodes instead of innerHTML extraction
- ✅ **LLM resilience:** Runtime configuration refresh for API key recovery
- ✅ **Dashboard polish:** Removed hero badge, added Ticket Analysis to quick actions
- ✅ **Skill enhancement:** Comprehensive agent skill with progressive disclosure

---

## 📞 Support & Contact

For questions or issues related to this project:

1. **Check the documentation:** Start with [my-skill/SKILL.md](./my-skill/SKILL.md)
2. **Review error logs:** Check console output and network tab
3. **Run validation scripts:** Use the provided PowerShell validation scripts
4. **Test endpoints directly:** Use curl or Postman to verify API behavior
5. **Contact the team:** Reach out to the IndiaMart engineering team

---

## 📄 License

This project is proprietary internal software for IndiaMart. Unauthorized distribution or use is prohibited.

---

**Last Updated:** May 16, 2026
**Project Status:** Production
**Maintainers:** IndiaMart Engineering Team
