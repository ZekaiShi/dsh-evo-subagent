import { createHash, randomUUID } from 'node:crypto'
import { homedir } from 'node:os'
import { dirname, basename, join, resolve, sep } from 'node:path'
import { existsSync, lstatSync, readFileSync, realpathSync } from 'node:fs'
import { mkdir, open, rename, unlink } from 'node:fs/promises'
import { setTimeout as delay } from 'node:timers/promises'

export const SHARING_MODES = Object.freeze(['global', 'workspace', 'conversation'])
export const BILI_PROMPT_START = '<!-- evo-subagent:bili:v1:start -->'
const externalSessions = new WeakSet()
export function markExternalPrompt(session, message) {
  if (session && message?.role === 'user' && message.source?.kind === 'user') {
    if ((message.content ?? []).some(block => block.type === 'text' && block.text.includes(BILI_PROMPT_START))) externalSessions.add(session)
    else externalSessions.delete(session)
  }
  return !!session && externalSessions.has(session)
}
const FEATURES = ['persona', 'habits']
const digest = value => createHash('sha256').update(value).digest('hex')
export class SharingError extends Error { constructor(message, status = 400) { super(message); this.status = status } }
export function profileBase(home) { return join(resolve(home ?? (process.env.DSH_HOME?.trim() || join(homedir(), '.dsh'))), 'evo-subagent') }
const initial = () => ({ version: 1, modes: { persona: 'global', habits: 'global' }, controls: { persona: 0, habits: 0 }, budget: null })
const routes = state => state.assignments ?? { persona: { workspace: {}, conversation: {} }, habits: { workspace: {}, conversation: {} } }
const stampFor = (state, feature) => digest(JSON.stringify([feature, state.modes[feature], state.controls[feature], routes(state)[feature]]))

// This policy/usage file is outside each persona's four maintained documents.
// Scope stamps deliberately exclude usage: a budget reservation must not make
// an unrelated settings page stale or invalidate its own observation.
export class SharingStore {
  constructor(base) { this.filename = join(base, 'sharing.json') }
  read() {
    let state
    try {
      const info = lstatSync(this.filename)
      if (!info.isFile() || info.isSymbolicLink() || info.size > 65536) throw new SharingError('Invalid sharing policy; existing file preserved', 422)
      state = JSON.parse(readFileSync(this.filename, 'utf8'))
    } catch (error) { if (error.code === 'ENOENT') return initial(); if (error instanceof SharingError) throw error; throw new SharingError('Cannot read sharing policy; existing file preserved', 422) }
    if (![1, 2].includes(state?.version) || (state.version === 2 && !state.assignments) || !FEATURES.every(key => SHARING_MODES.includes(state.modes?.[key]) && Number.isSafeInteger(state.controls?.[key]) && state.controls[key] >= 0)
      || !(state.budget === null || (typeof state.budget?.day === 'string' && ['calls', 'reservedOutput'].every(key => Number.isSafeInteger(state.budget[key]) && state.budget[key] >= 0)))) {
      throw new SharingError('Invalid sharing policy; existing file preserved', 422)
    }
    if (!FEATURES.every(feature => ['workspace', 'conversation'].every(kind => {
      const table = routes(state)[feature]?.[kind]
      return table && typeof table === 'object' && !Array.isArray(table) && Object.keys(table).length <= 200
        && Object.entries(table).every(([id, mode]) => /^[a-f0-9]{64}$/.test(id) && SHARING_MODES.includes(mode))
    }))) throw new SharingError('Invalid persona assignments; existing file preserved', 422)
    return state
  }
  snapshot(feature) {
    const state = this.read()
    return { mode: state.modes[feature], customized: state.controls[feature] > 0, revision: stampFor(state, feature), assignments: routes(state)[feature] }
  }
  async update(fn, signal) {
    signal?.throwIfAborted()
    await mkdir(dirname(this.filename), { recursive: true })
    const lockPath = this.filename + '.lock', deadline = Date.now() + 2000
    let lock, temporary
    while (!lock) {
      signal?.throwIfAborted()
      try { lock = await open(lockPath, 'wx', 0o600) } catch (error) {
        if (error.code !== 'EEXIST') throw error
        if (Date.now() >= deadline) throw new SharingError('Sharing policy is busy; try again', 409)
        await delay(25, undefined, { signal })
      }
    }
    try {
      const state = this.read(), stamp = JSON.stringify(state)
      fn(state)
      const content = JSON.stringify(state, null, 2) + '\n'
      if (Buffer.byteLength(content) > 65536) throw new SharingError('Sharing policy is too large')
      temporary = this.filename + '.' + randomUUID() + '.tmp'
      const file = await open(temporary, 'wx', 0o600)
      try { await file.writeFile(content, 'utf8'); await file.sync() } finally { await file.close() }
      signal?.throwIfAborted()
      if (JSON.stringify(this.read()) !== stamp) throw new SharingError('Sharing policy changed externally; reload', 409)
      await rename(temporary, this.filename)
    } finally { if (temporary) await unlink(temporary).catch(() => {}); await lock.close(); await unlink(lockPath) }
  }
  async set(feature, mode, revision, signal) {
    if (!FEATURES.includes(feature) || !SHARING_MODES.includes(mode)) throw new SharingError('Invalid sharing scope')
    await this.update(state => {
      const stamp = stampFor(state, feature)
      if (stamp !== revision) throw new SharingError('Sharing scope changed; reload before saving', 409)
      state.modes[feature] = mode; state.controls[feature]++
    }, signal)
  }
  async setWorkspaces(feature, enabled, revision, signal) {
    if (!FEATURES.includes(feature) || typeof enabled !== 'boolean') throw new SharingError('Invalid workspace sharing option')
    await this.update(state => {
      if (stampFor(state, feature) !== revision) throw new SharingError('Sharing scope changed; reload before saving', 409)
      state.modes[feature] = enabled ? 'workspace' : 'global'
      // One workspace switch replaces the older per-workspace exceptions.
      // Keep independent conversations and every saved profile intact.
      if (state.assignments) state.assignments[feature].workspace = {}
      state.controls[feature]++
    }, signal)
  }
  async assign(feature, kind, id, mode, revision, signal) {
    if (!FEATURES.includes(feature) || !['workspace', 'conversation'].includes(kind) || !/^[a-f0-9]{64}$/.test(id)
      || ![...SHARING_MODES, 'inherit'].includes(mode)) throw new SharingError('Invalid persona assignment')
    await this.update(state => {
      if (stampFor(state, feature) !== revision) throw new SharingError('Sharing scope changed; reload before saving', 409)
      state.assignments ??= routes(state)
      // Older releases must fail closed instead of ignoring an independent
      // assignment and writing that conversation's learning into global data.
      state.version = 2
      const table = state.assignments[feature][kind]
      if (mode === 'inherit') delete table[id]
      else table[id] = mode
      if (Object.keys(table).length > 200) throw new SharingError('At most 200 independent assignments per scope')
      state.controls[feature]++
    }, signal)
  }
  async reserve(tokens, limits, seed, signal) {
    await this.update(state => {
      const day = new Date().toISOString().slice(0, 10)
      if (state.budget === null) state.budget = seed?.day === day ? { day, calls: seed.calls, reservedOutput: seed.reservedOutput } : { day, calls: 0, reservedOutput: 0 }
      if (state.budget.day !== day) state.budget = { day, calls: 0, reservedOutput: 0 }
      if (state.budget.calls >= limits.dailyCalls || state.budget.reservedOutput + tokens > limits.dailyOutputTokens) throw new SharingError('Daily device observer budget reached')
      state.budget.calls++; state.budget.reservedOutput += tokens
    }, signal)
  }
}

function canonical(path) {
  if (typeof path !== 'string' || !path.trim()) return undefined
  let value = resolve(path)
  try { value = realpathSync.native(value) } catch { /* Registries can contain offline workspaces. */ }
  return process.platform === 'win32' ? value.toLowerCase() : value
}
const inside = (path, root) => path === root || path.startsWith(root.endsWith(sep) ? root : root + sep)
export function isChildSession(session) {
  const h = session?.header
  return h?.origin === 'subagent' || (h?.delegationDepth ?? 0) > 0 || (h?.parentSession !== undefined && !h.isSeeded)
}

export class ScopeProfiles {
  constructor(ctx, home, feature, makeStore) {
    this.base = profileBase(home); this.policy = new SharingStore(this.base); this.feature = feature; this.makeStore = makeStore
    this.services = {}
    for (const name of ['sessions', 'workingDirectory', 'workspaceRegistry']) {
      ctx.inject([name], scope => {
        this.services[name] = scope[name]
        if (typeof scope.effect === 'function') scope.effect(() => () => { delete this.services[name] }, 'evo sharing: ' + name)
      })
    }
  }
  rootSession(session) {
    const seen = new Set()
    for (let depth = 0; session && depth < 20; depth++) {
      if (seen.has(session)) return undefined
      seen.add(session)
      if (!isChildSession(session)) return session
      const parent = session.header?.parentSession
      if (parent === undefined) return undefined
      session = this.services.sessions?.get(parent)
    }
  }
  cwd(session) {
    let value
    try { value = this.services.workingDirectory?.get(session) } catch { /* Fall back to immutable metadata only when no current directory is available. */ }
    return canonical(value ?? session?.header?.cwd)
  }
  registered() {
    try { return (this.services.workspaceRegistry?.list() ?? []).filter(w => typeof w.path === 'string' && w.path).map(w => ({ path: canonical(w.path), label: w.title || basename(w.path) })).filter(w => w.path) } catch { return [] }
  }
  workspace(session) {
    const cwd = this.cwd(session)
    if (!cwd) return undefined
    const candidates = this.registered().filter(w => inside(cwd, w.path)).sort((a, b) => b.path.length - a.path.length)
    if (candidates.length) return candidates[0]
    let dir = cwd
    for (let n = 0; n < 20; n++) {
      if (existsSync(join(dir, '.git')) || existsSync(join(dir, 'AGENTS.md'))) return { path: dir, label: basename(dir) }
      const parent = dirname(dir)
      if (parent === dir) break
      dir = parent
    }
    return { path: cwd, label: basename(cwd) || cwd }
  }
  describe(session, mode) {
    const root = this.rootSession(session)
    if (!root) return undefined
    const workspace = this.workspace(root)
    if (!workspace) return undefined
    if (mode === 'workspace') return { id: digest(workspace.path), label: workspace.label }
    if (!root?.id) return undefined
    return { id: digest(workspace.path + '\0' + root.id), label: workspace.label + ' · ' + root.id }
  }
  catalog(mode) {
    const values = new Map()
    if (mode === 'workspace') for (const w of this.registered()) values.set(digest(w.path), { id: digest(w.path), label: w.label })
    for (const session of this.services.sessions?.list() ?? []) {
      if (isChildSession(session)) continue
      const item = this.describe(session, mode)
      if (item) values.set(item.id, item)
    }
    return [...values.values()].slice(0, 200)
  }
  workspaceTarget(id) {
    for (const item of this.registered()) if (digest(item.path) === id) return { ...item, id }
    for (const session of this.services.sessions?.list() ?? []) {
      if (isChildSession(session)) continue
      const workspace = this.workspace(session)
      if (workspace && digest(workspace.path) === id) return { ...workspace, id }
    }
    throw new SharingError('Selected workspace is unavailable', 404)
  }
  selection(policy, target) {
    if (policy.mode !== 'global' && !target) return { ...policy, store: null, id: '' }
    const id = policy.mode === 'global' ? 'global' : target.id
    const base = policy.mode === 'global' ? this.base : join(this.base, 'scopes', policy.mode, id)
    return { ...policy, id, store: this.makeStore(base), label: target?.label ?? '' }
  }
  current(agent) {
    const policy = this.policy.snapshot(this.feature)
    const root = this.rootSession(agent?.session)
    if ((root && externalSessions.has(root)) || (isChildSession(agent?.session) && !root)) return this.selection({ ...policy, mode: 'conversation' })
    const workspace = this.describe(agent?.session, 'workspace'), conversation = this.describe(agent?.session, 'conversation')
    const mode = (conversation && policy.assignments.conversation[conversation.id]) ?? (workspace && policy.assignments.workspace[workspace.id]) ?? policy.mode
    return this.selection({ ...policy, mode }, mode === 'global' ? undefined : mode === 'workspace' ? workspace : conversation)
  }
  sessionContext(id) {
    if (typeof id !== 'string' || id.length > 160) throw new SharingError('Invalid conversation')
    const session = this.services.sessions?.get(id), root = this.rootSession(session)
    if (!root || isChildSession(session)) throw new SharingError('Open the main conversation before changing its persona', 404)
    const workspace = this.describe(root, 'workspace'), conversation = this.describe(root, 'conversation')
    if (!workspace || !conversation) throw new SharingError('Choose a workspace first', 409)
    const selected = this.current({ session: root })
    return { session: root, workspace, conversation, selected, workspacePath: this.workspace(root).path }
  }
  async setSessionScope(id, scope, revision, signal) {
    if (!['inherit', 'workspace', 'conversation'].includes(scope)) throw new SharingError('Invalid conversation scope')
    const context = this.sessionContext(id)
    await this.policy.update(state => {
      if (stampFor(state, this.feature) !== revision) throw new SharingError('Sharing scope changed; reload before saving', 409)
      if (this.sessionContext(id).workspace.id !== context.workspace.id) throw new SharingError('Conversation workspace changed; reload', 409)
      state.assignments ??= routes(state)
      state.version = 2
      const assignment = state.assignments[this.feature]
      if (scope === 'conversation') assignment.conversation[context.conversation.id] = 'conversation'
      else {
        delete assignment.conversation[context.conversation.id]
        if (scope === 'workspace') assignment.workspace[context.workspace.id] = 'workspace'
      }
      if (Object.keys(assignment.workspace).length > 200 || Object.keys(assignment.conversation).length > 200) throw new SharingError('At most 200 independent assignments per scope')
      state.controls[this.feature]++
    }, signal)
    const current = this.sessionContext(id)
    if (current.workspace.id !== context.workspace.id) throw new SharingError('Conversation workspace changed; reload', 409)
    return current
  }
  forRequest(request, clear = false) {
    const policy = this.policy.snapshot(this.feature), query = new URL(request.url).searchParams
    const mode = clear ? policy.mode : query.get('scope') || policy.mode
    if (!SHARING_MODES.includes(mode)) throw new SharingError('Invalid profile scope')
    const options = mode === 'global' ? [] : this.catalog(mode)
    const id = clear ? '' : query.get('target') || ''
    if (mode === 'global' && id && id !== 'global') throw new SharingError('Sharing scope changed; reload before saving', 409)
    const target = options.find(x => x.id === id)
    if (id && !target && mode !== 'global') throw new SharingError('Selected workspace or conversation is unavailable; open it in DSH and reload', 404)
    const selected = this.selection({ ...policy, mode }, target)
    const assignedMode = target ? policy.assignments[mode]?.[target.id] : undefined
    const { assignments: _assignments, ...publicPolicy } = policy
    return { ...selected, sharing: { ...publicPolicy, mode, defaultMode: policy.mode, options, selectedId: selected.id, selectionRequired: !selected.store,
      assignedMode: assignedMode ?? 'inherit', appliedMode: assignedMode ?? policy.mode, independent: (assignedMode ?? policy.mode) !== 'global',
      workspaceOptions: this.feature === 'persona' ? this.catalog('workspace') : undefined } }
  }
  assertWrite(input, selected) {
    if ((input.sharingRevision !== undefined && input.sharingRevision !== selected.revision)
      || ((selected.mode !== 'global' || selected.customized) && input.sharingRevision === undefined)) throw new SharingError('Sharing scope changed; reload before saving', 409)
    const { sharingRevision: _revision, ...body } = input
    return body
  }
  guard(selection, agent) {
    return () => {
      try { const current = this.current(agent); return current.id === selection.id && current.mode === selection.mode && current.revision === selection.revision } catch { return false }
    }
  }
}
