# Retrospective Prompt Template

Use this as a prompt-shaping reference when editing or debugging retrospective generation.

## Goal

Generate a sprint retrospective that is:

- grounded in selected sprint data only
- concrete and ticket-aware
- concise enough for leadership review
- structured in valid Markdown

## Expected Sections

1. Sprint Summary
2. What Went Well
3. What Did Not Go Well
4. Blockers and Risks
5. Key Learnings
6. Action Items for Next Sprint

## Guardrails

- Do not invent tickets outside the selected sprint or bucket
- Prefer specific examples over generic agile phrasing
- Use assignee workload and incomplete tickets when assigning owners
- Keep action items operational and immediately usable
