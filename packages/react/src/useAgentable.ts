import { useContext } from 'react'
import { AgentableContext } from './context.js'
import type { AgentableContextValue } from './context.js'

export function useAgentable(): AgentableContextValue {
  const ctx = useContext(AgentableContext)
  if (!ctx) {
    throw new Error('useAgentable must be used inside <AgentableProvider>')
  }
  return ctx
}
