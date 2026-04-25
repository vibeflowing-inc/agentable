# Agentable

Put your app in any AI. Register actions where they already live, no refactoring needed.

Want to skip setup? Start from the ready-to-run [`examples/express-react`](./examples/express-react) app and test the full round-trip in minutes.

[![npm version](https://img.shields.io/npm/v/@agentable/core.svg)](https://www.npmjs.com/package/@agentable/core)
[![GitHub stars](https://img.shields.io/github/stars/saquand/agentable?style=flat)](https://github.com/saquand/agentable/stargazers)
[![MIT License](https://img.shields.io/badge/license-MIT-blue.svg)](./LICENSE)
[![Join Discord](https://img.shields.io/badge/Join-Discord-5865F2?logo=discord&logoColor=white)](https://discord.gg/vibeflow)

AI agents that can "use your app" usually force you to build and maintain a separate tool layer. Agentable flips that model: register actions directly inside your React components, right next to the state they control. The agent only needs two tools, `discoverActions` and `callAction`.

## Features

- React-native action registration with direct state and closure access.
- Minimal agent interface: `discoverActions` + `callAction`.
- Built-in server bridge for Express and Next.js App Router.
- Optional user confirmation flow for destructive actions.
- Vercel AI SDK adapter plus framework-agnostic `dispatch()` usage.

## Install

```bash
# npm
npm install @agentable/core @agentable/react @agentable/server zod

# pnpm
pnpm add @agentable/core @agentable/react @agentable/server zod
```

## How It Works

```text
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
2. Your backend agent calls `agentable.dispatch('action.name', params)` to queue an action call.
3. The React provider polls `GET /agentable/pending`, executes the matching handler in your component context, then POSTs the result.
4. `dispatch()` resolves with that handler result.

## Quick Start

### 1) Create the server bridge

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

**Next.js App Router** (`app/agentable/[...path]/route.ts`)

```ts
import { createAgentable, nextHandler } from '@agentable/server'

export const agentable = createAgentable()

const handle = nextHandler(agentable)
export const GET = handle
export const POST = handle
export const OPTIONS = handle
```

### 2) Wrap your React app

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

### 3) Register actions inside your components

```tsx
import { useRegisterAction } from '@agentable/react'
import { z } from 'zod'

function Counter() {
  const [count, setCount] = useState(0)

  useRegisterAction(
    {
      name: 'counter.increment',
      description: 'Increment the counter by a given amount.',
      schema: z.object({ amount: z.number().int().min(1).default(1) }),
      handler: async ({ amount }) => {
        const newCount = count + amount
        setCount(newCount)
        return { newCount }
      },
    },
    [count]
  )

  return <div>Count: {count}</div>
}
```

The agent can now discover and call `counter.increment`.

### 4) Connect your LLM

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

**Any other framework**

```ts
// Inside your tool implementation
const result = await agentable.dispatch('counter.increment', { amount: 5 })
// resolves when the frontend executes the action
```

## Confirmation Dialogs

Mark destructive or irreversible actions with `requiresConfirmation: true`. `dispatch()` blocks until the user approves or rejects.

```tsx
import { useRegisterAction, ConfirmationDialog } from '@agentable/react'

function DataTable() {
  const [rows, setRows] = useState(initialRows)

  useRegisterAction(
    {
      name: 'table.deleteAll',
      description: 'Delete all rows from the table.',
      schema: z.object({}),
      requiresConfirmation: true,
      handler: async () => {
        setRows([])
        return { deleted: true }
      },
    },
    []
  )

  return (
    <>
      <table>{/* ... */}</table>

      <ConfirmationDialog
        render={({ actionName, params, onApprove, onReject }) => (
          <div className="dialog">
            <p>
              Allow AI to run <strong>{actionName}</strong>?
            </p>
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

If the user denies, `dispatch()` resolves with `{ status: 'rejected' }`.  
If approved, it resolves with `{ status: 'success', result: ... }`.

## API Reference

### `@agentable/server`

#### `createAgentable(options?)`

```ts
createAgentable({
  timeoutMs?: number // default: 30_000
})
```

Returns an `AgentableServer` with:

| Method | Description |
| --- | --- |
| `handler(req)` | Web API request handler for framework adapters |
| `dispatch(name, params)` | Queue an action and await the frontend result |
| `getManifest()` | Get current action manifest, or `null` before frontend connect |

#### `expressHandler(agentable)`

```ts
app.use('/agentable', expressHandler(agentable))
```

#### `nextHandler(agentable)`

```ts
const handle = nextHandler(agentable)
export const GET = handle
export const POST = handle
export const OPTIONS = handle
```

### `@agentable/react`

#### `<AgentableProvider>`

```tsx
<AgentableProvider
  endpoint="http://localhost:3001/agentable" // required
  pollInterval={500} // optional, default 500ms
  context={{ userId, sessionId }} // optional, passed to every handler
>
```

#### `useRegisterAction(opts, deps?)`

```ts
useRegisterAction({
  name: string
  description: string
  schema: ZodObject
  requiresConfirmation?: boolean
  handler: (params) => Promise<unknown>
}, deps?)
```

Actions auto-unregister on unmount or dependency changes.

#### `useAgentable()`

```ts
const {
  registry,
  pendingConfirmation, // { callId, name, params } | null
  resolvePending, // (callId, approved: boolean) => void
  executeAction, // (callId, name, params) => Promise<void>
} = useAgentable()
```

Must be called inside `<AgentableProvider>`.

#### `<ConfirmationDialog render={...} />`

`render` receives:

```ts
{
  actionName: string
  params: unknown
  onApprove: () => void
  onReject: () => void
}
```

### `@agentable/core`

Framework-agnostic primitives used internally by `@agentable/react` and `@agentable/server`.

#### `ActionRegistry`

```ts
const registry = new ActionRegistry()

registry.register(opts)
registry.get(name)
registry.has(name)
registry.size
registry.getManifest()
registry.onChange(listener)
```

#### `callAction(registry, opts)`

```ts
const result = await callAction(registry, {
  name: string
  params: unknown
  context?: ActionContext
  requestConfirmation?: (name, params) => Promise<boolean>
})
// { status: 'success', result: unknown }
// { status: 'rejected' }
// { status: 'error', message: string }
```

### `@agentable/adapter-vercel-ai`

#### `toVercelAITools(agentable)`

Returns:

- `discoverActions` (no params, returns manifest)
- `callAction` (`{ name, params }`, dispatches an action call)

```ts
const { discoverActions, callAction } = toVercelAITools(agentable)

const result = await streamText({
  model: openai('gpt-4o'),
  tools: { discoverActions, callAction },
  messages,
})
```

## Packages

| Package | Description |
| --- | --- |
| [`@agentable/core`](./packages/core) | Action registry and dispatcher |
| [`@agentable/react`](./packages/react) | React provider, hooks, confirmation dialog |
| [`@agentable/server`](./packages/server) | HTTP bridge for Express and Next.js |
| [`@agentable/adapter-vercel-ai`](./packages/adapter-vercel-ai) | Vercel AI SDK adapter |

## Examples

- [`examples/express-react`](./examples/express-react): full round-trip with Express, React, and a mock agent.

## License

MIT. See [LICENSE](./LICENSE).
