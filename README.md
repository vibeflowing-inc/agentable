# agentable

[![npm version](https://img.shields.io/npm/v/@agentable/core.svg)](https://www.npmjs.com/package/@agentable/core)
[![MIT License](https://img.shields.io/badge/license-MIT-blue.svg)](./LICENSE)

> Put your app in any AI. Register actions where they already live — no refactoring needed.

---

## The problem

AI agents that can "use your app" typically require you to build a separate tool layer — duplicating business logic, maintaining two sources of truth, and wiring up a whole new API surface. The result is a parallel codebase nobody asked for.

Agentable inverts this. You register actions **inside your React components**, right next to the state they control. The agent gets two tools: `discoverActions` and `callAction`. That's the entire interface.

---

## How it works

```
  AI Agent
     │
     │  discoverActions()        →  GET  /agentable/manifest
     │  callAction(name, params) →  GET  /agentable/pending   (frontend polls)
     │                           ←  POST /agentable/result    (frontend posts back)
     ▼
  @agentable/server  ←────────────────────────────────────────────────────────────┐
  (your backend)                                                                   │
                               @agentable/react                                   │
                               (AgentableProvider)  →  useRegisterAction          │
                               polls /pending            (inside your components) │
                               posts /result  ──────────────────────────────────→─┘
```

1. `AgentableProvider` mounts in your React app and POSTs an action manifest to the server.
2. Your backend agent calls `agentable.dispatch('action.name', params)` — this queues the call server-side.
3. The React provider polls `GET /agentable/pending`, picks up the call, runs the matching handler (which has direct access to your React state and closures), and POSTs the result back.
4. `dispatch()` resolves with the handler's return value. The agent sees it.

---

## Installation

```bash
# npm
npm install @agentable/core @agentable/react @agentable/server zod

# pnpm
pnpm add @agentable/core @agentable/react @agentable/server zod
```

---

## Quick start

### 1. Create the server bridge

**Express**

```ts
import express from 'express'
import { createAgentable, expressHandler } from '@agentable/server'

const app = express()
app.use(express.json())

export const agentable = createAgentable()
app.use('/agentable', expressHandler(agentable))

app.listen(3001)
```

**Next.js App Router** — create `app/agentable/[...path]/route.ts`:

```ts
import { createAgentable, nextHandler } from '@agentable/server'

export const agentable = createAgentable()

const handle = nextHandler(agentable)
export const GET = handle
export const POST = handle
export const OPTIONS = handle
```

### 2. Wrap your React app

```tsx
import { AgentableProvider } from '@agentable/react'

export default function App() {
  return (
    <AgentableProvider endpoint="http://localhost:3001/agentable">
      <YourApp />
    </AgentableProvider>
  )
}
```

### 3. Register actions inside your components

```tsx
import { useRegisterAction } from '@agentable/react'
import { z } from 'zod'

function Counter() {
  const [count, setCount] = useState(0)

  useRegisterAction({
    name: 'counter.increment',
    description: 'Increment the counter by a given amount.',
    schema: z.object({ amount: z.number().int().min(1).default(1) }),
    handler: async ({ amount }) => {
      const newCount = count + amount
      setCount(newCount)
      return { newCount }
    },
  }, [count])

  return <div>Count: {count}</div>
}
```

The agent can now discover and call `counter.increment`.

### 4. Connect your LLM

**Vercel AI SDK**

```bash
npm install @agentable/adapter-vercel-ai
```

```ts
import { toVercelAITools } from '@agentable/adapter-vercel-ai'
import { streamText } from 'ai'
import { openai } from '@ai-sdk/openai'

const tools = toVercelAITools(agentable)

const result = await streamText({
  model: openai('gpt-4o'),
  tools,
  messages,
})
```

**Any other LLM or framework** — call `agentable.dispatch()` directly from your tool handler:

```ts
// Inside your tool implementation
const result = await agentable.dispatch('counter.increment', { amount: 5 })
// resolves when the frontend executes the action
```

---

## Confirmation dialogs

Mark actions with `requiresConfirmation: true` when they are destructive or irreversible. The agent's `dispatch()` call will block until the user approves or rejects — giving users control over what the AI is allowed to do.

```tsx
import { useRegisterAction, ConfirmationDialog } from '@agentable/react'

function DataTable() {
  const [rows, setRows] = useState(initialRows)

  useRegisterAction({
    name: 'table.deleteAll',
    description: 'Delete all rows from the table.',
    schema: z.object({}),
    requiresConfirmation: true,
    handler: async () => {
      setRows([])
      return { deleted: true }
    },
  }, [])

  return (
    <>
      <table>{/* ... */}</table>

      <ConfirmationDialog
        render={({ actionName, params, onApprove, onReject }) => (
          <div className="dialog">
            <p>Allow AI to run <strong>{actionName}</strong>?</p>
            {Object.keys(params).length > 0 && (
              <pre>{JSON.stringify(params, null, 2)}</pre>
            )}
            <button onClick={onApprove}>Allow</button>
            <button onClick={onReject}>Deny</button>
          </div>
        )}
      />
    </>
  )
}
```

If the user denies, `dispatch()` resolves with `{ status: 'rejected' }`. If they approve, the handler runs and `dispatch()` resolves with `{ status: 'success', result: ... }`.

---

## API reference

### `@agentable/server`

#### `createAgentable(options?)`

```ts
createAgentable({
  timeoutMs?: number  // default: 30_000 — how long dispatch() waits for a result
})
```

Returns an `AgentableServer`:

| Method | Description |
|---|---|
| `handler(req)` | Web API request handler — pass to your framework adapter |
| `dispatch(name, params)` | Queue an action call. Returns a Promise that resolves with the handler's return value |
| `getManifest()` | Returns the current action manifest, or `null` if the frontend hasn't connected |

#### `expressHandler(agentable)`

Express middleware. Mount it at the path your `AgentableProvider` endpoint points to.

```ts
app.use('/agentable', expressHandler(agentable))
```

#### `nextHandler(agentable)`

Next.js App Router adapter. Returns the handler directly (Next.js already uses Web API).

```ts
const handle = nextHandler(agentable)
export const GET = handle
export const POST = handle
export const OPTIONS = handle
```

---

### `@agentable/react`

#### `<AgentableProvider>`

```tsx
<AgentableProvider
  endpoint="http://localhost:3001/agentable"  // required
  pollInterval={500}                          // optional, ms — default 500
  context={{ userId, sessionId }}             // optional — passed to every handler
>
```

#### `useRegisterAction(opts, deps?)`

```ts
useRegisterAction({
  name: string               // unique identifier, e.g. 'modal.open'
  description: string        // shown to the agent — be specific
  schema: ZodObject          // validates params before handler is called
  requiresConfirmation?:     // default false — block until user approves
  handler: (params) =>       // runs inside React — has access to state/closures
    Promise<unknown>
}, deps?)                    // dependency array, same semantics as useEffect
```

The action is automatically unregistered when the component unmounts or deps change.

#### `useAgentable()`

```ts
const {
  registry,             // ActionRegistry instance
  pendingConfirmation,  // { callId, name, params } | null
  resolvePending,       // (callId, approved: boolean) => void
  executeAction,        // (callId, name, params) => Promise<void>
} = useAgentable()
```

Must be used inside `<AgentableProvider>`.

#### `<ConfirmationDialog render={...} />`

Renders nothing when no confirmation is pending. Calls `render` with:

```ts
{
  actionName: string
  params: unknown
  onApprove: () => void
  onReject: () => void
}
```

---

### `@agentable/core`

The framework-agnostic core. You typically don't need this directly — `@agentable/react` and `@agentable/server` use it internally.

#### `ActionRegistry`

```ts
const registry = new ActionRegistry()

registry.register(opts)       // returns unregister function
registry.get(name)            // → RegisterActionOptions | undefined
registry.has(name)            // → boolean
registry.size                 // → number
registry.getManifest()        // → ActionManifest (JSON Schema)
registry.onChange(listener)   // subscribe to register/unregister events, returns unsubscribe fn
```

#### `callAction(registry, opts)`

```ts
const result = await callAction(registry, {
  name: string
  params: unknown
  context?: ActionContext
  requestConfirmation?: (name, params) => Promise<boolean>
})
// → { status: 'success', result: unknown }
// → { status: 'rejected' }
// → { status: 'error', message: string }
```

---

### `@agentable/adapter-vercel-ai`

#### `toVercelAITools(agentable)`

Returns two Vercel AI SDK tools:

- **`discoverActions`** — no parameters, returns the manifest
- **`callAction`** — `{ name: string, params: Record<string, unknown> }`, calls `dispatch()`

```ts
const { discoverActions, callAction } = toVercelAITools(agentable)

const result = await streamText({
  model: openai('gpt-4o'),
  tools: { discoverActions, callAction },
  messages,
})
```

---

## Packages

| Package | Description |
|---|---|
| [`@agentable/core`](./packages/core) | Action registry and dispatcher — framework agnostic |
| [`@agentable/react`](./packages/react) | React provider, `useRegisterAction` hook, confirmation dialog |
| [`@agentable/server`](./packages/server) | HTTP bridge with Express and Next.js adapters |
| [`@agentable/adapter-vercel-ai`](./packages/adapter-vercel-ai) | Vercel AI SDK tools: `discoverActions` + `callAction` |

---

## Examples

- [`examples/express-react`](./examples/express-react) — full round-trip with Express + React + mock agent

---

## License

MIT — see [LICENSE](./LICENSE)
