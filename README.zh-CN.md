# dsh-evo-subagent

[English](README.md) | [简体中文](README.zh-CN.md)

![dsh-evo-subagent — Route. Remember. Evolve.](assets/Evo-subagent-preview.png)

[![npm](https://img.shields.io/npm/v/dsh-evo-subagent.svg)](https://www.npmjs.com/package/dsh-evo-subagent)
[![许可证](https://img.shields.io/npm/l/dsh-evo-subagent.svg)](LICENSE)

**不同工作区，不同人格；让熟悉的助手逐渐适应你。**

**工作区独立人格 · 自适应风格 · 由你掌控的偏好记忆**

开发项目需要高效搭档，讨论需要独立判断，日常交流需要温和陪伴。可以共享一份熟悉的人格，也可以为每个工作区分别配置，或让某段对话拥有自己的风格。

## 可以做什么

| 功能 | 用途 |
| --- | --- |
| 工作区人格 | 为不同项目设置人格名称、预设和风格要求。 |
| 对话人格 | 跟随工作区，或让当前对话单独维护人格。 |
| 自适应风格 | 根据你的明确反馈，逐渐调整语气、详略和互动方式。 |
| 陪伴预设 | 温和陪伴、理性沉稳、轻松幽默、直接利落、细致引导。 |
| 偏好记忆 | 用一份可编辑摘要保存你确认的通用交流习惯。 |
| 角色协作 | 子代理路由到任意已注册模型，积累可复用的项目经验。 |

独立档案中的学习留在本范围内，不回写共享人格。新的长期偏好由你确认。

## 安装

```sh
dsh plugin add dsh-evo-subagent
```

需要 DeepSeek Harness `^0.2.1-rc.2` 和 Node.js `>=24.2.0`。

如果之前安装的是 `evo-subagent`，先移除旧包，再安装新名称：

```sh
dsh plugin remove evo-subagent
dsh plugin add dsh-evo-subagent
```

原有人格、偏好、角色绑定和项目经验会继续复用。

## 开始使用

打开 DSH 的**插件设置**，进入 **dsh-evo-subagent**。

- **陪伴人格：** 勾选**每个工作区独立**，直接列出工作区；展开项目，即可启用该人格、设置名称、预设和风格要求。取消勾选后使用共享人格，原有工作区档案保留。
- **对话人格：** 在输入框旁打开**人格**，选择**跟随工作区**或**仅此对话独立**。新建独立对话档案默认暂停后台学习。
- **自适应风格：** 选择**自主探索**并开启**逐渐了解我**，再用明确反馈给出方向，例如：“写代码时直接一些，聊烦恼时先听我说，再给建议。”
- **用户习惯：** 用一段简短摘要维护通用偏好。新的建议放在统一样式的折叠面板中，由你修改和确认。
- **子代理管理：** 选择工作区，添加内置角色或自己的 agent 文件，再选择已注册模型。支持通过其他 provider 插件接入的 Codex、Claude Code 等模型。

人格设置保存后，后续回复即可采用。通用习惯有自己的共享范围，可以跨项目共享交流偏好，同时让各工作区保持独立人格。

## 数据与控制

档案保存在本机 DSH 用户目录。开启人格学习后，少量对话摘录会发送给所选模型进行后台整理，并产生额外模型用量。可以随时暂停学习、忘记偏好或恢复上次风格。

## 1.2 更新了什么

- 包名与 GitHub 仓库正式从 **evo-subagent** 更名为 **dsh-evo-subagent**。
- 工作区独立简化为一个勾选项，下方按工作区折叠管理。
- 简化对话人格选择，统一通用偏好更新面板的布局与动画。

[完整更新日志](CHANGELOG.md) · [版本发布说明](https://github.com/ZekaiShi/dsh-evo-subagent/releases)

## 操作演示

![子代理管理操作演示](assets/evo-subagent-tutorial.gif)

[观看子代理管理视频](assets/evo-subagent-tutorial.mp4)。此录制介绍角色配置；人格设置请参考上方说明。

## 下载趋势

![npm 累积下载量](assets/npm-downloads.svg)

图表合并统计 `evo-subagent` 与 `dsh-evo-subagent` 的 npm 累积下载量，每天更新。下载次数不等于独立用户数。

[反馈问题](https://github.com/ZekaiShi/dsh-evo-subagent/issues) · [MIT 许可证](LICENSE)
