---
name: evo-route-doctor
description: Diagnose dsh-evo-subagent provider/model routing and workspace binding failures in DeepSeek Harness. Use when a child runs on the wrong model, inherits unexpectedly, or fails before starting.
---

# Evo route doctor

Find the route selected for a specific `agent_key` and explain it from the current workspace and registered DSH models.

1. Identify the conversation workspace and the exact `agent_key`. Inspect `<workspace>/agents/<agent_key>.md`; if absent, check whether it is one of the plugin's bundled templates (`code-reviewer`, `researcher`, `wps-worker`). An unknown key inherits the parent route.
2. For a binding or template, check the strict four-line header: `---`, `provider: <id>`, `model: <id>`, `---`. Compare both IDs, including case, with the models registered in this DSH session. The plugin rejects an unregistered pair before starting a child.
3. Check whether the caller supplied a nonempty `prompt`. For a built-in role, that replaces its bundled role prompt; a workspace copy uses its local role body only when the caller's prompt is empty.
4. Report the observed route, the file or inheritance path that selected it, the first failing check, and the smallest correction. If the live registry is unavailable, say that registration remains unverified.

Keep diagnosis read-only unless the user asks to change a binding. Do not print credentials or infer a model from its display name.
