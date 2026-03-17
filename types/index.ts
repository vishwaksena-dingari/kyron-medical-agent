// ─── Doctor types ─────────────────────────────────────────────────────────────

export type Specialty =
    | 'cardiology'
    | 'orthopedics'
    | 'gastroenterology'
    | 'neurology'
    | 'dermatology'

export interface TimeSlot {
    id: string
    doctorId: string
    datetime: string     // ISO string
    label: string        // "Mon Apr 7 · 8:00 AM"
    dayLabel: string     // "Mon Apr 7"
    timeLabel: string    // "8:00 AM"
    isBooked: boolean
}

// export interface Doctor {
//     id: string
//     name: string
//     title: string
//     specialty: Specialty
//     emoji: string
//     bio: string
//     location: string
//     address: string
//     hospital: string
//     languages: string[]
//     acceptedInsurance: string[]
//     rating: number
//     yearsExperience: number
//     slots: TimeSlot[]
// }

export interface Doctor {
    id: string
    name: string
    title: string
    specialty: Specialty
    bio: string
    location: string
    address: string
    hospital: string
    languages: string[]
    acceptedInsurance: string[]
    rating: number
    yearsExperience: number
    slots: TimeSlot[]
}

// ─── Patient state ─────────────────────────────────────────────────────────────

// Used by page.tsx and all components
export interface PatientContext {
    name?: string
    dob?: string
    phone?: string
    email?: string
    reason?: string
    matchedSpecialty?: Specialty
    matchedDoctorId?: string
    matchedDoctorName?: string
    selectedSlotId?: string
    selectedSlotLabel?: string
    bookingConfirmed?: boolean
    appointmentId?: string
    smsOptIn?: boolean
}

// Used by API routes (initiate-call, vapi-inbound)
export interface PatientInfo {
    name: string
    firstName: string
    phone: string
    email: string
    dob: string
    reason: string
    matchedDoctorId: string | null
    matchedDoctorName: string | null
    selectedSlotId: string | null
    appointmentLabel: string
    confirmationStatus: 'none' | 'pending' | 'sent'
    confirmationId: string | null
    smsOptIn: boolean
}

// Used internally by KyronApp / streaming handler
export interface PatientIntake {
    name: string
    firstName: string
    phone: string
    email: string
    dob: string
    reason: string
    matchedDoctorId: string | null
    matchedSpecialty: Specialty | null
    selectedSlotId: string | null
    selectedSlotLabel: string | null
    smsOptIn: boolean
    appointmentConfirmed: boolean
}

export const EMPTY_PATIENT: PatientIntake = {
    name: '',
    firstName: '',
    phone: '',
    email: '',
    dob: '',
    reason: '',
    matchedDoctorId: null,
    matchedSpecialty: null,
    selectedSlotId: null,
    selectedSlotLabel: null,
    smsOptIn: false,
    appointmentConfirmed: false,
}

// ─── Messages ──────────────────────────────────────────────────────────────────

// Used by kyron-medical components
export interface Message {
    id: string
    role: 'user' | 'assistant'
    content: string
    slots?: SlotOption[]
    doctorOptions?: DoctorOption[]
    timestamp: Date
}

export interface SlotOption {
    id: string
    doctorId: string
    label: string
    dayLabel: string
    timeLabel: string
    datetime: string
    available: boolean
}

export interface DoctorOption {
    id: string
    name: string
    title: string
    specialty: string
    rating: number
    yearsExperience: number
    location: string
}

// ─── SSE streaming events ──────────────────────────────────────────────────────
// Used by ChatInterface.tsx to parse events from /api/chat

// export interface StreamEvent {
//     type: 'text' | 'intake_update' | 'slots' | 'confirmed' | 'done' | 'error'
//     text?: string
//     field?: string
//     value?: string | boolean | null
//     doctorId?: string
//     doctorName?: string
//     slots?: Array<{ id: string; label: string }>
//     confirmed?: {
//         appointmentId: string
//         doctorName: string
//         slotLabel: string
//         email: string
//     }
//     error?: string
// }

export interface StreamEvent {
    type: 'text' | 'intake_update' | 'slots' | 'confirmed' | 'booking_failed' | 'doctors' | 'done' | 'error'
    text?: string
    patientUpdate?: Partial<PatientContext>
    doctorId?: string
    doctorName?: string
    slots?: Array<{ id: string; label: string }>
    doctors?: DoctorOption[]
    specialty?: string
    confirmed?: {
        appointmentId: string
        doctorName: string
        slotLabel: string
        email: string
    }
    error?: string
}

// ─── Voice call state ──────────────────────────────────────────────────────────

export type CallState = 'idle' | 'loading' | 'ringing' | 'error'

// ─── API shapes ────────────────────────────────────────────────────────────────

export interface ChatRequest {
    messages: Array<{ role: 'user' | 'assistant'; content: string }>
    patientContext: PatientContext
    activeTab?: string
}

export interface ChatResponse {
    text: string
    slots?: SlotOption[]
    booking?: BookingResult
    patientUpdate?: Partial<PatientContext>
    error?: string
}

export interface BookingResult {
    success: boolean
    appointmentId: string
    doctorName: string
    specialty: string
    slotLabel: string
    slotDatetime: string
    address: string
    error?: string
}

// ─── Vercel KV caller session ──────────────────────────────────────────────────

export interface CallerSession {
    phone: string
    patientName: string
    dob?: string
    email?: string
    appointmentReason?: string
    matchedDoctorId?: string
    matchedDoctorName?: string
    bookedSlotLabel?: string
    bookingConfirmed?: boolean
    appointmentId?: string
    chatTranscript: string
    callTranscriptSnippet?: string
    lastCallId?: string
    lastSeenAt: number
    sessionCount: number
}

// ─── Office ────────────────────────────────────────────────────────────────────

export interface OfficeLocation {
    name: string
    address: string
    hours: string
    phone: string
}



// // ─── Core message types ───────────────────────────────────────────────────────

// export interface Message {
//   id: string
//   role: 'user' | 'assistant'
//   content: string
//   slots?: SlotOption[]
//   timestamp: Date
// }

// export interface SlotOption {
//   id: string
//   doctorId: string
//   label: string       // "Mon Apr 7 · 8:00 AM"
//   dayLabel: string    // "Mon Apr 7"
//   timeLabel: string   // "8:00 AM"
//   datetime: string    // ISO string
//   available: boolean
// }

// // ─── Patient ──────────────────────────────────────────────────────────────────

// export interface PatientContext {
//   name?: string
//   dob?: string
//   phone?: string
//   email?: string
//   reason?: string
//   matchedSpecialty?: string
//   matchedDoctorId?: string
//   matchedDoctorName?: string
//   selectedSlotId?: string
//   selectedSlotLabel?: string
//   bookingConfirmed?: boolean
//   appointmentId?: string
//   smsOptIn?: boolean
// }

// // ─── Doctor / Scheduling ──────────────────────────────────────────────────────

// export type Specialty =
//   | 'cardiology'
//   | 'orthopedics'
//   | 'gastroenterology'
//   | 'neurology'
//   | 'dermatology'

// export interface TimeSlot {
//   id: string
//   doctorId: string
//   datetime: string    // ISO string
//   label: string       // "Mon Apr 7 · 8:00 AM"
//   dayLabel: string    // "Mon Apr 7"
//   timeLabel: string   // "8:00 AM"
//   isBooked: boolean
// }

// export interface Doctor {
//   id: string
//   name: string
//   title: string
//   specialty: Specialty
//   emoji: string
//   bio: string
//   location: string
//   address: string
//   hospital: string
//   languages: string[]
//   acceptedInsurance: string[]
//   rating: number
//   yearsExperience: number
//   slots: TimeSlot[]
// }

// // ─── API response ─────────────────────────────────────────────────────────────

// export interface ChatResponse {
//   text: string
//   slots?: SlotOption[]
//   booking?: BookingResult
//   patientUpdate?: Partial<PatientContext>
//   error?: string
// }

// export interface BookingResult {
//   success: boolean
//   appointmentId: string
//   doctorName: string
//   specialty: string
//   slotLabel: string
//   slotDatetime: string
//   address: string
//   error?: string
// }

// // ─── Voice handoff ────────────────────────────────────────────────────────────

// export type CallState = 'idle' | 'loading' | 'ringing' | 'error'

// export interface CallerSession {
//   phone: string
//   patientName: string
//   dob?: string
//   email?: string
//   appointmentReason?: string
//   matchedDoctorId?: string
//   matchedDoctorName?: string
//   bookedSlotLabel?: string
//   bookingConfirmed?: boolean
//   appointmentId?: string
//   chatTranscript: string
//   callTranscriptSnippet?: string
//   lastCallId?: string
//   lastSeenAt: number
//   sessionCount: number
// }

// // ─── Office ───────────────────────────────────────────────────────────────────

// export interface OfficeLocation {
//   name: string
//   address: string
//   hours: string
//   phone: string
// }
