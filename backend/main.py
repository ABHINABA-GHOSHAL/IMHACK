from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from routers import documents, sprint, reminders, reports
from config import FRONTEND_URL, PORT
import uvicorn

app = FastAPI(
    title="Project Intelligence & Documentation Copilot",
    description="AI-powered project management system for IndiaMart",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[FRONTEND_URL, "http://localhost:5173", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(documents.router)
app.include_router(sprint.router)
app.include_router(reminders.router)
app.include_router(reports.router)


@app.get("/")
async def root():
    return {
        "name": "Project Intelligence & Documentation Copilot",
        "version": "1.0.0",
        "status": "running",
        "docs": "/docs",
    }


@app.get("/health")
async def health():
    return {"status": "healthy"}


if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=PORT, reload=True)
