# agentable

[![npm version](https://img.shields.io/npm/v/@agentable/core.svg)](https://www.npmjs.com/package/@agentable/core)
[![MIT License](https://img.shields.io/badge/license-MIT-blue.svg)](./LICENSE)

> Put your app in any AI. Register actions where they already live — no refactoring needed.

---

## The problem

AI agents that can "use your app" typically require you to build a separate tool layer — duplicating business logic, maintaining two sources of truth, and wiring up a whole new API surface. The result is a parallel codebase nobody asked for.

Agentable inverts this. You register actions **inside your React components**, right next to the state they control. The agent gets a `discoverActions` tool and a `callAction` tool. That's the entire interface.

---

## Quick Start

### 1. Mount the server

```ts
// server.ts (Express)
import express from 'express'
import { createAgentable } from '@agentable/server'
import { expressHandler } from '@agentable/server/adapters/express'

const app = express()
app.use(express.json())

const agentable = createAgentable()
app.use('/agentable', expressHandler(agentable))

app.listen(3001)
```

### 2. Wrap your React app

```tsx
// App.tsx
import { AgentableProvider } from '@agentable/react'

export default function App() {
  return (
    <AgentableProvider endpoint="http://localhost:3001/agentable">
      <MyApp />
    </AgentableProvider>
  )
}
```

### 3. Register actions anywhere in your UI

```tsx
// Counter.tsx
import { useRegisterAction } from '@agentable/react'
import { z } from 'zod'
import { useState } from 'react'

function Counter() {
  const [count, setCount] = useState(0)

  useRegisterAction({
    name: 'counter.increment',
    description: 'Increment the counter by a given amount',
    schema: z.object({ amount: z.number().default(1) }),
    handler: async ({ amount }) => {
      setCount(c => c + amount)
      return { newCount: count + amount }
    },
  })

  return <div>Count: {count}</div>
}
```

The agent can now discover and call `counter.increment` using the two tools.

---

## Packages

| Package | Description |
|---|---|
| [`@agentable/core`](./packages/core) | Action registry and dispatcher — framework agnostic |
| [`@agentable/react`](./packages/react) | React provider, `useRegisterAction` hook, confirmation dialog |
| [`@agentable/server`](./packages/server) | Framework-agnostic HTTP server with Express and Next.js adapters |
| [`@agentable/adapter-vercel-ai`](./packages/adapter-vercel-ai) | Vercel AI SDK tools: `discoverActions` + `callAction` |

---

## How it works

```
  AI Agent
     |
     |  discoverActions()     --> GET  /agentable/manifest
     |  callAction(name, params) --> GET /agentable/pending  (frontend polls)
     |                              POST /agentable/result   (frontend posts back)
     v
  @agentable/server  <--->  @agentable/react  <--->  Your React components
  (your backend)             (AgentableProvider)      (useRegisterAction)
```

1. The `AgentableProvider` mounts in your React app and POSTs its action manifest to the server.
2. When your backend agent calls `agentable.dispatch('counter.increment', { amount: 5 })`, the call is queued server-side.
3. The React provider polls `GET /agentable/pending`, picks up the call, runs the matching handler (which has direct access to your React state and closures), and POSTs the result back.
4. `dispatch()` resolves with the result. The agent sees the return value.

---

## Confirmation dialogs

Some actions are destructive. Mark them with `requiresConfirmation: true` and render a dialog:

```tsx
import { useRegisterAction, ConfirmationDialog } from '@agentable/react'
import { z } from 'zod'

function DataTable() {
  useRegisterAction({
    name: 'table.deleteAll',
    description: 'Delete all rows from the table',
    schema: z.object({}),
    requiresConfirmation: true,
    handler: async () => {
      setRows([])
      return { deleted: true }
    },
  })

  return (
    <>
      <table>{/* ... */}</table>

      <ConfirmationDialog
        render={({ actionName, params, onApprove, onReject }) => (
          <div className="dialog">
            <p>Allow AI to run <strong>{actionName}</strong>?</p>
            <pre>{JSON.stringify(params, null, 2)}</pre>
            <button onClick={onApprove}>Allow</button>
            <button onClick={onReject}>Deny</button>
          </div>
        )}
      />
    </>
  )
}
```

The agent's `dispatch()` call will block until the user approves or rejects. If rejected, `dispatch()` resolves with `{ status: 'rejected' }`.

---

## Works with any agent

Agentable exposes a plain HTTP interface. Wire it to any LLM framework:

**Vercel AI SDK**

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

**Any other framework** — call `agentable.dispatch(name, params)` directly from your tool handler. The function returns a Promise that resolves when the frontend executes the action.

---

## Examples

- [`examples/express-react`](./examples/express-react) — full round-trip with Express + React + mock agent

---

## License

MIT — see [LICENSE](./LICENSE)
