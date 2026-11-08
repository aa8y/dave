# Agent instructions for Dave

## Documentation

Keep all internal documentation in `.internal/`: audits, plans, architecture notes, decisions, investigations, handoffs, and internal reference material. Create the directory when absent. Use `.internal/audits/`, `.internal/plans/`, `.internal/reference/`, and `.internal/archive/` as appropriate. Never put credentials or tokens in documentation.

`.internal/` is intentionally ignored by Git and stays local unless the user explicitly requests sharing or tracking particular documents. Explain this when delivering internal artifacts. Do not force-add internal documents by default. Public README, changelog, license, and these agent entry points remain at the repository root. Root agent entry points should link to internal material rather than duplicate it.

## Planning authority

Plans must be created and revised by a top-level planning model: **Astra with OpenAI** or **Fable with Anthropic**. The planner adopts the role of a Staff Software Engineer, Staff Security Engineer, or another relevant Staff-level engineering specialist. Assess outcomes, risks, compatibility, and validation before breaking work down.

If the required planning model is unavailable, report the limitation and request the appropriate model or an explicit user override; do not silently substitute. Model names below are routing requirements, not a claim that every provider/model is available in the current environment.

Every implementation plan must contain:

- Stories describing user or operational outcomes, decomposed into tasks and executable subtasks.
- Stable IDs and explicit dependencies forming a directed acyclic graph (DAG). List immediate predecessor IDs; use an empty list for roots. Check for missing references and cycles.
- For every subtask: scope, complexity (**High**, **Medium**, or **Low**), assigned model, acceptance criteria, meaningful validation, and one or more intended commits with subjects. Distinguish complexity from severity and priority.
- Story/task completion criteria, execution order or parallel waves, material risks, and a definition of done. A parent completes only after its children and prerequisites pass review.

## Delegation and model routing

Stories, tasks, and subtasks are handled by subagents. The top-level planner coordinates the DAG, assigns bounded work, reviews results, and integrates completed work. Story/task coordinators use the highest complexity of their owned work; each executable subtask uses its own rating.

| Complexity | OpenAI | Anthropic |
| --- | --- | --- |
| High | Sol | Opus |
| Medium | Terra | Sonnet |
| Low | Mini | Haiku |

Use the active provider's mapping and a verified available model identifier. Do not invent identifiers or substitute another model without an explicit user override. If routing is unavailable, report the blocked assignment and continue independent authorized work. Delegate only ready nodes whose dependencies are satisfied. Give each subagent scope, owned files, prerequisites, acceptance criteria, validation, and expected commits. Avoid concurrent edits to the same files; sequence shared-file work or isolate it. Subagents report changes, checks, risks, and commit IDs. Every completed implementation subtask must produce one or more focused commits. Do not mark planned commits as completed before they exist.

## Engineering and security expectations

Read relevant internal references if available, then verify claims against current code. Ignored documentation may be absent in fresh clones; these instructions remain usable without it. Preserve unrelated user changes. Keep public behavior compatible unless the plan explicitly calls out a necessary behavior change.

Treat manifests containing shell templates as executable code with the invoking user's privileges. Never run untrusted manifests, publish images, or use real credentials as audit probes. Prefer inert fixtures and fake executables. Cover malformed input, command selection, shell/argument boundaries, process failure and cancellation, and resource limits. Separate confirmed bugs, known dependency advisories, hardening recommendations, and unverified risks in reports.

Use the Node version in `.nvmrc`; run `npm test` for implementation changes and relevant regression checks. Check locked dependencies without automatically applying broad upgrades. Preserve phase barriers, deterministic ordering, explicit skip behavior, and keep-going semantics unless deliberately revised. Do not use coverage percentages as a substitute for behavioral tests.

Current internal starting points: `.internal/reference/codebase.md`, `.internal/audits/2026-09-09/report.md`, and `.internal/plans/2026-09-09-improvement-plan.md`.
