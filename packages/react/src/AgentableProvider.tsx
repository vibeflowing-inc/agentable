import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ActionRegistry, callAction } from '@agentable/core'
import type { ActionContext } from '@agentable/core'
import { AgentableContext } from './context.js'
import type { PendingConfirmation } from './context.js'

export interface AgentableProviderProps {
  children: React.ReactNode
  endpoint: string
  pollInterval?: number
  context?: ActionContext
}

interface PendingCall {
  callId: string
  name: string
  params: unknown
}

export function AgentableProvider({
  children,
  endpoint,
  pollInterval = 500,
  context,
}: AgentableProviderProps) {
  const registry = useMemo(() => new ActionRegistry(), [])
  const [pendingConfirmation, setPendingConfirmation] = useState<PendingConfirmation | null>(null)

  // Map from callId -> resolver for confirmation promise
  const confirmResolvers = useRef<Map<string, (approved: boolean) => void>>(new Map())
  const processingRef = useRef(false)
  const mountedRef = useRef(true)

  const normalizedEndpoint = endpoint.endsWith('/') ? endpoint.slice(0, -1) : endpoint

  // ---------------------------------------------------------------------------
  // Manifest
  // ---------------------------------------------------------------------------
  const postManifest = useCallback(async () => {
    try {
      const manifest = registry.getManifest()
      await fetch(`${normalizedEndpoint}/manifest`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(manifest),
      })
    } catch {
      // Silently ignore — will retry on next registry change
    }
  }, [registry, normalizedEndpoint])

  // Post manifest on mount
  useEffect(() => {
    mountedRef.current = true
    console.log('[agentable] Provider mounted, posting initial manifest, registry.size=', registry.size)
    postManifest()
    return () => {
      mountedRef.current = false
    }
  }, [postManifest])

  // Re-post manifest whenever registry size changes (new actions registered/unregistered)
  const registrySizeRef = useRef(registry.size)
  useEffect(() => {
    const interval = setInterval(() => {
      if (registry.size !== registrySizeRef.current) {
        console.log('[agentable] Registry size changed:', registrySizeRef.current, '->', registry.size, 'posting manifest')
        registrySizeRef.current = registry.size
        postManifest()
      }
    }, 200)
    return () => clearInterval(interval)
  }, [registry, postManifest])

  // ---------------------------------------------------------------------------
  // Confirmation helpers
  // ---------------------------------------------------------------------------
  const requestConfirmation = useCallback(
    (name: string, params: unknown, callId: string): Promise<boolean> => {
      return new Promise<boolean>(resolve => {
        confirmResolvers.current.set(callId, resolve)
        setPendingConfirmation({ callId, name, params })
      })
    },
    [],
  )

  /**
   * resolvePending(callId, approved) — called by <ConfirmationDialog> when the
   * user approves or rejects a pending action.
   */
  const resolvePending = useCallback((callId: string, approved: boolean) => {
    setPendingConfirmation(prev => (prev?.callId === callId ? null : prev))
    const resolve = confirmResolvers.current.get(callId)
    if (resolve) {
      confirmResolvers.current.delete(callId)
      resolve(approved)
    }
  }, [])

  // ---------------------------------------------------------------------------
  // Action execution
  // ---------------------------------------------------------------------------
  const postResult = useCallback(
    async (callId: string, result: unknown) => {
      try {
        await fetch(`${normalizedEndpoint}/result`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ callId, result }),
        })
      } catch {
        // Best effort
      }
    },
    [normalizedEndpoint],
  )

  const processCall = useCallback(
    async (call: PendingCall) => {
      let result
      try {
        result = await callAction(registry, {
          name: call.name,
          params: call.params,
          context,
          requestConfirmation: (name, params) =>
            requestConfirmation(name, params, call.callId),
        })
      } catch (err) {
        result = {
          status: 'error' as const,
          message: err instanceof Error ? err.message : String(err),
        }
      }
      await postResult(call.callId, result)
    },
    [registry, context, requestConfirmation, postResult],
  )

  /**
   * executeAction — exposed on context so consumers can imperatively fire an
   * action (e.g. from a custom UI button) using the same pipeline as the agent.
   */
  const executeAction = useCallback(
    async (callId: string, name: string, params: unknown): Promise<void> => {
      await processCall({ callId, name, params })
    },
    [processCall],
  )

  // ---------------------------------------------------------------------------
  // Polling
  // ---------------------------------------------------------------------------
  useEffect(() => {
    let timeoutId: ReturnType<typeof setTimeout>

    const poll = async () => {
      if (!mountedRef.current) return

      if (!processingRef.current) {
        try {
          const res = await fetch(`${normalizedEndpoint}/pending`)
          if (res.ok) {
            const call: PendingCall | null = await res.json()
            if (call && mountedRef.current) {
              processingRef.current = true
              processCall(call).finally(() => {
                processingRef.current = false
              })
            }
          }
        } catch {
          // Network errors are expected when server is offline — ignore
        }
      }

      if (mountedRef.current) {
        timeoutId = setTimeout(poll, pollInterval)
      }
    }

    timeoutId = setTimeout(poll, pollInterval)
    return () => clearTimeout(timeoutId)
  }, [normalizedEndpoint, pollInterval, processCall])

  const value = useMemo(
    () => ({ registry, pendingConfirmation, resolvePending, executeAction }),
    [registry, pendingConfirmation, resolvePending, executeAction],
  )

  return <AgentableContext.Provider value={value}>{children}</AgentableContext.Provider>
}
