# evo-subagent

[English](README.md) | [简体中文](README.zh-CN.md)

![evo-subagent — Route. Remember. Evolve.](assets/Evo-subagent-preview.png)

[![npm](https://img.shields.io/npm/v/evo-subagent.svg)](https://www.npmjs.com/package/evo-subagent)
[![License](https://img.shields.io/npm/l/evo-subagent.svg)](LICENSE)

**Different workspaces, distinct personas. A style that fits each project and conversation.**

**Style across workspaces · Independent personas · Switch within a conversation**

evo-subagent 1.1 helps your DeepSeek Harness assistant fit the project: efficient and direct for development, thoughtful and independent for discussion, warm for everyday conversation. Share a familiar style across workspaces or assign a separate persona to each workspace and conversation. Independent profiles keep their style learning local without updating the global persona.

## What you can do

| Feature | What it does |
| --- | --- |
| Workspace personas | Give each project its own persona name, preset and style guidance. |
| Independent conversations | Choose a separate persona beside the input box and keep its style and learning within that conversation. |
| Adaptive style | Prefer concise, playful or detailed replies? Let explicit feedback gradually shape tone, detail and interaction. |
| Companion personas | Choose a warm companion, calm thinker, playful partner, concise helper or patient guide. |
| Style learning | Review conversation feedback in the background and gradually refine how your assistant responds. |
| Preference memory | Keep the communication preferences you approve, shared across conversations or separate for each project. |
| Role-based teamwork | A companion to talk with and a team to work with: give roles their own models and reusable task experience. |

## Install

```sh
dsh plugin add evo-subagent
```

Requires DeepSeek Harness `^0.2.1-rc.2` and Node.js `>=24.2.0`.

## Get started

Open DSH's **plugin settings** and select **evo-subagent**. The page has three sections; enable only the features you want.

### Assign a workspace persona

Open **Companion persona → Workspace personas**, choose a project and check **Maintain a separate persona for this workspace**. Set its name, preset and style guidance, such as “Efficient colleague: lead with a plan and retain independent judgment.”

Saved settings apply to subsequent responses immediately. Changes and learning stay in that workspace without updating the global persona.

### Start or switch an independent conversation

Open **Persona** beside the conversation input and choose **Independent workspace** or **This conversation only**. Adjust its preset, guidance and learning switch there. The control is available before the first message and in existing conversations. New independent profiles start with background learning off until you enable it.

### Companion persona

Choose a sharing scope and, if needed, the workspace or conversation to configure. Enable **Companion persona**, then choose:

- **Companion persona mode (Fixed preset):** choose a warm, calm, playful, direct or patient style for a familiar conversational tone.
- **Adaptive style mode (Autonomous exploration):** start from a preset, explore small style variations and refine them using your explicit feedback.

Want the style to take shape as you talk? Choose **Autonomous exploration** and turn on **Get to know me** for **style learning**: your assistant reviews conversation feedback in the background and gradually adjusts its expression. Give it a direction, for example:

> Be more playful in everyday chats, get straight to the point when coding, and listen before offering advice when I talk about a difficult day.

You approve new lasting memories and can pause learning, forget preferences or restore a previous style whenever you want.

### User habits

Enable **User habits** and edit a short summary, for example:

> Lead with the conclusion, keep routine answers concise, and explain the evidence when needed.

New suggestions appear as one proposed update for you to edit and approve. Only confirmed preferences are applied.

### Subagent management

Select a workspace, add a built-in role or use your own role files, and choose a registered provider/model for each role. Enable learning to reuse verified commands and lessons in later tasks.

Routing works with **any model registered in DSH**, including models registered by other provider plugins for **Codex or Claude Code**. Configure those providers separately, then select their models here.

## Choose what to share

Persona and user habits have **separate scope selectors**. For example, keep one communication preference summary everywhere while using a different persona in each project.

| Scope | Behavior |
| --- | --- |
| Share everywhere | One profile across all workspaces and conversations. |
| Separate by workspace | Conversations in a workspace share a profile; different projects stay independent. |
| Separate by conversation | Each conversation in each workspace has its own profile. |

Switching scope keeps your saved profiles. Keep shared defaults while assigning independence only to selected workspaces or conversations. To configure an older conversation, open it in DSH and refresh the list.

## Your data and controls

Profiles stay in your local DSH user directory. When persona learning is enabled, short conversation excerpts are sent to the selected model for background processing, which adds model usage. You approve new lasting memories and can pause or disable learning at any time.

Existing model routes, project experience and persona profiles remain available after upgrading.

## What's new in 1.1

- Workspace persona names, custom style guidance and individual assignments.
- A persona picker beside the input box, including independent conversation learning.
- Optional integration with the Bilibili plugin to retain video notes in a chosen workspace for future tasks.

[Full changelog](CHANGELOG.md) · [Release notes](https://github.com/ZekaiShi/evo-subagent/releases)

## Walkthrough

![Subagent management walkthrough](assets/evo-subagent-tutorial.gif)

[Watch the subagent-management video](assets/evo-subagent-tutorial.mp4). This walkthrough covers role configuration; the persona and habits sections were added in 1.0.

## Optional: content memory for your Bilibili companion

Configure [dsh-bili-scroll](https://github.com/c1overzz/dsh-bili-scroll) and keep its reports enabled. In an independent workspace's persona settings, open **Optional: Bilibili content learning** and select **Link this workspace**.

Video notes are retained in that workspace and supplied alongside its persona to later Bilibili runs. They are reference material, not user preferences or persona values. Sync, forget notes or disconnect whenever you want; comment and messaging settings remain controlled by the Bilibili plugin.

## Downloads

![Cumulative npm downloads](assets/npm-downloads.svg)

Cumulative npm downloads, refreshed daily. Downloads are not a count of unique users.

[Report an issue](https://github.com/ZekaiShi/evo-subagent/issues) · [MIT License](LICENSE)
