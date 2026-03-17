import { describe, it, expect } from 'vitest'
import {
    generateICS,
    generateAppointmentId,
    buildChatTranscript,
    truncateTranscript,
} from '@/lib/utils'

describe('generateAppointmentId', () => {
    it('starts with KM-', () => {
        expect(generateAppointmentId()).toMatch(/^KM-/)
    })

    it('generates unique IDs', () => {
        const ids = new Set(Array.from({ length: 20 }, () => generateAppointmentId()))
        expect(ids.size).toBe(20)
    })
})

describe('generateICS', () => {
    const params = {
        appointmentId: 'KM-TEST1',
        patientName: 'John Doe',
        doctorName: 'Dr. Elena Chen',
        specialty: 'cardiology',
        datetime: '2026-04-10T09:00:00.000Z',
        durationMinutes: 30,
        address: '593 Eddy Street, Suite 100, Providence, RI 02903',
    }

    it('contains required iCal fields', () => {
        const ics = generateICS(params)
        expect(ics).toContain('BEGIN:VCALENDAR')
        expect(ics).toContain('BEGIN:VEVENT')
        expect(ics).toContain('END:VEVENT')
        expect(ics).toContain('END:VCALENDAR')
    })

    it('contains the appointment ID as UID', () => {
        const ics = generateICS(params)
        expect(ics).toContain('UID:KM-TEST1@kyronmedical.com')
    })

    it('contains the doctor name in SUMMARY', () => {
        const ics = generateICS(params)
        expect(ics).toContain('SUMMARY:Appointment with Dr. Elena Chen')
    })

    it('contains the office address as LOCATION', () => {
        const ics = generateICS(params)
        expect(ics).toContain('LOCATION:593 Eddy Street')
    })

    it('DTSTART is before DTEND', () => {
        const ics = generateICS(params)
        const start = ics.match(/DTSTART:(\d+T\d+Z)/)?.[1]
        const end = ics.match(/DTEND:(\d+T\d+Z)/)?.[1]
        expect(start).toBeTruthy()
        expect(end).toBeTruthy()
        expect(start! < end!).toBe(true)
    })

    it('uses METHOD:REQUEST for calendar invite', () => {
        const ics = generateICS(params)
        expect(ics).toContain('METHOD:REQUEST')
    })
})

describe('buildChatTranscript', () => {
    it('labels user messages as Patient', () => {
        const t = buildChatTranscript([{ role: 'user', content: 'I have knee pain' }])
        expect(t).toBe('Patient: I have knee pain')
    })

    it('labels assistant messages as Aria', () => {
        const t = buildChatTranscript([{ role: 'assistant', content: 'I can help with that.' }])
        expect(t).toBe('Aria: I can help with that.')
    })

    it('filters out blank messages', () => {
        const t = buildChatTranscript([
            { role: 'user', content: 'Hello' },
            { role: 'assistant', content: '   ' },
        ])
        expect(t).toBe('Patient: Hello')
    })

    it('joins multiple turns with newlines', () => {
        const t = buildChatTranscript([
            { role: 'user', content: 'Hi' },
            { role: 'assistant', content: 'Hello!' },
        ])
        expect(t).toBe('Patient: Hi\nAria: Hello!')
    })
})

describe('truncateTranscript', () => {
    it('returns the transcript unchanged if within limit', () => {
        const t = 'Short message'
        expect(truncateTranscript(t, 3000)).toBe(t)
    })

    it('truncates and adds prefix when over limit', () => {
        const t = 'A'.repeat(4000)
        const result = truncateTranscript(t, 3000)
        expect(result).toContain('[earlier context truncated]')
        expect(result.length).toBeLessThan(4000)
    })

    it('preserves the tail of the transcript', () => {
        const tail = 'IMPORTANT_END'
        const t = 'X'.repeat(3000) + tail
        const result = truncateTranscript(t, 3000)
        expect(result).toContain(tail)
    })
})
