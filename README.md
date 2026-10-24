# evo-subagent

![evo-subagent — Route. Remember. Evolve.](assets/Evo-subagent-preview.png)

[English](README.md) | [简体中文](README.zh-CN.md)

[![npm version](https://img.shields.io/npm/v/evo-subagent.svg)](https://www.npmjs.com/package/evo-subagent)
[![license](https://img.shields.io/npm/l/evo-subagent.svg)](LICENSE)
[![Node.js](https://img.shields.io/badge/Node.js-%3E%3D24.2.0-339933?logo=node.js&logoColor=white)](package.json)

## Downloads

![Cumulative npm downloads](assets/npm-downloads.svg)

Cumulative npm download data since the first release, refreshed automatically every day. DSH Market ranks plugins using npm downloads, so this is the closest public adoption signal; it cannot distinguish marketplace installs from direct npm installs.

`evo-subagent` brings role-based subagent routing, project-scoped evolution, companion personas and user preferences to DeepSeek Harness.

It maps stable agent roles to registered provider/model pairs and remembers verified commands and lessons for each role. Version 1.0 also lets you choose how your assistant interacts with you, with separate personas and preferences for different workspaces or conversations.

## Features

- Route each `agent_key` through a same-named Markdown binding.
- Validate the exact provider/model pair before creating a child agent.
- Maintain per-agent `prefercmd.md` and `memory.md` knowledge files.
- Isolate bindings and evolution data by project workspace.
- Support fresh `spawn` children and context-aware `fork` children.
- Fall back to DSH's native model inheritance when no binding exists.
- Store no API keys, endpoints, credentials, or provider definitions.
- Share confirmed collaboration habits globally, by workspace, or independently per conversation (opt-in).
- Build a four-file companion persona with five presets or bounded autonomous style exploration (opt-in).

## Installation

Version `1.0.0` requires DeepSeek Harness `0.2.1-rc.2` (supported range: `^0.2.1-rc.2`) and Node.js `>=24.2.0`. For DSH `0.1.5-rc.3`, use plugin version `0.7.0`.

```sh
dsh plugin add evo-subagent
```

## Quick start

![Open and manage evo-subagent in DSH](assets/evo-subagent-tutorial.gif)

1. Open **More (bottom-left) → Settings → Built-in plugins → evo-subagent** and expand the configuration card. This is inside Settings, not the standalone Plugins page in the main sidebar.
2. Select a workspace and add a built-in role, or place a custom binding in its `agents/` directory.
3. Choose a registered provider/model pair for each custom binding.
4. Expand an agent to review its `prefercmd.md` and `memory.md` evolution files.
5. Optionally open **Companion persona** or **User habits**, choose a sharing scope and target, then enable the feature for that profile.

[Download the MP4 tutorial](assets/evo-subagent-tutorial.mp4)

The 25-second walkthrough uses a demo workspace on DSH `0.2.1-rc.2`. The settings panel is enlarged after the navigation steps; demo provider/model names are illustrative, not additional built-in models.

## Changelog

New entries are added at the top for every maintained release. See the [full bilingual changelog](CHANGELOG.md).

### 1.0.0 — 2026-10-24 · Personas, preferences and scoped evolution

Our first major release brings the assistant's interaction style and confirmed preferences alongside the existing role-routing and project-evolution features.

- Added five persona presets, autonomous style exploration, and four local Markdown documents. Values stay stable; only evidence-backed expression dimensions evolve.
- Added isolated background observation after completed human main turns, with a combined review every ten observed turns, bounded budgets, foreground preemption, approval and style rollback.
- Fixed native dropdown foreground/background colors for both dark and light DSH themes.
- Simplified everyday settings and unified all three animated sections. Observation cadence and resource limits are fixed internal constraints, not user-configurable controls.
- Consolidated general user preferences into one editable paragraph. Names, nicknames and conversation/task-specific requests no longer enter shared habits; legacy records are retained but excluded from shared context.
- Completed Chinese and English labels across all three settings sections, including workspace subagent management. The interface follows DSH's language; other locales fall back to the complete English version. Model IDs, workspace names and filenames are not translated.
- Added independent sharing scopes for persona and user habits: global, workspace, or conversation. Each target has its own settings and memories; switching scope preserves profiles without copying them. Observer quotas remain shared across profiles in one DSH home.
- Added a separate user-habits module, independent of role routing and project evolution.
- Added a local Markdown profile and authenticated controls for approval, correction, forgetting, and pausing learning.
- Assistant suggestions require evidence from the latest human message and owner approval. No old-history scanning or extra model calls are performed.

**Upgrading:** existing routing, project evolution and global profiles remain in place. Persona and habits are off by default for new profiles; each module can use its own sharing scope. Switching scope preserves saved profiles without migrating memories automatically. Validated against DSH `0.2.1-rc.2` with 172 passing automated tests and an isolated ten-turn persona simulation; no external model calls were used for these checks.

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

## Sharing scope

**Companion persona** and **User habits** each have their own **Sharing scope** selector:

| Scope | Behavior |
| --- | --- |
| Share everywhere | All workspaces and conversations in this DSH home use one profile. This preserves the previous default. |
| Separate by workspace | Conversations in the same workspace share a profile; different workspaces can use different personas and preferences. |
| Separate by conversation | Each main conversation in each workspace maintains an independent profile. |

For either independent mode, select the workspace or conversation below the scope selector before editing its settings. Conversation choices come from sessions currently open in DSH; open an older conversation and refresh to configure it. Child agents use their parent main conversation's profile; a separately forked main conversation has its own identity. Missing workspace/session context does not fall back to the global profile.

Changing scope does not copy or delete profiles. Existing global data stays in place, and each new target starts with the feature off until you configure it. Switching back restores that scope's saved settings. Scoped profiles live under `$DSH_HOME/evo-subagent/scopes/{workspace|conversation}/<hashed-target>/`, containing `persona/` (the same four documents) and/or `user-habits.md`. Project repositories stay untouched. `sharing.json` stores the two scope choices and the shared observer usage ledger; creating more profiles does not increase the daily allowance.

## Companion persona

Open **More → Settings → Built-in plugins → evo-subagent → Companion persona**. The independent `evo-subagent/persona` module is **off by default**; reading settings creates no files and makes no model calls. Enable it only if you accept the additional model usage and excerpt processing.

- **Modes:** fixed presets (warm companion, calm/rational, playful, direct/concise, patient guide), or autonomous exploration. Exploration starts from a safe preset, occasionally varies one expression dimension for a small group of turns, and stops random probing after 60 observed turns. Clear, consistent feedback can still refine style afterwards. Current requests and agent roles always take precedence.
- **Four files per profile:** in global mode, `$DSH_HOME/evo-subagent/persona/{core,user,relationship,evolution}.md` (default home: `~/.dsh`); independent modes use the scoped directory above. `core.md` holds owner-editable principles; `user.md` approved preferences; `relationship.md` approved shared agreements; `evolution.md` bounded observation windows, budgets, style versions and one rollback snapshot. These are Markdown with editable JSON blocks. Keep the document headers/generation fields intact. Malformed files fail closed; no silent reset.
- **Automatic loop:** only new, completed, actual-human main turns are eligible. After foreground work is idle, a single isolated call observes bounded visible excerpts. Every tenth observed turn **in that session** uses the same call to review its latest ten records. Child/tool/runtime messages, reasoning blocks, cancelled turns and old histories are excluded. Up to eight recent session windows are retained; older windows may be evicted sooner to keep the commit document below 128 KiB.
- **Conservative evolution:** warmth, humor, detail, initiative and directness are numeric dimensions, not arbitrary model-written instructions. A review can move at most two dimensions by one step, only with explicit quoted support from at least two distinct turns in the same scenario and no opposing signals. Core values never auto-change. Lasting user preferences and relationship notes remain pending until approved. Silence and politeness are not approval. This is prompt-level adaptation, not model training or real emotions.
- **Internal limits:** 256 output tokens per ordinary observation; 768 on the tenth-turn review. Input text is capped at 6,000/14,000 UTF-8 bytes, and injected persona context at 3,600 bytes (byte limits are **not** exact token counts). Limits are fixed at 120 calls and 32,768 reserved output tokens per UTC day; settings/API requests cannot change them, and legacy editable quotas are ignored. Reservations include failed/cancelled calls conservatively. A 15-second deadline, queue limit of eight, no automatic retries and foreground cancellation keep failures out of the main response. Under load/budget exhaustion, observations may be skipped. Shared provider rate limits can still affect performance. These technical counters are not shown in everyday settings.
- **Routing and privacy:** the observer normally follows the completed turn's registered provider/model. Existing pinned routes are respected; advanced API integrations can provide both route fields. Everyday settings do not require provider/model configuration. The observer selects available non-thinking/low effort rather than inheriting the main agent's high effort. It has no tools and does not append evaluation text to chat. Bounded user/answer excerpts and candidate quotes are sent to that provider and saved locally; obvious credentials and quoted/code blocks are filtered, but this is not a complete secret detector. Pause learning, disable, forget notes, clear observations, and restore a previous style in authenticated settings. Clearing a profile does not erase pre-existing DSH/provider logs.

The four-file commit checkpoint supports crash recovery, local write locking and stale-edit protection. Same-generation manual JSON edits are recognized; stale projections recover from `evolution.md` on the next successful write. Back up before editing files directly; do not mix snapshots from different generations. Stop writers before removing a stale `.lock` after a crash. No cloud sync, external CLI injection, global `AGENTS.md` changes or automatic migration of the older opt-in habits profile is added. Existing approved habits remain separate and continue to work. Optional-runtime-context-disabled DSH presets may suppress persona injection.

## User collaboration habits

Open **More → Settings → Built-in plugins → evo-subagent → User habits**, then enable the feature. It is **off by default** and creates no profile merely by being installed or read. You can prepare confirmed habits manually before enabling it.

The bundle loads a separate `evo-subagent/habits` plugin row requiring only DSH's tools and system-prompt services. Main agents, native subagents, and evo-subagents use the profile selected by the configured sharing scope in this DSH runtime and home; calling `evo_subagent` is not required.

In global mode, the profile lives outside project repositories (independent modes use the scoped directory above):

```text
$DSH_HOME/evo-subagent/user-habits.md
```

Without `DSH_HOME`, the default is `~/.dsh/evo-subagent/user-habits.md`. Different homes, Windows/WSL installations and devices do **not** automatically share or synchronize profiles. This preview assumes one user owns the DSH host; it is not multi-user personalization. It does not modify global or project `AGENTS.md` files.

- **One general summary:** cross-conversation language, detail, tone, answer structure and evidence preferences are displayed as one editable paragraph, without per-entry categories or lists. Names, nicknames, roleplay, temporary feelings, current tasks and project-specific instructions stay in their own conversation, not global habits.
- **Pending updates:** the assistant calls `evo_user_habits` with an exact quote supporting a general preference. Eligible candidates are merged into one proposed summary; you may edit and approve the whole update, or decline it. Child agents can read the shared summary but cannot propose changes.
- **Controls:** edit the whole summary, clear its text to forget the applied preferences, review a combined update, pause suggestions, or disable injection. Old scoped records remain on disk for compatibility but are not displayed or injected globally. The same scope filter also applies to persona memory, preventing legacy nicknames from reappearing through that path.
- **Boundaries:** preferences are lower-authority user context, not permissions, project knowledge, personality judgments or a reason to agree with unsupported claims. Current requests and applicable project instructions take precedence. The plugin does not scrape old sessions or call a second model to classify behavior; suggestions depend on the active assistant using the tool.
- **Privacy:** only the confirmed general summary enters model context. Evidence excerpts remain in the local profile and existing conversation/tool logs; they are not expanded into a settings list. Editing or clearing the applied summary does not erase archived evidence, DSH logs or provider-side records. No cloud sync or telemetry is added.

The summary is limited to 960 characters; internal general entries retain the 12-confirmed/20-pending caps and 240-character per-entry limit. Summary composition and common local-scope checks are deterministic, with no additional model call; they are conservative rules, not perfect semantic classification. The Markdown remains the source of truth. Unrecognized or malformed content fails closed. Writes use revision checks, a local lock and atomic replacement. Stop writers before inspecting/removing a stale `.lock` after a crash.

Normal runtime-context-enabled DSH presets are supported. Presets suppressing optional runtime context and external Codex/Claude Code processes are not guaranteed to receive the profile automatically. The feature changes no permissions, models or role prompts.

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
