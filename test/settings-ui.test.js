import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { runInNewContext } from 'node:vm'
import test from 'node:test'

const require = createRequire(import.meta.url)
async function browserModule(react, options = {}) {
  const registrations = []; let module
  const ctx = { inject(names, callback) { if (names[0] === 'slots') callback(ctx); if (names[0] === 'locale' && options.locale) callback({ ...ctx, locale: options.locale }) },
    slots: { inject(_name, callback) { return callback() }, register(_options, component) { registrations.push(component) } } }
  runInNewContext(await readFile(new URL('../dsh/client.js', import.meta.url), 'utf8'), {
    window: { __ModuleLoader__: { load(spec) { module = spec.factory(name => name === 'react' ? react : require(name)) } } },
    fetch: options.fetch || (async path => ({ status: !options.available || options.available.includes(path) ? 200 : 404 })), console,
  })
  module.apply(ctx); await new Promise(resolve => setImmediate(resolve))
  return registrations[0]
}

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

for (const feature of ['persona', 'habits']) {
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
