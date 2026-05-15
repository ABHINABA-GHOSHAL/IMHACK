import os
import json
from typing import List, Dict, Optional
import chromadb
from chromadb.config import Settings
from sentence_transformers import SentenceTransformer
from config import CHROMA_DB_PATH

# Sample historical documents for seeding the knowledge base
SAMPLE_DOCUMENTS = [
    {
        "id": "brd_001",
        "title": "Seller Catalog Intelligence BRD",
        "content": """# BRD: Seller Catalog Intelligence System
## Problem Statement
Sellers on IndiaMart lack visibility into which catalog improvements drive more buyer inquiries.
## Target Users
Active sellers on premium plans (100K+ sellers)
## Success Metrics
- 25% increase in seller inquiry rate within 60 days
- 40% reduction in catalog quality score below threshold
## Scope
Phase 1: Catalog score dashboard, improvement suggestions
Phase 2: AI-powered image quality detection
## Risks
- Data pipeline latency (mitigation: async processing)
- Low adoption risk (mitigation: in-app prompts)
## Timeline
Q2 2025 - 8 weeks total""",
        "doc_type": "BRD",
        "team": "Product",
        "project_id": "SELLER-001",
    },
    {
        "id": "brd_002",
        "title": "Payments API Integration BRD",
        "content": """# BRD: Payments API v3 Integration
## Problem Statement
Current payments flow has 12% drop-off due to 3rd party redirect. Need native checkout.
## Target Users
All buyers on IndiaMart marketplace
## Success Metrics
- Reduce checkout drop-off from 12% to 4%
- Payment success rate > 98%
## Technical Scope
Integrate Razorpay v3 API, implement webhook handling, PCI-DSS compliance
## Dependencies
- Payments Team API (critical path)
- Security audit (2 weeks)
## Risks
HIGH: Payments API dependency - historical blocker in Sprint 14, 19
Resolution pattern: Escalate to Payments TL directly""",
        "doc_type": "BRD",
        "team": "Engineering",
        "project_id": "PAYMENTS-002",
    },
    {
        "id": "retro_sprint14",
        "title": "Sprint 14 Retrospective",
        "content": """# Sprint 14 Retrospective
## What Went Well
- Feature delivery on mobile screens (3 days ahead)
- Strong collaboration between design and frontend
## What Didn't Go Well
- Payments API dependency caused 3-day delay (tickets: PAY-421, PAY-422, PAY-423)
- Blocker was not escalated for 2 days
## Blockers
- Payments API dependency: discovered Day 3, not resolved until Day 6
- Resolution: Finally escalated to Payments TL (should have been Day 1)
## Key Learnings
- Payments API dependencies MUST be escalated to Payments TL immediately
- Create a dependency checklist at sprint planning
## Action Items
- Add Payments TL as stakeholder on all payment-related sprints
- Create blocker escalation SOP""",
        "doc_type": "retrospective",
        "team": "Engineering",
        "project_id": "SPRINT-14",
    },
    {
        "id": "retro_sprint19",
        "title": "Sprint 19 Retrospective",
        "content": """# Sprint 19 Retrospective
## What Went Well
- Payments API blocker resolved in 1 day (vs 3 days in Sprint 14)
- Proactive escalation to Payments TL on Day 1 worked
## What Didn't Go Well
- Scope creep: +5 story points added mid-sprint
- 2 assignees did not update ticket status for 48+ hours
## Blockers
- Payments API dependency (again): IM-4112 blocked
- Resolution in 1 day: Direct escalation to Payments TL per Sprint 14 learnings
## Velocity
Started at 20 SP, completed 18 SP (90% — above threshold)
## Key Learnings
- Scope additions mid-sprint must go through PM approval
- Stale ticket monitoring needs automation""",
        "doc_type": "retrospective",
        "team": "Engineering",
        "project_id": "SPRINT-19",
    },
    {
        "id": "status_sprint22",
        "title": "Sprint 22 Status Report Week 2",
        "content": """# Sprint 22 Status Report — Week 2
## Progress
16/22 story points completed (73%)
## Health: AT RISK
Historical average at Day 7: 82% | Current: 73%
## Blockers
- Design review pending for 3 mobile screens
- Third-party API rate limiting on bulk exports
## Scope Change
+2 story points added (9% creep) — within threshold
## Prediction
78% probability on-time based on velocity trend
## Assignee Compliance
2 assignees have not updated tickets in 48 hours — reminders sent""",
        "doc_type": "status_report",
        "team": "Product",
        "project_id": "SPRINT-22",
    },
    {
        "id": "sop_brd",
        "title": "BRD Writing SOP",
        "content": """# SOP: Business Requirement Document Writing
## Purpose
Standardize BRD creation across IndiaMart product teams
## Required Sections
1. Executive Summary (2-3 sentences)
2. Problem Statement (quantified with data)
3. Target Users (segment, size)
4. Success Metrics (SMART goals)
5. Scope (in-scope and out-of-scope)
6. Technical Requirements
7. Dependencies and Risks
8. Timeline and Milestones
9. Team and Responsibilities
## Quality Checklist
- [ ] Problem backed by data
- [ ] Success metrics are measurable
- [ ] All dependencies identified
- [ ] Risks have mitigation plans
- [ ] Deadline is realistic given team capacity""",
        "doc_type": "SOP",
        "team": "All",
        "project_id": "SOP-BRD",
    },
]


class RAGService:
    def __init__(self):
        self.embedding_model = None
        self.client = None
        self.collection = None
        self._initialized = False

    def _lazy_init(self):
        if self._initialized:
            return
        os.makedirs(CHROMA_DB_PATH, exist_ok=True)
        self.embedding_model = SentenceTransformer("all-MiniLM-L6-v2")
        self.client = chromadb.PersistentClient(path=CHROMA_DB_PATH)
        self.collection = self.client.get_or_create_collection(
            name="project_knowledge_base",
            metadata={"hnsw:space": "cosine"},
        )
        # Seed with sample documents if collection is empty
        if self.collection.count() == 0:
            self._seed_knowledge_base()
        self._initialized = True

    def _seed_knowledge_base(self):
        for doc in SAMPLE_DOCUMENTS:
            embedding = self.embedding_model.encode(doc["content"]).tolist()
            self.collection.add(
                ids=[doc["id"]],
                embeddings=[embedding],
                documents=[doc["content"]],
                metadatas=[
                    {
                        "title": doc["title"],
                        "doc_type": doc["doc_type"],
                        "team": doc["team"],
                        "project_id": doc["project_id"],
                    }
                ],
            )

    def ingest_document(
        self,
        doc_id: str,
        content: str,
        title: str,
        doc_type: str,
        team: str = "All",
        project_id: str = "",
    ) -> bool:
        self._lazy_init()
        try:
            embedding = self.embedding_model.encode(content).tolist()
            # Check if exists and update, else add
            try:
                self.collection.get(ids=[doc_id])
                self.collection.update(
                    ids=[doc_id],
                    embeddings=[embedding],
                    documents=[content],
                    metadatas=[
                        {
                            "title": title,
                            "doc_type": doc_type,
                            "team": team,
                            "project_id": project_id,
                        }
                    ],
                )
            except Exception:
                self.collection.add(
                    ids=[doc_id],
                    embeddings=[embedding],
                    documents=[content],
                    metadatas=[
                        {
                            "title": title,
                            "doc_type": doc_type,
                            "team": team,
                            "project_id": project_id,
                        }
                    ],
                )
            return True
        except Exception as e:
            print(f"Error ingesting document: {e}")
            return False

    def retrieve(
        self,
        query: str,
        doc_type_filter: Optional[str] = None,
        top_k: int = 5,
    ) -> List[Dict]:
        self._lazy_init()
        try:
            query_embedding = self.embedding_model.encode(query).tolist()

            where_filter = None
            if doc_type_filter:
                where_filter = {"doc_type": {"$eq": doc_type_filter}}

            results = self.collection.query(
                query_embeddings=[query_embedding],
                n_results=min(top_k, self.collection.count()),
                where=where_filter,
                include=["documents", "metadatas", "distances"],
            )

            retrieved = []
            for i, doc in enumerate(results["documents"][0]):
                score = 1 - results["distances"][0][i]  # Convert distance to similarity
                if score >= 0.3:  # Minimum relevance threshold
                    retrieved.append(
                        {
                            "content": doc,
                            "metadata": results["metadatas"][0][i],
                            "score": round(score, 3),
                        }
                    )
            return retrieved
        except Exception as e:
            print(f"Error during retrieval: {e}")
            return []

    def retrieve_for_document_generation(
        self, problem: str, doc_type: str
    ) -> str:
        self._lazy_init()
        results = self.retrieve(
            query=problem,
            doc_type_filter=doc_type if doc_type in ["BRD", "SOW", "SOP"] else None,
            top_k=3,
        )
        if not results:
            return "No historical examples found. This may be a novel document type."

        formatted = []
        for i, r in enumerate(results, 1):
            title = r["metadata"].get("title", "Untitled")
            score = r["score"]
            formatted.append(
                f"### Example {i}: {title} (Relevance: {score:.0%})\n{r['content'][:800]}"
            )
        return "\n\n".join(formatted)

    def retrieve_blocker_patterns(self, blocker_description: str) -> str:
        self._lazy_init()
        results = self.retrieve(
            query=blocker_description,
            doc_type_filter="retrospective",
            top_k=3,
        )
        if not results:
            return "No historical blocker patterns found for this type of issue."

        formatted = []
        for r in results:
            title = r["metadata"].get("title", "Untitled")
            formatted.append(f"**{title}**:\n{r['content'][:600]}")
        return "\n\n".join(formatted)

    def get_stats(self) -> Dict:
        self._lazy_init()
        count = self.collection.count()
        return {
            "total_documents": count,
            "collection_name": "project_knowledge_base",
            "embedding_model": "all-MiniLM-L6-v2",
        }


rag_service = RAGService()
