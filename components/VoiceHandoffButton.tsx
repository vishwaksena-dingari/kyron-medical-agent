'use client'

import { useState } from 'react'
import type { CallState, Message, PatientContext } from '@/types'

interface Props {
  messages: Message[]
  patientContext: PatientContext
  callState: CallState
  setCallState: (s: CallState) => void
}

const LABEL: Record<CallState, string> = {
  idle:    'Continue by phone',
  loading: 'Connecting...',
  ringing: 'Pick up — Aria is calling!',
  error:   'Try again',
}

const DOT_COLOR: Record<CallState, string | undefined> = {
  idle:    undefined,
  loading: undefined,
  ringing: 'green',
  error:   undefined,
}

export default function VoiceHandoffButton({
  messages,
  patientContext,
  callState,
  setCallState,
}: Props) {
  const [errorMsg, setErrorMsg] = useState('')

  async function handleCall() {
    if (callState === 'loading' || callState === 'ringing') return

    if (!patientContext.phone) {
      setErrorMsg('Share your phone number in the chat first.')
      setCallState('error')
      return
    }

    setCallState('loading')
    setErrorMsg('')

    try {
      const res = await fetch('/api/initiate-call', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: messages.map(m => ({ role: m.role, content: m.content })),
          patient: patientContext,
        }),
      })

      const data = await res.json()

      if (!res.ok || !data.success) {
        throw new Error(data.error ?? 'Unknown error')
      }

      setCallState('ringing')

      // Reset to idle after 5 minutes (call should be done)
      setTimeout(() => setCallState('idle'), 5 * 60 * 1000)

    } catch (err) {
      console.error('[VoiceHandoff]', err)
      setErrorMsg('Could not start the call. Try again or call (401) 555-0192.')
      setCallState('error')
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px' }}>
      <button
        className={`call-btn${callState === 'loading' ? ' loading' : ''}${callState === 'ringing' ? ' ringing' : ''}${callState === 'error' ? ' error' : ''}`}
        onClick={handleCall}
        disabled={callState === 'loading'}
        aria-label={LABEL[callState]}
      >
        <div className={`cdot${DOT_COLOR[callState] ? ` ${DOT_COLOR[callState]}` : ''}`} />
        <span>{LABEL[callState]}</span>
      </button>

      {callState === 'ringing' && (
        <span style={{ fontSize: '11px', color: 'var(--green-text)', textAlign: 'right' }}>
          Calling {patientContext.phone} now
        </span>
      )}

      {callState === 'error' && errorMsg && (
        <span style={{ fontSize: '11px', color: '#F87171', textAlign: 'right', maxWidth: '200px' }}>
          {errorMsg}
        </span>
      )}
    </div>
  )
}
