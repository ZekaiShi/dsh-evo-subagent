import assert from 'node:assert/strict'
import { mkdtemp, mkdir, writeFile, readFile, readdir } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createRequire } from 'node:module'
import { pathToFileURL } from 'node:url'
import test from 'node:test'
import { Context } from '@deepseek-ai/cordis'
import { ToolRuntime } from '@deepseek-ai/dsh-tools'
import { ScopeProfiles, SharingStore, profileBase } from '../sharing.js'
import { PersonaStore, personaPath, PERSONA_LIMITS } from '../persona-store.js'
import { HabitsStore, habitsPath } from '../habits-store.js'
import { PersonaObserver } from '../persona.js'
import * as persona from '../persona.js'
import * as habits from '../habits.js'

const require = createRequire(import.meta.url), host = createRequire(require.resolve('@deepseek-ai/dsh/package.json'))
const { SystemPrompt, renderContextSnapshot } = await import(pathToFileURL(host.resolve('@deepseek-ai/dsh-system-prompt')))
const { SessionStore } = await import(pathToFileURL(host.resolve('@deepseek-ai/dsh-session')))
const { createUserMessage, createAssistantMessage } = await import(pathToFileURL(host.resolve('@deepseek-ai/dsh-llm')))
const signal = () => new AbortController().signal
const setMode = (policy, feature, mode) => policy.set(feature, mode, policy.snapshot(feature).revision)
const configure = (store, extra) => store.manage({ action: 'configure', revision: store.read().revision, ...extra })

async function fixture(t) {
  const home = await mkdtemp(join(tmpdir(), 'evo-sharing-')), ctx = new Context(), directories = new Map(), routes = new Map(), calls = []
  t.after(() => ctx.fiber.dispose())
  const a = join(home, 'project-a'), b = join(home, 'project-b')
  await mkdir(join(a, 'nested'), { recursive: true }); await mkdir(b)
  await ctx.plugin(SystemPrompt, { includeHarnessIdentity: false }); await ctx.plugin(ToolRuntime); await ctx.plugin(SessionStore)
  ctx.provide('workingDirectory', { get: session => directories.get(session?.id) ?? session?.header?.cwd })
  ctx.provide('workspaceRegistry', { list: () => [{ path: a, title: 'Project A' }, { path: b, title: 'Project B' }] })
  const llm = { async resolveModelInfo() { return { reasoning: { efforts: [{ id: 'none' }] } } }, async *stream(options) {
    calls.push(options)
    const nonce = /<<<!EVO:v1:([a-f0-9-]+):BEGIN!>>>/.exec(options.system)[1]
    yield { type: 'text-delta', index: 0, text: `<<<!EVO:v1:${nonce}:BEGIN!>>>{"signals":[],"candidates":[]}<<<!EVO:v1:${nonce}:END!>>>` }
    yield { type: 'finish', reason: { kind: 'stop' } }
  } }
  ctx.provide('llm', llm)
  ctx.provide('connection', { fetch: { register(route) { routes.set(route.path, route.fetch) } } })
  await ctx.plugin(persona, { dshHome: home }); await ctx.plugin(habits, { dshHome: home })
  await new Promise(resolve => setImmediate(resolve))
  const profiles = feature => new ScopeProfiles(ctx, home, feature, base => feature === 'persona' ? new PersonaStore(join(base, 'persona')) : new HabitsStore(join(base, 'user-habits.md')))
  const policy = new SharingStore(profileBase(home))
  function session(id, cwd = a, meta = {}) { return ctx.sessions.create(id, { ...(meta.isSeeded ? { seed: [], inheritedEventCount: 0 } : {}), meta: { cwd, ...meta } }) }
  const a1 = session('chat-a1'), a2 = session('chat-a2', join(a, 'nested')), b1 = session('chat-b1', b)
  async function api(feature, method = 'GET', input, target = '') {
    const url = 'http://local/api/evo-subagent/' + feature + (target ? '?target=' + encodeURIComponent(target) : '')
    const response = await routes.get('/api/evo-subagent/' + feature)(new Request(url, { method, ...(input ? { body: JSON.stringify(input) } : {}) }))
    return { status: response.status, body: await response.json() }
  }
  return { home, ctx, policy, profiles, directories, a, b, a1, a2, b1, session, llm, calls, api }
}

test('scope reads are side-effect free; feature policies and stale-edit stamps are independent', async t => {
  const { home, policy } = await fixture(t)
  const personaStamp = policy.snapshot('persona').revision, habitsStamp = policy.snapshot('habits').revision
  await assert.rejects(readdir(profileBase(home)), { code: 'ENOENT' })
  await policy.set('persona', 'workspace', personaStamp)
  assert.equal(policy.snapshot('habits').revision, habitsStamp)
  await assert.rejects(policy.set('persona', 'conversation', personaStamp), { status: 409 })
  await policy.set('habits', 'conversation', habitsStamp)
  assert.equal(policy.snapshot('persona').mode, 'workspace')
  assert.equal(policy.snapshot('habits').mode, 'conversation')
  const filename = policy.filename
  await writeFile(filename, '{broken policy')
  assert.throws(() => policy.snapshot('persona'), { status: 422 })
  await assert.rejects(policy.set('persona', 'global', personaStamp), { status: 422 })
  assert.equal(await readFile(filename, 'utf8'), '{broken policy')
})

test('workspace profiles share across nested conversations, isolate projects and preserve legacy global files', async t => {
  const { home, policy, profiles, a1, a2, b1 } = await fixture(t), p = profiles('persona')
  const global = new PersonaStore(personaPath(home))
  await configure(global, { enabled: true, preset: 'playful' })
  const original = await readFile(join(global.directory, 'evolution.md'), 'utf8')
  assert.equal(p.current({ session: b1 }).store.read().config.preset, 'playful')
  await setMode(policy, 'persona', 'workspace')
  const a = p.current({ session: a1 }), second = p.current({ session: a2 }), b = p.current({ session: b1 })
  assert.equal(a.id, second.id); assert.notEqual(a.id, b.id)
  assert.equal(a.store.read().config.enabled, false)
  assert.equal(p.current().store, null)
  await configure(a.store, { enabled: true, preset: 'calm' })
  assert.equal(second.store.read().config.preset, 'calm')
  assert.equal(b.store.read().config.enabled, false)
  assert.equal(await readFile(join(global.directory, 'evolution.md'), 'utf8'), original)
  await setMode(policy, 'persona', 'global')
  assert.equal(p.current().store.read().config.preset, 'playful')
  await setMode(policy, 'persona', 'workspace')
  assert.equal(p.current({ session: a1 }).store.read().config.preset, 'calm')
})

test('conversation profiles separate main chats and seeded forks, while nested children inherit their root profile', async t => {
  const { policy, profiles, a1, a2, b, session, ctx } = await fixture(t), p = profiles('persona')
  await setMode(policy, 'persona', 'conversation')
  const child = session('child', b, { parentSession: a1.id, origin: 'subagent', delegationDepth: 1 })
  const grandchild = session('grandchild', b, { parentSession: child.id, origin: 'subagent', isSeeded: true, delegationDepth: 2 })
  const mainFork = session('main-fork', undefined, { parentSession: a1.id, isSeeded: true })
  const root = p.current({ session: a1 })
  assert.equal(root.id, p.current({ session: child }).id)
  assert.equal(root.id, p.current({ session: grandchild }).id)
  assert.notEqual(root.id, p.current({ session: a2 }).id)
  assert.notEqual(root.id, p.current({ session: mainFork }).id)
  const unknown = session('orphan', b, { parentSession: 'unavailable', origin: 'subagent' })
  assert.equal(p.current({ session: unknown }).store, null)
  const options = p.catalog('conversation')
  assert.equal(options.length, 4)
  assert.ok(options.some(x => x.label.endsWith('main-fork')))
  assert.ok(!options.some(x => x.label.endsWith('child')))
  assert.equal(ctx.persona.read({ session: unknown }), undefined)
})

test('current working directory and policy changes invalidate captured observations without a global fallback', async t => {
  const { profiles, policy, directories, a1, b } = await fixture(t), p = profiles('persona')
  await setMode(policy, 'persona', 'workspace')
  const selected = p.current({ session: a1 }), current = p.guard(selected, { session: a1 })
  assert.equal(current(), true)
  directories.set(a1.id, b)
  assert.equal(current(), false)
  assert.notEqual(p.current({ session: a1 }).id, selected.id)
  directories.delete(a1.id)
  await setMode(policy, 'persona', 'conversation')
  assert.equal(current(), false)
})

for (const feature of ['persona', 'habits']) test(`${feature} settings require a valid target and scope revision; separate profiles keep separate settings`, async t => {
  const { api, policy, profiles, a1, b1 } = await fixture(t), p = profiles(feature)
  const initial = (await api(feature)).body
  const changed = await api(feature, 'POST', { action: 'set-scope', scope: 'workspace', sharingRevision: initial.sharing.revision })
  assert.equal(changed.status, 200); assert.equal(changed.body.scopeOnly, true)
  assert.equal(changed.body.sharing.options.length, 2)
  assert.equal((await api(feature, 'POST', { action: 'configure', enabled: true })).status, 409)
  assert.equal((await api(feature, 'GET', undefined, '../../outside')).status, 404)
  const target = p.current({ session: a1 }).id, other = p.current({ session: b1 }).id
  const state = (await api(feature, 'GET', undefined, target)).body
  const body = { action: 'configure', revision: state.revision, sharingRevision: state.sharing.revision, enabled: true }
  assert.equal((await api(feature, 'POST', { ...body, sharingRevision: undefined }, target)).status, 409)
  const saved = await api(feature, 'POST', body, target)
  assert.equal(saved.status, 200)
  assert.equal(feature === 'persona' ? saved.body.config.enabled : saved.body.enabled, true)
  const untouched = (await api(feature, 'GET', undefined, other)).body
  assert.equal(feature === 'persona' ? untouched.config.enabled : untouched.enabled, false)
  await setMode(policy, feature, 'conversation')
  assert.equal((await api(feature, 'POST', body, target)).status, 404)
  await setMode(policy, feature, 'workspace')
  assert.equal((await api(feature, 'POST', { ...body, revision: saved.body.revision }, target)).status, 409)
})

test('real prompt and tool services honor independent persona/habits scopes and reject evidence captured in another profile', async t => {
  const { ctx, home, policy, profiles, a1, a2, b1, directories, b } = await fixture(t)
  await setMode(policy, 'persona', 'workspace'); await setMode(policy, 'habits', 'conversation')
  const p = profiles('persona'), h = profiles('habits')
  const ps = p.current({ session: a1 }).store
  await configure(ps, { enabled: true, preset: 'calm' })
  await ps.manage({ action: 'add', revision: ps.read().revision, text: 'Prefer a calm tone.', target: 'user', context: 'general' })
  const hs = h.current({ session: a1 }).store
  await configure(hs, { enabled: true })
  await hs.manage({ action: 'replace-summary', revision: hs.read().revision, summary: 'Keep routine answers concise.' })
  const prompt = async session => renderContextSnapshot(await ctx.systemPrompt.assemble({ agent: { session } }))
  assert.match(await prompt(a1), /calm tone/); assert.match(await prompt(a1), /routine answers concise/)
  assert.match(await prompt(a2), /calm tone/); assert.ok(!(await prompt(a2)).includes('routine answers concise'))
  assert.ok(!(await prompt(b1)).includes('calm tone'))
  const agent = { id: 'parent', ctx, session: a1, options: {} }
  const quote = 'Please keep routine answers concise.'
  ctx.emit('agent/inbox/claimed', { agent, turn: 1, message: createUserMessage({ content: [{ type: 'text', text: quote }], source: { kind: 'user' } }) })
  directories.set(a1.id, b)
  const result = await ctx.tools.execute({ name: 'evo_user_habits', callId: 'moved', agent, signal: signal(), arguments: { action: 'propose', category: 'verbosity', context: 'general', text: 'Keep routine answers concise.', evidence: quote } })
  assert.equal(result.isError, true)
  assert.ok(!(await prompt(a1)).includes('calm tone'))
  assert.equal(new HabitsStore(habitsPath(home)).read().entries.length, 0)
})

test('device observer budget aggregates reservations across instances without changing scope stamps', async t => {
  const { home, policy } = await fixture(t), other = new SharingStore(profileBase(home))
  const revision = policy.snapshot('persona').revision, day = new Date().toISOString().slice(0, 10)
  const limits = { dailyCalls: 3, dailyOutputTokens: 768 }
  await policy.reserve(256, limits, { day, calls: 1, reservedOutput: 256 })
  await other.reserve(256, limits, { day, calls: 0, reservedOutput: 0 })
  await assert.rejects(policy.reserve(256, limits), /device observer budget/)
  assert.equal(policy.read().budget.calls, 3)
  assert.equal(policy.snapshot('persona').revision, revision)
})

test('observer writes only the selected profile and checks both scope and device budget before dispatch', async t => {
  const { home, policy, profiles, a1, a2, llm, calls } = await fixture(t), p = profiles('persona')
  await setMode(policy, 'persona', 'conversation')
  const selected = p.current({ session: a1 }), untouched = p.current({ session: a2 })
  await configure(selected.store, { enabled: true })
  const observer = new PersonaObserver(new PersonaStore(personaPath(home)), llm)
  t.after(() => observer.dispose())
  const job = { store: selected.store, scopeKey: selected.id, isCurrent: p.guard(selected, { session: a1 }), reserve: (tokens, sig) => policy.reserve(tokens, PERSONA_LIMITS, undefined, sig),
    id: 'turn-1', session: a1.id, turn: 1, control: selected.store.read().control, user: 'Please be warmer.', assistant: 'A helpful answer.', context: 'general', style: [3, 1, 2, 1, 2], route: { provider: 'fake', model: 'fake' } }
  await observer.observe(job, signal())
  assert.equal(calls.length, 1); assert.equal(selected.store.read().stats.turns, 1)
  assert.equal(untouched.store.read().stats.turns, 0)
  assert.equal(policy.read().budget.calls, 1)
  await setMode(policy, 'persona', 'workspace')
  await observer.observe({ ...job, turn: 2, id: 'turn-2' }, signal())
  assert.equal(calls.length, 1)
})

test('new completed human turns reach the correct scoped observer through the real DSH session feed', async t => {
  const { ctx, policy, profiles, a1, a2, calls } = await fixture(t), p = profiles('persona')
  await setMode(policy, 'persona', 'conversation')
  const selected = p.current({ session: a1 }).store
  await configure(selected, { enabled: true })
  const agent = { id: 'agent-a1', session: a1 }
  ctx.emit('agent/inbox/claimed', { agent, turn: 1, message: createUserMessage({ content: [{ type: 'text', text: 'Please use a warm tone.' }], source: { kind: 'user' } }) })
  a1.append('turn/start', { turn: 1 })
  a1.append('assistant/message', { turn: 1, step: 1, message: createAssistantMessage({ content: [{ type: 'text', text: 'A warm answer.' }], source: { provider: 'fake', model: 'fake' } }), stream: [] }, { surfaceOp: 'append' })
  a1.append('turn/end', { turn: 1, reason: { kind: 'completed' } })
  ctx.emit('agent/status', { agent, status: 'idle' })
  const deadline = Date.now() + 2500
  while (selected.read().generation < 3) { assert.ok(Date.now() < deadline, 'scoped observer did not settle'); await new Promise(resolve => setTimeout(resolve, 10)) }
  assert.equal(calls.length, 1)
  assert.equal(selected.read().stats.turns, 1)
  assert.equal(p.current({ session: a2 }).store.read().stats.turns, 0)
})
