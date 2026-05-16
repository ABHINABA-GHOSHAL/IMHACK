# RAG And OpenProject Reference

## Purpose

Use this file when working on retrieval quality, OpenProject integration behavior, or any feature that combines historical context with live operational state.

## RAG Usage In This Repository

The RAG system stores full documents in ChromaDB and retrieves similar items using sentence embeddings.

### What RAG Is Used For

- grounding BRD and document generation
- retrieving blocker patterns from historical retrospectives
- grounding status reports with historical examples

### Where RAG Is Called

- `backend/routers/documents.py`
  - retrieves examples for document generation
  - ingests finalized user content into the knowledge base

- `backend/routers/sprint.py`
  - retrieves blocker patterns for sprint alerts
  - retrieves context used to improve blocker guidance and retrospectives

- `backend/routers/reports.py`
  - retrieves historical report examples
  - retrieves blocker context for report synthesis

### Important RAG Characteristics

- collection initialization is handled lazily in `backend/services/rag_service.py`
- the DB is seeded with sample internal-style documents if empty
- retrieval is document-level, not chunk-level
- low-value results can be filtered before they are returned upstream

### What To Check When RAG Output Feels Weak

- whether the query being sent is specific enough
- whether the right retrieval helper is being called
- whether the database has enough ingested documents
- whether the feature should use historical examples or blocker-pattern retrieval

## OpenProject Usage In This Repository

OpenProject is the live operational source of truth for all current project state.

### What OpenProject Is Used For

- project listing and selection
- sprint or bucket listing and selection
- fetching work packages
- computing sprint health from current tickets
- reading ticket detail and comments
- creating work packages from BRD output
- adding comments to tickets
- uploading file attachments

### Where OpenProject Is Called

- `backend/routers/documents.py`
  - creates work packages after preview and confirmation

- `backend/routers/sprint.py`
  - fetches projects, versions, users, work package types, ticket detail, comments, and tickets
  - computes sprint health from live work package data
  - posts AI and user comments
  - attaches files

- `backend/routers/reports.py`
  - fetches tickets and sprint info used to compute report metrics

### Important OpenProject Characteristics

- auth is loaded from environment configuration
- pagination is handled in the service layer
- work package payloads are normalized before the frontend receives them
- current sprint metrics should always come from OpenProject-derived ticket state

## RAG And OpenProject Together

These systems serve different roles and should not be confused:

- OpenProject provides the live current state of execution
- RAG provides historical and organization-specific context
- the LLM combines both to generate useful outputs

### Correct Mental Model

For most features:

1. fetch live current state from OpenProject
2. fetch historical context from RAG only when needed
3. pass both into the LLM
4. return structured output to the frontend

If a feature needs exact counts or statuses, trust OpenProject-derived values over generated text.

## Common Edge Cases

### OpenProject Edge Cases

- project has no versions or buckets
- ticket lists require pagination across multiple pages
- ticket comments exist but no assignee is set
- work package types differ across projects

### RAG Edge Cases

- empty ChromaDB on first run
- retrieval returning generic samples because the query is weak
- insufficient ingested internal documents for a new team or domain

## Debugging Guide

### If current data looks wrong

Check:

- `openproject_service.py`
- router-level parameter passing for `project_id` and `version_id`
- pagination and normalization logic

### If AI output feels generic

Check:

- RAG retrieval helper being used
- richness of the constructed query
- whether historical examples are actually present
- the final prompt payload sent to the LLM

### If counts and generated text disagree

Trust backend-computed metrics first and then inspect how those metrics were passed into the LLM request.
