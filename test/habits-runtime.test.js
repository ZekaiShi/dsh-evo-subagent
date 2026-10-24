import assert from 'node:assert/strict'
import { mkdtemp, readFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createRequire } from 'node:module'
import { pathToFileURL } from 'node:url'
import { runInNewContext } from 'node:vm'
import test from 'node:test'
import { Context } from '@deepseek-ai/cordis'
import { ToolRuntime } from '@deepseek-ai/dsh-tools'
import * as habits from '../habits.js'
import { HabitsStore, habitsPath } from '../habits-store.js'

const require = createRequire(import.meta.url)
const host = createRequire(require.resolve('@deepseek-ai/dsh/package.json'))
const { SystemPrompt, renderContextSnapshot } = await import(pathToFileURL(host.resolve('@deepseek-ai/dsh-system-prompt')))
const connectionPlugin = await import(pathToFileURL(host.resolve('@deepseek-ai/dsh-client-connection')))
const { WebServer } = await import(pathToFileURL(host.resolve('@deepseek-ai/dsh-host-webserver')))

async function fixture(t, web = false) {
  const home = await mkdtemp(join(tmpdir(), 'evo-habits-runtime-'))
  const store = new HabitsStore(habitsPath(home))
  const ctx = new Context()
  t.after(() => ctx.fiber.dispose())
  await ctx.plugin(SystemPrompt, { includeHarnessIdentity: false })
  await ctx.plugin(ToolRuntime)
  if (web) {
    const records = new Map()
    ctx.provide('credentials', { async modifyRecord(key, callback) {
      const result = await callback(records.get(key))
      if (result !== undefined) records.set(key, result)
      return records.get(key)
    } })
    await ctx.plugin(WebServer, { host: '127.0.0.1', port: 0 })
    await ctx.plugin(connectionPlugin)
    ctx.webServer.register({ kind: 'exact', path: '/', handler(req, res) {
      if (ctx.connection.authorizeIndex(req, res)) { res.writeHead(200); res.end('test index') }
    } })
  }
  const fiber = ctx.plugin(habits, { dshHome: home })
  await fiber
  await new Promise(resolve => setImmediate(resolve))
  return { ctx, store, fiber }
}

test('real prompt registry injects only confirmed habits and observes pause/removal without a restart', async t => {
  const { ctx, store } = await fixture(t)
  let context = renderContextSnapshot(await ctx.systemPrompt.assemble())
  assert.ok(!context.includes('User collaboration preferences'))
  await store.manage({ action: 'configure', revision: store.read().revision, enabled: true })
  const pending = await store.propose({ text: 'Use {{literal}} for examples.', evidence: 'Keep {{literal}} in examples.', category: 'format', context: 'general' })
  context = renderContextSnapshot(await ctx.systemPrompt.assemble())
  assert.ok(!context.includes('Use {{literal}}'))
  await store.manage({ action: 'approve', id: pending.id, revision: store.read().revision })
  context = renderContextSnapshot(await ctx.systemPrompt.assemble())
  assert.match(context, /Use \{\{literal\}\}/)
  await store.manage({ action: 'remove', id: pending.id, revision: store.read().revision })
  assert.ok(!renderContextSnapshot(await ctx.systemPrompt.assemble()).includes('Use {{literal}}'))
})

test('real tool runtime validates a proposal while leaving approval to the user', async t => {
  const { ctx, store } = await fixture(t)
  await store.manage({ action: 'configure', revision: store.read().revision, enabled: true })
  const agent = { ctx, id: 'parent', session: { header: {}, append() {} }, options: {}, status: 'running' }
  ctx.emit('agent/inbox/claimed', { agent, message: { role: 'user', source: { kind: 'user' }, content: [{ type: 'text', text: 'Please keep routine answers concise.' }] }, turn: 1 })
  const result = await ctx.tools.execute({ name: 'evo_user_habits', callId: 'habits-test', agent, signal: new AbortController().signal,
    arguments: { action: 'propose', category: 'verbosity', text: 'Keep routine answers concise.', evidence: 'Please keep routine answers concise.' } })
  assert.equal(result.isError, false, JSON.stringify(result))
  assert.equal(result.value.status, 'pending')
  assert.equal(store.read().entries[0].status, 'pending')
  const invalid = await ctx.tools.execute({ name: 'evo_user_habits', callId: 'habits-test-2', agent, signal: new AbortController().signal,
    arguments: { action: 'approve', id: result.value.id } })
  assert.equal(invalid.isError, true)
})

test('real DSH HTTP bridge requires authentication and rejects cross-origin access to habits', async t => {
  const { ctx } = await fixture(t, true)
  const origin = ctx.webServer.getOrigin()
  const url = origin + '/api/evo-subagent/habits'
  assert.equal((await fetch(url)).status, 401)
  const auth = await fetch(ctx.connection.authenticatedUrl(origin + '/'), { redirect: 'manual' })
  assert.equal(auth.status, 303)
  const cookie = auth.headers.get('set-cookie').split(';')[0]
  const read = await fetch(url, { headers: { cookie } })
  assert.equal(read.status, 200)
  assert.equal(read.headers.get('cache-control'), 'no-store')
  const state = await read.json()
  const saved = await fetch(url, { method: 'POST', headers: { cookie, origin, 'content-type': 'application/json' },
    body: JSON.stringify({ action: 'configure', revision: state.revision, enabled: true }) })
  assert.equal(saved.status, 200)
  assert.equal((await saved.json()).enabled, true)
  const crossOrigin = await fetch(url, { method: 'POST', headers: { cookie, origin: 'https://untrusted.invalid', 'content-type': 'application/json' },
    body: JSON.stringify({ action: 'configure', revision: state.revision, enabled: false }) })
  assert.equal(crossOrigin.status, 403)
})

test('the habits plugin independently unregisters its global tool, context and HTTP route', async t => {
  const { ctx, fiber } = await fixture(t, true)
  assert.ok(ctx.userHabits)
  await fiber.dispose()
  assert.equal(ctx.userHabits, undefined)
  const result = await ctx.tools.execute({ name: 'evo_user_habits', callId: 'removed', agent: { ctx }, signal: new AbortController().signal, arguments: { action: 'read' } })
  assert.equal(result.isError, true)
})

test('standalone habits settings render confirmed/candidate controls without a routing backend or unsafe HTML', async () => {
  const realReact = require('react')
  const { renderToStaticMarkup } = require('react-dom/server')
  const state = { enabled: true, learning: true, filename: 'demo/user-habits.md', revision: 'test',
    generalSummary: 'Default to Chinese; use a warm tone.', pendingSummary: 'Default to Chinese; use a warm tone; <script>not executable</script>.', generalPendingCount: 1, entries: [
    { id: 'confirmed', status: 'active', category: 'language', context: 'general', text: 'Default to Chinese.' },
    { id: 'pending', status: 'pending', category: 'interaction', context: 'general', text: '<script>not executable</script>', evidence: 'A user quote' },
    { id: 'old-name', status: 'active', category: 'interaction', context: 'general', text: 'Call me Little Pomelo.' },
  ] }
  const react = { ...realReact, useState(value) { return realReact.useState(value === false ? true : value === null ? state : value) } }
  const registrations = []
  let module
  const ctx = {
    inject(names, callback) { if (names[0] === 'slots') callback(ctx) },
    slots: { inject(_name, callback) { return callback() }, register(_options, component) { registrations.push(component) } },
  }
  runInNewContext(await readFile(new URL('../dsh/client.js', import.meta.url), 'utf8'), {
    window: { __ModuleLoader__: { load(spec) { module = spec.factory(name => name === 'react' ? react : require(name)) } } },
    fetch: async path => ({ status: path === '/api/evo-subagent/habits' ? 200 : 404 }), console,
  })
  module.apply(ctx); await new Promise(resolve => setImmediate(resolve))
  const html = renderToStaticMarkup(realReact.createElement(registrations[0]))
  assert.match(html, /User habits/)
  assert.match(html, /Use this update/)
  assert.match(html, /Edit summary/)
  assert.match(html, /Default to Chinese/)
  assert.ok(!html.includes('<script>'))
  assert.ok(!html.includes('Subagents by project'))
  assert.ok(!html.includes('Little Pomelo') && !html.includes('A user quote'))
  assert.equal((html.match(/data-evo-habits-summary=""/g) || []).length, 1)
  assert.equal((html.match(/<select\b/g) || []).length, 1)
  assert.ok(!html.includes('Preference category') && !html.includes('Applicable scenario'))
})
