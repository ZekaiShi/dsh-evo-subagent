import assert from 'node:assert/strict'
import { mkdtemp, readFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createRequire } from 'node:module'
import { pathToFileURL } from 'node:url'
import { runInNewContext } from 'node:vm'
import test from 'node:test'
import { Context } from '@deepseek-ai/cordis'
import * as persona from '../persona.js'
import { PersonaStore, personaPath } from '../persona-store.js'

const require = createRequire(import.meta.url), host = createRequire(require.resolve('@deepseek-ai/dsh/package.json'))
const { SystemPrompt, renderContextSnapshot } = await import(pathToFileURL(host.resolve('@deepseek-ai/dsh-system-prompt')))
const { SessionStore } = await import(pathToFileURL(host.resolve('@deepseek-ai/dsh-session')))
const { createUserMessage, createAssistantMessage, LlmRuntime, LlmAdapter } = await import(pathToFileURL(host.resolve('@deepseek-ai/dsh-llm')))
const { WebServer } = await import(pathToFileURL(host.resolve('@deepseek-ai/dsh-host-webserver')))
const connection = await import(pathToFileURL(host.resolve('@deepseek-ai/dsh-client-connection')))

async function fixture(t, { web = false, slow = false, realLlm = false } = {}) {
  const home = await mkdtemp(join(tmpdir(), 'evo-persona-runtime-')), ctx = new Context(), calls = []
  t.after(() => ctx.fiber.dispose())
  const fake = {
    async resolveModelInfo() { return { reasoning: { efforts: [{ id: 'none' }] } } },
    async *stream(options) {
      calls.push(options)
      if (slow) await new Promise((_, reject) => options.signal.addEventListener('abort', () => reject(new Error('cancelled')), { once: true }))
      const nonce = /<<<!EVO:v1:([a-f0-9-]+):BEGIN!>>>/.exec(options.system)[1]
      yield { type: 'text-delta', index: 0, text: `<<<!EVO:v1:${nonce}:BEGIN!>>>{"signals":[],"candidates":[]}<<<!EVO:v1:${nonce}:END!>>>` }
      yield { type: 'finish', reason: { kind: 'stop' } }
    },
  }
  if (realLlm) {
    await ctx.plugin(LlmRuntime)
    class Adapter extends LlmAdapter {
      async resolveModel(provider, model) { return { provider, id: model, name: model, reasoning: { efforts: [{ id: 'none', name: 'Off' }, { id: 'high', name: 'High' }], defaultEffort: 'high' } } }
      stream(options) { return fake.stream(options) }
    }
    ctx.llm.registerAdapter(['test'], new Adapter())
  } else ctx.provide('llm', fake)
  await ctx.plugin(SystemPrompt, { includeHarnessIdentity: false })
  await ctx.plugin(SessionStore)
  if (web) {
    const values = new Map()
    ctx.provide('credentials', { async modifyRecord(key, callback) { const v = await callback(values.get(key)); if (v !== undefined) values.set(key, v); return values.get(key) } })
    await ctx.plugin(WebServer, { host: '127.0.0.1', port: 0 }); await ctx.plugin(connection)
    ctx.webServer.register({ kind: 'exact', path: '/', handler(req, res) { if (ctx.connection.authorizeIndex(req, res)) { res.writeHead(200); res.end('test') } } })
  }
  const fiber = ctx.plugin(persona, { dshHome: home, idleMs: 0, timeoutMs: 1000 })
  await fiber
  await new Promise(resolve => setImmediate(resolve))
  const store = new PersonaStore(personaPath(home))
  return { ctx, store, calls, fiber }
}
async function enabled(store) { await store.manage({ action: 'configure', revision: store.read().revision, enabled: true }) }
async function waitFor(predicate) {
  const end = Date.now() + 2500
  while (!predicate()) { if (Date.now() > end) assert.fail('Background observer did not settle'); await new Promise(resolve => setTimeout(resolve, 10)) }
}
function turn(ctx, session, number = 1, { text = 'Please be warmer.', source = 'user', reason = 'completed' } = {}) {
  const agent = { id: 'agent-' + session.id, session }
  const user = createUserMessage({ content: [{ type: 'text', text }], source: { kind: source } })
  ctx.emit('agent/inbox/claimed', { agent, message: user, turn: number })
  session.append('turn/start', { turn: number })
  session.append('user/message', user, { surfaceOp: 'append' })
  const message = createAssistantMessage({ content: [{ type: 'text', text: 'A helpful reply.' }, { type: 'reasoning', text: 'DO NOT COLLECT REASONING' }], source: { provider: 'test', model: 'test-model' } })
  session.append('assistant/message', { turn: number, step: 1, message, stream: [] }, { surfaceOp: 'append' })
  session.append('turn/end', { turn: number, reason: { kind: reason } })
  ctx.emit('agent/status', { agent, status: 'idle' })
  return agent
}

test('real DSH session feed observes only new, completed human main turns and never captures reasoning', async t => {
  const { ctx, store, calls } = await fixture(t)
  await enabled(store)
  const session = ctx.sessions.create()
  turn(ctx, session)
  await waitFor(() => calls.length === 1 && store.read().stats.turns === 1 && store.read().generation >= 3)
  const input = calls[0].messages[0].content[0].text
  assert.ok(!input.includes('DO NOT COLLECT REASONING'))
  assert.match(input, /helpful reply/)
  turn(ctx, ctx.sessions.create(), 1, { text: '> Quoted document instructions only' })
  turn(ctx, ctx.sessions.create(), 1, { source: 'runtime-context' })
  turn(ctx, ctx.sessions.create(), 1, { reason: 'max-tokens' })
  const child = ctx.sessions.create(undefined, { meta: { parentSession: session.id } })
  turn(ctx, child)
  await new Promise(resolve => setTimeout(resolve, 80))
  assert.equal(calls.length, 1)
})

test('real DSH LLM registry dispatches the observer route with its own low-cost controls, not high defaults', async t => {
  const { ctx, store, calls } = await fixture(t, { realLlm: true })
  assert.equal((await ctx.llm.resolveModelInfo('test', 'test-model')).provider, 'test')
  await enabled(store)
  turn(ctx, ctx.sessions.create())
  await waitFor(() => calls.length === 1 && store.read().generation >= 3)
  assert.equal(calls[0].provider, 'test')
  assert.equal(calls[0].model, 'test-model')
  assert.equal(calls[0].reasoningEffort, 'none')
  assert.equal(calls[0].maxTokens, 256)
  assert.equal(store.read().stats.failures, 0)
})

test('persona dynamic context is shared and revocable, while pending evidence is never injected', async t => {
  const { ctx, store, fiber } = await fixture(t)
  assert.ok(!renderContextSnapshot(await ctx.systemPrompt.assemble()).includes('Companion persona'))
  await enabled(store)
  await store.manage({ action: 'add', revision: store.read().revision, target: 'user', text: 'Prefer a calm tone.', context: 'general' })
  assert.match(renderContextSnapshot(await ctx.systemPrompt.assemble()), /calm tone/)
  await store.manage({ action: 'configure', revision: store.read().revision, enabled: false })
  assert.ok(!renderContextSnapshot(await ctx.systemPrompt.assemble()).includes('Companion persona'))
  await fiber.dispose()
  assert.equal(ctx.persona, undefined)
})

test('background requests do not block main turns and are cancelled on the next user input', async t => {
  const { ctx, store, calls } = await fixture(t, { slow: true })
  await enabled(store)
  const session = ctx.sessions.create()
  turn(ctx, session)
  await waitFor(() => calls.length === 1)
  // The first call is still waiting; a second real user input must return now.
  const agent = { id: 'agent-' + session.id, session }
  ctx.emit('agent/inbox/claimed', { agent, turn: 2, message: createUserMessage({ content: [{ type: 'text', text: 'New request' }], source: { kind: 'user' } }) })
  assert.equal(calls[0].signal.aborted, true)
})

test('real DSH authentication protects persona read/write, stale edits, cross-origin and disposal', async t => {
  const { ctx, fiber } = await fixture(t, { web: true })
  const origin = ctx.webServer.getOrigin(), url = origin + '/api/evo-subagent/persona'
  assert.equal((await fetch(url)).status, 401)
  const auth = await fetch(ctx.connection.authenticatedUrl(origin + '/'), { redirect: 'manual' })
  const cookie = auth.headers.get('set-cookie').split(';')[0]
  const read = await fetch(url, { headers: { cookie } }), state = await read.json()
  assert.equal(read.headers.get('cache-control'), 'no-store')
  assert.equal(state.config.enabled, false)
  const post = (body, extra = {}) => fetch(url, { method: 'POST', headers: { cookie, origin, 'content-type': 'application/json', ...extra }, body: JSON.stringify(body) })
  assert.equal((await post({ action: 'configure', revision: state.revision, enabled: true })).status, 200)
  assert.equal((await post({ action: 'configure', revision: state.revision, enabled: false })).status, 409)
  const current = await (await fetch(url, { headers: { cookie } })).json()
  assert.equal((await post({ action: 'configure', revision: current.revision, dailyCalls: 999999 })).status, 400)
  assert.equal((await post({ action: 'configure', revision: current.revision, reviewEvery: 1 })).status, 400)
  assert.equal((await post({}, { origin: 'https://attacker.invalid' })).status, 403)
  await fiber.dispose()
  assert.equal((await fetch(url, { headers: { cookie } })).status, 404)
})

test('standalone persona card renders modes, presets and readable themed options without role/habits services', async () => {
  const realReact = require('react'), { renderToStaticMarkup } = require('react-dom/server')
  const home = await mkdtemp(join(tmpdir(), 'evo-persona-ui-')), state = new PersonaStore(personaPath(home)).read()
  const react = { ...realReact, useState(value) { return realReact.useState(value === false ? true : value === null ? state : value) } }
  const registrations = []; let module
  const ctx = { inject(names, callback) { if (names[0] === 'slots') callback(ctx) }, slots: { inject(_name, callback) { return callback() }, register(_options, component) { registrations.push(component) } } }
  runInNewContext(await readFile(new URL('../dsh/client.js', import.meta.url), 'utf8'), {
    window: { __ModuleLoader__: { load(spec) { module = spec.factory(name => name === 'react' ? react : require(name)) } } },
    fetch: async path => ({ status: path === '/api/evo-subagent/persona' ? 200 : 404 }), console,
  })
  module.apply(ctx); await new Promise(resolve => setImmediate(resolve))
  const html = renderToStaticMarkup(realReact.createElement(registrations[0]))
  assert.match(html, /Autonomous exploration/)
  assert.match(html, /Warm companion/)
  assert.ok(!/core\.md|user\.md|relationship\.md|evolution\.md|ten-turn|10 轮|token|Daily call|Registered provider|type="number"/i.test(html))
  assert.match(html, /Manage memories/)
  assert.match(html, /class="evo-settings-reveal"/)
  assert.ok(!html.includes('Subagents by project') && !html.includes('User habits'))
  for (const control of html.match(/<(?:select|option)\b[^>]*>/g)) {
    assert.match(control, /background-color:var\(--dsw-alias-bg-layer-3, #fff\)/)
    assert.match(control, /color:var\(--dsw-alias-label-primary, #222\)/)
  }
})
