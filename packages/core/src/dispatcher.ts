import type { ActionRegistry } from './registry.js'
import type { ActionContext, ActionResult } from './types.js'

export interface CallActionOptions {
  name: string
  params: unknown
  context?: ActionContext
  requestConfirmation?: (name: string, params: unknown) => Promise<boolean>
}

export async function callAction(
  registry: ActionRegistry,
  opts: CallActionOptions,
): Promise<ActionResult> {
  const { name, params, context = {}, requestConfirmation } = opts

  const action = registry.get(name)
  if (!action) {
    return { status: 'error', message: `Action not found: ${name}` }
  }

  const parsed = action.schema.safeParse(params)
  if (!parsed.success) {
    return {
      status: 'error',
      message: `Invalid params for action "${name}": ${parsed.error.message}`,
    }
  }

  if (action.requiresConfirmation) {
    if (!requestConfirmation) {
      return {
        status: 'error',
        message: `Action "${name}" requires confirmation but no requestConfirmation handler was provided`,
      }
    }

    const approved = await requestConfirmation(name, parsed.data)
    if (!approved) {
      return { status: 'rejected' }
    }
  }

  try {
    const result = await action.handler(parsed.data, context)
    return { status: 'success', result }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return { status: 'error', message }
  }
}
