import { z } from 'zod'

export interface RegisterActionOptions<T = unknown> {
  name: string
  description: string
  schema: z.ZodType<T>
  requiresConfirmation?: boolean
  handler: (params: T, ctx: ActionContext) => Promise<unknown>
}

export interface ActionContext {
  userId?: string
  sessionId?: string
  metadata?: Record<string, unknown>
}

export interface ActionManifestEntry {
  name: string
  description: string
  schema: Record<string, unknown> // JSON Schema
  requiresConfirmation: boolean
}

export interface ActionManifest {
  version: '1'
  actions: ActionManifestEntry[]
}

export type ActionResult =
  | { status: 'success'; result: unknown }
  | { status: 'rejected' }
  | { status: 'error'; message: string }
