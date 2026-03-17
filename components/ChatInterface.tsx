'use client'

import { useRef, useEffect, useCallback } from 'react'
import type {
  Message,
  PatientContext,
  SlotOption,
  DoctorOption,
  CallState,
  StreamEvent,
  Specialty,
} from '@/types'
import MessageBubble from './MessageBubble'
import VoiceHandoffButton from './VoiceHandoffButton'

type NavTab = 'Schedule' | 'Prescriptions' | 'Locations'

interface Props {
  messages: Message[]
  setMessages: React.Dispatch<React.SetStateAction<Message[]>>
  patientContext: PatientContext
  onPatientUpdate: (update: Partial<PatientContext>) => void
  onBookingConfirmed: (appointmentId: string, slotLabel: string) => void
  isTyping: boolean
  setIsTyping: (v: boolean) => void
  callState: CallState
  setCallState: (s: CallState) => void
  mobileChatOpen: boolean
  setMobileChatOpen: (v: boolean) => void
  activeNavTab: NavTab
  pendingMessage?: string | null
  onPendingMessageSent?: () => void
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function generateId(): string {
  return Math.random().toString(36).slice(2, 9)
}

// Show patient initials in their avatar bubble
function getInitials(name?: string): string {
  if (!name) return 'P'
  const parts = name.trim().split(' ')
  if (parts.length === 1) return parts[0][0].toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function ChatInterface({
  messages,
  setMessages,
  patientContext,
  onPatientUpdate,
  onBookingConfirmed,
  isTyping,
  setIsTyping,
  callState,
  setCallState,
  mobileChatOpen,
  setMobileChatOpen,
  activeNavTab,
  pendingMessage,
  onPendingMessageSent,
}: Props) {
  const msgsRef          = useRef<HTMLDivElement>(null)
  const inputRef         = useRef<HTMLInputElement>(null)
  const abortRef         = useRef<AbortController | null>(null)
  const slotPickedRef    = useRef(false)   // true once patient picks a slot — stops new slot pills
  const doctorPickedRef  = useRef(false)   // true once patient picks a doctor — stops new doctor pills
  const sendMessageRef   = useRef<((text: string) => void) | null>(null)
  const prevPendingRef   = useRef<string | null>(null)

  // Auto-scroll to bottom on new messages or typing state change
  useEffect(() => {
    const el = msgsRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [messages, isTyping])

  // Focus input when mobile chat opens
  useEffect(() => {
    if (mobileChatOpen) {
      setTimeout(() => inputRef.current?.focus(), 380)
    }
  }, [mobileChatOpen])

  // ─── SSE streaming sendMessage ─────────────────────────────────────────────

  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim() || isTyping) return

    const userMsg: Message = {
      id: generateId(),
      role: 'user',
      content: text.trim(),
      timestamp: new Date(),
    }

    setMessages(prev => [...prev, userMsg])
    setIsTyping(true)

    // ariaId is created now but the message is NOT added yet.
    // It gets added lazily on the first text/doctors/slots event.
    const ariaId = generateId()

    let ariaFullText = ''

    // Cancel any previous in-flight request
    abortRef.current?.abort()
    abortRef.current = new AbortController()

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: abortRef.current.signal,
        body: JSON.stringify({
          messages: [...messages, userMsg].map(m => ({
            role: m.role,
            content: m.content,
          })),
          patientContext,
          activeTab: activeNavTab,
        }),
      })

      if (!res.ok || !res.body) throw new Error(`API ${res.status}`)

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n\n')
        buffer = lines.pop() ?? ''

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          let event: StreamEvent
          try {
            event = JSON.parse(line.slice(6)) as StreamEvent
          } catch { continue }

          switch (event.type) {

            // Stream text tokens — words appear one by one
            case 'text':
              ariaFullText += event.text ?? ''
              setMessages(prev =>
                prev.some(m => m.id === ariaId)
                  ? prev.map(m => m.id === ariaId ? { ...m, content: ariaFullText } : m)
                  : [...prev, { id: ariaId, role: 'assistant' as const, content: ariaFullText, timestamp: new Date() }]
              )
              break

            // Update left panel patient info fields in real time
            case 'intake_update':
              if (event.patientUpdate) {
                // New doctor matched → reset slot guard so fresh slots appear
                // doctorPickedRef stays true until booking is confirmed (prevents re-showing doctor pills)
                if (event.patientUpdate.matchedDoctorId) {
                  slotPickedRef.current = false
                }
                onPatientUpdate(event.patientUpdate)
              }
              break

            // Append doctor option pills — only if no doctor chosen yet
            case 'doctors':
              if (event.doctors && event.doctors.length > 0 && !doctorPickedRef.current) {
                setMessages(prev =>
                  prev.some(m => m.id === ariaId)
                    ? prev.map(m => m.id === ariaId ? { ...m, doctorOptions: event.doctors } : m)
                    : [...prev, { id: ariaId, role: 'assistant' as const, content: '', doctorOptions: event.doctors, timestamp: new Date() }]
                )
              }
              break

            // Append slot pills to the current Aria message — only if no slot chosen yet
            case 'slots':
              if (event.slots && event.slots.length > 0 && !slotPickedRef.current) {
                const formatted = event.slots!.map(s => ({
                  id: s.id,
                  doctorId: event.doctorId ?? '',
                  label: s.label,
                  dayLabel: s.label.split(' · ')[0] ?? s.label,
                  timeLabel: s.label.split(' · ')[1] ?? '',
                  datetime: '',
                  available: true,
                }))
                setMessages(prev =>
                  prev.some(m => m.id === ariaId)
                    ? prev.map(m => m.id === ariaId ? { ...m, slots: formatted } : m)
                    : [...prev, { id: ariaId, role: 'assistant' as const, content: '', slots: formatted, timestamp: new Date() }]
                )
              }
              break

            // Booking confirmed — show confirmation in left panel, clear all slot pills
            case 'confirmed':
              if (event.confirmed) {
                onPatientUpdate({ bookingConfirmed: true })
                onBookingConfirmed(
                    event.confirmed.appointmentId,
                    event.confirmed.slotLabel,
                )
                // Remove slot pills from all messages — appointment is booked
                setMessages(prev => prev.map(m => ({ ...m, slots: undefined })))
                // Reset guards so patient can book a second appointment
                slotPickedRef.current = false
                doctorPickedRef.current = false
              }
              break

            // Booking failed — slot was taken. Reset state and attach fresh pills to current message
            case 'booking_failed':
              slotPickedRef.current = false
              if (event.slots && event.slots.length > 0) {
                const failedSlots = event.slots!.map(s => ({
                  id: s.id,
                  doctorId: event.doctorId ?? '',
                  label: s.label,
                  dayLabel: s.label.split(' · ')[0] ?? s.label,
                  timeLabel: s.label.split(' · ')[1] ?? '',
                  datetime: '',
                  available: true,
                }))
                setMessages(prev =>
                  prev.some(m => m.id === ariaId)
                    ? prev.map(m => m.id === ariaId ? { ...m, slots: failedSlots } : m)
                    : [...prev, { id: ariaId, role: 'assistant' as const, content: '', slots: failedSlots, timestamp: new Date() }]
                )
              }
              break

            case 'done':
              setIsTyping(false)
              break

            case 'error':
              throw new Error(event.error ?? 'Stream error')
          }
        }
      }

    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'AbortError') return

      console.error('[ChatInterface]', err)
      const errMsg = "I'm sorry, something went wrong. Please try again, or call us at (401) 555-0192."
      setMessages(prev =>
        prev.some(m => m.id === ariaId)
          ? prev.map(m => m.id === ariaId ? { ...m, content: errMsg } : m)
          : [...prev, { id: ariaId, role: 'assistant' as const, content: errMsg, timestamp: new Date() }]
      )
      setIsTyping(false)
    }
  }, [messages, patientContext, activeNavTab, isTyping, setMessages,
      setIsTyping, onPatientUpdate, onBookingConfirmed])

  // Keep ref in sync so pendingMessage effect always calls the latest sendMessage
  useEffect(() => {
    sendMessageRef.current = sendMessage
  }, [sendMessage])

  // Fire pending message injected from Specialists panel click
  useEffect(() => {
    if (pendingMessage && pendingMessage !== prevPendingRef.current) {
      prevPendingRef.current = pendingMessage
      sendMessageRef.current?.(pendingMessage)
      onPendingMessageSent?.()
    }
  }, [pendingMessage, onPendingMessageSent])

  // ─── Doctor selection ──────────────────────────────────────────────────────

  function handleDoctorSelect(doctor: DoctorOption) {
    doctorPickedRef.current = true
    setMessages(prev => prev.map(m => ({ ...m, doctorOptions: undefined })))
    onPatientUpdate({
      matchedDoctorId: doctor.id,
      matchedDoctorName: doctor.name,
      matchedSpecialty: doctor.specialty as Specialty,
    })
    sendMessage(`I'd like to see ${doctor.name}`)
  }

  // ─── Slot selection ────────────────────────────────────────────────────────

  function handleSlotSelect(slot: SlotOption) {
    slotPickedRef.current = true  // block any future slot pills synchronously
    onPatientUpdate({
      selectedSlotId: slot.id,
      selectedSlotLabel: slot.label,
      matchedDoctorId: slot.doctorId,
    })
    sendMessage(`I'd like ${slot.label}`)
  }

  // ─── Input handlers ────────────────────────────────────────────────────────

  function handleKey(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      const val = inputRef.current?.value ?? ''
      if (inputRef.current) inputRef.current.value = ''
      sendMessage(val)
    }
  }

  function handleSend() {
    const val = inputRef.current?.value ?? ''
    if (inputRef.current) inputRef.current.value = ''
    sendMessage(val)
  }

  // ─── Render ────────────────────────────────────────────────────────────────

  const initials = getInitials(patientContext.name)

  return (
    <div
      // typing-active adds blue glow when Aria is responding
      className={`chat-card${isTyping ? ' typing-active' : ''}${mobileChatOpen ? ' open' : ''}`}
      style={{ animation: 'fU .5s .04s var(--ease) both' }}
    >
      {/* Mobile drag handle */}
      <div className="drag-handle">
        <div className="handle-bar" />
      </div>

      {/* Chat header */}
      <div className="chat-top">
        <div className="aria-row">
          <div className="aria-av">Ar</div>
          <div>
            <div className="aria-n">Aria</div>
            <div className="aria-sub">● Online · Kyron Medical</div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <VoiceHandoffButton
            messages={messages}
            patientContext={patientContext}
            callState={callState}
            setCallState={setCallState}
          />
          <div
            className="xbtn"
            onClick={() => setMobileChatOpen(false)}
            role="button"
            aria-label="Close chat"
          >
            ✕
          </div>
        </div>
      </div>

      {/* Messages */}
      <div className="msgs" ref={msgsRef}>
        {messages.map((msg, i) => (
          <MessageBubble
            key={msg.id}
            message={msg}
            initials={initials}
            delay={i < 3 ? i * 0.1 : 0}
            onSlotSelect={handleSlotSelect}
            onDoctorSelect={handleDoctorSelect}
            isTyping={isTyping}
          />
        ))}

        {/* Typing indicator — shows only while waiting for first token/pill */}
        {isTyping && messages[messages.length - 1]?.role !== 'assistant' && (
          <div className="msg">
            <div className="mav">Ar</div>
            <div className="typing-bub">
              <div className="td" />
              <div className="td" />
              <div className="td" />
            </div>
          </div>
        )}
      </div>

      {/* Input row */}
      <div className="inp-row">
        <input
          ref={inputRef}
          className="inp"
          placeholder="Type a message…"
          onKeyDown={handleKey}
          disabled={isTyping}
          autoComplete="off"
          aria-label="Message Aria"
        />
        <button
          className="sbtn"
          onClick={handleSend}
          disabled={isTyping}
          aria-label="Send message"
        >
          <svg
            width="13"
            height="13"
            viewBox="0 0 24 24"
            fill="none"
            stroke="white"
            strokeWidth="2.4"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <line x1="22" y1="2" x2="11" y2="13" />
            <polygon points="22 2 15 22 11 13 2 9 22 2" />
          </svg>
        </button>
      </div>
    </div>
  )
}


// 'use client'

// import { useRef, useEffect, useCallback } from 'react'
// import type { Message, PatientContext, SlotOption, CallState } from '@/types'
// import MessageBubble from './MessageBubble'
// import VoiceHandoffButton from './VoiceHandoffButton'

// type NavTab = 'Schedule' | 'Prescriptions' | 'Locations'

// interface Props {
//   messages: Message[]
//   setMessages: React.Dispatch<React.SetStateAction<Message[]>>
//   patientContext: PatientContext
//   onPatientUpdate: (update: Partial<PatientContext>) => void
//   onBookingConfirmed: (appointmentId: string, slotLabel: string) => void
//   isTyping: boolean
//   setIsTyping: (v: boolean) => void
//   callState: CallState
//   setCallState: (s: CallState) => void
//   mobileChatOpen: boolean
//   setMobileChatOpen: (v: boolean) => void
//   activeNavTab: NavTab
// }

// // Greeting message per nav tab
// const TAB_GREETINGS: Record<NavTab, string> = {
//   Schedule: "Hi! I'm Aria, your Kyron Medical assistant. I can help you schedule an appointment, check on a prescription, or find office hours.\n\nWhat brings you in today?",
//   Prescriptions: "Hi! I'm Aria from Kyron Medical. I can help you with a prescription refill inquiry.\n\nCould I have your full name and date of birth to get started?",
//   Locations: "Hi! I'm Aria from Kyron Medical. I can help you with our office locations and hours.\n\nAre you looking for our Providence or Cranston office — or both?",
// }

// function generateId(): string {
//   return Math.random().toString(36).slice(2, 9)
// }

// function getInitials(name?: string): string {
//   if (!name) return 'P'
//   const parts = name.trim().split(' ')
//   if (parts.length === 1) return parts[0][0].toUpperCase()
//   return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
// }

// export default function ChatInterface({
//   messages,
//   setMessages,
//   patientContext,
//   onPatientUpdate,
//   onBookingConfirmed,
//   isTyping,
//   setIsTyping,
//   callState,
//   setCallState,
//   mobileChatOpen,
//   setMobileChatOpen,
//   activeNavTab,
// }: Props) {
//   const msgsRef   = useRef<HTMLDivElement>(null)
//   const inputRef  = useRef<HTMLInputElement>(null)
//   const abortRef  = useRef<AbortController | null>(null)

//   // Scroll to bottom whenever messages or typing state changes
//   useEffect(() => {
//     const el = msgsRef.current
//     if (el) el.scrollTop = el.scrollHeight
//   }, [messages, isTyping])

//   // Focus input when mobile chat opens
//   useEffect(() => {
//     if (mobileChatOpen) {
//       setTimeout(() => inputRef.current?.focus(), 380)
//     }
//   }, [mobileChatOpen])

//   const sendMessage = useCallback(async (text: string) => {
//     if (!text.trim() || isTyping) return

//     const userMsg: Message = {
//       id: generateId(),
//       role: 'user',
//       content: text.trim(),
//       timestamp: new Date(),
//     }

//     setMessages(prev => [...prev, userMsg])
//     setIsTyping(true)

//     // Cancel any in-flight request
//     abortRef.current?.abort()
//     abortRef.current = new AbortController()

//     try {
//       const res = await fetch('/api/chat', {
//         method: 'POST',
//         headers: { 'Content-Type': 'application/json' },
//         signal: abortRef.current.signal,
//         body: JSON.stringify({
//           messages: [...messages, userMsg].map(m => ({
//             role: m.role,
//             content: m.content,
//           })),
//           patientContext,
//           activeTab: activeNavTab,
//         }),
//       })

//       if (!res.ok) throw new Error(`API ${res.status}`)

//       const data = await res.json()

//       // Apply patient field updates from tool calls
//       if (data.patientUpdate && Object.keys(data.patientUpdate).length > 0) {
//         onPatientUpdate(data.patientUpdate)
//       }

//       // Handle booking confirmation
//       if (data.booking?.success) {
//         onPatientUpdate({
//           bookingConfirmed: true,
//           appointmentId: data.booking.appointmentId,
//           selectedSlotLabel: data.booking.slotLabel,
//         })
//         onBookingConfirmed(data.booking.appointmentId, data.booking.slotLabel)
//       }

//       const assistantMsg: Message = {
//         id: generateId(),
//         role: 'assistant',
//         content: data.text,
//         slots: data.slots ?? [],
//         timestamp: new Date(),
//       }

//       setMessages(prev => [...prev, assistantMsg])

//     } catch (err: unknown) {
//       if (err instanceof Error && err.name === 'AbortError') return

//       console.error('[Chat]', err)
//       const errMsg: Message = {
//         id: generateId(),
//         role: 'assistant',
//         content: "I'm sorry, something went wrong on my end. Please try again, or call us at (401) 555-0192.",
//         timestamp: new Date(),
//       }
//       setMessages(prev => [...prev, errMsg])
//     } finally {
//       setIsTyping(false)
//     }
//   }, [messages, patientContext, activeNavTab, isTyping, setMessages, setIsTyping, onPatientUpdate, onBookingConfirmed])

//   function handleSlotSelect(slot: SlotOption) {
//     // Update provider panel selection
//     onPatientUpdate({
//       selectedSlotId: slot.id,
//       selectedSlotLabel: slot.label,
//       matchedDoctorId: slot.doctorId,
//     })
//     // Send as a user message so Aria can confirm
//     sendMessage(`I'd like ${slot.label}`)
//   }

//   function handleKey(e: React.KeyboardEvent<HTMLInputElement>) {
//     if (e.key === 'Enter' && !e.shiftKey) {
//       e.preventDefault()
//       const val = inputRef.current?.value ?? ''
//       if (inputRef.current) inputRef.current.value = ''
//       sendMessage(val)
//     }
//   }

//   function handleSend() {
//     const val = inputRef.current?.value ?? ''
//     if (inputRef.current) inputRef.current.value = ''
//     sendMessage(val)
//   }

//   const initials = getInitials(patientContext.name)

//   return (
//     <div
//       className={`chat-card${mobileChatOpen ? ' open' : ''}`}
//       style={{ animation: 'fU .5s .04s var(--ease) both' }}
//     >
//       {/* Mobile drag handle */}
//       <div className="drag-handle">
//         <div className="handle-bar" />
//       </div>

//       {/* Chat header */}
//       <div className="chat-top">
//         <div className="aria-row">
//           <div className="aria-av">Ar</div>
//           <div>
//             <div className="aria-n">Aria</div>
//             <div className="aria-sub">● Online · Kyron Medical</div>
//           </div>
//         </div>

//         <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
//           <VoiceHandoffButton
//             messages={messages}
//             patientContext={patientContext}
//             callState={callState}
//             setCallState={setCallState}
//           />
//           <div
//             className="xbtn"
//             onClick={() => setMobileChatOpen(false)}
//             role="button"
//             aria-label="Close chat"
//           >
//             ✕
//           </div>
//         </div>
//       </div>

//       {/* Messages */}
//       <div className="msgs" ref={msgsRef}>
//         {messages.map((msg, i) => (
//           <MessageBubble
//             key={msg.id}
//             message={msg}
//             initials={initials}
//             delay={i < 3 ? i * 0.1 : 0}
//             onSlotSelect={handleSlotSelect}
//           />
//         ))}

//         {/* Typing indicator */}
//         {isTyping && (
//           <div className="msg">
//             <div className="mav">Ar</div>
//             <div className="typing-bub">
//               <div className="td" />
//               <div className="td" />
//               <div className="td" />
//             </div>
//           </div>
//         )}
//       </div>

//       {/* Input row */}
//       <div className="inp-row">
//         <input
//           ref={inputRef}
//           className="inp"
//           placeholder="Type a message…"
//           onKeyDown={handleKey}
//           disabled={isTyping}
//           autoComplete="off"
//           aria-label="Message Aria"
//         />
//         <button
//           className="sbtn"
//           onClick={handleSend}
//           disabled={isTyping}
//           aria-label="Send message"
//         >
//           <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
//             <line x1="22" y1="2" x2="11" y2="13" />
//             <polygon points="22 2 15 22 11 13 2 9 22 2" />
//           </svg>
//         </button>
//       </div>
//     </div>
//   )
// }
