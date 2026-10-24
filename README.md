# evo-subagent

[English](README.md) | [简体中文](README.zh-CN.md)

![evo-subagent — Route. Remember. Evolve.](assets/Evo-subagent-preview.png)

[![npm](https://img.shields.io/npm/v/evo-subagent.svg)](https://www.npmjs.com/package/evo-subagent)
[![License](https://img.shields.io/npm/l/evo-subagent.svg)](LICENSE)

**An assistant that works in different roles, learns from experience, and adapts to how you like to talk.**

evo-subagent 1.0 brings companion personas, user preferences and subagent teamwork together in DeepSeek Harness. Share one profile everywhere, or give each project or conversation its own personality.

## What you can do

| Feature | What it does |
| --- | --- |
| Companion persona | Choose a preset or let your assistant gradually adapt its interaction style. |
| User habits | Keep your preferred language, tone and answer style in one editable summary. |
| Subagent management | Give different roles their own models and help them reuse lessons from previous tasks. |

## Install

```sh
dsh plugin add evo-subagent
```

Requires DeepSeek Harness `^0.2.1-rc.2` and Node.js `>=24.2.0`.

## Get started

Open DSH's **plugin settings** and select **evo-subagent**. The page has three sections; enable only the features you want.

### Companion persona

Choose a sharing scope and, if needed, the workspace or conversation to configure. Enable **Companion persona**, then choose:

- **Fixed preset:** warm companion, calm and rational, light and playful, direct and concise, or patient guide.
- **Autonomous exploration:** start from a preset and gradually refine the interaction style using your explicit feedback.

Turn on **Get to know me** to allow background learning. You can review new memories, pause learning, forget preferences or restore a previous style.

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

Switching scope keeps your saved profiles. New independent profiles start with the features off; select a target and configure it before use. To configure an older conversation, open it in DSH and refresh the list.

## Your data and controls

Profiles stay in your local DSH user directory. When persona learning is enabled, short conversation excerpts are sent to the selected model for background processing, which adds model usage. You approve new lasting memories and can pause or disable learning at any time.

Existing model routes and project experience remain available when upgrading to 1.0.

## What's new in 1.0

- Companion personas with presets and adaptive interaction styles.
- One editable summary of your communication preferences.
- Independent global, workspace and conversation profiles.
- A simpler settings page with consistent animations, readable dark-theme menus, and Chinese/English interfaces.

[Full changelog](CHANGELOG.md) · [Release notes](https://github.com/ZekaiShi/evo-subagent/releases/tag/v1.0.0)

## Walkthrough

![Subagent management walkthrough](assets/evo-subagent-tutorial.gif)

[Watch the subagent-management video](assets/evo-subagent-tutorial.mp4). This walkthrough covers role configuration; the persona and habits sections were added in 1.0.

## Downloads

![Cumulative npm downloads](assets/npm-downloads.svg)

Cumulative npm downloads, refreshed daily. Downloads are not a count of unique users.

[Report an issue](https://github.com/ZekaiShi/evo-subagent/issues) · [MIT License](LICENSE)
