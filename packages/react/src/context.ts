import { createContext } from 'react'
import type { ActionRegistry } from '@vibeflowai/agentable-core'

export interface PendingConfirmation {
  callId: string
  name: string
  params: unknown
}

export interface AgentableContextValue {
  registry: ActionRegistry
  pendingConfirmation: PendingConfirmation | null
  resolvePending: (callId: string, approved: boolean) => void
  executeAction: (callId: string, name: string, params: unknown) => Promise<void>
}

export const AgentableContext = createContext<AgentableContextValue | null>(null)
