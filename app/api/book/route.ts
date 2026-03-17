import { NextResponse } from 'next/server'
import { bookSlot, getDoctorById, getSlotById } from '@/lib/doctors'
import { sendConfirmationEmail } from '@/lib/resend'
import { generateAppointmentId } from '@/lib/utils'

// Standalone booking endpoint — called directly if needed
// (Primary booking flow goes through /api/chat tool calling,
//  this is a safety fallback and for direct UI booking from the provider panel)

interface BookRequest {
  slotId: string
  doctorId: string
  patientName: string
  patientEmail: string
  patientPhone: string
  patientDob?: string
}

export async function POST(req: Request) {
  try {
    const body: BookRequest = await req.json()
    const { slotId, doctorId, patientName, patientEmail, patientPhone } = body

    if (!slotId || !doctorId || !patientName || !patientEmail || !patientPhone) {
      return NextResponse.json(
        { error: 'Missing required fields: slotId, doctorId, patientName, patientEmail, patientPhone' },
        { status: 400 }
      )
    }

    const doctor = getDoctorById(doctorId)
    if (!doctor) {
      return NextResponse.json({ error: 'Doctor not found' }, { status: 404 })
    }

    const slot = getSlotById(slotId)
    if (!slot) {
      return NextResponse.json({ error: 'Slot not found' }, { status: 404 })
    }

    if (slot.isBooked) {
      return NextResponse.json(
        { error: 'That slot is no longer available. Please choose another time.' },
        { status: 409 }
      )
    }

    const booked = bookSlot(slotId)
    if (!booked) {
      return NextResponse.json(
        { error: 'Failed to book slot — it may have just been taken.' },
        { status: 409 }
      )
    }

    const appointmentId = generateAppointmentId()

    // Send email — non-blocking
    sendConfirmationEmail({
      appointmentId,
      patientName,
      patientEmail,
      doctorName: doctor.name,
      specialty: doctor.specialty,
      slotLabel: slot.label,
      slotDatetime: slot.datetime,
      officeAddress: doctor.address,
    }).catch(err => console.error('[/api/book] Email failed:', err))

    return NextResponse.json({
      success: true,
      appointmentId,
      doctorName: doctor.name,
      specialty: doctor.specialty,
      slotLabel: slot.label,
      slotDatetime: slot.datetime,
      address: doctor.address,
    })

  } catch (err) {
    console.error('[/api/book]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
