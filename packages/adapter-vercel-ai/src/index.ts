import { tool } from 'ai'
import { z } from 'zod'
import type { AgentableServer } from '@agentable/server'

export function toVercelAITools(agentable: AgentableServer) {
  return {
    discoverActions: tool({
      description:
        'Discover all UI actions currently available in the app. Returns a manifest with action names, descriptions, and parameter schemas. Call this before callAction.',
      parameters: z.object({}),
      execute: async () => {
        const manifest = agentable.getManifest()
        if (!manifest) {
          return {
            error:
              'No manifest available yet. The frontend may not be connected.',
          }
        }
        return manifest
      },
    }),
    callAction: tool({
      description:
        "Execute a UI action in the app by name. The action runs in the user's browser. Use discoverActions first to see what is available.",
      parameters: z.object({
        name: z.string().describe('The exact action name from the manifest'),
        params: z
          .record(z.unknown())
          .describe("Parameters matching the action's schema")
          .default({}),
      }),
      execute: async ({ name, params }) => {
        return agentable.dispatch(name, params)
      },
    }),
  }
}
