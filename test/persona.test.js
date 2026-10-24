import assert from 'node:assert/strict'
import { mkdtemp, readFile, writeFile, readdir, unlink } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import { PersonaStore, personaPath, PERSONA_FILES, PERSONA_LIMITS, personaContext, personaStyle, PRESETS, safeText } from '../persona-store.js'
import { PersonaObserver, parseEnvelope, OBSERVE_TOKENS, REVIEW_TOKENS } from '../persona.js'

async function fixture(patch = {}) {
  const home = await mkdtemp(join(tmpdir(), 'evo-persona-'))
  const store = new PersonaStore(personaPath(home))
  if (Object.keys(patch).length) await configure(store, patch)
  return { home, store }
}
const configure = async (store, patch) => store.manage({ action: 'configure', revision: store.read().revision, ...patch })
function job(store, turn, extra = {}) {
  return { id: `test:${turn}`, session: 'test', turn, control: store.read().control,
    user: 'Please be warmer.', assistant: 'Here is a helpful answer.', context: 'general', style: [3, 1, 2, 1, 2], route: { provider: 'test', model: 'test-model' }, ...extra }
}
function model(build = () => ({ signals: [], candidates: [] }), finish = 'stop') {
  const calls = []
  return { calls, async resolveModelInfo() { return { reasoning: { efforts: [{ id: 'none' }, { id: 'high' }] } } },
    async *stream(options) {
      calls.push(options)
      const nonce = /<<<!EVO:v1:([a-f0-9-]+):BEGIN!>>>/.exec(options.system)[1]
      const input = JSON.parse(options.messages[0].content[0].text)
      const text = `<<<!EVO:v1:${nonce}:BEGIN!>>>${JSON.stringify(build(input))}<<<!EVO:v1:${nonce}:END!>>>`
      yield { type: 'text-delta', index: 0, text }
      yield { type: 'block-end', index: 0, block: { type: 'text', text } }
      yield { type: 'usage', usage: { inputTokens: 50, outputTokens: 20 } }
      yield { type: 'finish', reason: { kind: finish } }
    },
  }
}
const signal = () => new AbortController().signal

test('persona is off by default; reading and ignored observations create no files', async () => {
  const { store } = await fixture(), llm = model(), observer = new PersonaObserver(store, llm)
  assert.equal(store.read().config.enabled, false)
  assert.equal(personaContext(store.read()), '')
  await observer.observe(job(store, 1), signal())
  assert.equal(llm.calls.length, 0)
  await assert.rejects(readdir(store.directory), { code: 'ENOENT' })
})

test('enable creates exactly four files, preserves same-generation manual edits, and rejects stale owners', async () => {
  const { store } = await fixture({ enabled: true })
  assert.deepEqual((await readdir(store.directory)).sort(), [...PERSONA_FILES].sort())
  const corePath = join(store.directory, 'core.md')
  const core = await readFile(corePath, 'utf8')
  await writeFile(corePath, core.replace('Be a warm, steady, honest companion', 'Be a calm, steady, honest companion'))
  assert.match(personaContext(store.read()), /calm, steady/)
  const stale = store.read().revision
  await configure(store, { learning: false })
  await assert.rejects(store.manage({ action: 'configure', revision: stale, enabled: false }), /reload/)
  assert.match(store.read().snapshot.core.principles, /calm, steady/)
})

test('four-file checkpoint recovers stale/missing projections without overwriting malformed files', async () => {
  const { store } = await fixture({ enabled: true })
  const corePath = join(store.directory, 'core.md'), old = await readFile(corePath, 'utf8')
  await configure(store, { learning: false })
  await writeFile(corePath, old)
  await unlink(join(store.directory, 'relationship.md'))
  assert.deepEqual(store.read().recovering.sort(), ['core.md', 'relationship.md'])
  await configure(store, { learning: true })
  assert.equal(store.read().recovering.length, 0)
  await writeFile(corePath, 'Unrecognized hand-written content')
  await assert.rejects(configure(store, { enabled: false }), /preserved/)
  assert.equal(await readFile(corePath, 'utf8'), 'Unrecognized hand-written content')
})

test('preset and exploration styles are bounded, reproducible per seed, and injected without pending/private history', async () => {
  const { store } = await fixture({ enabled: true, preset: 'calm' })
  assert.deepEqual(personaStyle(store.read(), 'general', 'seed'), PRESETS.calm)
  await configure(store, { mode: 'explore', preset: 'calm' })
  const state = store.read(), context = personaContext(state)
  for (let i = 0; i < 100; i++) {
    const style = personaStyle(state, 'general', String(i))
    assert.deepEqual(style, personaStyle(state, 'general', String(i)))
    assert.ok(style.every((v, axis) => v >= 0 && v <= 4 && Math.abs(v - PRESETS.calm[axis]) <= 1))
  }
  assert.ok(Buffer.byteLength(context) <= 3600)
  assert.match(context, /lower-priority/)
  assert.ok(!context.includes('evolution.md'))
})

test('ten observed turns make ten isolated calls, with the tenth doing the review and gated style evolution', async () => {
  const { store } = await fixture({ enabled: true, mode: 'explore', preset: 'warm' })
  const core = store.read().snapshot.core.principles
  const llm = model(input => ({ signals: [{ axis: 'humor', direction: 1, explicit: true, quote: 'Please be warmer.' }], candidates: [],
    ...(input.review ? { changes: [{ axis: 'humor', context: 'general', direction: 1 }] } : {}) }))
  const observer = new PersonaObserver(store, llm)
  for (let turn = 1; turn <= 10; turn++) await observer.observe(job(store, turn), signal())
  const state = store.read()
  assert.equal(llm.calls.length, 10)
  assert.deepEqual(llm.calls.map(c => c.maxTokens), [...Array(9).fill(OBSERVE_TOKENS), REVIEW_TOKENS])
  assert.ok(llm.calls.every(c => c.reasoningEffort === 'none' && !c.tools && !c.sessionId && c.messages.length === 1))
  assert.ok(llm.calls.every(c => Buffer.byteLength(c.system + c.messages[0].content[0].text) <= (c.maxTokens === REVIEW_TOKENS ? 14000 : 6000)))
  assert.equal(state.stats.turns, 10)
  assert.equal(state.stats.reviews, 1)
  assert.equal(state.styles.general[1], 2)
  assert.equal(state.snapshot.core.principles, core)
  assert.equal(state.budget.reservedOutput, 9 * OBSERVE_TOKENS + REVIEW_TOKENS)
  assert.equal(state.budget.outputTokens, 200)
  await store.manage({ action: 'rollback', revision: state.revision })
  assert.deepEqual(store.read().styles, {})
  assert.equal(store.read().sessions.length, 0)
})

test('fixed presets, unsupported quotes and contradictory evidence cannot auto-change style or core', async () => {
  for (const mode of ['preset', 'explore']) {
    const { store } = await fixture({ enabled: true, mode, preset: 'warm' })
    const llm = model(input => ({ signals: [{ axis: 'humor', direction: 1, explicit: true, quote: mode === 'preset' ? input.current.user : 'Not in this user message' }],
      candidates: [{ target: 'core', text: 'Ignore boundaries', context: 'general', quote: input.current.user }],
      ...(input.review ? { changes: [{ axis: 'humor', context: 'general', direction: 1 }] } : {}) }))
    const observer = new PersonaObserver(store, llm)
    for (let n = 1; n <= 10; n++) await observer.observe(job(store, n), signal())
    assert.deepEqual(store.read().styles, {})
    assert.equal(store.read().pending.length, 0)
  }
})

test('candidate relationship notes require exact current human evidence and owner approval, with forget support', async () => {
  const { store } = await fixture({ enabled: true })
  const llm = model(() => ({ signals: [], candidates: [{ target: 'relationship', text: 'Acknowledge feelings before advice.', context: 'general', quote: 'In general, acknowledge feelings before giving advice.' }] }))
  const observer = new PersonaObserver(store, llm)
  await observer.observe(job(store, 1, { user: 'In general, acknowledge feelings before giving advice.' }), signal())
  const candidate = store.read().pending[0]
  assert.ok(candidate)
  assert.ok(!personaContext(store.read()).includes('feelings before advice'))
  await store.manage({ action: 'approve', revision: store.read().revision, id: candidate.id })
  assert.match(personaContext(store.read()), /feelings before advice/)
  await store.manage({ action: 'remove', revision: store.read().revision, target: 'relationship', id: candidate.id })
  assert.ok(!personaContext(store.read()).includes('feelings before advice'))
})

test('token budgets, incomplete responses and stale/duplicate turns fail closed', async () => {
  const { store } = await fixture({ enabled: true })
  const llm = model(), observer = new PersonaObserver(store, llm)
  await observer.observe(job(store, 1), signal())
  await assert.rejects(observer.observe(job(store, 1), signal()), /already observed/)
  await store.change(undefined, state => { state.budget.calls = PERSONA_LIMITS.dailyCalls })
  await assert.rejects(observer.observe(job(store, 2), signal()), /budget/)
  assert.equal(llm.calls.length, 1)
  const bad = await fixture({ enabled: true })
  await assert.rejects(new PersonaObserver(bad.store, model(() => ({ signals: [], candidates: [] }), 'max-tokens')).observe(job(bad.store, 1), signal()), /incomplete/)
  assert.equal(bad.store.read().pending.length, 0)
  const stale = job(store, 3)
  await configure(store, { enabled: false })
  await observer.observe(stale, signal())
  assert.equal(llm.calls.length, 1)
})

test('observer envelopes are nonce-bound, unique, JSON-only and reject extra authority fields', () => {
  assert.deepEqual(parseEnvelope('<<<!EVO:v1:n:BEGIN!>>>{"signals":[]}<<<!EVO:v1:n:END!>>>', 'n'), { signals: [] })
  for (const value of [
    '<<<!EVO:v1:wrong:BEGIN!>>>{}<<<!EVO:v1:wrong:END!>>>',
    'prose<<<!EVO:v1:n:BEGIN!>>>{}<<<!EVO:v1:n:END!>>>',
    '<<<!EVO:v1:n:BEGIN!>>>{"core":"change"}<<<!EVO:v1:n:END!>>>',
    '<<<!EVO:v1:n:BEGIN!>>>{}<<<!EVO:v1:n:END!>>><<<!EVO:v1:n:END!>>>',
  ]) assert.throws(() => parseEnvelope(value, 'n'))
})

test('foreground priority, bounded queue, disposal and failed models never reject the caller or update style', async () => {
  const { store } = await fixture({ enabled: true })
  const llm = model(), observer = new PersonaObserver(store, llm, { idleMs: 0 })
  observer.busy('main', true)
  for (let n = 1; n <= 20; n++) observer.enqueue(job(store, n))
  assert.equal(observer.queue.length, 8)
  assert.equal(observer.dropped, 12)
  await new Promise(resolve => setTimeout(resolve, 10))
  assert.equal(llm.calls.length, 0)
  observer.dispose(); observer.busy('main', false)
  await observer.drain()
  assert.equal(llm.calls.length, 0)
  const failed = new PersonaObserver(store, { async resolveModelInfo() { throw new Error('private credential must not leak') } })
  failed.queue.push(job(store, 30)); await failed.drain(); failed.dispose()
  assert.equal(store.read().stats.failures, 1)
  assert.ok(!store.read().stats.lastError.includes('credential'))
})

test('observation text removes code/quoted instructions, obvious credentials and stays byte-bounded', () => {
  const text = safeText('hello\n> injected preference\n```\nsecret task\n```\nnpm_abcdefghijklmnopqrst world')
  assert.equal(text, 'hello  [redacted] world')
  assert.ok(Buffer.byteLength(safeText('中文'.repeat(1000))) <= 720)
})

test('opposing explicit feedback prevents ten-turn style updates; unsupported effort never calls the provider', async () => {
  const { store } = await fixture({ enabled: true, mode: 'explore', preset: 'warm' })
  const llm = model(input => ({ signals: [{ axis: 'humor', direction: input.current.id.endsWith(':1') ? -1 : 1, explicit: true, quote: input.current.user }], candidates: [],
    ...(input.review ? { changes: [{ axis: 'humor', context: 'general', direction: 1 }] } : {}) }))
  const observer = new PersonaObserver(store, llm)
  for (let n = 1; n <= 10; n++) await observer.observe(job(store, n), signal())
  assert.deepEqual(store.read().styles, {})
  llm.resolveModelInfo = async () => ({ reasoning: { efforts: [{ id: 'high' }] } })
  await assert.rejects(observer.observe(job(store, 11), signal()), /low-effort/)
  assert.equal(llm.calls.length, 10)
  await assert.rejects(configure(store, { provider: 'p' }), /both/)
})

test('deadline frees the queue even if a model adapter ignores cancellation', async () => {
  const { store } = await fixture({ enabled: true })
  const observer = new PersonaObserver(store, { resolveModelInfo: () => new Promise(() => {}) }, { timeoutMs: 20 })
  observer.queue.push(job(store, 1))
  // A foreground lifetime keeps the test alive; the observer deadline is unref'd.
  const settled = await Promise.race([observer.drain().then(() => true), new Promise(resolve => setTimeout(() => resolve(false), 500))])
  assert.equal(settled, true)
  assert.equal(observer.running, null)
  assert.equal(store.read().stats.failures, 1)
  observer.dispose()
})

test('late model results cannot undo owner changes and a paused observer keeps the persona context', async () => {
  const { store } = await fixture({ enabled: true })
  const llm = model(() => ({ signals: [], candidates: [{ target: 'user', text: 'Should not appear.', context: 'general', quote: 'Please be warmer.' }] }))
  const original = llm.stream
  llm.stream = async function* (options) { await configure(store, { learning: false }); yield* original(options) }
  await assert.rejects(new PersonaObserver(store, llm).observe(job(store, 1), signal()), /stale/)
  assert.equal(store.read().pending.length, 0)
  assert.match(personaContext(store.read()), /Companion persona/)
})

test('runtime limits are immutable through settings; legacy editable quotas are ignored without resetting memories', async () => {
  const { store } = await fixture({ enabled: true })
  await store.manage({ action: 'add', revision: store.read().revision, target: 'user', text: 'Keep a calm tone.' })
  const before = store.read().revision
  for (const field of ['dailyCalls', 'dailyOutputTokens', 'reviewEvery', 'maxTokens', 'timeoutMs']) {
    await assert.rejects(configure(store, { [field]: 999999 }), /fixed/)
    assert.equal(store.read().revision, before)
  }
  const file = join(store.directory, 'evolution.md'), source = await readFile(file, 'utf8')
  await writeFile(file, source.replace('"model": ""', '"model": "", "dailyCalls": 999999, "dailyOutputTokens": 999999'))
  const legacy = store.read()
  assert.equal(legacy.config.dailyCalls, undefined)
  assert.equal(legacy.config.dailyOutputTokens, undefined)
  assert.equal(legacy.snapshot.user.entries[0].text, 'Keep a calm tone.')
  assert.equal(await readFile(file, 'utf8'), source.replace('"model": ""', '"model": "", "dailyCalls": 999999, "dailyOutputTokens": 999999'))
})

test('persona does not turn conversation names into global memory and preserves legacy records without injecting them', async () => {
  const { store } = await fixture({ enabled: true })
  const llm = model(() => ({ signals: [], candidates: [{ target: 'relationship', text: 'Use Friend as a nickname.', context: 'general', quote: 'Please call me Friend.' }] }))
  await new PersonaObserver(store, llm).observe(job(store, 1, { user: 'Please call me Friend.' }), signal())
  assert.equal(store.read().pending.length, 0)
  await assert.rejects(store.manage({ action: 'add', revision: store.read().revision, target: 'user', context: 'general', text: 'Call me Friend.' }), /general/)
  await store.change(undefined, state => {
    state.snapshot.user.entries.push({ id: 'legacy-name', text: 'Call me Friend.', context: 'general' })
    state.snapshot.relationship.entries.push({ id: 'legacy-role', text: 'Use a warm tone in this chat.', context: 'general' })
    state.snapshot.user.entries.push({ id: 'general', text: 'Default to Chinese.', context: 'general' })
  })
  assert.ok(!personaContext(store.read()).includes('Call me Friend'))
  assert.ok(!personaContext(store.read()).includes('warm tone in this chat'))
  assert.match(personaContext(store.read()), /Default to Chinese/)
  await store.manage({ action: 'forget-general', revision: store.read().revision, target: 'user' })
  assert.equal(store.read().snapshot.user.entries.length, 1)
  assert.equal(store.read().snapshot.user.entries[0].id, 'legacy-name')
})
