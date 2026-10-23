# evo-subagent

![evo-subagent — Route. Remember. Evolve.](assets/Evo-subagent-preview.png)

[English](README.md) | [简体中文](README.zh-CN.md)

[![npm version](https://img.shields.io/npm/v/evo-subagent.svg)](https://www.npmjs.com/package/evo-subagent)
[![license](https://img.shields.io/npm/l/evo-subagent.svg)](LICENSE)
[![Node.js](https://img.shields.io/badge/Node.js-%3E%3D24.2.0-339933?logo=node.js&logoColor=white)](package.json)

## Downloads

![Cumulative npm downloads](assets/npm-downloads.svg)

Cumulative npm download data since the first release, refreshed automatically every day. DSH Market ranks plugins using npm downloads, so this is the closest public adoption signal; it cannot distinguish marketplace installs from direct npm installs.

`evo-subagent` is a DeepSeek Harness plugin for predictable subagent routing and project-scoped evolution.

It maps stable agent roles to registered provider/model pairs, remembers verified commands and lessons for each role, and keeps every project's agent knowledge isolated.

## Features

- Route each `agent_key` through a same-named Markdown binding.
- Validate the exact provider/model pair before creating a child agent.
- Maintain per-agent `prefercmd.md` and `memory.md` knowledge files.
- Isolate bindings and evolution data by project workspace.
- Support fresh `spawn` children and context-aware `fork` children.
- Fall back to DSH's native model inheritance when no binding exists.
- Store no API keys, endpoints, credentials, or provider definitions.

## Installation

Version `0.8.x` requires DeepSeek Harness `0.2.1-rc.2` (supported range: `^0.2.1-rc.2`) and Node.js `>=24.2.0`. For DSH `0.1.5-rc.3`, use plugin version `0.7.0`.

```sh
dsh plugin add evo-subagent
```

## Quick start

![Open and manage evo-subagent in DSH](assets/evo-subagent-tutorial.gif)

1. Open **More (bottom-left) → Settings → Built-in plugins → evo-subagent** and expand the configuration card. This is inside Settings, not the standalone Plugins page in the main sidebar.
2. Select a workspace and add a built-in role, or place a custom binding in its `agents/` directory.
3. Choose a registered provider/model pair for each custom binding.
4. Expand an agent to review its `prefercmd.md` and `memory.md` evolution files.

[Download the MP4 tutorial](assets/evo-subagent-tutorial.mp4)

The 25-second walkthrough uses a demo workspace on DSH `0.2.1-rc.2`. The settings panel is enlarged after the navigation steps; demo provider/model names are illustrative, not additional built-in models.

## Changelog

New entries are added at the top for every maintained release.

### 2026-10-23 — Tutorial refresh

- Replaced the GIF and MP4 with a walkthrough of the current settings location.
- Clarified the full path from the bottom-left More menu and distinguished it from the standalone Plugins page.
- Documentation and media update only; no new npm release.

### 0.8.0 — 2026-10-21

- Adapted subagent startup to DSH `0.2.1-rc.2`'s managed activation API, including foreground cancellation and background completion delivery.
- Moved the configuration card to its own **evo-subagent** tab on the new Plugins settings page.
- Now follows the session's current working directory when resolving project bindings and evolution files.
- Updated the supported DSH/Cordis versions and added checks against the real DSH tool, activation, and skill services.

### 0.7.0 — 2026-09-27

- Refreshed the development validation baseline to DeepSeek Harness `0.1.5-rc.3`.
- Bundled three DSH Agent Skills for route diagnosis, memory review, and delegation guidance. They appear in the DSH skill catalog when the skill service is available.
- Confirmed the subagent routing seam remains unchanged.

### 0.6.1 — 2026-09-19

- Refreshed the development validation baseline to DeepSeek Harness `0.1.5-rc.2`.
- Rechecked routing, workspace evolution, and settings tests without changing plugin behavior.

### 0.6.0 — 2026-09-12

- Added compatibility with DeepSeek Harness `0.1.5-rc.1` and Cordis `4.0.2`.
- Raised the required Node.js runtime to `>=24.2.0` for the updated DSH CLI.
- Revalidated routing, workspace evolution, and settings behavior on the new runtime.

## Agent bindings

Create an `agents/` directory in the project and add one Markdown file per role. The filename stem becomes the `agent_key`.

```text
project/
├─ agents/
│  ├─ code-reviewer.md
│  └─ researcher.md
└─ .evo_subagent/
   └─ evolution/
```

Each binding begins with a strict front matter block:

```md
---
provider: deepseek-official
model: deepseek-v4-flash
---

# Code reviewer
Optional role notes may follow.
```

The provider and model must already be registered. Matching is exact and case-sensitive.

Call the plugin tool with the corresponding key:

```json
{
  "agent_key": "code-reviewer",
  "description": "Review the implementation",
  "prompt": "Report correctness, security, and test coverage issues.",
  "run_in_background": false
}
```

## Built-in roles

Three templates are included:

| `agent_key` | Role |
| --- | --- |
| `code-reviewer` | Severity-ranked code review |
| `researcher` | Evidence-backed investigation |
| `wps-worker` | Office document production |

A project binding with the same `agent_key` overrides its built-in template.

## Bundled Agent Skills

Installing this plugin also registers three optional DSH-compatible skills in the DSH skill catalog. They guide the parent agent; they are not additional subagent roles.

| Skill | Purpose |
| --- | --- |
| `/evo-route-doctor` | Diagnose an unexpected route or invalid registered provider/model pair. |
| `/evo-memory-review` | Review a role's `prefercmd.md` and `memory.md` for stale or conflicting knowledge. |
| `/evo-delegation-guide` | Choose an existing role and prepare a scoped subagent task. |

DSH needs its skill registry and skill tool enabled for these entries to appear. A project-specific skill with the same name can override a bundled entry. The skill files are also included in the npm package under `skills/`.

## Evolution

Each project stores role-specific knowledge under:

```text
.evo_subagent/evolution/<agent_key>/prefercmd.md
.evo_subagent/evolution/<agent_key>/memory.md
```

- `prefercmd.md` records commands that have been verified to work.
- `memory.md` records reusable lessons and failures to avoid.

Foreground subagents receive a bounded knowledge block. They can return new entries with:

```md
[[EVOLUTION]]
prefercmd:
- pnpm test
memory:
- Do not use --force in CI.
[[/EVOLUTION]]
```

Entries are deduplicated and bounded. Prefix an entry with `!` to keep it at highest priority, or `?` to make it compressible when the context budget is tight.

Background tasks use DSH's parent completion delivery. Use `run_in_background: false` to wait for the result and save returned evolution entries. Cancelling a foreground call also stops its child activation.

Legacy `.smart_subagent/evolution` data remains a read-only fallback and is copied to the new location on the next save.

## Workspace management

The plugin settings card groups agents by project and lets users:

- view or collapse workspace agent lists;
- edit a custom binding's registered provider/model route;
- add a built-in role to a workspace by copying its template;
- bind one workspace-root `AGENTS.md` as the Main agent;
- inspect and edit each agent's evolution files.

Main-agent evolution is stored under `.evo_subagent/evolution/main/`. Binding and unbinding only changes the plugin-managed instruction block in `AGENTS.md`.

## Tool fields

| Field | Required | Description |
| --- | --- | --- |
| `agent_key` | Yes | Binding filename without `.md`. |
| `description` | Yes | Short task label. |
| `prompt` | Yes | Complete task for the child agent. |
| `run_in_background` | No | Defaults to `true`; use `false` to collect evolution output. |

## Routing behavior

1. Resolve `<agent_key>.md` safely.
2. Parse its fenced `provider` and `model` fields.
3. Verify both values against the live model registry.
4. Start the child through the selected `spawn` or `fork` provider.

Invalid bindings fail before a child is created. Missing bindings preserve native DSH inheritance unless a built-in template matches.

## Development

Requires Node.js 24.2 or newer.

```sh
npm test
npm run check
npm pack --dry-run
```

## License

[MIT](LICENSE)
