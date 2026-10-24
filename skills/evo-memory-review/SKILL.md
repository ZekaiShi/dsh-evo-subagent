---
name: evo-memory-review
description: Review and curate a dsh-evo-subagent role's prefercmd.md and memory.md using evidence from actual runs. Use when evolution entries are stale, duplicated, contradictory, or too noisy.
---

# Evo memory review

Review one workspace and one agent role at a time. The files are `<workspace>/.evo_subagent/evolution/<agent_key>/prefercmd.md` and `memory.md`; the main agent uses `main` as its key. The former `.smart_subagent/evolution` location can be a read-only fallback until the plugin migrates it.

- Compare each command with the workspace, operating system, tools, and available run evidence. Keep only commands actually shown to work; put reusable lessons or failure conditions in `memory.md`.
- Identify exact duplicates, conflicting advice, and entries tied to removed paths or versions. Treat `!` as pinned and `?` as lower priority. Do not remove a pinned entry or turn an unverified guess into a verified command without evidence.
- Present a compact keep/rewrite/remove proposal with reasons and the evidence used. If the user requested edits, make the smallest approved changes to these two files and preserve unrelated entries. Otherwise, stop at recommendations.
- After editing, reread both files and summarize the actual changes. Never add secrets, tokens, or raw private logs to evolution memory.

The plugin already bounds injected context and deduplicates new entries. This skill focuses on the quality of the stored knowledge, not on changing the plugin's storage rules.
