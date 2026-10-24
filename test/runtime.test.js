import assert from 'node:assert/strict'
import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { runInNewContext } from 'node:vm'
import test from 'node:test'
import { Context } from '@deepseek-ai/cordis'
import { SubagentRuntime } from '@deepseek-ai/dsh-subagent'
import { ToolRuntime } from '@deepseek-ai/dsh-tools'
import * as plugin from '../index.js'

// Resolve host services from the exact DSH development runtime, not a second
// independently installed copy of a core service.
const require = createRequire(import.meta.url)
const dshRequire = createRequire(require.resolve('@deepseek-ai/dsh/package.json'))
const { SkillRegistry } = await import(pathToFileURL(dshRequire.resolve('@deepseek-ai/dsh-skill')))
const { evaluatePluginCompatibility } = await import(pathToFileURL(dshRequire.resolve('@deepseek-ai/dsh-app-boot')))
const { WebServer } = await import(pathToFileURL(dshRequire.resolve('@deepseek-ai/dsh-host-webserver')))
const manifest = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'))

async function runtime(t, { pending = false } = {}) {
  const directory = await mkdtemp(join(tmpdir(), 'evo-runtime-'))
  await writeFile(join(directory, 'reviewer.md'), '---\nprovider: test-provider\nmodel: test-model\n---\n')
  const ctx = new Context()
  t.after(() => ctx.fiber.dispose())
  const notices = []
  const catalog = []
  const parent = {
    id: 'parent', ctx, status: 'running', options: {},
    session: { header: {}, append(type, data) { catalog.push({ type, data }) } },
    inject(message) { notices.push(message) },
    steer(message) { notices.push(message) },
    followup(message) { notices.push(message) },
  }
  ctx.provide('workingDirectory', { get: () => directory, ensure: async () => directory })
  ctx.provide('agents', { get: id => id === parent.id ? parent : undefined })
  ctx.provide('systemPrompt', { tools() {}, section() {}, getSectionOrder: () => 0 })
  ctx.provide('llm', {
    listProviders: () => [{ id: 'test-provider' }],
    listModels: async () => [{ id: 'test-model' }],
  })
  await ctx.plugin(ToolRuntime)
  await ctx.plugin(SkillRegistry)
  await ctx.plugin(SubagentRuntime, { maxDepth: 3, maxActiveSubagents: 8 })
  const calls = []
  const executions = []
  ctx.subagents.registerProvider({
    name: 'spawn', inheritsParentContext: false,
    capabilities: { agentOptions: true, agentPreset: false, outputSchema: false, depthLimit: true },
    async start(request) {
      calls.push(request)
      const completion = Promise.withResolvers()
      const execution = { completion, disposed: 0 }
      executions.push(execution)
      if (!pending) completion.resolve({ stopReason: 'completed', output: [{ type: 'text', text: 'verified output' }] })
      return {
        id: `child-${calls.length}`, result: completion.promise,
        async dispose() {
          execution.disposed++
          completion.resolve({ stopReason: 'cancelled', output: [] })
        },
      }
    },
  })
  const pluginFiber = ctx.plugin(plugin, { bindingsDir: directory, evolution: false })
  await pluginFiber
  const execute = (args = {}, signal = new AbortController().signal) => ctx.tools.execute({
    callId: 'test-call', name: 'evo_subagent', agent: parent, signal,
    arguments: { agent_key: 'reviewer', description: 'Review', prompt: 'Check the change', ...args },
  })
  return { ctx, pluginFiber, directory, parent, calls, executions, notices, catalog, execute }
}

test('DSH 0.2.1 compatibility gate accepts the new release and rejects the former peer ranges', () => {
  assert.equal(evaluatePluginCompatibility(manifest, {}, '0.2.1-rc.2'), undefined)
  assert.ok(evaluatePluginCompatibility(manifest, {}, '0.1.5-rc.3'))
  assert.ok(evaluatePluginCompatibility(manifest, {}, '0.3.0'))
  const previous = { name: manifest.name, version: '0.7.0', peerDependencies: { '@deepseek-ai/dsh-subagent': '^0.1.5-rc.3' } }
  assert.ok(evaluatePluginCompatibility(previous, {}, '0.2.1-rc.2'))
})

test('real DSH tools and activation services execute a routed foreground child and release it', async t => {
  const h = await runtime(t)
  const result = await h.execute({ run_in_background: false })
  assert.equal(result.isError, false, JSON.stringify(result))
  assert.deepEqual(result.value, { kind: 'foreground', runId: 'child-1', output: [{ type: 'text', text: 'verified output' }] })
  assert.deepEqual(h.calls[0].agentOptions, { provider: 'test-provider', model: 'test-model' })
  assert.equal(h.calls[0].cwd, h.directory)
  assert.equal(h.executions[0].disposed, 1)
  assert.equal(h.notices.length, 0)
})

test('real DSH background delivery returns before completion and notifies its parent', async t => {
  const h = await runtime(t, { pending: true })
  const result = await h.execute()
  assert.equal(result.isError, false, JSON.stringify(result))
  assert.deepEqual(result.value, { kind: 'continuable', subagentId: 'child-1' })
  assert.equal(h.executions[0].disposed, 0)
  const ended = Promise.withResolvers()
  h.ctx.on('subagent/end', () => ended.resolve())
  h.executions[0].completion.resolve({ stopReason: 'completed', output: [{ type: 'text', text: 'background done' }] })
  await ended.promise
  await new Promise(resolve => setImmediate(resolve))
  assert.equal(h.executions[0].disposed, 1)
  assert.equal(h.catalog[0].type, 'subagent/catalog')
  assert.equal(h.notices.length, 1)
  assert.match(JSON.stringify(h.notices[0]), /background done/)
})

test('cancelling a foreground tool stops its published DSH activation', async t => {
  const h = await runtime(t, { pending: true })
  const controller = new AbortController()
  const resultPromise = h.execute({ run_in_background: false }, controller.signal)
  while (h.executions.length === 0) await new Promise(resolve => setImmediate(resolve))
  await new Promise(resolve => setImmediate(resolve))
  controller.abort()
  const result = await resultPromise
  assert.equal(result.isError, true)
  assert.equal(h.executions[0].disposed, 1)
})

test('the three skills load through the real DSH registry and unregister on plugin disposal', async t => {
  const h = await runtime(t)
  const names = (await h.ctx.skills.list()).map(skill => skill.name)
  assert.deepEqual(names.sort(), ['evo-delegation-guide', 'evo-memory-review', 'evo-route-doctor'])
  const skill = await h.ctx.skills.get('evo-route-doctor')
  assert.equal(skill.resourceBase.kind, 'directory')
  assert.ok(skill.content.length > 100)
  await h.pluginFiber.dispose()
  assert.deepEqual(await h.ctx.skills.list(), [])
})

test('settings routes serve workspace models and save evolution through the real DSH HTTP service', async t => {
  const h = await runtime(t)
  const agentsDir = join(h.directory, 'agents')
  await mkdir(agentsDir)
  await writeFile(join(agentsDir, 'reviewer.md'), '---\nprovider: test-provider\nmodel: test-model\n---\n')
  h.ctx.provide('workspaceRegistry', { list: () => [{ path: h.directory, title: 'Test workspace' }] })
  await h.ctx.plugin(WebServer, { host: '127.0.0.1', port: 0 })
  await new Promise(resolve => setImmediate(resolve))
  const origin = h.ctx.webServer.getOrigin()
  const response = await fetch(`${origin}/evo-subagent/projects`)
  assert.equal(response.status, 200)
  const summary = await response.json()
  assert.equal(summary.projects[0].projectName, 'Test workspace')
  assert.deepEqual(summary.modelsByProvider, { 'test-provider': ['test-model'] })
  const post = (route, body) => fetch(`${origin}/evo-subagent/${route}`, {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body),
  })
  const saved = await post('evolution/save', { projectRoot: h.directory, agentKey: 'reviewer', memory: '- verified on rc.2\n' })
  assert.equal(saved.status, 200)
  const loaded = await post('evolution/read', { projectRoot: h.directory, agentKey: 'reviewer' })
  assert.equal(loaded.status, 200)
  assert.match((await loaded.json()).memory, /verified on rc.2/)
})

test('the browser bundle registers a renderable tab on the new DSH Plugins page', async () => {
  const react = require('react')
  const { renderToStaticMarkup } = require('react-dom/server')
  const registrations = []
  let module
  const ctx = {
    inject(names, callback) { if (names[0] === 'slots') callback(ctx) },
    slots: {
      inject(name, callback) { assert.ok(['settings.plugins.tab', 'conversation.input.left'].includes(name)); return callback() },
      register(options, component) { registrations.push({ options, component }) },
    },
  }
  runInNewContext(await readFile(new URL('../dsh/client.js', import.meta.url), 'utf8'), {
    window: { __ModuleLoader__: { load(spec) { module = spec.factory(require) } } },
    fetch: async () => ({ status: 200 }), console,
  })
  module.apply(ctx)
  await new Promise(resolve => setImmediate(resolve))
  assert.equal(registrations.length, 2)
  assert.equal(registrations[0].options.name, 'settings.plugins.tab')
  assert.equal(registrations[1].options.name, 'conversation.input.left')
  assert.equal(registrations[0].options.label, 'dsh-evo-subagent')
  const html = renderToStaticMarkup(react.createElement(registrations[0].component))
  assert.match(html, /Subagent management/)
})

for (const catalogAvailable of [true, false]) {
  test(`routing dropdowns and options use paired theme colors (catalog ${catalogAvailable ? 'available' : 'unavailable'})`, async () => {
    const realReact = require('react')
    const { renderToStaticMarkup } = require('react-dom/server')
    const summary = {
      projects: [{ projectRoot: '/demo', projectName: 'Demo',
        agents: [{ agentKey: 'reviewer', editable: true, source: 'binding', provider: 'test-provider', model: 'test-model' }],
        mainAgent: { filename: '', candidates: catalogAvailable ? ['AGENTS.md'] : [] },
      }],
      builtin: [{ agentKey: 'planner', source: 'template' }],
      modelsByProvider: catalogAvailable ? { 'test-provider': ['test-model', 'other-model'], 'other-provider': [] } : {},
      scope: { scanSource: 'workspaces', workspaces: [{ path: '/demo', title: 'Demo' }] },
    }
    const react = { ...realReact, useState(value) { return realReact.useState(value === false ? true : value === null ? summary : value) } }
    const registrations = []
    let module
    const ctx = {
      inject(names, callback) { if (names[0] === 'slots') callback(ctx) },
      slots: { inject(_name, callback) { return callback() }, register(_options, component) { registrations.push(component) } },
    }
    runInNewContext(await readFile(new URL('../dsh/client.js', import.meta.url), 'utf8'), {
      window: { __ModuleLoader__: { load(spec) { module = spec.factory(name => name === 'react' ? react : require(name)) } } },
      fetch: async path => ({ status: path === '/evo-subagent/projects' ? 200 : 404 }), console,
    })
    module.apply(ctx); await new Promise(resolve => setImmediate(resolve))
    const html = renderToStaticMarkup(realReact.createElement(registrations[0]))
    assert.equal((html.match(/<select\b/g) || []).length, 4) // Provider, model, main agent and workspace.
    const controls = html.match(/<(?:select|option)\b[^>]*>/g)
    assert.equal(controls.length, catalogAvailable ? 11 : 8)
    for (const control of controls) {
      assert.match(control, /background-color:var\(--dsw-alias-bg-layer-3, #fff\)/)
      assert.match(control, /color:var\(--dsw-alias-label-primary, #222\)/)
    }
  })
}
