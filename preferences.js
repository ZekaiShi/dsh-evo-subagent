// Deterministic scope checks and paragraph composition; no extra model call.
// These rules catch common local details, not every possible semantic ambiguity.
export function isGeneralPreference(entry) {
  if (!entry || entry.context !== 'general' || typeof entry.text !== 'string' || !entry.text.trim()) return false
  const value = entry.text + ' ' + (entry.evidence ?? entry.quote ?? '')
  const boundary = /(?:避免|不要|不用|不喜欢|无需).{0,8}(?:亲昵称呼|亲昵的称呼|昵称|爱称)|\b(?:avoid|without|no|do not use|don't use)\s+(?:pet names|nicknames|terms of endearment)\b/gi
  const naming = /称呼|称谓|昵称|外号|爱称|叫我|喊我|叫你|喊你|名字是|名叫|\b(?:nickname|pet name|form of address|(?:call|address|refer to) (?:me|the user|them)|my name is|name is)\b/i
  if (naming.test(value.replace(boundary, ''))) return false
  return !/(?:今天|今晚|这一次|这次|这一轮|这轮|本次|本轮|本对话|当前对话|这个对话|这段对话|这个会话|这次聊天|这个项目|当前项目|这个仓库|当前仓库|这份文件|这个任务|暂时|临时|扮演)|\b(?:today|tonight|this (?:chat|conversation|session|task|project|repository|file|turn)|for now|just this|role.?play|act as|pretend to be)\b|[A-Z]:[\\/]|\\\\[^\s]+|\/(?:home|mnt|Users|tmp)\/|\b\d{4}[-/]\d{1,2}[-/]\d{1,2}\b/i.test(value)
}

export function preferenceParagraph(entries) {
  const result = [], seen = new Set()
  for (const entry of entries) {
    if (!isGeneralPreference(entry)) continue
    for (const part of entry.text.split(/[；;\r\n]+/)) {
      const text = part.trim().replace(/^[\s•*-]+/, '').replace(/[。.!！；;]+$/, '')
      const key = text.toLocaleLowerCase().replace(/[\s，,：:]+/g, '')
      if (text && !seen.has(key)) { seen.add(key); result.push(text) }
    }
  }
  if (!result.length) return ''
  return result.join(result.some(t => /[\u3400-\u9fff]/u.test(t)) ? '；' : '; ') + (result.some(t => /[\u3400-\u9fff]/u.test(t)) ? '。' : '.')
}

export function generalHabitsView(state) {
  const active = state.entries.filter(e => e.status === 'active' && isGeneralPreference(e))
  const pending = state.entries.filter(e => e.status === 'pending' && isGeneralPreference(e))
  const summary = state.summary === undefined ? preferenceParagraph(active) : state.summary
  return { generalSummary: summary, pendingSummary: preferenceParagraph([{ context: 'general', text: summary }, ...pending]), generalPendingCount: pending.length }
}
