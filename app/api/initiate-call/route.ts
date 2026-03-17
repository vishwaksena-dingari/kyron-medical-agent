import { NextResponse } from 'next/server'
import type { PatientContext } from '@/types'
import { initiateOutboundCall } from '@/lib/vapi'
import { saveCallerSession, getCallerSession } from '@/lib/kv'
import { normalizePhone, buildChatTranscript } from '@/lib/utils'

interface InitiateCallRequest {
  messages: { role: 'user' | 'assistant'; content: string }[]
  patient: PatientContext
}

export async function POST(req: Request) {
  try {
    const body: InitiateCallRequest = await req.json()
    const { messages, patient } = body

    if (!patient.phone) {
      return NextResponse.json(
        { error: 'Patient phone number is required to initiate a call.' },
        { status: 400 }
      )
    }

    const e164 = normalizePhone(patient.phone)

    // Look up any existing session for this patient
    const existingSession = await getCallerSession(e164).catch(() => null)

    // Save session to KV BEFORE dialing
    // If the call fails, the session is still saved for the next attempt
    const chatTranscript = buildChatTranscript(messages)
    await saveCallerSession(
      e164,
      {
        patientName:       patient.name         ?? '',
        dob:               patient.dob,
        email:             patient.email,
        appointmentReason: patient.reason,
        matchedDoctorId:   patient.matchedDoctorId,
        matchedDoctorName: patient.matchedDoctorName,
        bookedSlotLabel:   patient.selectedSlotLabel,
        bookingConfirmed:  patient.bookingConfirmed ?? false,
        appointmentId:     patient.appointmentId,
        chatTranscript,
      },
      existingSession
    ).catch(err => console.error('[initiate-call] KV save failed (non-fatal):', err))

    // Initiate the Vapi outbound call
    const { callId, status } = await initiateOutboundCall({
      phone: e164,
      patient,
      messages: messages.map(m => ({
        id: '',
        role: m.role,
        content: m.content,
        timestamp: new Date(),
      })),
      existingSession,
    })

    // Store Vapi call ID back to KV so webhook can correlate
    await saveCallerSession(
      e164,
      {
        patientName:       patient.name         ?? '',
        dob:               patient.dob,
        email:             patient.email,
        appointmentReason: patient.reason,
        matchedDoctorId:   patient.matchedDoctorId,
        matchedDoctorName: patient.matchedDoctorName,
        bookedSlotLabel:   patient.selectedSlotLabel,
        bookingConfirmed:  patient.bookingConfirmed ?? false,
        appointmentId:     patient.appointmentId,
        chatTranscript,
        lastCallId: callId,
      },
      existingSession
    ).catch(() => {}) // best-effort

    return NextResponse.json({ success: true, callId, status })

  } catch (err) {
    console.error('[/api/initiate-call]', err)

    const message = err instanceof Error ? err.message : 'Failed to initiate call'
    const isVapiError = message.includes('Vapi error')

    return NextResponse.json(
      {
        error: isVapiError
          ? 'Could not reach the voice system. Please try again or call us at (401) 555-0192.'
          : 'Internal server error.',
      },
      { status: isVapiError ? 502 : 500 }
    )
  }
}
