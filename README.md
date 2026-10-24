# dsh-evo-subagent

[English](README.md) | [简体中文](README.zh-CN.md)

![dsh-evo-subagent — Route. Remember. Evolve.](assets/Evo-subagent-preview.png)

[![npm](https://img.shields.io/npm/v/dsh-evo-subagent.svg)](https://www.npmjs.com/package/dsh-evo-subagent)
[![License](https://img.shields.io/npm/l/dsh-evo-subagent.svg)](LICENSE)

**Different workspaces, different personalities. A familiar assistant that adapts to you.**

**Independent workspace personas · Adaptive styles · Preferences you control**

Give development projects an efficient partner, discussions an independent perspective, and everyday conversations a warmer companion. Share one persona or keep each workspace separate, with an optional independent persona for an individual conversation.

## What it does

| Feature | What you get |
| --- | --- |
| Workspace personas | Set a name, preset and style guidance for each project. |
| Conversation personas | Follow the workspace or give this conversation its own persona. |
| Adaptive styles | Refine tone, detail and interaction through your explicit feedback. |
| Companion presets | Choose warm, calm, playful, direct or patient styles. |
| Approved preferences | Keep general communication habits in one editable summary. |
| Role-based collaboration | Route subagents to any registered model and retain useful project experience. |

Independent profiles learn within their own scope without updating the shared persona. New long-term preferences require your approval.

## Install

```sh
dsh plugin add dsh-evo-subagent
```

Requires DeepSeek Harness `^0.2.1-rc.2` and Node.js `>=24.2.0`.

Previously installed as `evo-subagent`? Remove the old package, then install the new name:

```sh
dsh plugin remove evo-subagent
dsh plugin add dsh-evo-subagent
```

Existing local personas, preferences, role bindings and project experience are reused.

## Get started

Open DSH's **plugin settings** and select **dsh-evo-subagent**.

- **Companion persona:** check **Separate persona for each workspace** to list your workspaces. Expand a project to enable its persona and choose a name, preset and style guidance. Uncheck it to use one shared persona; saved workspace profiles remain available.
- **Inside a conversation:** open **Persona** beside the input. Choose **Follow workspace settings** or **This conversation only**. New independent conversation profiles start with background learning paused.
- **Adaptive style:** choose **Autonomous exploration** and enable **Get to know me**. Give explicit direction, such as “Be concise when coding, and listen before offering advice when I talk about worries.”
- **User habits:** maintain one short summary of general preferences. New suggestions appear in a matching collapsible panel for you to edit and approve.
- **Subagent management:** choose a workspace, add built-in roles or your own agent files, and select registered models. Supports models registered by provider plugins, including Codex and Claude Code.

Persona changes apply to subsequent replies. General habits have their own sharing controls, so you can share communication preferences while keeping project personas separate.

## Your data and control

Profiles stay in the local DSH user directory. Background persona learning sends small conversation excerpts to the selected model and incurs additional usage. You can pause learning, forget preferences or restore a previous style.

## What's new in 1.2

- Renamed the package and repository from **evo-subagent** to **dsh-evo-subagent**.
- Simplified workspace independence to one checkbox with collapsible workspace settings.
- Simplified conversation choices and aligned preference-update panels with the rest of the interface.

[Full changelog](CHANGELOG.md) · [Release notes](https://github.com/ZekaiShi/dsh-evo-subagent/releases)

## Walkthrough

![Subagent management walkthrough](assets/evo-subagent-tutorial.gif)

[Watch the subagent-management video](assets/evo-subagent-tutorial.mp4). This recording covers role configuration; persona settings are described above.

## Download history

![Cumulative npm downloads](assets/npm-downloads.svg)

The chart combines cumulative npm downloads for `evo-subagent` and `dsh-evo-subagent`, updated daily. Downloads do not represent unique users.

[Report an issue](https://github.com/ZekaiShi/dsh-evo-subagent/issues) · [MIT License](LICENSE)
