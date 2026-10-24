# Changelog / 更新日志

## 1.0.0 — 2026-10-24

### English — Personas, preferences and scoped evolution

The first major release adds companion personas and confirmed communication preferences to evo-subagent's existing role routing and project knowledge evolution.

- **Companion persona:** five presets—warm, calm, playful, direct and patient guide—or autonomous exploration. Four local Markdown documents maintain principles, approved preferences, interaction agreements and bounded evolution state. Core values never change automatically.
- **Background evolution:** completed human main turns can be observed in an isolated model call. Every ten observed turns in a session, one combined review can make small, evidence-backed style adjustments. Fixed usage limits, foreground preemption and no automatic retries control overhead. New lasting memories need owner approval; style rollback is available.
- **User habits:** one editable paragraph for reusable language, tone, detail, structure and evidence preferences. Assistant suggestions require an exact human quote and approval. Names, roleplay, temporary moods and task-specific details stay out of shared profiles.
- **Independent sharing scopes:** persona and habits each support sharing everywhere, sharing within a workspace, or keeping each conversation independent. Different projects can use different personas. Child agents inherit the parent main conversation's selected profile. Switching scope keeps saved profiles without copying memories; missing scoped context never falls back to global data.
- **Settings refresh:** a consistent animated layout for all three sections, readable native dropdowns in dark/light themes, complete Chinese and English interfaces, and simpler everyday controls. Internal cadence and budget limits are not exposed as settings.
- **Existing features retained:** exact registered provider/model routing, workspace agent bindings, built-in role templates, per-agent `prefercmd.md` / `memory.md`, and the three bundled DSH Agent Skills.

**Upgrade and compatibility**

- Requires DSH `^0.2.1-rc.2`, Cordis `~4.0.5` and Node.js `>=24.2.0`.
- Existing bindings, project knowledge and global profiles are preserved. New persona/habits profiles are off by default; enable them explicitly in Settings → Built-in plugins → evo-subagent.
- Scoped profiles remain in the local DSH home, outside project repositories. Observer allowances are shared across profiles in that home. No cloud sync or telemetry is added.
- Validation: 172 automated tests and an isolated ten-turn persona simulation passed using fake models, with no external model calls. This validates implementation behavior, not the quality of every model's personalized responses.

### 中文 — 人格、习惯与分范围进化

首个重大版本，在既有角色分工路由和项目经验进化之外，加入陪伴人格与经过用户确认的交流习惯。

- **陪伴人格：** 提供温和陪伴、理性沉稳、轻松幽默、直接利落、细致引导五种预设，以及自主探索模式。四份本地 Markdown 文件分别维护原则、已确认偏好、相处约定与有限的进化状态，核心价值边界不会自动改写。
- **后台进化：** 真实用户主对话完成后，可通过独立模型调用观察；每个会话累计十次观察后合并复盘，根据明确证据小幅调整表达风格。固定预算、前台优先和不自动重试控制开销；新的长期记忆需要用户确认，支持风格回滚。
- **用户习惯：** 将通用语言、语气、详略、回答结构和证据偏好整理为一段可编辑摘要。助手提议必须引用真实用户原话并经过确认；称呼、角色扮演、临时情绪和当前任务细节不进入共享档案。
- **独立适用范围：** 人格与习惯分别支持所有工作区共享、每个工作区独立、每个对话独立，可为不同项目配置不同人格。子代理沿用所属主对话的档案；切换范围保留历史档案，不自动复制记忆，无法识别范围时不回退到全局数据。
- **设置体验统一：** 三栏使用一致的展开动效，修复深浅主题下拉菜单可读性，补齐中英文界面，精简日常设置。观察周期与预算作为内部硬约束，不提供用户修改选项。
- **保留原有能力：** 精确匹配已注册 provider/model 的路由、工作区绑定、内置角色模板、各代理的 `prefercmd.md` / `memory.md`，以及三个随包提供的 DSH Agent Skill。

**升级与兼容**

- 需要 DSH `^0.2.1-rc.2`、Cordis `~4.0.5`、Node.js `>=24.2.0`。
- 原有绑定、项目经验和全局档案保留。新的人格／习惯档案默认关闭，可在“设置 → 内置插件 → evo-subagent”中主动开启。
- 分范围档案仍保存在本机 DSH 用户目录，不写入项目仓库。同一用户目录下所有人格档案共用后台额度，不增加云同步或遥测。
- 验证结果：172 项自动化测试和独立十轮人格模拟通过，使用假模型，未调用外部模型。测试验证实现行为，不代表所有模型的人格表达质量都相同。

## Earlier releases / 历史版本

See [README.md](README.md#changelog) or [README.zh-CN.md](README.zh-CN.md#更新日志) for versions 0.8.0 and earlier.
