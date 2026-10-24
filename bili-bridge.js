import { createHash, randomUUID } from 'node:crypto'
import { dirname, join } from 'node:path'
import { lstatSync, readFileSync, readdirSync } from 'node:fs'
import { mkdir, open, rename, unlink } from 'node:fs/promises'
import { PersonaError, personaContext, safeText } from './persona-store.js'
import { BILI_PROMPT_START } from './sharing.js'

const START = BILI_PROMPT_START, END = '<!-- evo-subagent:bili:v1:end -->'
const hash = text => createHash('sha256').update(text).digest('hex')
function regular(path, limit = 262144) {
  const info = lstatSync(path)
  if (!info.isFile() || info.isSymbolicLink() || info.size > limit) throw new PersonaError('Bilibili data must be a bounded regular file')
  return readFileSync(path, 'utf8')
}
function directory(path) {
  const info = lstatSync(path)
  if (!info.isDirectory() || info.isSymbolicLink()) throw new PersonaError('Bilibili data directories cannot be symlinks')
}
function json(path, fallback) {
  try { return JSON.parse(regular(path, 65536)) } catch (error) { if (error.code === 'ENOENT') return fallback; throw error }
}
async function replace(path, value, expected, signal) {
  signal?.throwIfAborted()
  await mkdir(dirname(path), { recursive: true })
  const temporary = path + '.' + randomUUID() + '.tmp'
  const file = await open(temporary, 'wx', 0o600)
  try {
    await file.writeFile(JSON.stringify(value, null, 2) + '\n'); await file.sync(); await file.close()
    let now = null
    try { now = regular(path, 65536) } catch (error) { if (error.code !== 'ENOENT') throw error }
    if (expected !== undefined && now !== expected) throw new PersonaError('Bilibili settings changed; reload before connecting', 409)
    signal?.throwIfAborted(); await rename(temporary, path)
  } finally { await file.close().catch(() => {}); await unlink(temporary).catch(() => {}) }
}
export function splitPrompt(text = '') {
  if (typeof text !== 'string') throw new PersonaError('Invalid Bilibili persona prompt')
  const start = text.indexOf(START), end = text.indexOf(END)
  if (start === -1 && end === -1) return text.trim()
  if (start < 0 || end < start || text.indexOf(START, start + 1) !== -1 || text.indexOf(END, end + 1) !== -1) throw new PersonaError('The linked Bilibili prompt was edited incompletely; existing settings preserved')
  return (text.slice(0, start) + text.slice(end + END.length)).trim()
}

// Reads only the upstream's public-content reports. Credentials, account state,
// comments and private-message logs are deliberately outside the adapter.
export function readBiliNotes(home) {
  const base = join(home, 'bili-duty'), notes = []
  directory(base)
  for (const folder of ['reports', 'out']) {
    const path = join(base, folder)
    try { directory(path) } catch (error) { if (error.code === 'ENOENT') continue; throw error }
    const names = readdirSync(path).filter(name => folder === 'out' ? /^\d{4}-\d{2}-\d{2}\.md$/.test(name) : /^BV[0-9A-Za-z]{10}-\d{4}-\d{2}-\d{2}\.md$/.test(name))
      .sort((a, b) => /\d{4}-\d{2}-\d{2}/.exec(b)[0].localeCompare(/\d{4}-\d{2}-\d{2}/.exec(a)[0]) || b.localeCompare(a)).slice(0, 12)
    for (const name of names.reverse()) {
      const text = regular(join(path, name)), day = /\d{4}-\d{2}-\d{2}/.exec(name)[0]
      const blocks = folder === 'out' ? text.replace(/```[\s\S]*?```/g, '').split(/\n(?=###\s*BV)/).filter(x => /^###\s*BV/.test(x.trim())) : [text]
      for (const block of blocks.slice(-16)) {
        const id = folder === 'reports' ? name.slice(0, 12) : /^###\s*(BV[0-9A-Za-z]{10})\b/.exec(block.trim())?.[1]
        if (!id) continue
        const note = safeText(block.replace(/^###\s*BV[0-9A-Za-z]{10}/, '').replace(/^>.*$/gm, ''), 1440).slice(0, 480)
        if (note.length < 12) continue
        notes.push({ id, day, note, digest: hash(note) })
      }
    }
  }
  return [...new Map(notes.map(note => [note.id, note])).values()].sort((a, b) => a.day.localeCompare(b.day)).slice(-16)
}

export class BiliBridge {
  constructor(profiles) { this.profiles = profiles; this.home = dirname(profiles.base); this.filename = join(profiles.base, 'bili-bridge.json'); this.pending = null; this.error = '' }
  read() {
    const state = json(this.filename, null)
    if (state && (state.version !== 1 || typeof state.enabled !== 'boolean' || !/^[a-f0-9]{64}$/.test(state.target)
      || typeof state.previousWorkspace !== 'string' || state.previousWorkspace.length > 4096 || typeof state.lastSync !== 'string'
      || !Number.isInteger(state.learned) || state.learned < 0 || state.learned > 16)) throw new PersonaError('Invalid Bilibili bridge configuration; existing file preserved')
    return state
  }
  status(target) {
    let available = false, state
    try { directory(join(this.home, 'bili-duty')); available = !!json(join(this.home, 'bili-duty', 'config.json'), null); state = this.read() } catch (error) { return { available, connected: false, error: error.code === 'ENOENT' ? '' : error.message } }
    return { available, connected: !!state?.enabled && state.target === target, target: state?.target, lastSync: state?.lastSync ?? '', learned: state?.learned ?? 0, error: this.error }
  }
  async connect(target, signal) {
    await this.pending?.catch(() => {})
    const workspace = this.profiles.workspaceTarget(target), policy = this.profiles.policy.snapshot('persona')
    if ((policy.assignments.workspace[target] ?? policy.mode) !== 'workspace') throw new PersonaError('Enable this workspace\'s independent persona before linking Bilibili')
    const old = this.read()
    if (old?.enabled && old.target !== target) throw new PersonaError('Disconnect the current Bilibili workspace before selecting another', 409)
    directory(join(this.home, 'bili-duty'))
    const cfg = json(join(this.home, 'bili-duty', 'config.json'), null)
    if (!cfg || typeof cfg !== 'object' || Array.isArray(cfg)) throw new PersonaError('Configure dsh-bili-scroll first')
    const base = splitPrompt(cfg.personaPrompt || '')
    if (base.length > 2400 || /^[A-Za-z]:[\\/]|^\\\\|^~\//.test(base)) throw new PersonaError('Paste the existing Bilibili persona text into its settings before linking; file references are preserved')
    const selected = this.profiles.selection({ ...policy, mode: 'workspace' }, workspace)
    if (!selected.store.read().config.enabled) throw new PersonaError('Enable this workspace\'s persona before linking Bilibili')
    const previous = old?.enabled && old.target === target ? old : { previousWorkspace: typeof cfg.workspace === 'string' ? cfg.workspace : '' }
    await replace(this.filename, { version: 1, enabled: true, target, previousWorkspace: previous.previousWorkspace, lastSync: '', learned: 0 }, undefined, signal)
    try { await this.sync(signal, true) } catch (error) {
      await replace(this.filename, old ?? { version: 1, enabled: false, target, previousWorkspace: previous.previousWorkspace, lastSync: '', learned: 0 }, undefined, signal)
      throw error
    }
    return this.status(target)
  }
  async disconnect(signal, internal = false) {
    if (!internal) await this.pending?.catch(() => {})
    const state = this.read()
    if (!state) return
    directory(join(this.home, 'bili-duty'))
    const path = join(this.home, 'bili-duty', 'config.json'), raw = regular(path, 65536), cfg = JSON.parse(raw)
    if (!cfg || typeof cfg !== 'object' || Array.isArray(cfg)) throw new PersonaError('Invalid Bilibili settings; existing file preserved')
    cfg.personaPrompt = splitPrompt(cfg.personaPrompt || '')
    try { if (cfg.workspace === this.profiles.workspaceTarget(state.target).path) cfg.workspace = state.previousWorkspace } catch { /* Preserve an owner-changed workspace. */ }
    await replace(path, cfg, raw, signal)
    await replace(this.filename, { ...state, enabled: false }, undefined, signal)
  }
  sync(signal, connecting = false) {
    if (this.pending) return this.pending
    this.pending = this.perform(signal, connecting).then(value => { this.error = ''; return value }).catch(error => { this.error = error.message; throw error }).finally(() => { this.pending = null })
    return this.pending
  }
  async perform(signal, connecting) {
    const state = this.read()
    if (!state?.enabled) return
    let workspace
    try { workspace = this.profiles.workspaceTarget(state.target) } catch (error) { await this.disconnect(signal, true); throw error }
    const policy = this.profiles.policy.snapshot('persona')
    const selected = this.profiles.selection({ ...policy, mode: 'workspace' }, workspace), before = selected.store.read()
    if ((policy.assignments.workspace[state.target] ?? policy.mode) !== 'workspace' || !before.config.enabled) {
      await this.disconnect(signal, true)
      return
    }
    directory(join(this.home, 'bili-duty'))
    const path = join(this.home, 'bili-duty', 'config.json'), raw = regular(path, 65536), cfg = JSON.parse(raw)
    if (!cfg || typeof cfg !== 'object' || Array.isArray(cfg)) throw new PersonaError('Invalid Bilibili settings; existing file preserved')
    if (!connecting && cfg.workspace !== workspace.path) {
      await this.disconnect(signal, true)
      throw new PersonaError('Bilibili workspace changed; reconnect explicitly to continue learning')
    }
    const base = splitPrompt(cfg.personaPrompt || '')
    if (base.length > 2400) throw new PersonaError('Bilibili persona text is too long to link; existing settings preserved')
    const notes = readBiliNotes(this.home).filter(note => !before.readingDismissed.includes(note.digest))
    const additions = notes.filter(note => !before.readings.some(old => old.id === note.id && old.digest === note.digest))
    if (additions.length) await selected.store.change(before.revision, current => {
      if (this.profiles.policy.snapshot('persona').revision !== policy.revision) throw new PersonaError('Persona assignment changed; content import discarded', 409)
      const map = new Map(current.readings.map(note => [note.id, note]))
      for (const note of notes) map.set(note.id, note)
      current.readings = [...map.values()].sort((a, b) => a.day.localeCompare(b.day)).slice(-16)
    }, signal)
    const current = selected.store.read()
    const prompt = base + (base ? '\n\n' : '') + START + '\n' + personaContext(current).replace(/</g, '\\u003c').replace(/>/g, '\\u003e') + '\n' + END
    if (prompt.length > 5900) throw new PersonaError('Linked persona exceeds the upstream prompt limit')
    cfg.personaPrompt = prompt; cfg.workspace = workspace.path
    cfg._set = [...new Set([...(Array.isArray(cfg._set) ? cfg._set : []), 'personaPrompt', 'workspace'])]
    if (this.profiles.policy.snapshot('persona').revision !== policy.revision) throw new PersonaError('Persona assignment changed; bridge update discarded', 409)
    const changed = JSON.stringify(JSON.parse(raw)) !== JSON.stringify(cfg)
    if (changed) await replace(path, cfg, raw, signal)
    if (changed || additions.length) await replace(this.filename, { ...state, lastSync: new Date().toISOString(), learned: current.readings.length }, undefined, signal)
    return { imported: additions.length, learned: current.readings.length }
  }
}
