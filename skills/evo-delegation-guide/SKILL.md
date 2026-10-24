---
name: evo-delegation-guide
description: Choose an existing dsh-evo-subagent role and prepare a focused delegation task. Use when deciding which agent_key to call or when a child task needs clearer scope and acceptance criteria.
---

# Evo delegation guide

Select a role that exists in the current workspace or one of the bundled roles: `code-reviewer` for code review, `researcher` for evidence gathering, and `wps-worker` for office documents. Check the role binding and the task before delegating; do not invent an `agent_key` or assume that a role's model is registered.

Write the child task with its objective, relevant files or sources, constraints, and expected output. Give it only the permissions implied by the user's request. Keep independent tasks separate, but avoid creating a child when the work is a quick step in the current task.

When using `evo_subagent`, pass the chosen `agent_key`, a short `description`, and a self-contained `prompt`. A nonempty prompt overrides a bundled role prompt, so include any role-specific instructions needed for this task. Use `run_in_background: false` when the parent needs the result and evolution feedback in this turn; background work is continuable but does not use the foreground evolution recorder.

After the child returns, check its output against the requested deliverable and report what is verified and what remains open. Do not treat a child's unsupported claim as completed work.
