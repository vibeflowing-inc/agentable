import { zodToJsonSchema } from 'zod-to-json-schema'
import type { RegisterActionOptions, ActionManifest, ActionManifestEntry } from './types.js'

export class ActionRegistry {
  private actions = new Map<string, RegisterActionOptions<unknown>>()
  private listeners = new Set<() => void>()

  onChange(listener: () => void): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  private notify() {
    for (const listener of this.listeners) listener()
  }

  register<T>(opts: RegisterActionOptions<T>): () => void {
    if (this.actions.has(opts.name)) {
      console.warn(`[agentable] Overwriting existing action: ${opts.name}`)
    }
    this.actions.set(opts.name, opts as RegisterActionOptions<unknown>)
    this.notify()

    return () => {
      this.actions.delete(opts.name)
      this.notify()
    }
  }

  get(name: string): RegisterActionOptions<unknown> | undefined {
    return this.actions.get(name)
  }

  has(name: string): boolean {
    return this.actions.has(name)
  }

  get size(): number {
    return this.actions.size
  }

  getManifest(): ActionManifest {
    const entries: ActionManifestEntry[] = []

    for (const [, action] of this.actions) {
      const jsonSchema = zodToJsonSchema(action.schema, {
        target: 'jsonSchema7',
      }) as Record<string, unknown>

      entries.push({
        name: action.name,
        description: action.description,
        schema: jsonSchema,
        requiresConfirmation: action.requiresConfirmation ?? false,
      })
    }

    return {
      version: '1',
      actions: entries,
    }
  }
}

export const defaultRegistry = new ActionRegistry()
