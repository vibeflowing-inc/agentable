import express from 'express'
import { createAgentable } from '@vibeflowai/agentable-server'
import { expressHandler } from '@vibeflowai/agentable-server/adapters/express'

const app = express()
app.use(express.json())

// ---------------------------------------------------------------------------
// Agentable setup
// ---------------------------------------------------------------------------
const agentable = createAgentable({ timeoutMs: 30_000 })

// Mount the agentable HTTP bridge at /agentable
app.use('/agentable', expressHandler(agentable))

// ---------------------------------------------------------------------------
// Mock agent — no real LLM needed
// Interprets the user's message and dispatches UI actions directly.
// ---------------------------------------------------------------------------
app.post('/api/chat', async (req, res) => {
  const { message } = req.body ?? {}

  if (!message || typeof message !== 'string') {
    return res.status(400).json({ error: 'message is required' })
  }

  const lower = message.toLowerCase()

  try {
    if (lower.includes('reset')) {
      await agentable.dispatch('counter.reset', {})
      return res.json({
        reply: 'Done — I reset the counter to 0. (Needed your confirmation first!)',
      })
    }

    if (lower.includes('increment') || lower.includes('increase') || lower.includes('add')) {
      // Try to extract a number from the message, e.g. "increment by 5"
      const match = lower.match(/\b(\d+)\b/)
      const amount = match ? parseInt(match[1], 10) : 1
      const result = await agentable.dispatch('counter.increment', { amount })
      return res.json({
        reply: `Done — I incremented the counter by ${amount}. Result: ${JSON.stringify(result)}`,
      })
    }

    // Generic fallback — just echo back
    return res.json({
      reply: `I understood: "${message}". Try saying "increment", "increment by 5", or "reset".`,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    // Dispatch can reject (user denied) or time out
    if (message.includes('timed out')) {
      return res.json({ reply: 'The action timed out — is the React app open in a browser tab?' })
    }
    return res.json({ reply: `Action was not completed: ${message}` })
  }
})

// ---------------------------------------------------------------------------
// Start
// ---------------------------------------------------------------------------
const PORT = process.env.PORT ?? 3001
app.listen(PORT, () => {
  console.log(`agentable example server running on http://localhost:${PORT}`)
  console.log(`  POST /api/chat       — send a message to the mock agent`)
  console.log(`  /agentable/*         — agentable bridge (React app connects here)`)
})
