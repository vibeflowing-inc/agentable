/**
 * Next.js App Router adapter.
 *
 * Next.js App Router route handlers already use the Web Request/Response API natively,
 * so the agentable handler can be used directly without any conversion.
 *
 * Usage in app/agentable/[...path]/route.ts:
 *
 *   import { createAgentable } from '@vibeflowai/agentable-server'
 *   import { nextjsHandler } from '@vibeflowai/agentable-server/adapters/nextjs'
 *
 *   const agentable = createAgentable()
 *
 *   export const GET = nextjsHandler(agentable)
 *   export const POST = nextjsHandler(agentable)
 *   export const OPTIONS = nextjsHandler(agentable)
 */

import type { AgentableServer } from '../index.js'

export function nextHandler(agentable: AgentableServer) {
  return agentable.handler
}

/** @deprecated Use nextHandler instead */
export const nextjsHandler = nextHandler
