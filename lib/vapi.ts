import type { CallerSession, PatientContext } from '@/types'
import type { Message } from '@/types'
import { normalizePhone, buildChatTranscript, truncateTranscript } from '@/lib/utils'

// ─── Vapi API ─────────────────────────────────────────────────────────────────

export async function initiateOutboundCall(params: {
  phone: string
  patient: PatientContext
  messages: Message[]
  existingSession: CallerSession | null
}): Promise<{ callId: string; status: string }> {
  const { phone, patient, messages, existingSession } = params

  const e164 = normalizePhone(phone)
  const transcript = buildChatTranscript(
    messages.map(m => ({ role: m.role, content: m.content }))
  )
  const truncated = truncateTranscript(transcript, 3000)

  const systemPrompt = buildHandoffSystemPrompt(patient, truncated, existingSession)
  const firstMessage = buildFirstMessage(patient)

  const response = await fetch('https://api.vapi.ai/call/phone', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.VAPI_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      phoneNumberId: process.env.VAPI_PHONE_NUMBER_ID,
      customer: {
        number: e164,
        name: patient.name ?? undefined,
      },
      assistantId: process.env.VAPI_ASSISTANT_ID,
      assistantOverrides: {
        firstMessage,
        model: {
          provider: 'anthropic',
          model: 'claude-sonnet-4-20250514',
          temperature: 0.4,
          messages: [{ role: 'system', content: systemPrompt }],
        },
        metadata: {
          patientPhone: e164,
          patientName: patient.name ?? null,
          patientEmail: patient.email ?? null,
          appointmentReason: patient.reason ?? null,
          matchedDoctorId: patient.matchedDoctorId ?? null,
          matchedDoctorName: patient.matchedDoctorName ?? null,
          bookedSlotLabel: patient.selectedSlotLabel ?? null,
          bookingConfirmed: patient.bookingConfirmed ?? false,
          callSource: 'web-chat-handoff',
          chatMessageCount: messages.length,
        },
      },
    }),
  })

  if (!response.ok) {
    const err = await response.json().catch(() => ({}))
    throw new Error(`Vapi error ${response.status}: ${JSON.stringify(err)}`)
  }

  const data = await response.json()
  return { callId: data.id, status: data.status ?? 'queued' }
}

// ─── System prompt builder ────────────────────────────────────────────────────

function buildHandoffSystemPrompt(
  patient: PatientContext,
  transcript: string,
  existing: CallerSession | null
): string {
  const firstName = patient.name?.split(' ')[0] ?? 'the patient'

  return `You are Aria, a warm and helpful virtual assistant for Kyron Medical. You are now on a PHONE CALL with ${firstName}.

This call was initiated from a web chat — the patient clicked "Continue by phone" to continue the same conversation by voice.

CRITICAL: You are continuing an existing conversation. Greet the patient by first name, briefly acknowledge where you left off, and continue seamlessly. Do not start from scratch.

--- FULL CHAT TRANSCRIPT ---
${transcript}
--- END TRANSCRIPT ---

CURRENT STATUS:
${patient.reason ? `• Reason for visit: ${patient.reason}` : '• Reason for visit: not yet collected'}
${patient.matchedDoctorName ? `• Matched provider: ${patient.matchedDoctorName}` : '• Provider: not yet matched'}
${patient.selectedSlotLabel ? `• Selected slot: ${patient.selectedSlotLabel}` : '• Appointment: not yet booked'}
${patient.bookingConfirmed ? '• Appointment: CONFIRMED ✓' : ''}
${patient.email ? `• Email on file: ${patient.email}` : ''}

${existing ? `RETURNING PATIENT NOTE: This patient has contacted us ${existing.sessionCount} time(s) before.` : ''}

VOICE-SPECIFIC RULES:
• Keep responses SHORT — 2 to 3 sentences max per turn. This is voice, not text.
• Speak naturally. No bullet points, no lists, no markdown.
• Spell out times: "nine thirty AM" not "9:30 AM"
• Spell out dates: "Thursday, April tenth" not "2026-04-10"
• Use brief affirmations: "Got it", "Sure", "Of course" — vary them, don't repeat
• Never say "as I mentioned in the chat" — just speak naturally as if the context is in your memory
• Never read out IDs, ISO timestamps, or raw data
• Before confirming a booking say: "Just to confirm — that's [name] with [doctor] on [date] at [time]. Does that sound right?"
• When looking something up say: "Let me check that for you, just one moment." to fill silence naturally

HARD SAFETY RULES (identical to chat):
• Never provide medical advice, diagnoses, or clinical guidance. Ever.
• If clinical question: "I'm not able to offer medical guidance, but I can schedule you with one of our providers."
• If emergency: "Please hang up and call 911 or go to your nearest emergency room right away."
• Never speculate about what a doctor might say.`
}

// ─── First message builder ────────────────────────────────────────────────────

function buildFirstMessage(
  patient: PatientContext
): string {
  const first = patient.name?.split(' ')[0] ?? 'there'

  if (patient.bookingConfirmed && patient.selectedSlotLabel) {
    return `Hi ${first}, it's Aria from Kyron Medical. Your appointment with ${patient.matchedDoctorName ?? 'your provider'} is all confirmed for ${patient.selectedSlotLabel}. Is there anything else I can help you with?`
  }

  if (patient.selectedSlotLabel && !patient.bookingConfirmed) {
    return `Hi ${first}, it's Aria from Kyron Medical — happy to continue. I had ${patient.selectedSlotLabel} selected for you with ${patient.matchedDoctorName ?? 'your provider'}. Shall we confirm that?`
  }

  if (patient.matchedDoctorName) {
    return `Hi ${first}, it's Aria from Kyron Medical. I was just helping you find an appointment with ${patient.matchedDoctorName} — let's get that booked for you right now.`
  }

  if (patient.reason) {
    return `Hi ${first}, it's Aria from Kyron Medical. I have your reason for the visit — let me pull up the right provider for you.`
  }

  return `Hi ${first}, it's Aria from Kyron Medical. Thanks for calling in — happy to pick up right where we left off.`
}

// ─── Returning caller system prompt ──────────────────────────────────────────

export function buildReturningCallerPrompt(
  session: CallerSession
): { systemPrompt: string; firstMessage: string } {
  const firstName = session.patientName.split(' ')[0]
  const hoursSince = (Date.now() - session.lastSeenAt) / (1000 * 60 * 60)
  const isRecent = hoursSince < 2
  const isToday = hoursSince < 24

  const systemPrompt = `You are Aria, a warm and helpful virtual assistant for Kyron Medical.

You recognize this patient from a previous interaction.

PATIENT ON FILE:
• Name: ${session.patientName}
• DOB: ${session.dob ?? 'not on file'}
• Email: ${session.email ?? 'not on file'}
• Times contacted: ${session.sessionCount}
• Last contact: ${Math.round(hoursSince)} hour(s) ago

PREVIOUS CONVERSATION:
${session.chatTranscript ? `Web chat:\n${session.chatTranscript}\n` : ''}${session.callTranscriptSnippet ? `Previous call:\n${session.callTranscriptSnippet}` : ''}

CURRENT STATUS:
${session.appointmentReason ? `• Reason: ${session.appointmentReason}` : '• Reason: not yet collected'}
${session.matchedDoctorName ? `• Provider: ${session.matchedDoctorName}` : ''}
${session.bookedSlotLabel ? `• Appointment: ${session.bookedSlotLabel}` : '• Appointment: not yet booked'}
${session.bookingConfirmed ? '• Status: CONFIRMED ✓' : ''}

BEHAVIOR:
${isRecent
    ? `This patient likely got disconnected — pick up EXACTLY where you left off. Reference what you were just discussing. If mid-booking, continue the booking flow.`
    : `This patient is returning. Greet them warmly, then ask how you can help.`}

VOICE RULES:
• 2–3 sentences max per turn
• Spell out times and dates fully
• Never give medical advice
• If emergency: "Please call 911."
• Never read out IDs or raw data`

  const firstMessage = isRecent && !session.bookingConfirmed
    ? `Hi ${firstName}, it's Aria from Kyron Medical — looks like we may have gotten cut off. Let me pick up right where we left off.`
    : session.bookingConfirmed
      ? `Welcome back, ${firstName}! It's Aria from Kyron Medical. Are you calling about your upcoming appointment, or is there something else I can help you with?`
      : isToday
        ? `Hi ${firstName}, it's Aria from Kyron Medical — good to hear from you again. How can I help you today?`
        : `Welcome back, ${firstName}! It's Aria from Kyron Medical. How can I help you today?`

  return { systemPrompt, firstMessage }
}
