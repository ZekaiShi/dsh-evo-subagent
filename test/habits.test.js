import assert from 'node:assert/strict'
import { mkdtemp, readFile, writeFile, access } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import { HabitsStore, habitsPath, habitsContext, parseHabits, renderHabits } from '../habits-store.js'
import { createHabitsApply } from '../habits.js'

const preference = { category: 'format', context: 'general', text: 'Lead with conclusions.', evidence: 'Please lead with conclusions in future.' }
const signal = () => new AbortController().signal
async function fixture() {
  const home = await mkdtemp(join(tmpdir(), 'evo-habits-'))
  return { home, store: new HabitsStore(habitsPath(home)) }
}
async function configure(store, patch = { enabled: true }) {
  return store.manage({ action: 'configure', revision: store.read().revision, ...patch })
}
async function approve(store, id) { return store.manage({ action: 'approve', revision: store.read().revision, id }) }

test('habits default off and read does not create a user file', async () => {
  const { store } = await fixture()
  assert.equal(store.read().enabled, false)
  assert.equal(habitsContext(store.read()), '')
  await assert.rejects(access(store.filename), { code: 'ENOENT' })
  await assert.rejects(store.propose(preference), /disabled/)
  await assert.rejects(access(store.filename), { code: 'ENOENT' })
})

test('a suggestion is excluded from context until the owner approves it', async () => {
  const { store } = await fixture()
  await configure(store)
  const candidate = await store.propose(preference)
  assert.equal(candidate.status, 'pending')
  assert.ok(!habitsContext(store.read()).includes(preference.text))
  await approve(store, candidate.id)
  assert.match(habitsContext(store.read()), /Lead with conclusions/)
  const restarted = new HabitsStore(store.filename)
  assert.equal(restarted.read().entries[0].status, 'active')
})

test('same-home roles and projects share habits; independent homes do not', async () => {
  const a = await fixture(), b = await fixture()
  await configure(a.store)
  const proposal = await a.store.propose(preference)
  await approve(a.store, proposal.id)
  assert.equal(new HabitsStore(habitsPath(a.home)).read().entries[0].text, preference.text)
  assert.equal(b.store.read().entries.length, 0)
  assert.equal(habitsContext(b.store.read()), '')
})

test('pause learning retains confirmed preferences; disabling stops injection', async () => {
  const { store } = await fixture()
  await configure(store)
  await approve(store, (await store.propose(preference)).id)
  await configure(store, { learning: false })
  await assert.rejects(store.propose(preference), /disabled/)
  assert.match(habitsContext(store.read()), /Lead with conclusions/)
  await configure(store, { enabled: false })
  assert.equal(habitsContext(store.read()), '')
})

test('manual additions, edits and forgetting update the Markdown profile', async () => {
  const { store } = await fixture()
  await configure(store)
  let state = await store.manage({ action: 'add', revision: store.read().revision, ...preference })
  const id = state.entries[0].id
  state = await store.manage({ action: 'update', revision: state.revision, id, text: 'Use concise conclusions.' })
  assert.equal(state.entries[0].text, 'Use concise conclusions.')
  await store.manage({ action: 'remove', revision: state.revision, id })
  assert.equal(store.read().entries.length, 0)
  assert.ok(!(await readFile(store.filename, 'utf8')).includes('conclusions'))
})

test('a stale settings revision fails instead of overwriting newer preferences', async () => {
  const { store } = await fixture()
  const old = store.read()
  await configure(store)
  await assert.rejects(store.manage({ action: 'configure', revision: old.revision, enabled: false }), /reload/)
  assert.equal(store.read().enabled, true)
})

test('two stores serialize concurrent proposals and deduplicate repeated suggestions', async () => {
  const { store } = await fixture()
  await configure(store)
  const other = new HabitsStore(store.filename)
  await Promise.all([store.propose(preference), other.propose(preference), other.propose({ ...preference, text: 'Show evidence for claims.', context: 'general' })])
  assert.equal(store.read().entries.length, 2)
  assert.equal(new Set(store.read().entries.map(entry => entry.id)).size, 2)
})

test('unsupported categories, multiline entries and obvious credentials are rejected', async () => {
  const { store } = await fixture()
  await configure(store)
  for (const bad of [{ category: 'personality' }, { text: 'one\ntwo' }, { text: 'x'.repeat(241) }, { text: 'Use sk-abcdefghijk123456789' }, { context: '../project' }]) {
    await assert.rejects(store.propose({ ...preference, ...bad }))
  }
  assert.equal(store.read().entries.length, 0)
})

test('storage caps limit pending and confirmed records without silently evicting a habit', async () => {
  const { store } = await fixture()
  await configure(store)
  for (let index = 0; index < 20; index++) await store.propose({ ...preference, text: `Preference ${index}` })
  await assert.rejects(store.propose({ ...preference, text: 'Overflow' }), /20 pending/)
  for (const entry of store.read().entries.slice(0, 12)) await approve(store, entry.id)
  const candidate = store.read().entries.find(entry => entry.status === 'pending')
  await assert.rejects(approve(store, candidate.id), /12 confirmed/)
  assert.equal(store.read().entries.length, 20)
})

test('human edits to existing Markdown text are read, and corrupt files are not overwritten', async () => {
  const { store } = await fixture()
  await configure(store)
  await approve(store, (await store.propose(preference)).id)
  const original = await readFile(store.filename, 'utf8')
  await writeFile(store.filename, original.replace(preference.text, 'Default to Chinese.'))
  assert.equal(store.read().entries[0].text, 'Default to Chinese.')
  await writeFile(store.filename, '# A file the plugin does not own\n')
  await assert.rejects(configure(store), /not overwritten/)
  assert.equal(await readFile(store.filename, 'utf8'), '# A file the plugin does not own\n')
})

test('cancellation before a write leaves the previous profile unchanged', async () => {
  const { store } = await fixture()
  await configure(store)
  const before = store.read().revision
  const controller = new AbortController(); controller.abort()
  await assert.rejects(store.propose(preference, controller.signal), { name: 'AbortError' })
  assert.equal(store.read().revision, before)
})

test('unrecognized manual Markdown is rejected instead of silently discarded', async () => {
  const { store } = await fixture()
  await configure(store)
  const content = await readFile(store.filename, 'utf8') + '\nDo not overwrite my hand-written notes.\n'
  await writeFile(store.filename, content)
  await assert.rejects(configure(store), /not overwritten/)
  assert.equal(await readFile(store.filename, 'utf8'), content)
})

test('Markdown metadata escapes comment closers and literal prompt interpolation survives', async () => {
  const state = { enabled: true, learning: true, entries: [{ ...preference, text: 'Preserve {{literal}} and --> markers.', evidence: 'Use --> in examples', id: 'test', status: 'active', source: 'user', updatedAt: '2026-10-23' }] }
  assert.deepEqual(parseHabits(renderHabits(state)), state)
  assert.deepEqual(parseHabits('\uFEFF' + renderHabits(state)), state)
  assert.match(habitsContext(state), /\{\{literal\}\}/)
  assert.ok(!habitsContext(state).includes('Use --> in examples'))
})

test('general summary hides legacy local details without deleting them or leaking them into context', async () => {
  const { store } = await fixture()
  const entry = { ...preference, id: 'general', status: 'active', source: 'user', updatedAt: '2026-10-24' }
  const entries = [entry,
    { ...entry, id: 'name', text: 'Call me Little Pomelo.' },
    { ...entry, id: 'project', text: 'Use concise notes for this project.' },
    { ...entry, id: 'scenario', context: 'coding', text: 'Use a concise coding style.' },
    { ...entry, id: 'language', text: 'Default to Chinese.' }]
  const state = { enabled: true, learning: true, entries }
  await configure(store)
  await writeFile(store.filename, renderHabits(state))
  const original = await readFile(store.filename, 'utf8'), view = store.read()
  assert.match(view.generalSummary, /Lead with conclusions/)
  assert.match(view.generalSummary, /Default to Chinese/)
  assert.ok(!/Pomelo|project|coding/.test(view.generalSummary))
  assert.ok(!/Pomelo|concise notes|coding style/.test(habitsContext(view)))
  assert.equal(view.entries.length, 5)
  assert.equal(await readFile(store.filename, 'utf8'), original)
})

test('names and locally-scoped quotes cannot be promoted to new global habits', async () => {
  const { store } = await fixture(); await configure(store)
  for (const input of [
    { text: 'Call me Little Pomelo.', evidence: 'Call me Little Pomelo.' },
    { text: 'Use a warm tone.', evidence: 'Use a warm tone in this chat.' },
    { text: 'Keep answers concise.', context: 'coding' },
    { text: 'Use the H:\\example\\file.md file.' },
    { text: '今天先说结论。' },
  ]) await assert.rejects(store.propose({ ...preference, ...input }), /general|local/)
  assert.equal(store.read().entries.length, 0)
  await store.propose({ ...preference, text: 'Avoid nicknames.', evidence: 'Avoid nicknames.' })
})

test('summary editing, whole-update approval and forgetting preserve old evidence and require a current revision', async () => {
  const { store } = await fixture(); await configure(store)
  await approve(store, (await store.propose(preference)).id)
  await store.manage({ action: 'replace-summary', revision: store.read().revision, summary: 'Default to Chinese; use a warm tone.' })
  assert.equal(store.read().entries.length, 1)
  assert.ok(!habitsContext(store.read()).includes(preference.text))
  await store.propose({ ...preference, text: 'Explain evidence when needed.' })
  const next = store.read()
  assert.equal(next.generalPendingCount, 1)
  assert.match(next.pendingSummary, /Chinese/)
  assert.match(next.pendingSummary, /Explain evidence/)
  await store.manage({ action: 'approve-summary', revision: next.revision })
  assert.equal(store.read().generalPendingCount, 0)
  assert.match(store.read().generalSummary, /Explain evidence/)
  const duplicated = await store.propose({ ...preference, text: 'Explain evidence when needed.' })
  assert.equal(duplicated.status, 'active')
  assert.equal(store.read().generalPendingCount, 0)
  await assert.rejects(store.manage({ action: 'replace-summary', revision: next.revision, summary: '' }), /reload/)
  await store.manage({ action: 'replace-summary', revision: store.read().revision, summary: '' })
  assert.equal(store.read().generalSummary, '')
  assert.ok(!habitsContext(store.read()).includes('Chinese'))
  assert.equal(store.read().entries.length, 1)
  assert.equal((await store.propose(preference)).status, 'pending')
  await assert.rejects(store.manage({ action: 'replace-summary', revision: store.read().revision, summary: 'Call me Friend.' }), /general/)
})

async function pluginFixture() {
  const { home, store } = await fixture()
  const handlers = {}, definitions = [], contexts = [], routes = []
  const ctx = {
    provide(name, value) { this[name] = value },
    on(name, callback) { handlers[name] = callback },
    tools: { register(definition) { definitions.push(definition) } },
    systemPrompt: { context(value) { contexts.push(value) } },
    inject(names, callback) { if (names[0] === 'connection') callback({ connection: { fetch: { register(route) { routes.push(route) } } } }) },
  }
  createHabitsApply(value => value)(ctx, { dshHome: home })
  const session = { header: {} }, agent = { session }
  const claimed = (message, source = 'user', target = agent) => handlers['agent/inbox/claimed']({ agent: target,
    message: { role: 'user', source: { kind: source }, content: [{ type: 'text', text: message }] } })
  const execute = (args, target = agent) => definitions[0].execute(args, { agent: target, signal: signal() })
  return { ctx, store, agent, claimed, execute, contexts, routes }
}

test('habit proposals require fresh real-user evidence and cannot be approved by the model', async () => {
  const h = await pluginFixture()
  await configure(h.store)
  const args = { action: 'propose', ...preference }
  await assert.rejects(h.execute(args), /latest human/)
  h.claimed(preference.evidence, 'tool')
  await assert.rejects(h.execute(args), /latest human/)
  h.claimed(preference.evidence)
  assert.equal((await h.execute(args)).status, 'pending')
  await assert.rejects(h.execute({ action: 'approve', id: h.store.read().entries[0].id }), /Unsupported/)
  const read = await h.execute({ action: 'read' })
  assert.deepEqual(read.confirmed, [])
  assert.equal(read.pendingCount, 1)
})

test('quoted content, stale evidence and child-agent proposals do not become habits', async () => {
  const h = await pluginFixture(); await configure(h.store)
  const args = { action: 'propose', ...preference }
  h.claimed(preference.evidence)
  h.claimed('```\n' + preference.evidence + '\n```')
  await assert.rejects(h.execute(args), /latest human/)
  h.claimed('> ' + preference.evidence)
  await assert.rejects(h.execute(args), /latest human/)
  h.claimed(preference.evidence); h.claimed('Only review this file for this task.')
  await assert.rejects(h.execute(args), /latest human/)
  h.claimed(preference.evidence)
  h.claimed('', 'user')
  await assert.rejects(h.execute(args), /latest human/)
  const child = { session: { header: { parentSession: 'parent' } } }
  h.claimed(preference.evidence, 'user', child)
  await assert.rejects(h.execute(args, child), /latest human/)
})

test('authenticated-route contract enforces revisions and bounded JSON bodies', async () => {
  const h = await pluginFixture()
  const route = h.routes[0]
  assert.equal(route.path, '/api/evo-subagent/habits')
  const url = 'http://localhost' + route.path
  const initial = await (await route.fetch(new Request(url))).json()
  const post = body => route.fetch(new Request(url, { method: 'POST', body: JSON.stringify(body) }))
  assert.equal((await post({ action: 'configure', enabled: true })).status, 409)
  const saved = await post({ action: 'configure', revision: initial.revision, enabled: true })
  assert.equal(saved.status, 200)
  assert.equal(saved.headers.get('cache-control'), 'no-store')
  assert.equal((await post({ action: 'configure', revision: initial.revision, enabled: false })).status, 409)
  assert.equal((await post({ padding: 'x'.repeat(20_000) })).status, 413)
})

test('prompt context is lower-authority runtime context, disables interpolation and hides candidates', async () => {
  const h = await pluginFixture()
  assert.equal(h.contexts[0].interpolate, false)
  assert.equal(h.contexts[0].text(), '')
  await configure(h.store); h.claimed(preference.evidence)
  const candidate = await h.execute({ action: 'propose', ...preference })
  assert.ok(!h.contexts[0].text().includes(preference.text))
  await approve(h.store, candidate.id)
  assert.match(h.contexts[0].text(), /Current explicit requests/)
  assert.match(h.contexts[0].text(), /Lead with conclusions/)
})
