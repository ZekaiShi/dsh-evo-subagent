import test from 'node:test'
import assert from 'node:assert/strict'
import { isGeneralPreference, preferenceParagraph } from '../preferences.js'

test('preference scope keeps general tone boundaries while rejecting names, local scopes and paths', () => {
  for (const text of ['Prefer concise answers.', 'Default to Chinese.', 'Avoid nicknames.', '不要使用亲昵称呼。']) {
    assert.equal(isGeneralPreference({ context: 'general', text }), true, text)
  }
  for (const text of ['Call me Friend.', 'Address the user as Friend.', '昵称是小柚。', '以后叫我小柚。', 'Avoid nicknames, but call me Boss.', 'Use this chat to be warmer.', '今天说话简单点。', 'Use H:\\example\\prompt.md.', 'Act as my fictional assistant.']) {
    assert.equal(isGeneralPreference({ context: 'general', text }), false, text)
  }
  assert.equal(isGeneralPreference({ context: 'coding', text: 'Prefer concise answers.' }), false)
  assert.equal(isGeneralPreference({ context: 'general', text: 'Prefer concise answers.', evidence: 'Be concise in this conversation.' }), false)
})

test('paragraph composition removes duplicates and scoped records, with no category labels or bullets', () => {
  const entries = [
    { context: 'general', text: '偏好中文交流。' }, { context: 'general', text: '偏好中文交流' },
    { context: 'general', text: '先给结论；语气温和。' }, { context: 'general', text: '叫我小柚。' },
    { context: 'research', text: '提供详细分析。' },
  ]
  assert.equal(preferenceParagraph(entries), '偏好中文交流；先给结论；语气温和。')
})
