# assets

Plugin preview images, hosted here so the awesome-dsh-plugin market can link
them via `raw.githubusercontent.com/ZekaiShi/evo-subagent/main/assets/...`.

## Tutorial media

- `evo-subagent-tutorial.mp4` — updated on 2026-10-23 from the supplied DSH recording, starting at source time 00:13 and continuing to the end (about 25 seconds).
- `evo-subagent-tutorial.gif` — silent looping preview of the same walkthrough for both READMEs.
- Recorded interface: DSH `0.2.1-rc.2`, Chinese UI, isolated `Demo project`; no production credentials or model requests.
- Navigation: More → Settings → Built-in plugins → evo-subagent. After the first six seconds, the view zooms into the settings panel for readability. The MP4 has no audio.

## 放图指引 / Where generated previews go

把生成的预览图放到本目录，命名建议：

- `assets/hero.png` — 主展示图（GitHub 社交预览 / 市场卡片，推荐 1280×640 或 4:3）
- `assets/demo.png` — 可选的功能示意（如路由流程概念图）

生成后用 `git add assets/` 提交到仓库 main 分支，market 里的截图
（`data/screenshots.json`）会自动从 `raw.githubusercontent.com/...` 加载。
