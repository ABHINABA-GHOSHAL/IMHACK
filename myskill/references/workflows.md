# Workflow Reference

## Purpose

Use this file to understand user-visible flows, checkpoints, expected outputs, and likely failure points.

## 1. Document Generation Workflow

### User Goal

Turn business context into a structured BRD, then optionally into OpenProject tickets.

### Input

- problem statement
- target users
- success metric
- deadline
- involved teams
- priority
- optional additional context

### Flow

1. User enters business context in Document Copilot.
2. Backend retrieves similar historical documents from RAG.
3. LLM generates a Markdown document.
4. User optionally refines the document.
5. User previews extracted tickets from the BRD.
6. User confirms ticket creation.
7. Backend creates work packages in OpenProject.
8. User may ingest the final document into RAG for future reuse.

### Output

- generated BRD or document in Markdown
- preview list of extracted tasks
- confirmed work packages in OpenProject

### Important Checkpoints

- ticket descriptions must not contain BRD metadata headers
- preview is the human approval gate before ticket creation
- file attachment support exists for confirm-with-files flow

### Common Failure Points

- invalid LLM JSON during task extraction
- OpenProject creation failure after successful preview
- poor retrieval quality if RAG context is weak or sparse

## 2. Sprint Monitor Workflow

### User Goal

Understand sprint health, blockers, and scope condition using live ticket data.

### Input

- selected project
- optional selected bucket or sprint version

### Flow

1. User selects a project and optional bucket.
2. Backend fetches work packages from OpenProject.
3. Sprint health is computed from live tickets.
4. If blockers exist, RAG retrieves similar blocker patterns.
5. LLM generates blocker guidance for comments or retrospective output.
6. User can generate an AI retrospective.

### Output

- completion percentage
- blocked ticket count
- scope creep percentage
- sprint health status
- optional retrospective Markdown

### Important Checkpoints

- health metrics come from deterministic backend calculations, not directly from the LLM
- retrospective generation can fall back if the LLM call fails
- blocker comments are posted back to OpenProject

### Common Failure Points

- project or version selection mismatch
- OpenProject pagination or connectivity issues
- LLM failure during retrospective generation

## 3. Ticket Analysis Workflow

### User Goal

Investigate one ticket in detail using live metadata, comments, and AI analysis.

### Input

- selected project
- optional selected bucket
- selected ticket

### Flow

1. User loads tickets for a selected project and optional bucket.
2. Frontend filters and sorts the loaded ticket set locally.
3. User selects a single ticket.
4. Backend fetches ticket detail and comments on demand.
5. LLM analyzes the ticket using the current ticket state and discussion history.
6. User may add a manual comment or attach a file.
7. User may export the rendered analysis as PDF.

### Output

- ticket detail payload
- comments list
- AI analysis in Markdown
- optional PDF export

### Important Checkpoints

- analysis must use live OpenProject ticket detail and comment history
- comment and attachment actions write back to OpenProject
- PDF export must clone the rendered DOM node before `pdf.html()` is called

### Common Failure Points

- missing ticket ID or invalid selection
- OpenProject comment fetch failure
- broken PDF export if someone reintroduces `innerHTML` extraction

## 4. Status Report Workflow

### User Goal

Generate a leadership-ready weekly status report grounded in current sprint data and historical context.

### Input

- project ID
- version ID
- include-history toggle or equivalent request flag

### Flow

1. Backend fetches current sprint tickets from OpenProject.
2. Backend computes deterministic sprint metrics.
3. Backend builds assignee-level analysis from ticket states.
4. RAG retrieves historical report examples and blocker patterns.
5. LLM generates a structured Markdown report.
6. Frontend renders the report and can export it as PDF.

### Output

- sprint summary metrics
- assignee analysis
- full Markdown report
- optional PDF export

### Important Checkpoints

- person-wise analysis should stay aligned with backend counts
- historical comparison is optional and RAG-backed
- recommendations should stay tied to current sprint state

### Common Failure Points

- incorrect assignee counts if backend analysis logic changes
- malformed Markdown tables in generated output
- PDF export regressions if the rendered DOM pattern is changed

## 5. Authentication Workflow

### User Goal

Restrict the app to internal IndiaMART usage.

### Flow

1. User signs up or signs in with an `@indiamart.com` email.
2. Backend validates the allowed domain and issues a JWT.
3. Frontend stores the token in session storage.
4. Protected routes are unlocked inside the main app shell.

### Important Checkpoints

- only `@indiamart.com` accounts are allowed
- sidebar and main routes are hidden behind auth
- missing token should redirect back to login

## Workflow Debugging Guide

If something is wrong, classify it first:

- wrong data or counts → likely backend computation or OpenProject mapping
- weak or generic AI output → likely prompt inputs, RAG retrieval, or LLM behavior
- broken button or rendering → likely frontend page logic
- failed write-back to comments or attachments → likely OpenProject API integration
