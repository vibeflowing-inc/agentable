import { useEffect } from 'react'
import type { RegisterActionOptions } from '@agentable/core'
import { useAgentable } from './useAgentable.js'

export function useRegisterAction<T>(
  opts: RegisterActionOptions<T>,
  deps: unknown[] = [],
): void {
  const { registry } = useAgentable()

  useEffect(() => {
    console.log('[agentable] Registering action:', opts.name, 'registry.size before=', registry.size)
    const unregister = registry.register(opts)
    console.log('[agentable] Registered action:', opts.name, 'registry.size after=', registry.size)
    return () => {
      console.log('[agentable] Unregistering action:', opts.name)
      unregister()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)
}
