import React, { useState, useRef } from 'react'
import { z } from 'zod'
import { AgentableProvider, useRegisterAction, ConfirmationDialog } from '@agentable/react'

// ---------------------------------------------------------------------------
// Counter component — registers two actions on the global agentable registry
// ---------------------------------------------------------------------------
function Counter() {
  const [count, setCount] = useState(0)

  useRegisterAction(
    {
      name: 'counter.increment',
      description: 'Increment the counter by the given amount (default 1).',
      schema: z.object({
        amount: z.number().int().min(1).default(1),
      }),
      requiresConfirmation: false,
      handler: async ({ amount }) => {
        const newCount = count + amount
        setCount(newCount)
        return { previousCount: count, newCount }
      },
    },
    [count],
  )

  useRegisterAction(
    {
      name: 'counter.reset',
      description: 'Reset the counter back to zero.',
      schema: z.object({}),
      requiresConfirmation: true,
      handler: async () => {
        setCount(0)
        return { reset: true }
      },
    },
    [],
  )

  return (
    <div style={{ marginBottom: 24 }}>
      <h2 style={{ margin: '0 0 8px' }}>Counter</h2>
      <p style={{ fontSize: 48, fontWeight: 700, margin: '0 0 12px' }}>{count}</p>
      <div style={{ display: 'flex', gap: 8 }}>
        <button onClick={() => setCount(c => c + 1)}>+1</button>
        <button onClick={() => setCount(c => c - 1)}>-1</button>
        <button onClick={() => setCount(0)}>Reset</button>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Chat component — sends messages to the mock backend agent
// ---------------------------------------------------------------------------
interface ChatMessage {
  role: 'user' | 'agent'
  text: string
}

function Chat() {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: 'agent',
      text: 'Hi! I can control the counter. Try: "increment by 3", "increment", or "reset".',
    },
  ])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const send = async () => {
    const text = input.trim()
    if (!text || loading) return

    setMessages(msgs => [...msgs, { role: 'user', text }])
    setInput('')
    setLoading(true)

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text }),
      })
      const data = await res.json()
      setMessages(msgs => [
        ...msgs,
        { role: 'agent', text: data.reply ?? data.error ?? 'No response' },
      ])
    } catch {
      setMessages(msgs => [...msgs, { role: 'agent', text: 'Network error — is the server running?' }])
    } finally {
      setLoading(false)
      inputRef.current?.focus()
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      send()
    }
  }

  return (
    <div style={{ borderTop: '1px solid #e5e7eb', paddingTop: 24 }}>
      <h2 style={{ margin: '0 0 12px' }}>Chat with mock agent</h2>
      <div
        style={{
          height: 260,
          overflowY: 'auto',
          border: '1px solid #e5e7eb',
          borderRadius: 8,
          padding: 12,
          marginBottom: 12,
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
          background: '#f9fafb',
        }}
      >
        {messages.map((msg, i) => (
          <div
            key={i}
            style={{
              alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start',
              maxWidth: '80%',
              padding: '8px 12px',
              borderRadius: 12,
              background: msg.role === 'user' ? '#3b82f6' : '#ffffff',
              color: msg.role === 'user' ? '#ffffff' : '#111827',
              border: msg.role === 'agent' ? '1px solid #e5e7eb' : 'none',
              fontSize: 14,
              lineHeight: 1.5,
            }}
          >
            {msg.text}
          </div>
        ))}
        {loading && (
          <div
            style={{
              alignSelf: 'flex-start',
              padding: '8px 12px',
              borderRadius: 12,
              background: '#ffffff',
              border: '1px solid #e5e7eb',
              color: '#6b7280',
              fontSize: 14,
            }}
          >
            Agent is thinking...
          </div>
        )}
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder='Try "increment by 5" or "reset"'
          disabled={loading}
          style={{
            flex: 1,
            padding: '8px 12px',
            border: '1px solid #d1d5db',
            borderRadius: 8,
            fontSize: 14,
            outline: 'none',
          }}
        />
        <button
          onClick={send}
          disabled={loading || !input.trim()}
          style={{
            padding: '8px 20px',
            background: '#3b82f6',
            color: '#fff',
            border: 'none',
            borderRadius: 8,
            cursor: loading || !input.trim() ? 'not-allowed' : 'pointer',
            opacity: loading || !input.trim() ? 0.6 : 1,
            fontSize: 14,
          }}
        >
          Send
        </button>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Root App
// ---------------------------------------------------------------------------
export default function App() {
  return (
    <AgentableProvider endpoint="/agentable" pollInterval={500}>
      <div
        style={{
          maxWidth: 560,
          margin: '48px auto',
          padding: '0 24px',
          fontFamily: 'system-ui, sans-serif',
          color: '#111827',
        }}
      >
        <header style={{ marginBottom: 32 }}>
          <h1 style={{ margin: 0, fontSize: 24, fontWeight: 700 }}>agentable</h1>
          <p style={{ margin: '4px 0 0', color: '#6b7280', fontSize: 14 }}>
            Express + React example — actions registered in the UI, dispatched from the server.
          </p>
        </header>

        <Counter />
        <Chat />
      </div>

      {/* Confirmation dialog — shown when an action has requiresConfirmation: true */}
      <ConfirmationDialog
        render={({ actionName, params, onApprove, onReject }) => (
          <div
            style={{
              position: 'fixed',
              inset: 0,
              background: 'rgba(0,0,0,0.4)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 9999,
            }}
          >
            <div
              style={{
                background: '#fff',
                borderRadius: 12,
                padding: 24,
                maxWidth: 400,
                width: '90%',
                boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
              }}
            >
              <h3 style={{ margin: '0 0 8px', fontSize: 16 }}>Confirm action</h3>
              <p style={{ margin: '0 0 12px', color: '#374151', fontSize: 14 }}>
                The AI wants to run{' '}
                <strong
                  style={{
                    background: '#f3f4f6',
                    padding: '2px 6px',
                    borderRadius: 4,
                    fontFamily: 'monospace',
                  }}
                >
                  {actionName}
                </strong>
              </p>
              {Object.keys(params as object).length > 0 && (
                <pre
                  style={{
                    background: '#f9fafb',
                    border: '1px solid #e5e7eb',
                    borderRadius: 6,
                    padding: '8px 12px',
                    fontSize: 12,
                    overflow: 'auto',
                    marginBottom: 16,
                  }}
                >
                  {JSON.stringify(params, null, 2)}
                </pre>
              )}
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                <button
                  onClick={onReject}
                  style={{
                    padding: '8px 16px',
                    border: '1px solid #d1d5db',
                    borderRadius: 8,
                    background: '#fff',
                    cursor: 'pointer',
                    fontSize: 14,
                  }}
                >
                  Deny
                </button>
                <button
                  onClick={onApprove}
                  style={{
                    padding: '8px 16px',
                    border: 'none',
                    borderRadius: 8,
                    background: '#3b82f6',
                    color: '#fff',
                    cursor: 'pointer',
                    fontSize: 14,
                  }}
                >
                  Allow
                </button>
              </div>
            </div>
          </div>
        )}
      />
    </AgentableProvider>
  )
}
