# AGENTS.md — Canonical AI Agent Operating Entry Point

> 🤖 **Instructions for AI Coding Assistants (Antigravity, Claude Code, Cursor, OpenCode, Codex, etc.)**  
> Before modifying or creating any files in this repository, you **MUST** strictly follow the protocol below.

---

## ⚡ Agent Standard Operating Procedure (SOP)

1. **Check Project State**: Read `.booking/project-state.json` if it exists to understand current verified capabilities.
2. **Read Operating Rules**: Read and comply with `.agent/AGENT-RULES.md` (Core transactions, Safe Schema, Security boundaries, Documentation ownership).
3. **Identify Capability / Episode**: Determine the requested capability (e.g., `booking-core` via `ep01-basic-booking`, `rich-menu` via `ep02-rich-menu`).
4. **Load Episode Contract**: Read `.agent/episodes/<episode-id>/episode.json` and `.agent/episodes/<episode-id>/TASK.md`.
5. **Verify Prerequisites**: Check all prerequisites declared in `requires` before executing steps.
6. **Execute & Verify**: Execute the steps strictly as defined in `TASK.md`. Verify actual external systems (Cloudflare, LINE, D1) before concluding.
7. **Strict State Update**: **NEVER** mark a capability as `verified` unless all verification conditions have passed.
8. **Enforce Privacy & Security**: **NEVER** commit private store settings, real LINE UIDs, or secrets to Git. Refer to `docs/SECURITY-AND-SECRETS.md`.
9. **Documentation Sequence**: Follow the strict `Verify ➔ State ➔ README ➔ Episode Doc ➔ CHANGELOG ➔ Tag` sequence defined in Rule 14.
