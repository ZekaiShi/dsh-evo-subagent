import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { runInNewContext } from 'node:vm'
import test from 'node:test'

const require = createRequire(import.meta.url)
async function browserModule(react, options = {}) {
  const registrations = []; let module
  const ctx = { inject(names, callback) { if (names[0] === 'slots') callback(ctx); if (names[0] === 'locale' && options.locale) callback({ ...ctx, locale: options.locale }) },
    slots: { inject(_name, callback) { return callback() }, register(_options, component) { registrations.push(component); options.registrations?.push({ name: _options.name, component }) } } }
  runInNewContext(await readFile(new URL('../dsh/client.js', import.meta.url), 'utf8'), {
    window: { __ModuleLoader__: { load(spec) { module = spec.factory(name => name === 'react' ? react : require(name)) } } },
    fetch: options.fetch || (async path => ({ status: !options.available || options.available.includes(path) ? 200 : 404 })), console,
  })
  module.apply(ctx); await new Promise(resolve => setImmediate(resolve))
  return registrations[0]
}

test('the conversation persona control is an additive official composer slot and is fully bilingual', async () => {
  const registrations = [], realReact = require('react'), { renderToStaticMarkup } = require('react-dom/server')
  const snapshot = { context: { scope: 'workspace', independent: true, workspace: 'Demo' }, config: { enabled: true, learning: false, mode: 'preset', preset: 'direct', title: 'Demo persona', instructions: 'Stay concise.' } }
  let language = 'en'
  const locale = { getSnapshot: () => ({ active: language }), subscribe: () => () => {} }
  const react = { ...realReact, useState(value) { return realReact.useState(value === null ? snapshot : value) } }
  await browserModule(react, { registrations, locale, available: ['/api/evo-subagent/persona'] })
  const control = registrations.find(x => x.name === 'conversation.input.left')
  assert.ok(control)
  const english = renderToStaticMarkup(realReact.createElement(control.component, { sessionId: 'demo' }))
  for (const text of ['This conversation only', 'Follow workspace settings', 'Efficient and direct', 'Style guidance']) assert.ok(english.includes(text), text)
  assert.ok(!english.includes('Independent workspace'))
  assert.ok(!/[\u3400-\u9fff]/u.test(english))
  language = 'zh-CN'
  const chinese = renderToStaticMarkup(realReact.createElement(control.component, { sessionId: 'demo' }))
  for (const text of ['仅此对话独立', '跟随工作区', '高效利落', '风格要求']) assert.ok(chinese.includes(text), text)
  assert.ok(!chinese.includes('This conversation only'))
})

test('composer choices address the current session and preserve scope/profile revisions', async () => {
  const registrations = [], requests = [], refs = []
  let refIndex = 0
  const snapshot = { revision: 'profile-rev', sharingRevision: 'scope-rev', contextKey: 'global:global', context: { scope: 'global', independent: false, workspace: 'Demo', workspaceId: 'workspace-id' }, config: {} }
  const react = {
    createElement(type, props, ...children) { return { type, props: { ...props, children } } },
    useState(value) { return [value === null ? snapshot : value, () => {}] },
    useRef(value) { return refs[refIndex++] ??= { current: value } }, useEffect() {}, useSyncExternalStore: (_s, read) => read(),
  }
  await browserModule(react, { registrations, fetch: async (path, options) => {
    if (!options?.method) return { status: path === '/api/evo-subagent/persona' ? 200 : 404 }
    requests.push({ path, options }); return { status: 200, ok: true, json: async () => snapshot }
  } })
  const control = registrations.find(x => x.name === 'conversation.input.left').component
  const node = control({ sessionId: 'chat-a' })
  function find(node) {
    if (!node) return undefined
    if (Array.isArray(node)) return node.map(find).find(Boolean)
    return node.type === 'select' ? node : find(node.props?.children)
  }
  await find(node).props.onChange({ target: { value: 'conversation' } })
  assert.equal(requests[0].path, '/api/evo-subagent/persona?session=chat-a')
  const body = JSON.parse(requests[0].options.body)
  assert.equal(body.sessionId, 'chat-a'); assert.equal(body.scope, 'conversation')
  assert.equal(body.sharingRevision, 'scope-rev'); assert.equal(body.revision, 'profile-rev')
  assert.equal(body.workspaceId, 'workspace-id'); assert.equal(body.contextKey, 'global:global')
})

test('all three settings sections share appearance, expansion timing, keyboard hiding and reduced-motion behavior', async () => {
  const react = require('react'), { renderToStaticMarkup } = require('react-dom/server')
  const Card = await browserModule(react)
  const html = renderToStaticMarkup(react.createElement(Card))
  assert.equal((html.match(/class="evo-settings-section"/g) || []).length, 3)
  assert.equal((html.match(/class="evo-settings-heading"/g) || []).length, 3)
  assert.equal((html.match(/class="evo-settings-reveal"/g) || []).length, 3)
  assert.equal((html.match(/inert=""/g) || []).length, 3)
  for (const name of ['persona', 'habits', 'roles']) {
    assert.ok(html.includes(`data-evo-section="${name}"`))
    assert.ok(html.includes(`aria-controls="evo-panel-${name}"`))
  }
  assert.match(html, /grid-template-rows \.18s ease,opacity \.18s ease/)
  assert.match(html, /prefers-reduced-motion:reduce/)
})

test('the same section component retains closing content instead of unmounting it before the transition', async () => {
  const ref = { current: null }
  const react = {
    createElement(type, props, ...children) { return { type, props: { ...props, children } } },
    useState(value) { return [value, () => {}] }, useEffect() {}, useRef() { return ref }, useSyncExternalStore(_s, read) { return read() }, useCallback(fn) { return fn },
  }
  const Card = await browserModule(react), cards = Card().props.children.filter(c => typeof c.type === 'function')
  assert.equal(cards.length, 3)
  const sections = cards.map(card => card.type())
  assert.ok(sections.every(s => s.type === sections[0].type))
  const Section = sections[0].type, child = { content: 'Retained during close' }
  const opened = Section({ id: 'test', open: true, title: 'Title', hint: 'Hint', children: child })
  const closed = Section({ id: 'test', open: false, title: 'Title', hint: 'Hint', children: null })
  const openPanel = opened.props.children[1], closedPanel = closed.props.children[1]
  assert.equal(openPanel.props.inert, undefined)
  assert.equal(closedPanel.props.inert, '')
  assert.equal(closedPanel.props['aria-hidden'], true)
  assert.equal(closedPanel.props['data-open'], 'false')
  assert.equal(closedPanel.props.children[0].props.children[0].props.children[0], child)
})

for (const language of ['zh', 'zh-CN', 'zh_Hans', 'en', 'en-US', 'fr', 'de']) {
  test(`all three sections use a consistent interface language (${language})`, async () => {
    const react = require('react'), { renderToStaticMarkup } = require('react-dom/server')
    const locale = { getSnapshot: () => ({ active: language }), subscribe: () => () => {} }
    const Card = await browserModule(react, { locale })
    const html = renderToStaticMarkup(react.createElement(Card))
    if (/^zh/i.test(language)) {
      for (const title of ['陪伴人格', '用户习惯', '子代理管理']) assert.ok(html.includes(title), title)
      assert.match(html, /lang="zh-CN"/)
      assert.ok(!html.includes('Subagent management'))
    } else {
      for (const title of ['Companion persona', 'User habits', 'Subagent management']) assert.ok(html.includes(title), title)
      assert.match(html, /lang="en"/)
      assert.ok(!/[\u3400-\u9fff]/u.test(html))
    }
  })
}

test('expanded workspace controls are fully bilingual and keep provider/model/file identifiers unchanged', async () => {
  const realReact = require('react'), { renderToStaticMarkup } = require('react-dom/server')
  const summary = {
    projects: [{ projectRoot: '/demo', projectName: 'Demo', mainAgent: { filename: '', candidates: ['AGENTS.md'] },
      agents: [{ agentKey: 'reviewer', editable: true, source: 'binding', provider: 'provider-keep-id', model: 'model-keep-id' }] }],
    builtin: [{ agentKey: 'planner', source: 'template' }], modelsByProvider: { 'provider-keep-id': ['model-keep-id'] },
    scope: { scanSource: 'workspaces', workspaces: [{ path: '/demo', title: 'Demo' }] },
  }
  let language = 'zh-CN'
  const locale = { getSnapshot: () => ({ active: language }), subscribe: () => () => {} }
  const react = { ...realReact, useState(value) { return realReact.useState(value === false ? true : value === null ? summary : value) } }
  const Card = await browserModule(react, { locale, available: ['/evo-subagent/projects'] })
  const chinese = renderToStaticMarkup(realReact.createElement(Card))
  for (const text of ['子代理管理', '模型提供方', '主代理', '内置模板', '工作区子代理', '积累任务经验']) assert.ok(chinese.includes(text), text)
  assert.ok(!/Main agent|Provider|subagents|profile/.test(chinese))
  language = 'en-US'
  const english = renderToStaticMarkup(realReact.createElement(Card))
  for (const text of ['Subagent management', 'Provider', 'Main agent', 'Built-in templates', 'Workspace subagents', 'Learn from tasks']) assert.ok(english.includes(text), text)
  assert.ok(!/[\u3400-\u9fff：、]/u.test(english))
  for (const html of [chinese, english]) for (const id of ['provider-keep-id', 'model-keep-id', 'AGENTS.md']) assert.ok(html.includes(id), id)
})

test('English and Chinese workspace dictionaries have complete matching translation keys', async () => {
  const source = await readFile(new URL('../dsh/client.js', import.meta.url), 'utf8')
  const match = /var EN = (\{[\s\S]*?\n    \})\s+var ZH = (\{[\s\S]*?\n    \})/.exec(source)
  assert.ok(match)
  const english = runInNewContext('(' + match[1] + ')'), chinese = runInNewContext('(' + match[2] + ')')
  assert.deepEqual(Object.keys(english).sort(), Object.keys(chinese).sort())
  assert.deepEqual(Object.keys(english.source).sort(), Object.keys(chinese.source).sort())
  for (const values of [english, chinese]) for (const value of Object.values(values)) if (typeof value === 'string') assert.ok(value.trim())
})

test('persona workspace mode lists collapsible workspaces without redundant selectors in both languages', async () => {
  const realReact = require('react'), { renderToStaticMarkup } = require('react-dom/server')
  let state = { scopeOnly: true, sharing: { mode: 'workspace', defaultMode: 'workspace', workspaceOptions: [{ id: 'a', label: 'Project A' }, { id: 'b', label: 'Project B' }] } }
  let language = 'zh-CN'
  const locale = { getSnapshot: () => ({ active: language }), subscribe: () => () => {} }
  const react = { ...realReact, useState(value) { return realReact.useState(value === false ? true : value === null ? state : value) } }
  const Card = await browserModule(react, { locale, available: ['/api/evo-subagent/persona'] })
  const chinese = renderToStaticMarkup(realReact.createElement(Card))
  for (const text of ['每个工作区独立', 'Project A', 'Project B', 'persona-workspace-a', 'persona-workspace-b']) assert.ok(chinese.includes(text), text)
  assert.equal((chinese.match(/type="checkbox"/g) || []).length, 1)
  assert.match(chinese, /type="checkbox"[^>]*checked=""/)
  for (const text of ['配置工作区', '为这个工作区单独维护人格', '适用范围（默认）', '<select']) assert.ok(!chinese.includes(text), text)
  language = 'en'
  const english = renderToStaticMarkup(realReact.createElement(Card))
  assert.ok(english.includes('Separate persona for each workspace'))
  assert.ok(!/[\u3400-\u9fff]/u.test(english))
  state = { sharing: { mode: 'global', defaultMode: 'global', workspaceOptions: state.sharing.workspaceOptions }, config: { enabled: true, learning: false, mode: 'preset', preset: 'calm' }, stats: {} }
  const shared = renderToStaticMarkup(realReact.createElement(Card))
  assert.ok(shared.includes('All workspaces use the shared persona'))
  assert.ok(shared.includes('Persona preset'))
  assert.ok(!shared.includes('persona-workspace-a'))
})

test('persona checkbox changes routing and workspace editors address their own target', async () => {
  const requests = []
  const state = { scopeOnly: true, sharing: { mode: 'workspace', defaultMode: 'workspace', revision: 'scope-revision', workspaceOptions: [{ id: 'workspace-a', label: 'Project A' }] } }
  const react = {
    createElement(type, props, ...children) { return { type, props: { ...props, children } } },
    useState(value) { return [value === false ? true : value === null ? state : value, () => {}] },
    useRef: () => ({ current: null }), useEffect() {}, useSyncExternalStore: (_s, read) => read(),
  }
  const Card = await browserModule(react, { fetch: async (path, options) => {
    if (!options?.method) return { status: path === '/api/evo-subagent/persona' ? 200 : 404 }
    requests.push({ path, options }); return { ok: true, status: 200, json: async () => state }
  } })
  function find(node, predicate) {
    if (!node) return undefined
    if (Array.isArray(node)) return node.map(n => find(n, predicate)).find(Boolean)
    return predicate(node) ? node : find(node.props?.children, predicate)
  }
  const persona = Card().props.children.find(c => typeof c?.type === 'function').type
  const panel = persona()
  await find(panel, n => n.type === 'input' && n.props.type === 'checkbox').props.onChange({ target: { checked: false } })
  assert.equal(requests[0].path, '/api/evo-subagent/persona')
  assert.deepEqual(JSON.parse(requests[0].options.body), { sharingRevision: 'scope-revision', action: 'set-workspaces', enabled: false })
  const editor = persona({ workspace: { id: 'workspace-a', label: 'Project A' } })
  assert.ok(!find(editor, n => n.type === 'textarea'))
  await find(editor, n => n.type === 'button').props.onClick()
  assert.equal(requests[1].path, '/api/evo-subagent/persona?target=workspace-a&scope=workspace')
  assert.equal(JSON.parse(requests[1].options.body).target, 'workspace-a')
})

for (const feature of ['habits']) {
  test(`${feature} scoped settings show bilingual selectors without accessing an unselected profile`, async () => {
    const realReact = require('react'), { renderToStaticMarkup } = require('react-dom/server')
    const state = { scopeOnly: true, sharing: { mode: 'conversation', selectedId: '', revision: 'scope-revision', options: [{ id: 'chat1', label: 'Demo · chat1' }] } }
    const react = { ...realReact, useState(value) { return realReact.useState(value === false ? true : value === null ? state : value) } }
    let language = 'zh-CN'
    const locale = { getSnapshot: () => ({ active: language }), subscribe: () => () => {} }
    const Card = await browserModule(react, { available: ['/api/evo-subagent/' + feature], locale })
    const chinese = renderToStaticMarkup(realReact.createElement(Card))
    for (const text of ['适用范围', '所有工作区共享', '每个工作区独立', '每个对话独立', '配置对话']) assert.ok(chinese.includes(text), text)
    assert.ok(!chinese.includes('type="checkbox"'))
    language = 'fr'
    const english = renderToStaticMarkup(realReact.createElement(Card))
    assert.ok(!/[\u3400-\u9fff]/u.test(english))
    for (const text of ['Sharing scope', 'Share everywhere', 'Separate by workspace', 'Separate by conversation', 'Conversation to configure']) assert.ok(english.includes(text), text)
    assert.match(english, /Demo · chat1/)
    for (const control of english.match(/<(?:select|option)\b[^>]*>/g)) assert.match(control, /background-color:var\(--dsw-alias-bg-layer-3, #fff\)/)
  })

  test(`${feature} scope controls send target IDs and scope stamps to the correct owner endpoint`, async () => {
    const state = { scopeOnly: true, revision: 'profile-revision', sharing: { mode: 'workspace', selectedId: 'workspace-id', revision: 'scope-revision', options: [] } }, requests = []
    let stateIndex = 0
    const react = {
      createElement(type, props, ...children) { return { type, props: { ...props, children } } },
      useState(value) { return [stateIndex++ === 0 ? true : value === null ? state : value, () => {}] },
      useRef: () => ({ current: null }), useEffect() {}, useCallback: fn => fn, useSyncExternalStore: (_s, read) => read(),
    }
    const endpoint = '/api/evo-subagent/' + feature
    const Card = await browserModule(react, { fetch: async (path, options) => {
      if (!options?.method) return { status: path === endpoint ? 200 : 404 }
      requests.push({ path, options }); return { status: 200, ok: true, json: async () => state }
    } })
    const entry = Card().props.children.find(c => typeof c?.type === 'function')
    function find(node, predicate) {
      if (!node) return undefined
      if (Array.isArray(node)) return node.map(n => find(n, predicate)).find(Boolean)
      return predicate(node) ? node : find(node.props?.children, predicate)
    }
    const scope = find(entry.type(), n => typeof n.type === 'function' && n.props?.sharing)
    assert.ok(scope)
    await scope.props.onScope('conversation')
    assert.equal(requests[0].path, endpoint)
    const payload = JSON.parse(requests[0].options.body)
    assert.equal(payload.scope, 'conversation'); assert.equal(payload.sharingRevision, 'scope-revision')
    await scope.props.onTarget('another-target')
    assert.equal(requests[1].path, endpoint + '?target=another-target')
    assert.equal(requests[1].options.method, 'GET')
  })
}
