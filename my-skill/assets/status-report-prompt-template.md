# Status Report Prompt Template

Use this as a prompt-shaping reference when editing or debugging status report generation.

## Goal

Generate a weekly sprint status report that combines:

- live OpenProject metrics
- blocker context
- historical report examples from RAG
- clear person-wise next actions

## Expected Sections

1. Sprint Summary
2. Problem Tickets
3. Progress
4. Blockers and Risks
5. Historical Comparison
6. Person-wise Analysis and Actions
7. Recommendations

## Guardrails

- Preserve Markdown table validity
- Keep person-wise counts aligned with deterministic backend analysis
- Do not collapse multiple rows onto a single line
- Keep recommendations actionable and tied to current sprint data
