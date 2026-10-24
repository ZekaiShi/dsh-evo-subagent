import { defineTool } from '@deepseek-ai/dsh-tools'
import { createApply } from './plugin.js'

export const name = 'dsh-evo-subagent'
export const inject = ['tools', 'subagents', 'llm', 'workingDirectory']
export const apply = createApply(defineTool)
