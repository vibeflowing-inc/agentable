import type { ActionManifest } from '@agentable/core'

export interface AgentableServerOptions {
  timeoutMs?: number
  basePath?: string
}

interface PendingCall {
  callId: string
  name: string
  params: unknown
}

interface PendingResolver {
  resolve: (value: unknown) => void
  reject: (reason: unknown) => void
  timeoutId: ReturnType<typeof setTimeout>
}

export interface AgentableServer {
  handler: (req: Request) => Promise<Response>
  dispatch: (name: string, params: unknown) => Promise<unknown>
  getManifest: () => ActionManifest | null
}

export function createAgentable(opts: AgentableServerOptions = {}): AgentableServer {
  const { timeoutMs = 30_000 } = opts

  let currentManifest: ActionManifest | null = null
  const callQueue: PendingCall[] = []
  const pendingResolvers = new Map<string, PendingResolver>()

  let callCounter = 0
  function generateCallId(): string {
    return `call_${Date.now()}_${++callCounter}`
  }

  function getManifest(): ActionManifest | null {
    return currentManifest
  }

  async function dispatch(name: string, params: unknown): Promise<unknown> {
    const callId = generateCallId()

    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        pendingResolvers.delete(callId)
        // Remove from queue if still there
        const idx = callQueue.findIndex(c => c.callId === callId)
        if (idx !== -1) callQueue.splice(idx, 1)
        reject(new Error(`Action "${name}" timed out after ${timeoutMs}ms`))
      }, timeoutMs)

      pendingResolvers.set(callId, { resolve, reject, timeoutId })
      callQueue.push({ callId, name, params })
    })
  }

  async function handler(req: Request): Promise<Response> {
    const url = new URL(req.url)
    // Strip query string and normalize trailing slash for route matching
    const rawPath = url.pathname
    // Match last segment(s) after any base path
    const segments = rawPath.split('/').filter(Boolean)
    const lastSegment = segments[segments.length - 1] ?? ''

    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    }

    if (req.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders })
    }

    const json = (data: unknown, status = 200) =>
      new Response(JSON.stringify(data), {
        status,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      })

    const error = (message: string, status = 400) =>
      json({ error: message }, status)

    // GET /manifest — return current manifest
    if (req.method === 'GET' && lastSegment === 'manifest') {
      return json(currentManifest ?? { version: '1', actions: [] })
    }

    // POST /manifest — frontend registers manifest
    if (req.method === 'POST' && lastSegment === 'manifest') {
      try {
        const body = await req.json()
        currentManifest = body as ActionManifest
        return json({ ok: true })
      } catch {
        return error('Invalid JSON body')
      }
    }

    // GET /pending — frontend polls for next pending call
    if (req.method === 'GET' && lastSegment === 'pending') {
      const next = callQueue.shift() ?? null
      return json(next)
    }

    // POST /result — frontend posts result of executed action
    if (req.method === 'POST' && lastSegment === 'result') {
      try {
        const body = await req.json() as { callId: string; result: unknown }
        const { callId, result } = body

        const resolver = pendingResolvers.get(callId)
        if (resolver) {
          clearTimeout(resolver.timeoutId)
          pendingResolvers.delete(callId)
          resolver.resolve(result)
        }

        return json({ ok: true })
      } catch {
        return error('Invalid JSON body')
      }
    }

    return error('Not found', 404)
  }

  return { handler, dispatch, getManifest }
}

// Re-export express adapter from main entry so CommonJS moduleResolution works
export { expressHandler } from './adapters/express.js'
