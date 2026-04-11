import { useEffect } from 'react'
import type { RegisterActionOptions } from '@agentable/core'
import { useAgentable } from './useAgentable.js'

export function useRegisterAction<T>(
  opts: RegisterActionOptions<T>,
  deps: unknown[] = [],
): void {
  const { registry } = useAgentable()

  useEffect(() => {
    return registry.register(opts)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)
}
