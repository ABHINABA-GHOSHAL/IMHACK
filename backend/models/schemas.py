from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from enum import Enum


class DocumentType(str, Enum):
    BRD = "BRD"
    SOW = "SOW"
    SPRINT_PLAN = "Sprint Planning Document"
    PROPOSAL = "Project Proposal"
    MEMO = "Internal Memo"
    AGENDA = "Meeting Agenda"


class GenerateDocumentRequest(BaseModel):
    doc_type: DocumentType = DocumentType.BRD
    problem: str = Field(..., description="What problem are you solving?")
    users: str = Field(..., description="Who are the users?")
    success_metric: str = Field(..., description="What is the success metric?")
    deadline: str = Field(..., description="What is the deadline?")
    teams: str = Field(..., description="Which teams are involved?")
    priority: str = Field(..., description="What is the priority?")
    additional_context: Optional[str] = None


class RefineDocumentRequest(BaseModel):
    current_document: str
    refinement_instruction: str
    doc_type: DocumentType = DocumentType.BRD


class IngestDocumentRequest(BaseModel):
    content: str
    doc_type: str
    title: str
    project_id: Optional[str] = None
    team: Optional[str] = None


class DocumentResponse(BaseModel):
    content: str
    sources: List[Dict[str, Any]] = []
    doc_type: str
    tokens_used: Optional[int] = None


class SprintHealthRequest(BaseModel):
    project_id: Optional[str] = None


class TicketStatus(BaseModel):
    id: str
    subject: str
    status: str
    assignee: Optional[str] = None
    due_date: Optional[str] = None
    story_points: Optional[float] = None
    is_blocked: bool = False
    blocking: List[str] = []


class SprintHealthResponse(BaseModel):
    project_name: str
    total_tickets: int
    completed_tickets: int
    blocked_tickets: int
    completion_percentage: float
    health_status: str  # "On Track", "At Risk", "Critical"
    scope_creep_percentage: float
    velocity_vs_average: float
    blockers: List[Dict[str, Any]] = []
    alerts: List[str] = []
    ai_summary: str = ""


class ReminderType(str, Enum):
    ASSIGNMENT = "assignment"
    DUE_2_DAYS = "due_2_days"
    DUE_TODAY = "due_today"
    OVERDUE = "overdue"
    STALE = "stale"
    BLOCKER = "blocker"
    SPRINT_RISK = "sprint_risk"
    WEEKLY_DIGEST = "weekly_digest"


class Reminder(BaseModel):
    id: Optional[str] = None
    ticket_id: str
    ticket_subject: str
    assignee_name: str
    assignee_email: Optional[str] = None
    reminder_type: ReminderType
    message: str
    sent_at: Optional[str] = None
    acknowledged: bool = False
    channel: str = "in_app"


class SendReminderRequest(BaseModel):
    ticket_id: str
    assignee_email: str
    reminder_type: ReminderType
    custom_message: Optional[str] = None


class StatusReportRequest(BaseModel):
    project_id: Optional[str] = None
    sprint_name: Optional[str] = None
    include_history: bool = True


class StatusReportResponse(BaseModel):
    sprint_name: str
    week_of: str
    progress_summary: str
    health_status: str
    blockers: List[Dict[str, Any]]
    scope_changes: List[Dict[str, Any]]
    completion_prediction: str
    assignee_compliance: str
    full_report: str
    generated_at: str


class CreateTicketsRequest(BaseModel):
    brd_content: str
    project_id: str
    team: Optional[str] = None


class ChatMessage(BaseModel):
    role: str
    content: str


class ChatRequest(BaseModel):
    messages: List[ChatMessage]
    context: Optional[str] = None
