import { defineTool } from '@deepseek-ai/dsh-tools'
import { join } from 'node:path'
import { HabitsError, HabitsStore, HABIT_CATEGORIES, habitsContext } from './habits-store.js'
import { ScopeProfiles, SharingError, isChildSession, markExternalPrompt } from './sharing.js'

export const name = 'evo-user-habits'
export const inject = ['tools', 'systemPrompt']

function humanText(message) {
  if (message?.role !== 'user' || message.source?.kind !== 'user') return ''
  return (message.content ?? []).filter(block => block.type === 'text').map(block => block.text).join('\n')
    .replace(/```[\s\S]*?```|~~~[\s\S]*?~~~/g, '')
    .split('\n').filter(line => !/^\s*>/.test(line)).join('\n').slice(0, 20_000)
}

async function requestJson(request) {
  const reader = request.body?.getReader()
  if (!reader) throw new HabitsError('JSON body required')
  const chunks = []
  let size = 0
  try {
    while (true) {
      const part = await reader.read()
      if (part.done) break
      size += part.value.byteLength
      if (size > 16_384) { await reader.cancel(); throw new HabitsError('Request is too large', 413) }
      chunks.push(Buffer.from(part.value))
    }
  } finally { reader.releaseLock() }
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8')) } catch { throw new HabitsError('Invalid JSON') }
}

export function createHabitsApply(toolFactory = defineTool) {
  return function apply(ctx, config = {}) {
    const profiles = new ScopeProfiles(ctx, config.dshHome, 'habits', base => new HabitsStore(join(base, 'user-habits.md')))
    const evidence = new WeakMap()
    ctx.provide('userHabits', { read: agent => profiles.current(agent).store?.read() })
    ctx.on('agent/inbox/claimed', ({ agent, message }) => {
      if (markExternalPrompt(agent?.session, message)) { evidence.delete(agent.session); return }
      if (!agent?.session || isChildSession(agent.session)) return
      if (message?.role === 'user' && message.source?.kind === 'user') {
        // Even an image-only or fully quoted message supersedes the previous
        // human message. Never keep old evidence alive by filtering it to empty.
        try {
          const selected = profiles.current(agent)
          evidence.set(agent.session, { text: humanText(message), id: selected.id, revision: selected.revision })
        } catch { evidence.delete(agent.session) }
      }
    })
    ctx.systemPrompt.context({ name: 'evo-user-habits', order: 300, interpolate: false, text: (context = {}) => {
      try { const selected = profiles.current(context.agent); return selected.store ? habitsContext(selected.store.read()) : '' } catch {
        return 'User collaboration preferences are unavailable. Do not guess or overwrite the habits file; ask the user to inspect its settings.'
      }
    } })
    ctx.tools.register(toolFactory({
      name: 'evo_user_habits',
      description: 'Read the general preference summary or propose an abstract reusable preference about language, verbosity, tone, answer structure or evidence standards within the owner-selected sharing scope, with an exact quote from the latest human message. Use context general only. Never store names, nicknames, roleplay, temporary moods, current-chat requests, project/task facts, credentials or personality guesses. Candidates need owner confirmation; this tool cannot approve, edit, delete or enable habits.',
      parameters: {
        action: { type: 'string', enum: ['read', 'propose'], required: true },
        category: { type: 'string', enum: HABIT_CATEGORIES },
        context: { type: 'string', enum: ['general'] },
        text: { type: 'string', description: 'One reusable preference, at most 240 characters.' },
        evidence: { type: 'string', description: 'Exact excerpt, at most 240 characters, from the latest actual user message.' },
      },
      output: { schema: { type: 'json' }, render: (_args, value) => [{ type: 'text', text: JSON.stringify(value) }] },
      isConcurrencySafe: args => args.action === 'read',
      async execute(args, exec) {
        exec.signal.throwIfAborted()
        if (args.action === 'propose' && isChildSession(exec.agent?.session)) throw new HabitsError('A proposal needs an exact excerpt from this top-level agent\'s latest human message', 403)
        const selected = profiles.current(exec.agent), store = selected.store
        if (!store) throw new HabitsError('Open a conversation with a known workspace before using scoped preferences', 409)
        if (args.action === 'read') {
          const state = store.read()
          return { enabled: state.enabled, learning: state.learning, summary: state.enabled ? state.generalSummary : '',
            confirmed: state.enabled && state.generalSummary ? [{ context: 'general', text: state.generalSummary }] : [], pendingCount: state.generalPendingCount }
        }
        if (args.action !== 'propose') throw new HabitsError('Unsupported habit tool action')
        const session = exec.agent?.session
        const quote = args.evidence
        const claimed = session && evidence.get(session)
        if (!session || isChildSession(session) || typeof quote !== 'string' || !quote.trim() || !claimed?.text.includes(quote) || claimed.id !== selected.id || claimed.revision !== selected.revision) {
          throw new HabitsError('A proposal needs an exact excerpt from this top-level agent\'s latest human message', 403)
        }
        return store.propose({ category: args.category, context: args.context ?? 'general', text: args.text, evidence: quote }, exec.signal)
      },
    }))
    // The authenticated owner-only Connection API is intentional: user preferences
    // must never be exposed on the older unauthenticated plugin HTTP routes.
    ctx.inject(['connection'], ({ connection }) => {
      connection.fetch.register({
        path: '/api/evo-subagent/habits', methods: ['GET', 'POST'], requestBody: 'buffered',
        async fetch(request) {
          try {
            const input = request.method === 'POST' ? await requestJson(request) : null
            if (input?.action === 'set-scope') await profiles.policy.set('habits', input.scope, input.sharingRevision, request.signal)
            const selected = profiles.forRequest(request, input?.action === 'set-scope')
            if (!selected.store) {
              if (input && input.action !== 'set-scope') throw new HabitsError('Select a workspace or conversation first', 409)
              return Response.json({ scopeOnly: true, sharing: selected.sharing }, { headers: { 'cache-control': 'no-store' } })
            }
            const result = input && input.action !== 'set-scope' ? await selected.store.manage(profiles.assertWrite(input, selected), request.signal) : selected.store.read()
            return Response.json({ ...result, sharing: selected.sharing }, { headers: { 'cache-control': 'no-store' } })
          } catch (error) {
            return Response.json({ error: error instanceof HabitsError || error instanceof SharingError ? error.message : 'Habits storage is unavailable; the existing file was not overwritten' },
              { status: error.status ?? 500, headers: { 'cache-control': 'no-store' } })
          }
        },
      })
    })
  }
}

export const apply = createHabitsApply()
