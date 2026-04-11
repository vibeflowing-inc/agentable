import React from 'react'
import { useAgentable } from './useAgentable.js'

export interface ConfirmationRenderProps {
  actionName: string
  params: unknown
  onApprove: () => void
  onReject: () => void
}

export interface ConfirmationDialogProps {
  render: (props: ConfirmationRenderProps) => React.ReactNode
}

export function ConfirmationDialog({ render }: ConfirmationDialogProps) {
  const { pendingConfirmation, resolvePending } = useAgentable()

  if (!pendingConfirmation) {
    return null
  }

  const { callId, name, params } = pendingConfirmation

  return (
    <>
      {render({
        actionName: name,
        params,
        onApprove: () => resolvePending(callId, true),
        onReject: () => resolvePending(callId, false),
      })}
    </>
  )
}
