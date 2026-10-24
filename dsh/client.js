// Browser half of the evo-subagent dsh plugin: the Evolution settings card.
//
// Renders a plugin card in Settings -> Plugins (the settings.plugins.tab
// slot). The card groups every detected subagent by project workspace, shows
// each agent's current routing provider/model, lets you switch the model with a
// dropdown (writes the binding .md front matter), edits each agent's hidden
// prefercmd.md / memory.md evolution files, and flips the evolution toggle.
//
// Hand-written in the lazy-CJS bundle protocol
// (window.__ModuleLoader__.load with a factory returning cordis-plugin
// exports), so no build step and no dsh client imports — the same
// zero-dependency stance as the modlens card it was modelled on.
window.__ModuleLoader__.load({
  id: 'evo-subagent',
  factory: (require) => {
    var module = { exports: {} }
    var exports = module.exports

    // Native option popups may keep a light system background in dark mode.
    // Set both colors explicitly on the control and options using DSH tokens.
    var selectColors = {
      backgroundColor: 'var(--dsw-alias-bg-layer-3, #fff)',
      color: 'var(--dsw-alias-label-primary, #222)',
    }

    var EN = {
      title: 'Subagent management',
      subtitle: 'Manage models and learned experience for each workspace',
      scope: 'Scope',
      scopeBindings: 'Bindings',
      scopeEvolution: 'Evolution',
      scopeProjects: 'Workspace source',
      scanAuto: 'Registered workspaces',
      scanManual: 'Custom folder',
      scanNone: 'Not configured',
      scanFallback: 'Fallback workspace folder — used only when no workspaces are registered; leave blank to clear',
      scanSave: 'Save',
      builtin: 'Built-in templates',
      builtinHint: 'Ready-to-use official roles',
      addTo: 'Add to',
      addTemplate: 'Add built-in template',
      added: 'Added',
      addFailed: 'Add failed',
      noWorkspace: 'No target workspace',
      mainAgent: 'Main agent',
      mainAgentHint: 'AGENTS.md in the workspace root',
      mainAgentUnbound: 'Not bound',
      mainAgentMissing: 'AGENTS.md not found',
      mainAgentFailed: 'Main agent update failed',
      projects: 'Workspace subagents',
      projectsHint: 'Each workspace keeps its agents and learned experience separate',
      provider: 'Provider',
      model: 'Routing model',
      modelFixed: 'built-in template (read-only)',
      source: { binding: 'binding', template: 'built-in', both: 'binding + built-in' },
      toggle: 'Learn from tasks',
      toggleHint: 'Reuse verified commands and lessons in future tasks',
      prefercmd: 'prefercmd.md — verified commands',
      memory: 'memory.md — lessons learned',
      save: 'Save',
      saved: 'Saved',
      saving: 'Saving…',
      discard: 'Discard',
      loadFailed: 'Load failed',
      saveFailed: 'Save failed',
      toggleFailed: 'Toggle failed',
      modelFailed: 'Model update failed',
      configFailed: 'Config update failed',
      loading: 'Loading…',
      empty: 'No projects with an agents/ folder found',
      scanHint: 'No workspaces are registered in this profile yet. Open a conversation in a project folder, or set a fallback dir above.',
      open: 'Expand',
      colon: ': ',
      listSeparator: ', ',
    }
    var ZH = {
      title: '子代理管理',
      subtitle: '按工作区管理子代理的模型与经验',
      scope: '作用域',
      scopeBindings: '绑定目录',
      scopeEvolution: '进化目录',
      scopeProjects: '工作区来源',
      scanAuto: '已添加的工作区',
      scanManual: '自定义文件夹',
      scanNone: '未配置',
      scanFallback: '备用工作区文件夹，仅在未添加工作区时使用，留空可清除',
      scanSave: '保存',
      builtin: '内置模板',
      builtinHint: '官方角色，始终可用',
      addTo: '添加到',
      addTemplate: '添加内置模板',
      added: '已添加',
      addFailed: '添加失败',
      noWorkspace: '无目标工作区',
      mainAgent: '主代理',
      mainAgentHint: '工作区根目录中的 AGENTS.md',
      mainAgentUnbound: '未绑定',
      mainAgentMissing: '未检测到 AGENTS.md',
      mainAgentFailed: '主代理更新失败',
      projects: '工作区子代理',
      projectsHint: '不同工作区的子代理与经验相互独立',
      provider: '模型提供方',
      model: '路由模型',
      modelFixed: '内置模板（只读）',
      source: { binding: '绑定', template: '内置', both: '绑定 + 内置' },
      toggle: '积累任务经验',
      toggleHint: '让子代理在后续任务中复用已验证的命令与经验',
      prefercmd: 'prefercmd.md — 已验证命令',
      memory: 'memory.md — 经验教训',
      save: '保存',
      saved: '已保存',
      saving: '保存中…',
      discard: '放弃修改',
      loadFailed: '加载失败',
      saveFailed: '保存失败',
      toggleFailed: '切换失败',
      modelFailed: '模型更新失败',
      configFailed: '配置更新失败',
      loading: '加载中…',
      empty: '未发现含 agents/ 文件夹的项目',
      scanHint: '当前配置尚未添加工作区。在项目文件夹里打开对话，或在上方填写备用文件夹。',
      open: '展开',
      colon: '：',
      listSeparator: '、',
    }

    function useInterfaceLanguage(react, localeRef) {
      var subscribe = callback => localeRef.current ? localeRef.current.subscribe(callback) : () => {}
      var read = () => localeRef.current ? localeRef.current.getSnapshot().active : ''
      var active = typeof react.useSyncExternalStore === 'function' ? react.useSyncExternalStore(subscribe, read, read) : read()
      // DSH commonly uses zh/en; region tags from other clients are accepted.
      // Other locales get the complete English interface, never mixed labels.
      return /^zh(?:[-_]|$)/i.test(String(active || '')) ? 'zh' : 'en'
    }

    function noteFrom(error, fallback) {
      var text = error && error.message ? error.message : ''
      return text ? fallback + ': ' + text : fallback
    }

    var settingsCss = `
      .evo-settings-section{border:1px solid var(--dsw-alias-border-l2,rgba(127,127,127,.35));border-radius:12px;background:var(--dsw-alias-bg-layer-3,rgba(127,127,127,.05));transition:background .18s ease,border-color .18s ease}
      .evo-settings-section[data-open=true]{background:var(--dsw-alias-bg-layer-2,rgba(127,127,127,.10))}
      .evo-settings-heading{appearance:none;width:100%;font:inherit;color:inherit;text-align:left;cursor:pointer;background:transparent;border:0;border-radius:12px;display:flex;align-items:center;gap:12px;padding:14px 16px}
      .evo-settings-heading:hover{background:var(--dsw-alias-interactive-bg-hover,rgba(127,127,127,.06))}
      .evo-settings-chevron{flex:none;color:var(--dsw-alias-label-tertiary,#888);transition:transform .18s ease}
      .evo-settings-chevron[data-open=true]{transform:rotate(180deg)}
      .evo-settings-reveal{display:grid;grid-template-rows:0fr;opacity:0;visibility:hidden;transition:grid-template-rows .18s ease,opacity .18s ease,visibility .18s step-end}
      .evo-settings-reveal[data-open=true]{grid-template-rows:1fr;opacity:1;visibility:visible;transition:grid-template-rows .18s ease,opacity .18s ease,visibility 0s}
      .evo-settings-clip{min-height:0;overflow:hidden}
      .evo-settings-content{padding:0 16px 14px}
      @media(prefers-reduced-motion:reduce){.evo-settings-section,.evo-settings-chevron,.evo-settings-reveal{transition:none!important}}
    `
    function sectionChevron(h, open) {
      return h('svg', { width: 16, height: 16, viewBox: '0 0 16 16', className: 'evo-settings-chevron', 'data-open': String(open), 'aria-hidden': true },
        h('path', { d: 'M4 6l4 4 4-4', fill: 'none', stroke: 'currentColor', strokeWidth: 1.5, strokeLinecap: 'round', strokeLinejoin: 'round' }))
    }
    function SettingsSectionFactory(react) {
      var h = react.createElement
      return function SettingsSection({ id, title, hint, open, onToggle, children }) {
        // Retain the content while closing so height/opacity can transition in
        // both directions. Hidden panels are inert, including keyboard focus.
        var retained = react.useRef(null)
        if (open) retained.current = children
        return h('section', { className: 'evo-settings-section', 'data-evo-section': id, 'data-open': String(open) },
          h('button', { type: 'button', className: 'evo-settings-heading', 'aria-expanded': open, 'aria-controls': 'evo-panel-' + id, onClick: onToggle },
            h('div', { style: { flex: 1, minWidth: 0 } },
              h('div', { style: { fontSize: '14px', fontWeight: 600 } }, title),
              h('div', { style: { color: 'var(--dsw-alias-label-tertiary, #888)', fontSize: '13px', lineHeight: 1.5, marginTop: '4px' } }, hint)), sectionChevron(h, open)),
          h('div', { id: 'evo-panel-' + id, className: 'evo-settings-reveal', 'data-open': String(open), 'aria-hidden': !open, inert: open ? undefined : '' },
            h('div', { className: 'evo-settings-clip' }, h('div', { className: 'evo-settings-content' }, retained.current))))
      }
    }

    function ScopeControlFactory(react) {
      var h = react.createElement
      return function ScopeControl({ sharing, zh, busy, onScope, onTarget }) {
        var t = zh ? {
          scope: '适用范围', global: '所有工作区共享', workspace: '每个工作区独立', conversation: '每个对话独立',
          workspaceTarget: '配置工作区', conversationTarget: '配置对话', choose: '请选择…',
          globalHint: '所有工作区和对话使用同一份档案。', workspaceHint: '同一工作区内的对话共享档案，不同工作区相互独立。', conversationHint: '每个工作区中的每个对话分别维护自己的档案。',
          retained: '切换范围会保留原档案，不会自动复制记忆或设置。', empty: '请先在 DSH 中打开对应工作区或对话，再刷新。',
        } : {
          scope: 'Sharing scope', global: 'Share everywhere', workspace: 'Separate by workspace', conversation: 'Separate by conversation',
          workspaceTarget: 'Workspace to configure', conversationTarget: 'Conversation to configure', choose: 'Choose…',
          globalHint: 'All workspaces and conversations use one profile.', workspaceHint: 'Conversations in the same workspace share a profile. Each workspace is independent.', conversationHint: 'Each conversation in each workspace has its own independent profile.',
          retained: 'Switching scope keeps existing profiles without copying memories or settings.', empty: 'Open the workspace or conversation in DSH, then refresh.',
        }
        sharing = sharing || { mode: 'global', options: [], selectedId: 'global' }
        var style = { width: '100%', minWidth: 0, boxSizing: 'border-box', font: 'inherit', fontSize: '12px', padding: '6px 8px', border: '1px solid var(--dsw-alias-border-l2, #666)', borderRadius: '7px', ...selectColors }
        var mode = sharing.mode, options = sharing.options || []
        function select(label, value, choices, onChange) {
          return h('label', { style: { display: 'grid', gap: '5px', minWidth: 0 } }, label,
            h('select', { 'aria-label': label, value, disabled: busy, style, onChange: event => onChange(event.target.value) },
              choices.map(pair => h('option', { key: pair[0], value: pair[0], style: selectColors }, pair[1]))))
        }
        return h('div', { 'data-evo-sharing': mode, style: { margin: '12px 0', lineHeight: 1.6 } },
          select(t.scope, mode, ['global', 'workspace', 'conversation'].map(key => [key, t[key]]), onScope),
          h('p', { style: { fontSize: '12px', opacity: 0.75 } }, t[mode + 'Hint']),
          mode !== 'global' ? select(mode === 'workspace' ? t.workspaceTarget : t.conversationTarget, sharing.selectedId || '', [['', t.choose], ...options.map(item => [item.id, item.label])], onTarget) : null,
          mode !== 'global' && !options.length ? h('p', { role: 'status' }, t.empty) : null,
          h('p', { style: { fontSize: '12px', opacity: 0.65 } }, t.retained))
      }
    }

    function PersonaFactory(react, localeRef, Section, ScopeControl) {
      var h = react.createElement
      return function PersonaCard() {
        var zh = useInterfaceLanguage(react, localeRef) === 'zh'
        var t = zh ? {
          title: '陪伴人格', hint: '选择喜欢的相处方式，让助手慢慢了解你',
          privacy: '开启后会在后台使用模型整理少量对话摘录，产生额外用量。新的长期记忆由你确认，也可以随时暂停。',
          enabled: '启用陪伴人格', learning: '逐渐了解我', mode: '相处方式', preset: '人格预设',
          presetMode: '固定预设', exploreMode: '自主探索', warm: '温和陪伴', calm: '理性沉稳', playful: '轻松幽默', direct: '直接利落', guide: '细致引导',
          reload: '刷新', off: '尚未开启', paused: '已暂停了解，保留当前人格', ready: '正在逐渐了解你', unavailable: '暂时无法整理新的了解，正常对话不受影响。', manage: '管理记忆',
          pending: '待确认喜好与相处记忆', approve: '确认', reject: '拒绝', remove: '忘记',
          user: '通用偏好', relationship: '通用相处约定', add: '补充偏好', text: '例如：偏好中文交流，先给结论，语气温和简洁', confirmForget: '忘记这段已确认的通用偏好？',
          rollback: '恢复上次风格', clear: '清除未确认的了解', confirmClear: '清除尚未确认的了解和近期调整记录？已经确认的记忆会保留。', empty: '新的了解会先在这里请你确认。',
          error: '操作失败', loading: '加载中…', general: '通用', coding: '编程', research: '科研', writing: '写作',
        } : {
          title: 'Companion persona', hint: 'Choose how you connect, and let your assistant get to know you',
          privacy: 'When enabled, short conversation excerpts are processed by a model in the background, with extra usage. You approve lasting memories and can pause learning at any time.',
          enabled: 'Enable companion persona', learning: 'Get to know me', mode: 'Interaction style', preset: 'Persona preset',
          presetMode: 'Fixed preset', exploreMode: 'Autonomous exploration', warm: 'Warm companion', calm: 'Calm and rational', playful: 'Light and playful', direct: 'Direct and concise', guide: 'Patient guide',
          reload: 'Refresh', off: 'Not enabled', paused: 'Learning paused; current persona retained', ready: 'Getting to know you', unavailable: 'Learning is temporarily unavailable. Normal conversation is unaffected.', manage: 'Manage memories',
          pending: 'Pending preferences and relationship notes', approve: 'Approve', reject: 'Reject', remove: 'Forget',
          user: 'General preferences', relationship: 'General interaction preferences', add: 'Add preference', text: 'For example: concise conclusions, a warm tone, and evidence when needed', confirmForget: 'Forget this confirmed general preference summary?',
          rollback: 'Restore previous style', clear: 'Clear unconfirmed memories', confirmClear: 'Clear unconfirmed memories and recent adjustments? Confirmed memories will remain.', empty: 'New memories will appear here for your approval.',
          error: 'Operation failed', loading: 'Loading…', general: 'General', coding: 'Coding', research: 'Research', writing: 'Writing',
        }
        var openState = react.useState(false), dataState = react.useState(null), busyState = react.useState(false), errorState = react.useState('')
        var textState = react.useState('')
        var data = dataState[0], busy = busyState[0]
        var personaPending = data ? data.generalPending || [] : []
        var control = { font: 'inherit', fontSize: '12px', padding: '6px 8px', border: '1px solid var(--dsw-alias-border-l2, #666)', borderRadius: '7px', ...selectColors }
        var button = { ...control, cursor: 'pointer', backgroundColor: 'transparent' }
        var input = { ...control, width: '100%', boxSizing: 'border-box' }
        async function request(body, target) {
          busyState[1](true); errorState[1]('')
          try {
            var selected = body && body.action === 'set-scope' ? '' : target === undefined ? data && data.sharing && data.sharing.selectedId : target
            var response = await fetch('/api/evo-subagent/persona' + (selected ? '?target=' + encodeURIComponent(selected) : ''), { method: body ? 'POST' : 'GET', credentials: 'same-origin', cache: 'no-store',
              ...(body ? { headers: { 'content-type': 'application/json' }, body: JSON.stringify({ revision: data && data.revision, sharingRevision: data && data.sharing && data.sharing.revision, ...body }) } : {}) })
            var result = await response.json()
            if (!response.ok) throw new Error(result.error || 'HTTP ' + response.status)
            dataState[1](result); if (target !== undefined || (body && ['add', 'set-scope'].includes(body.action))) textState[1]('')
          } catch (error) { dataState[1](null); errorState[1](noteFrom(error, t.error)) }
          finally { busyState[1](false) }
        }
        react.useEffect(() => { if (openState[0]) request() }, [openState[0]])
        function select(label, value, values, change) {
          return h('label', { style: { display: 'grid', gap: '5px', minWidth: 0 } }, label,
            h('select', { 'aria-label': label, value, disabled: busy, onChange: event => change(event.target.value), style: input },
              values.map(pair => h('option', { key: pair[0], value: pair[0], style: selectColors }, pair[1]))))
        }
        function notes(target) {
          var summary = data.summaries && data.summaries[target]
          if (!summary) return null
          return h('div', null, h('h4', null, t[target]), h('p', { style: { overflowWrap: 'anywhere' } }, summary),
            h('button', { type: 'button', style: button, disabled: busy, onClick: () => { if (window.confirm(t.confirmForget)) request({ action: 'forget-general', target }) } }, t.remove))
        }
        return h(Section, { id: 'persona', title: t.title, hint: t.hint, open: openState[0], onToggle: () => openState[1](!openState[0]) },
          openState[0] ? h('div', { style: { fontSize: '13px', lineHeight: 1.6 } },
            h('p', null, t.privacy),
            h('button', { type: 'button', style: button, disabled: busy, onClick: () => request() }, busy ? t.loading : t.reload),
            errorState[0] ? h('p', { role: 'alert' }, errorState[0]) : null,
            data ? h(ScopeControl, { sharing: data.sharing, zh, busy, onScope: scope => request({ action: 'set-scope', scope }), onTarget: target => request(undefined, target) }) : null,
            data && !data.scopeOnly ? h('div', null,
              h('p', { role: 'status', style: { opacity: 0.7, fontSize: '12px' } }, !data.config.enabled ? t.off : !data.config.learning ? t.paused : t.ready),
              ['enabled', 'learning'].map(key => h('label', { key, style: { display: 'block', margin: '10px 0' } }, h('input', { type: 'checkbox', checked: data.config[key], disabled: busy || (key === 'learning' && !data.config.enabled),
                onChange: event => request({ action: 'configure', [key]: event.target.checked }) }), ' ', t[key])),
              h('div', { style: { display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '8px' } },
                select(t.mode, data.config.mode, [['preset', t.presetMode], ['explore', t.exploreMode]], value => request({ action: 'configure', mode: value })),
                select(t.preset, data.config.preset, ['warm', 'calm', 'playful', 'direct', 'guide'].map(key => [key, t[key]]), value => request({ action: 'configure', preset: value }))),
              data.stats.lastError || (data.runtime && data.runtime.error) ? h('p', { role: 'status' }, t.unavailable) : null,
              personaPending.length ? h('h4', null, t.pending) : h('p', { style: { opacity: 0.65, fontSize: '12px' } }, t.empty), personaPending.map(p => h('div', { key: p.id, style: { borderTop: '1px solid var(--dsw-alias-border-l2, #666)', padding: '8px 0' } },
                h('p', null, t[p.target] + ': ' + p.text), h('blockquote', null, p.quote),
                h('button', { type: 'button', style: button, disabled: busy, onClick: () => request({ action: 'approve', id: p.id }) }, t.approve), ' ',
                h('button', { type: 'button', style: button, disabled: busy, onClick: () => request({ action: 'reject', id: p.id }) }, t.reject))),
              h('details', { style: { marginTop: '12px' } }, h('summary', null, t.manage),
              notes('user'), notes('relationship'),
              h('input', { 'aria-label': t.text, placeholder: t.text, maxLength: 240, style: input, value: textState[0], disabled: busy, onChange: event => textState[1](event.target.value) }),
              h('button', { type: 'button', style: button, disabled: busy || !textState[0].trim(), onClick: () => request({ action: 'add', target: 'user', context: 'general', text: textState[0] }) }, t.add),
              h('div', { style: { display: 'flex', gap: '8px', marginTop: '12px', flexWrap: 'wrap' } },
                h('button', { type: 'button', style: button, disabled: busy || !data.previous, onClick: () => request({ action: 'rollback' }) }, t.rollback),
                h('button', { type: 'button', style: button, disabled: busy, onClick: () => { if (window.confirm(t.confirmClear)) request({ action: 'clear-observations' }) } }, t.clear))),
            ) : null,
          ) : null,
        )
      }
    }

    function HabitsFactory(react, localeRef, Section, ScopeControl) {
      var h = react.createElement
      return function UserHabitsCard() {
        var zh = useInterfaceLanguage(react, localeRef) === 'zh'
        var t = zh ? {
          title: '用户习惯', hint: '按所选范围维护一份通用交流偏好',
          enabled: '启用通用习惯', learning: '允许整理新的通用偏好', privacy: '只共享语言、详略、语气和回答方式等通用偏好。称呼、角色和临时要求留在当前对话，不会带到其他对话。确认后的摘要会发送给当前模型。',
          active: '通用偏好', pending: '通用偏好有更新', approve: '采用这份更新', reject: '暂不采用', edit: '编辑摘要', cancel: '取消',
          save: '保存摘要', text: '例如：偏好中文交流，先给结论，表达温和简洁；需要时说明依据。',
          empty: '还没有通用偏好，可以直接补充一段，也可以在交流中逐渐形成。', loading: '加载中…', reload: '刷新', failed: '习惯操作失败', unavailable: '通用习惯暂时不可用，请稍后刷新。',
        } : {
          title: 'User habits', hint: 'General communication preferences, shared within your chosen scope',
          enabled: 'Enable general preferences', learning: 'Allow new general preferences', privacy: 'Only general language, tone, detail and response preferences are shared. Names, roles and temporary requests stay in their conversation. The approved summary is sent to the current model.',
          active: 'General preferences', pending: 'A general preference update', approve: 'Use this update', reject: 'Not now', edit: 'Edit summary', cancel: 'Cancel',
          save: 'Save summary', text: 'For example: concise conclusions, a warm tone, and evidence when needed.',
          empty: 'No general preferences yet. Add a short summary, or let one take shape as you talk.', loading: 'Loading…', reload: 'Refresh', failed: 'Habit operation failed', unavailable: 'General preferences are temporarily unavailable. Try refreshing later.',
        }
        var openState = react.useState(false), dataState = react.useState(null), noteState = react.useState('')
        var busyState = react.useState(false), draftState = react.useState({}), editingState = react.useState(false)
        var open = openState[0], data = dataState[0], busy = busyState[0]
        var buttonStyle = { font: 'inherit', fontSize: '12px', color: 'inherit', background: 'transparent', border: '1px solid var(--dsw-alias-border-l2, #666)', borderRadius: '7px', padding: '5px 9px', cursor: 'pointer' }
        var inputStyle = { width: '100%', boxSizing: 'border-box', font: 'inherit', color: 'inherit', background: 'transparent', border: '1px solid var(--dsw-alias-border-l2, #666)', borderRadius: '7px', padding: '7px', fontSize: '12px' }
        async function request(body, target) {
          var selected = body && body.action === 'set-scope' ? '' : target === undefined ? data && data.sharing && data.sharing.selectedId : target
          var response = await fetch('/api/evo-subagent/habits' + (selected ? '?target=' + encodeURIComponent(selected) : ''), {
            method: body ? 'POST' : 'GET', credentials: 'same-origin', cache: 'no-store',
            ...(body ? { headers: { 'content-type': 'application/json' }, body: JSON.stringify({ sharingRevision: data && data.sharing && data.sharing.revision, ...body }) } : {}),
          })
          if (response.status === 404) throw new Error(t.unavailable)
          var result = await response.json()
          if (!response.ok) throw new Error(result.error || 'HTTP ' + response.status)
          return result
        }
        async function load(target) {
          busyState[1](true); noteState[1]('')
          try { dataState[1](await request(undefined, target)); draftState[1]({}); editingState[1](false) } catch (error) { dataState[1](null); noteState[1](noteFrom(error, t.failed)) }
          finally { busyState[1](false) }
        }
        async function change(action, extra) {
          if (!data || busy) return
          busyState[1](true); noteState[1]('')
          try {
            dataState[1](await request({ action, revision: data.revision, ...extra }))
            draftState[1]({}); editingState[1](false)
          } catch (error) { dataState[1](null); noteState[1](noteFrom(error, t.failed)) }
          finally { busyState[1](false) }
        }
        react.useEffect(() => { if (open) load() }, [open])
        function edit(field, value) {
          draftState[1](previous => ({ ...previous, [field]: value }))
        }
        return h(Section, { id: 'habits', title: t.title, hint: t.hint, open, onToggle: () => openState[1](!open) },
          open ? h('div', { style: { fontSize: '13px' } },
            h('p', { style: { fontSize: '12px', opacity: 0.75, lineHeight: 1.5 } }, t.privacy),
            noteState[0] ? h('p', { role: 'alert', style: { overflowWrap: 'anywhere' } }, noteState[0]) : null,
            h('button', { type: 'button', disabled: busy, onClick: () => load(), style: buttonStyle }, busy ? t.loading : t.reload),
            data ? h(ScopeControl, { sharing: data.sharing, zh, busy, onScope: scope => change('set-scope', { scope }), onTarget: target => load(target) }) : null,
            data && !data.scopeOnly ? h('div', null,
              h('label', { style: { display: 'block', margin: '10px 0' } }, h('input', { type: 'checkbox', checked: data.enabled, disabled: busy,
                onChange: event => change('configure', { enabled: event.target.checked }) }), ' ', t.enabled),
              h('label', { style: { display: 'block', margin: '10px 0' } }, h('input', { type: 'checkbox', checked: data.learning, disabled: busy || !data.enabled,
                onChange: event => change('configure', { learning: event.target.checked }) }), ' ', t.learning),
              h('h4', null, t.active),
              h('p', { 'data-evo-habits-summary': '', style: { lineHeight: 1.8, overflowWrap: 'anywhere', opacity: data.generalSummary ? 1 : 0.65 } }, data.generalSummary || t.empty),
              h('button', { type: 'button', disabled: busy, style: buttonStyle, onClick: () => editingState[1](!editingState[0]) }, t.edit),
              editingState[0] ? h('div', { style: { marginTop: '10px' } },
                h('textarea', { 'aria-label': t.active, placeholder: t.text, maxLength: 960, disabled: busy, style: { ...inputStyle, ...selectColors, minHeight: '90px', resize: 'vertical' },
                  value: draftState[0].summary === undefined ? data.generalSummary || '' : draftState[0].summary, onChange: event => edit('summary', event.target.value) }),
                h('button', { type: 'button', disabled: busy, style: buttonStyle, onClick: () => change('replace-summary', { summary: draftState[0].summary === undefined ? data.generalSummary || '' : draftState[0].summary }) }, t.save), ' ',
                h('button', { type: 'button', disabled: busy, style: buttonStyle, onClick: () => { editingState[1](false); draftState[1]({}) } }, t.cancel)) : null,
              data.generalPendingCount ? h('details', { style: { marginTop: '14px' } }, h('summary', null, t.pending),
                h('textarea', { 'aria-label': t.pending, maxLength: 960, disabled: busy, style: { ...inputStyle, ...selectColors, minHeight: '90px', marginTop: '8px', resize: 'vertical' },
                  value: draftState[0].pending === undefined ? data.pendingSummary : draftState[0].pending, onChange: event => edit('pending', event.target.value) }),
                h('button', { type: 'button', disabled: busy, style: buttonStyle, onClick: () => change('approve-summary', { summary: draftState[0].pending === undefined ? data.pendingSummary : draftState[0].pending }) }, t.approve), ' ',
                h('button', { type: 'button', disabled: busy, style: buttonStyle, onClick: () => change('reject-summary') }, t.reject)) : null,
            ) : null,
          ) : null,
        )
      }
    }

    function CardFactory(react, localeRef, Section) {
      var h = react.createElement

      var chevron = open => sectionChevron(h, open)

      var fieldRow = (label, control, key) =>
        h(
          'label',
          {
            key: key,
            style: {
              display: 'flex',
              flexDirection: 'column',
              gap: '6px',
              padding: '12px 0',
              borderTop: '1px solid var(--dsw-alias-border-l2, rgba(127,127,127,0.35))',
            },
          },
          h('div', { style: { fontSize: '13px', color: 'var(--dsw-alias-label-secondary, inherit)' } }, label),
          control,
        )

      var editorStyles = {
        width: '100%',
        minHeight: '96px',
        padding: '8px 10px',
        borderRadius: '8px',
        border: '1px solid var(--dsw-alias-border-l2, rgba(127,127,127,0.35))',
        background: 'transparent',
        color: 'inherit',
        font: 'inherit',
        fontSize: '12px',
        lineHeight: 1.5,
        resize: 'vertical',
        fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
      }

      var selectStyles = {
        font: 'inherit',
        fontSize: '12px',
        height: '28px',
        boxSizing: 'border-box',
        padding: '3px 8px',
        borderRadius: '8px',
        border: '1px solid var(--dsw-alias-border-l2, rgba(127,127,127,0.35))',
        ...selectColors,
        minWidth: 0,
      }

      return function SmartSubagentCard() {
        var t = useInterfaceLanguage(react, localeRef) === 'zh' ? ZH : EN
        var openState = react.useState(false)
        var summaryState = react.useState(null)
        var noteState = react.useState('')
        var editorsState = react.useState({})
        var scanDirState = react.useState('')
        var routesState = react.useState({})
        var groupsState = react.useState({ builtin: true })
        var targetWorkspaceState = react.useState('')
        var open = openState[0]
        var summary = summaryState[0]
        var note = noteState[0]
        var editors = editorsState[0]
        var setEditors = editorsState[1]
        var scanDir = scanDirState[0]
        var setScanDir = scanDirState[1]
        var routes = routesState[0]
        var setRoutes = routesState[1]
        var groups = groupsState[0]
        var setGroups = groupsState[1]
        var targetWorkspace = targetWorkspaceState[0]
        var setTargetWorkspace = targetWorkspaceState[1]

        var load = react.useCallback(() => {
          fetch('/evo-subagent/projects')
            .then((r) => r.json().then((body) => (r.ok ? body : Promise.reject(new Error(body.error || '')))))
            .then((next) => {
              summaryState[1](next)
              setScanDir((next.scope && next.scope.projectsBaseDir) || '')
              var registered = next.scope && Array.isArray(next.scope.workspaces) ? next.scope.workspaces : []
              var targets = registered.length > 0
                ? registered
                : (next.projects || []).map((project) => ({ path: project.projectRoot, title: project.projectName }))
              if (targets.length === 0 && next.scope && next.scope.projectsBaseDir) {
                targets = [{ path: next.scope.projectsBaseDir, title: next.scope.projectsBaseDir }]
              }
              setTargetWorkspace((current) => targets.some((item) => item.path === current) ? current : ((targets[0] && targets[0].path) || ''))
              noteState[1]('')
            })
            .catch((error) => noteState[1](noteFrom(error, t.loadFailed)))
        }, [t.loadFailed])

        react.useEffect(() => {
          if (open && summary === null) load()
        }, [open, summary, load])

        var saveScanDir = () => {
          // Empty string clears the fallback dir on the host, returning the
          // card to pure workspace auto-detection.
          var value = scanDir.trim()
          noteState[1](t.saving)
          fetch('/evo-subagent/config', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ projectsBaseDir: value }),
          })
            .then((r) => r.json().then((body) => (r.ok ? body : Promise.reject(new Error(body.error || '')))))
            .then((body) => {
              summaryState[1]((prev) => ({ ...(prev || {}), scope: { ...((prev && prev.scope) || {}), projectsBaseDir: body.projectsBaseDir } }))
              noteState[1]('')
              load()
            })
            .catch((error) => noteState[1](noteFrom(error, t.configFailed)))
        }

        var toggle = (value) => {
          var next = { ...(summary || {}), evolution: value }
          summaryState[1](next)
          fetch('/evo-subagent/config', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ evolution: value }),
          })
            .then((r) => r.json().then((body) => (r.ok ? body : Promise.reject(new Error(body.error || '')))))
            .then((body) => summaryState[1]({ ...next, evolution: body.evolution }))
            .catch(() => noteState[1](t.toggleFailed))
        }

        // POST a provider/model route change and keep a local draft of the
        // selection so the two dropdowns stay consistent while saving.
        var postModel = (projectRoot, agentKey, provider, model) => {
          fetch('/evo-subagent/model', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ projectRoot, agentKey, provider, model }),
          })
            .then((r) => r.json().then((body) => (r.ok ? body : Promise.reject(new Error(body.error || '')))))
            .then(() => load())
            .catch((error) => noteState[1](noteFrom(error, t.modelFailed)))
        }

        var changeModel = (projectRoot, agentKey, provider, model) => {
          var id = projectRoot + '::' + agentKey
          setRoutes((prev) => ({ ...prev, [id]: { provider, model } }))
          postModel(projectRoot, agentKey, provider, model)
        }

        var changeProvider = (projectRoot, agentKey, provider, modelsByProvider) => {
          var id = projectRoot + '::' + agentKey
          // Auto-pick the first model of the newly selected provider so one
          // provider click is a complete, routable selection.
          var models = modelsByProvider[provider] || []
          var model = models[0] || ''
          setRoutes((prev) => ({ ...prev, [id]: { provider, model } }))
          if (model.length > 0) postModel(projectRoot, agentKey, provider, model)
        }

        var addTemplate = (projectRoot, agentKey) => {
          if (!projectRoot) return
          noteState[1](t.saving)
          fetch('/evo-subagent/template/add', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ projectRoot, agentKey }),
          })
            .then((r) => r.json().then((body) => (r.ok ? body : Promise.reject(new Error(body.error || '')))))
            .then(() => load())
            .catch((error) => noteState[1](noteFrom(error, t.addFailed)))
        }

        var setMainAgent = (projectRoot, filename) => {
          noteState[1](t.saving)
          fetch('/evo-subagent/main-agent', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ projectRoot, filename }),
          })
            .then((r) => r.json().then((body) => (r.ok ? body : Promise.reject(new Error(body.error || '')))))
            .then(() => load())
            .catch((error) => noteState[1](noteFrom(error, t.mainAgentFailed)))
        }

        var readFiles = (projectRoot, agentKey, editorId) => {
          var id = editorId || (projectRoot + '::' + agentKey)
          var set = setEditors
          set((prev) => ({ ...prev, [id]: { ...prev[id], loading: true } }))
          fetch('/evo-subagent/evolution/read', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ projectRoot, agentKey }),
          })
            .then((r) => r.json().then((body) => (r.ok ? body : Promise.reject(new Error(body.error || '')))))
            .then((body) => {
              set((prev) => ({
                ...prev,
                [id]: {
                  ...prev[id],
                  loading: false,
                  open: true,
                  dirty: false,
                  prefercmd: body.prefercmd || '',
                  memory: body.memory || '',
                  note: '',
                },
              }))
            })
            .catch((error) => {
              set((prev) => ({
                ...prev,
                [id]: { ...prev[id], loading: false, note: noteFrom(error, t.loadFailed) },
              }))
            })
        }

        var saveFiles = (projectRoot, agentKey, editorId) => {
          var id = editorId || (projectRoot + '::' + agentKey)
          var entry = editors[id]
          if (!entry) return
          setEditors((prev) => ({ ...prev, [id]: { ...prev[id], note: t.saving } }))
          fetch('/evo-subagent/evolution/save', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ projectRoot, agentKey, prefercmd: entry.prefercmd, memory: entry.memory }),
          })
            .then((r) => r.json().then((body) => (r.ok ? body : Promise.reject(new Error(body.error || '')))))
            .then(() => {
              setEditors((prev) => ({
                ...prev,
                [id]: { ...prev[id], dirty: false, note: t.saved },
              }))
            })
            .catch((error) => {
              setEditors((prev) => ({
                ...prev,
                [id]: { ...prev[id], note: noteFrom(error, t.saveFailed) },
              }))
            })
        }

        var discardFiles = (projectRoot, agentKey, editorId) => {
          var id = editorId || (projectRoot + '::' + agentKey)
          setEditors((prev) => ({
            ...prev,
            [id]: { ...prev[id], dirty: false, note: '' },
          }))
          readFiles(projectRoot, agentKey, id)
        }

        var setEditor = (id, patch) => {
          setEditors((prev) => ({ ...prev, [id]: { ...prev[id], ...patch, dirty: true } }))
        }

        var evolutionEditor = (projectRoot, agentKey, id, entry) =>
          h(
            'div',
            { style: { padding: '4px 4px 8px', display: 'flex', flexDirection: 'column', gap: '8px' } },
            entry.loading
              ? h('span', { style: { fontSize: '13px', color: 'var(--dsw-alias-label-tertiary, rgba(127,127,127,0.8))' } }, t.loading)
              : h(
                  'div',
                  null,
                  fieldRow(
                    t.prefercmd,
                    h('textarea', {
                      value: entry.prefercmd || '',
                      spellCheck: false,
                      style: editorStyles,
                      onChange: (event) => setEditor(id, { prefercmd: event.target.value }),
                    }),
                    id + '-pc',
                  ),
                  fieldRow(
                    t.memory,
                    h('textarea', {
                      value: entry.memory || '',
                      spellCheck: false,
                      style: editorStyles,
                      onChange: (event) => setEditor(id, { memory: event.target.value }),
                    }),
                    id + '-mem',
                  ),
                  h(
                    'div',
                    { style: { display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '8px', padding: '8px 0 4px' } },
                    h(
                      'span',
                      { role: 'status', style: { marginRight: 'auto', fontSize: '12px', color: 'var(--dsw-alias-label-tertiary, rgba(127,127,127,0.8))' } },
                      entry.note || '',
                    ),
                    h(
                      'button',
                      {
                        type: 'button',
                        disabled: !entry.dirty,
                        onClick: () => discardFiles(projectRoot, agentKey, id),
                        style: {
                          appearance: 'none', font: 'inherit', fontSize: '13px', lineHeight: 1.5,
                          cursor: entry.dirty ? 'pointer' : 'default',
                          border: '1px solid var(--dsw-alias-border-l2, rgba(127,127,127,0.35))',
                          borderRadius: '8px', padding: '5px 14px', background: 'none',
                          color: 'var(--dsw-alias-label-secondary, inherit)', opacity: entry.dirty ? 1 : 0.4,
                        },
                      },
                      t.discard,
                    ),
                    h(
                      'button',
                      {
                        type: 'button',
                        disabled: !entry.dirty,
                        onClick: () => saveFiles(projectRoot, agentKey, id),
                        style: {
                          appearance: 'none', font: 'inherit', fontSize: '13px', lineHeight: 1.5,
                          cursor: entry.dirty ? 'pointer' : 'default', border: '1px solid transparent',
                          borderRadius: '8px', padding: '5px 14px',
                          background: 'var(--dsw-alias-label-primary, currentColor)',
                          color: 'var(--dsw-alias-bg-layer-3, rgba(127,127,127,0.05))', opacity: entry.dirty ? 1 : 0.4,
                        },
                      },
                      t.save,
                    ),
                  ),
                ),
          )

        var body = null
        if (open) {
          if (summary === null) {
            body = h(
              'div',
              { style: { padding: '12px 0', color: 'var(--dsw-alias-label-tertiary, rgba(127,127,127,0.8))', fontSize: '13px' } },
              note || t.loading,
            )
          } else {
            var projects = Array.isArray(summary.projects) ? summary.projects : []
            var builtin = Array.isArray(summary.builtin) ? summary.builtin : []
            var modelsByProvider = summary.modelsByProvider || {}
            var scopeInfo = (summary && summary.scope) || {}
            var scanSource = scopeInfo.scanSource || (scopeInfo.projectsBaseDir ? 'manual' : 'none')
            var workspaces = Array.isArray(scopeInfo.workspaces) ? scopeInfo.workspaces : []
            var sourceText
            if (scanSource === 'workspaces') {
              sourceText =
                t.scanAuto +
                ' · ' +
                workspaces.length +
                t.colon +
                workspaces.map((w) => w.title || w.path).join(t.listSeparator)
            } else if (scanSource === 'manual') {
              sourceText = t.scanManual + t.colon + (scopeInfo.projectsBaseDir || '')
            } else {
              sourceText = t.scanNone
            }
            var addTargets = workspaces.length > 0
              ? workspaces
              : projects.map((project) => ({ path: project.projectRoot, title: project.projectName }))
            if (addTargets.length === 0 && scopeInfo.projectsBaseDir) {
              addTargets = [{ path: scopeInfo.projectsBaseDir, title: scopeInfo.projectsBaseDir }]
            }
            var selectedProject = projects.find((project) => project.projectRoot === targetWorkspace)
            var projectSections = projects.map((project) => {
              var projectRoot = project.projectRoot
              var agentRows = (project.agents || []).map((agent) => {
                var key = agent.agentKey
                var id = projectRoot + '::' + key
                var entry = editors[id] || {}
                var expanded = Boolean(entry.open)
                // Draft route selection: falls back to the agent's persisted
                // provider/model until the user picks something.
                var draft = routes[id] || {}
                var currentProvider = draft.provider || agent.provider || ''
                var currentModel = draft.model || agent.model || ''
                var providerOptions = Object.keys(modelsByProvider)
                var modelOptions = modelsByProvider[currentProvider] || []
                var modelControl = agent.editable
                  ? h(
                      'div',
                      {
                        style: { display: 'flex', alignItems: 'center', gap: '8px', flex: 'none', whiteSpace: 'nowrap' },
                      },
                      h(
                        'select',
                        {
                          value: currentProvider,
                          onChange: (event) => changeProvider(projectRoot, key, event.target.value, modelsByProvider),
                          style: { ...selectStyles, width: '128px' },
                          'aria-label': t.provider + ' · ' + key,
                        },
                        providerOptions.length === 0
                          ? h('option', { key: currentProvider, style: selectColors }, currentProvider)
                          : providerOptions.map((provider) => h('option', { key: provider, value: provider, style: selectColors }, provider)),
                      ),
                      h(
                        'select',
                        {
                          value: currentModel,
                          onChange: (event) => changeModel(projectRoot, key, currentProvider, event.target.value),
                          style: { ...selectStyles, width: '184px' },
                          'aria-label': t.model + ' · ' + key,
                        },
                        modelOptions.length === 0
                          ? h('option', { key: currentModel, style: selectColors }, currentModel)
                          : modelOptions.map((model) => h('option', { key: model, value: model, style: selectColors }, model)),
                      ),
                    )
                  : h(
                      'span',
                      {
                        style: {
                          fontSize: '12px',
                          padding: '4px 8px',
                          borderRadius: '8px',
                          border: '1px dashed var(--dsw-alias-border-l2, rgba(127,127,127,0.35))',
                          color: 'var(--dsw-alias-label-tertiary, rgba(127,127,127,0.8))',
                        },
                      },
                      (agent.model || '') + ' · ' + t.modelFixed,
                    )
                return h(
                  'div',
                  { key: key },
                  h(
                    'div',
                    {
                      style: {
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                          padding: '4px',
                          minWidth: 0,
                      },
                    },
                    h(
                      'button',
                      {
                        type: 'button',
                        'aria-expanded': expanded,
                        onClick: () => (entry.open ? setEditors((p) => ({ ...p, [id]: { ...p[id], open: false } })) : readFiles(projectRoot, key)),
                        style: {
                          appearance: 'none',
                          font: 'inherit',
                          color: 'inherit',
                          textAlign: 'left',
                          cursor: 'pointer',
                          background: 'none',
                          border: 0,
                          borderRadius: '8px',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px',
                          padding: '0',
                          flex: '1 1 auto',
                          minWidth: 0,
                          overflow: 'hidden',
                        },
                      },
                      h('span', { style: { fontSize: '13px', fontWeight: 500, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } }, key),
                      h(
                        'span',
                        {
                          style: {
                            fontSize: '11px',
                            padding: '1px 8px',
                            borderRadius: '999px',
                            border: '1px solid var(--dsw-alias-border-l2, rgba(127,127,127,0.35))',
                            color: 'var(--dsw-alias-label-tertiary, rgba(127,127,127,0.8))',
                          },
                        },
                        (t.source[agent.source] || agent.source),
                      ),
                      h('span', { style: { flex: 'none' } }, chevron(expanded)),
                    ),
                    modelControl,
                  ),
                  expanded ? evolutionEditor(projectRoot, key, id, entry) : null,
                )
              })

              var mainInfo = project.mainAgent || { filename: '', candidates: [] }
              var mainId = projectRoot + '::@main'
              var mainEntry = editors[mainId] || {}
              var mainBound = Boolean(mainInfo.filename)
              var mainExpanded = Boolean(mainEntry.open)
              var mainCandidates = Array.isArray(mainInfo.candidates) ? mainInfo.candidates : []
              var mainRow = h(
                'div',
                { key: '@main' },
                h(
                  'div',
                  { style: { display: 'flex', alignItems: 'center', gap: '8px', padding: '4px', minWidth: 0 } },
                  h(
                    'button',
                    {
                      type: 'button',
                      disabled: !mainBound,
                      'aria-expanded': mainExpanded,
                      onClick: () => (mainEntry.open
                        ? setEditors((prev) => ({ ...prev, [mainId]: { ...prev[mainId], open: false } }))
                        : readFiles(projectRoot, 'main', mainId)),
                      style: {
                        appearance: 'none', font: 'inherit', color: 'inherit', textAlign: 'left',
                        cursor: mainBound ? 'pointer' : 'default', background: 'none', border: 0,
                        borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '8px',
                        padding: 0, flex: '1 1 auto', minWidth: 0, overflow: 'hidden',
                        opacity: mainBound ? 1 : 0.65,
                      },
                    },
                    h('span', { style: { fontSize: '13px', fontWeight: 500, whiteSpace: 'nowrap' } }, t.mainAgent),
                    h(
                      'span',
                      {
                        style: {
                          fontSize: '11px', padding: '1px 8px', borderRadius: '999px',
                          border: '1px solid var(--dsw-alias-border-l2, rgba(127,127,127,0.35))',
                          color: 'var(--dsw-alias-label-tertiary, rgba(127,127,127,0.8))', whiteSpace: 'nowrap',
                        },
                      },
                      t.mainAgentHint,
                    ),
                    mainBound ? h('span', { style: { flex: 'none' } }, chevron(mainExpanded)) : null,
                  ),
                  h(
                    'select',
                    {
                      value: mainInfo.filename || '',
                      disabled: mainCandidates.length === 0 && !mainBound,
                      onChange: (event) => setMainAgent(projectRoot, event.target.value),
                      style: { ...selectStyles, width: '184px', flex: 'none', opacity: mainCandidates.length === 0 && !mainBound ? 0.55 : 1 },
                      'aria-label': t.mainAgent + ' · ' + (project.projectName || projectRoot),
                    },
                    h('option', { value: '', style: selectColors }, mainCandidates.length === 0 ? t.mainAgentMissing : t.mainAgentUnbound),
                    mainCandidates.map((filename) => h('option', { key: filename, value: filename, style: selectColors }, filename)),
                  ),
                ),
                mainExpanded ? evolutionEditor(projectRoot, 'main', mainId, mainEntry) : null,
              )

              var groupId = 'workspace:' + projectRoot
              var projectOpen = groups[groupId] !== false
              return h(
                'div',
                { key: projectRoot },
                h(
                  'button',
                  {
                    type: 'button',
                    'aria-expanded': projectOpen,
                    onClick: () => setGroups((prev) => ({ ...prev, [groupId]: prev[groupId] === false })),
                    style: {
                      appearance: 'none',
                      width: '100%',
                      font: 'inherit',
                      color: 'inherit',
                      textAlign: 'left',
                      cursor: 'pointer',
                      background: 'none',
                      border: 0,
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      padding: '10px 4px 4px',
                      minWidth: 0,
                    },
                  },
                  h('span', { style: { flex: 'none' } }, chevron(projectOpen)),
                  h('span', { style: { fontSize: '13px', fontWeight: 600, flex: 'none' } }, project.projectName || projectRoot),
                  h(
                    'span',
                    {
                      style: {
                        fontSize: '11px',
                        padding: '1px 7px',
                        borderRadius: '999px',
                        border: '1px solid var(--dsw-alias-border-l2, rgba(127,127,127,0.35))',
                        flex: 'none',
                      },
                    },
                    String(agentRows.length),
                  ),
                  h(
                    'span',
                    { style: { marginLeft: 'auto', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: '11px', color: 'var(--dsw-alias-label-tertiary, rgba(127,127,127,0.8))' } },
                    project.projectRoot || '',
                  ),
                ),
                projectOpen
                  ? h(
                      'div',
                      null,
                      mainRow,
                      agentRows.length === 0
                        ? h('div', { style: { fontSize: '12px', color: 'var(--dsw-alias-label-tertiary, rgba(127,127,127,0.8))', padding: '4px' } }, t.empty)
                        : agentRows,
                    )
                  : null,
              )
            })

            body = h(
              'div',
              null,
              h(
                'div',
                {
                  style: {
                    display: 'flex',
                    alignItems: 'baseline',
                    gap: '8px',
                    padding: '10px 0',
                    borderBottom: '1px solid var(--dsw-alias-border-l2, rgba(127,127,127,0.35))',
                    fontSize: '13px',
                    flexWrap: 'wrap',
                  },
                },
                h('span', { style: { fontWeight: 600, flex: 'none' } }, t.scopeProjects),
                h(
                  'span',
                  {
                    style: {
                      color: 'var(--dsw-alias-label-tertiary, rgba(127,127,127,0.8))',
                      fontSize: '12px',
                      wordBreak: 'break-all',
                    },
                  },
                  sourceText,
                ),
              ),
              note
                ? h(
                    'div',
                    {
                      role: 'status',
                      style: {
                        margin: '8px 0 0',
                        padding: '7px 9px',
                        borderRadius: '8px',
                        border: '1px solid var(--dsw-alias-border-l2, rgba(127,127,127,0.35))',
                        color: 'var(--dsw-alias-label-secondary, inherit)',
                        fontSize: '12px',
                        lineHeight: 1.4,
                        overflowWrap: 'anywhere',
                      },
                    },
                    note,
                  )
                : null,
              scanSource === 'workspaces'
                ? null
                : h(
                    'label',
                    {
                      style: {
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '6px',
                        padding: '10px 0',
                        borderBottom: '1px solid var(--dsw-alias-border-l2, rgba(127,127,127,0.35))',
                      },
                    },
                    h(
                      'span',
                      { style: { fontSize: '12px', color: 'var(--dsw-alias-label-tertiary, rgba(127,127,127,0.8))' } },
                      t.scanFallback,
                    ),
                    h(
                      'div',
                      { style: { display: 'flex', alignItems: 'center', gap: '8px' } },
                      h('input', {
                        type: 'text',
                        value: scanDir,
                        placeholder: 'D:\\trae',
                        spellCheck: false,
                        onChange: (event) => setScanDir(event.target.value),
                        style: {
                          flex: 1,
                          minWidth: 0,
                          font: 'inherit',
                          fontSize: '12px',
                          padding: '5px 8px',
                          borderRadius: '8px',
                          border: '1px solid var(--dsw-alias-border-l2, rgba(127,127,127,0.35))',
                          background: 'transparent',
                          color: 'inherit',
                        },
                      }),
                      h(
                        'button',
                        {
                          type: 'button',
                          onClick: saveScanDir,
                          style: {
                            appearance: 'none',
                            font: 'inherit',
                            fontSize: '12px',
                            lineHeight: 1.5,
                            cursor: 'pointer',
                            border: '1px solid transparent',
                            borderRadius: '8px',
                            padding: '5px 12px',
                            background: 'var(--dsw-alias-label-primary, currentColor)',
                            color: 'var(--dsw-alias-bg-layer-3, rgba(127,127,127,0.05))',
                            flex: 'none',
                          },
                        },
                        t.scanSave,
                      ),
                    ),
                  ),
              h(
                'label',
                {
                  style: { display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 0', fontSize: '13px' },
                },
                h('input', {
                  type: 'checkbox',
                  checked: Boolean(summary.evolution),
                  onChange: (event) => toggle(event.target.checked),
                }),
                h('span', { style: { fontWeight: 500 } }, t.toggle),
                h('span', { style: { color: 'var(--dsw-alias-label-tertiary, rgba(127,127,127,0.8))', fontSize: '12px' } }, t.toggleHint),
              ),
              builtin.length > 0
                ? h(
                    'div',
                    { style: { padding: '4px 0' } },
                    h(
                      'div',
                      { style: { display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 0 2px', minWidth: 0 } },
                      h(
                        'button',
                        {
                          type: 'button',
                          'aria-expanded': groups.builtin !== false,
                          onClick: () => setGroups((prev) => ({ ...prev, builtin: prev.builtin === false })),
                          style: {
                            appearance: 'none',
                            font: 'inherit',
                            color: 'inherit',
                            background: 'none',
                            border: 0,
                            padding: '0',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            minWidth: 0,
                          },
                        },
                        h('span', { style: { flex: 'none' } }, chevron(groups.builtin !== false)),
                        h('span', { style: { fontSize: '13px', fontWeight: 600, flex: 'none' } }, t.builtin),
                        h('span', { style: { fontSize: '12px', color: 'var(--dsw-alias-label-tertiary, rgba(127,127,127,0.8))', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } }, t.builtinHint),
                      ),
                      h('span', { style: { marginLeft: 'auto', flex: 'none', fontSize: '12px', color: 'var(--dsw-alias-label-tertiary, rgba(127,127,127,0.8))' } }, t.addTo),
                      addTargets.length > 0
                        ? h(
                            'select',
                            {
                              value: targetWorkspace,
                              onChange: (event) => setTargetWorkspace(event.target.value),
                              style: { ...selectStyles, width: '184px', flex: 'none' },
                              'aria-label': t.addTo,
                            },
                            addTargets.map((target) => h('option', { key: target.path, value: target.path, style: selectColors }, target.title || target.path)),
                          )
                        : h('span', { style: { fontSize: '12px', color: 'var(--dsw-alias-label-tertiary, rgba(127,127,127,0.8))' } }, t.noWorkspace),
                    ),
                    groups.builtin === false
                      ? null
                      : builtin.map((agent) => {
                        var added = Boolean(selectedProject && (selectedProject.agents || []).some((item) => item.agentKey === agent.agentKey))
                        return h(
                        'div',
                        {
                          key: agent.agentKey,
                          style: { display: 'flex', alignItems: 'center', gap: '8px', padding: '4px' },
                        },
                        h('span', { style: { fontSize: '13px', fontWeight: 500, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } }, agent.agentKey),
                        h(
                          'span',
                          {
                            style: {
                              fontSize: '11px',
                              padding: '1px 8px',
                              borderRadius: '999px',
                              border: '1px solid var(--dsw-alias-border-l2, rgba(127,127,127,0.35))',
                              color: 'var(--dsw-alias-label-tertiary, rgba(127,127,127,0.8))',
                            },
                          },
                          (t.source[agent.source] || agent.source),
                        ),
                        h(
                          'button',
                          {
                            type: 'button',
                            disabled: !targetWorkspace || added,
                            title: added ? t.added : t.addTemplate,
                            'aria-label': (added ? t.added : t.addTemplate) + ' · ' + agent.agentKey,
                            onClick: () => addTemplate(targetWorkspace, agent.agentKey),
                            style: {
                              marginLeft: 'auto',
                              appearance: 'none',
                              width: '28px',
                              height: '28px',
                              padding: 0,
                              borderRadius: '8px',
                              border: '1px solid var(--dsw-alias-border-l2, rgba(127,127,127,0.35))',
                              background: 'transparent',
                              color: 'inherit',
                              font: 'inherit',
                              fontSize: added ? '13px' : '18px',
                              lineHeight: 1,
                              cursor: !targetWorkspace || added ? 'default' : 'pointer',
                              opacity: !targetWorkspace || added ? 0.45 : 1,
                              flex: 'none',
                            },
                          },
                          added ? '✓' : '+',
                        ),
                      )
                    }),
                  )
                : null,
              fieldRow(
                h(
                  'span',
                  null,
                  t.projects,
                  h(
                    'span',
                    {
                      style: {
                        color: 'var(--dsw-alias-label-tertiary, rgba(127,127,127,0.8))',
                        fontWeight: 400,
                        marginLeft: '8px',
                        fontSize: '12px',
                      },
                    },
                    t.projectsHint,
                  ),
                ),
                projects.length === 0
                  ? h(
                      'div',
                      { style: { fontSize: '13px', color: 'var(--dsw-alias-label-tertiary, rgba(127,127,127,0.8))', display: 'flex', flexDirection: 'column', gap: '4px' } },
                      h('span', null, t.empty),
                      scanSource === 'workspaces' ? null : h('span', { style: { fontSize: '12px' } }, t.scanHint),
                    )
                  : h('div', null, projectSections),
                'projects',
              ),
            )
          }
        }

        return h(Section, { id: 'roles', title: t.title, hint: t.subtitle, open, onToggle: () => openState[1](!open) }, body)
      }
    }

    function registerCard(ctx) {
      if (typeof ctx.inject !== 'function') return
      var localeRef = { current: null }
      ctx.inject(['locale'], (scope) => {
        localeRef.current = scope.locale
        if (typeof scope.effect === 'function') {
          scope.effect(() => () => { localeRef.current = null }, 'evo-subagent: locale handle')
        }
      })
      ctx.inject(['slots'], (scope) => {
        // The card and its host routes live and die together: any response
        // proves the route exists; only a 404 means no web profile.
        Promise.all([fetch('/evo-subagent/projects'), fetch('/api/evo-subagent/habits', { credentials: 'same-origin', cache: 'no-store' }), fetch('/api/evo-subagent/persona', { credentials: 'same-origin', cache: 'no-store' })])
          .then((responses) => {
            var available = { roles: responses[0].status !== 404, habits: responses[1].status !== 404, persona: responses[2].status !== 404 }
            if (!available.roles && !available.habits && !available.persona) return
            try {
              mountCard(scope, localeRef, available)
            } catch (error) {
              console.error(`[evo-subagent] settings card skipped: ${error}`)
            }
          })
          .catch(() => {})
      })
    }

    function mountCard(ctx, localeRef, available) {
      var react
      try {
        react = require('react')
      } catch (error) {
        console.error(`[evo-subagent] settings card skipped: ${error}`)
        return
      }
      var Section = SettingsSectionFactory(react)
      var ScopeControl = ScopeControlFactory(react)
      var RolesCard = CardFactory(react, localeRef, Section)
      var HabitsCard = HabitsFactory(react, localeRef, Section, ScopeControl)
      var CompanionCard = PersonaFactory(react, localeRef, Section, ScopeControl)
      var Card = () => react.createElement('div', { lang: useInterfaceLanguage(react, localeRef) === 'zh' ? 'zh-CN' : 'en', style: { display: 'grid', gap: '12px' } },
        react.createElement('style', null, settingsCss),
        available.persona ? react.createElement(CompanionCard) : null,
        available.habits ? react.createElement(HabitsCard) : null,
        available.roles ? react.createElement(RolesCard) : null)
      ctx.slots.inject('settings.plugins.tab', () => ctx.slots.register({
        name: 'settings.plugins.tab',
        id: 'evo-subagent',
        label: 'evo-subagent',
        order: 31,
      }, Card))
    }

    function apply(ctx) {
      registerCard(ctx)
    }

    exports.apply = apply
    exports.inject = []
    return module.exports
  },
})
