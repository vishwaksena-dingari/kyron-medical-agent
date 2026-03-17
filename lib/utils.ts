// ─── Phone normalization ──────────────────────────────────────────────────────

// export function normalizePhone(phone: string): string {
//   const digits = phone.replace(/\D/g, '')
//   if (digits.length === 10) return `+1${digits}`
//   if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`
//   return `+1${digits.slice(-10)}`
// }

// export function formatPhoneDisplay(phone: string): string {
//   const digits = phone.replace(/\D/g, '').slice(-10)
//   if (digits.length !== 10) return phone
//   return `+1 (${digits.slice(0,3)}) ${digits.slice(3,6)}-${digits.slice(6)}`
// }

export { normalizePhone, formatPhoneDisplay } from '@/lib/phone'

// ─── Date / time ─────────────────────────────────────────────────────────────

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
const DAYS_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

export function formatDateForVoice(isoString: string): string {
    const d = new Date(isoString)
    const h = d.getHours()
    const m = d.getMinutes()
    const ampm = h >= 12 ? 'PM' : 'AM'
    const h12 = h % 12 || 12
    const timeStr = m === 0 ? `${h12} ${ampm}` : `${h12}:${pad(m)} ${ampm}`
    return `${DAYS[d.getDay()]}, ${MONTHS[d.getMonth()]} ${ordinal(d.getDate())} at ${timeStr}`
}

export function formatSlotLabel(date: Date): string {
    const h = date.getHours()
    const m = date.getMinutes()
    const ampm = h >= 12 ? 'PM' : 'AM'
    const h12 = h % 12 || 12
    const timeStr = `${h12}:${pad(m)} ${ampm}`
    return `${DAYS_SHORT[date.getDay()]} ${MONTHS_SHORT[date.getMonth()]} ${date.getDate()} · ${timeStr}`
}

export function formatDayLabel(date: Date): string {
    return `${DAYS_SHORT[date.getDay()]} ${MONTHS_SHORT[date.getMonth()]} ${date.getDate()}`
}

export function formatTimeLabel(date: Date): string {
    const h = date.getHours()
    const m = date.getMinutes()
    const ampm = h >= 12 ? 'PM' : 'AM'
    const h12 = h % 12 || 12
    return `${h12}:${pad(m)} ${ampm}`
}

export function formatDateShort(isoString: string): string {
    const d = new Date(isoString)
    return `${MONTHS_SHORT[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`
}

// ─── ICS generation ───────────────────────────────────────────────────────────

export function generateICS(params: {
    appointmentId: string
    patientName: string
    doctorName: string
    specialty: string
    datetime: string
    durationMinutes?: number
    address: string
}): string {
    const start = new Date(params.datetime)
    const end = new Date(start.getTime() + (params.durationMinutes ?? 30) * 60000)

    const fmtICS = (d: Date) =>
        d.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z'

    const now = fmtICS(new Date())

    return [
        'BEGIN:VCALENDAR',
        'VERSION:2.0',
        'PRODID:-//Kyron Medical//Patient Portal//EN',
        'CALSCALE:GREGORIAN',
        'METHOD:REQUEST',
        'BEGIN:VEVENT',
        `UID:${params.appointmentId}@kyronmedical.com`,
        `DTSTAMP:${now}`,
        `DTSTART:${fmtICS(start)}`,
        `DTEND:${fmtICS(end)}`,
        `SUMMARY:Appointment with ${params.doctorName}`,
        `DESCRIPTION:Kyron Medical appointment for ${params.patientName}\\n${params.doctorName} — ${params.specialty}\\nConfirmation #: ${params.appointmentId}`,
        `LOCATION:${params.address}`,
        'STATUS:CONFIRMED',
        'SEQUENCE:0',
        `ORGANIZER;CN=Kyron Medical:mailto:appointments@kyronmedical.com`,
        'END:VEVENT',
        'END:VCALENDAR',
    ].join('\r\n')
}

// ─── ID generation ────────────────────────────────────────────────────────────

export function generateAppointmentId(): string {
    const ts = Date.now().toString(36).toUpperCase().slice(-5)
    const rand = Math.random().toString(36).toUpperCase().slice(2, 5)
    return `KM-${ts}${rand}`
}

// ─── Chat transcript ──────────────────────────────────────────────────────────

export function buildChatTranscript(
    messages: Array<{ role: string; content: string }>
): string {
    return messages
        .filter(m => m.content.trim())
        .map(m => `${m.role === 'user' ? 'Patient' : 'Aria'}: ${m.content}`)
        .join('\n')
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function pad(n: number): string {
    return n.toString().padStart(2, '0')
}

function ordinal(n: number): string {
    const s = ['th', 'st', 'nd', 'rd']
    const v = n % 100
    return n + (s[(v - 20) % 10] || s[v] || s[0])
}

export function truncateTranscript(transcript: string, maxChars = 3000): string {
    if (transcript.length <= maxChars) return transcript
    return '...[earlier context truncated]\n' + transcript.slice(-maxChars)
}
