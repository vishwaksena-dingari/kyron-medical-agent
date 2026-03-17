import type { Doctor, TimeSlot, Specialty } from '@/types'
import { formatSlotLabel, formatDayLabel, formatTimeLabel } from '@/lib/utils'
// import { SPECIALTY_ICON } from '@/lib/icons'

// ─── Slot generator ───────────────────────────────────────────────────────────

function pad(n: number): string {
    return n.toString().padStart(2, '0')
}

interface SlotConfig {
    startOffset: number   // days from today to start
    endOffset: number     // days from today to end
    times: { hour: number; minute: number }[]
    skipDays: number[]    // 0=Sun 1=Mon ... 6=Sat
    skipWeekPattern?: number[] // skip these week-numbers mod 4 (simulates busy/vacation)
}

function generateSlots(doctorId: string, config: SlotConfig): TimeSlot[] {
    const slots: TimeSlot[] = []
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    for (let d = config.startOffset; d <= config.endOffset; d++) {
        const date = new Date(today)
        date.setDate(today.getDate() + d)

        if (config.skipDays.includes(date.getDay())) continue

        // Simulate some fully-booked weeks (every 4th cycle)
        const weekIndex = Math.floor(d / 7)
        if (config.skipWeekPattern?.includes(weekIndex % 4)) continue

        for (const { hour, minute } of config.times) {
            const slotDate = new Date(date)
            slotDate.setHours(hour, minute, 0, 0)

            if (slotDate <= new Date()) continue

            const id = `${doctorId}-${slotDate.getFullYear()}${pad(slotDate.getMonth() + 1)}${pad(slotDate.getDate())}-${pad(hour)}${pad(minute)}`

            slots.push({
                id,
                doctorId,
                datetime: slotDate.toISOString(),
                label: formatSlotLabel(slotDate),
                dayLabel: formatDayLabel(slotDate),
                timeLabel: formatTimeLabel(slotDate),
                isBooked: false,
            })
        }
    }

    return slots
}

// ─── Doctors ──────────────────────────────────────────────────────────────────

export const DOCTORS: Doctor[] = [
    {
        id: 'dr-chen',
        name: 'Dr. Elena Chen',
        title: 'MD, FACC',
        specialty: 'cardiology',
        bio: 'Board-certified cardiologist with 15 years of experience in preventive cardiology, heart failure management, and interventional procedures.',
        location: 'Providence, RI',
        address: '593 Eddy Street, Suite 100, Providence, RI 02903',
        hospital: 'Rhode Island Hospital',
        languages: ['English', 'Mandarin'],
        acceptedInsurance: ['Blue Cross', 'Aetna', 'United', 'Cigna'],
        rating: 4.9,
        yearsExperience: 15,
        slots: generateSlots('dr-chen', {
            startOffset: 3,
            endOffset: 52,
            times: [
                { hour: 9, minute: 0 },
                { hour: 9, minute: 30 },
                { hour: 10, minute: 30 },
                { hour: 14, minute: 0 },
                { hour: 14, minute: 30 },
                { hour: 15, minute: 0 },
            ],
            skipDays: [0, 2, 6],     // Skip Sun, Tue (clinic meetings), Sat
            skipWeekPattern: [2],     // Skip every 4th cycle week
        }),
    },
    {
        id: 'dr-patel',
        name: 'Dr. Raj Patel',
        title: 'MD, FAAOS',
        specialty: 'orthopedics',
        bio: 'Orthopedic surgeon specializing in sports medicine, joint replacement, and minimally invasive spine surgery. 14 years of experience.',
        location: 'Providence, RI',
        address: '593 Eddy Street, Suite 200, Providence, RI 02903',
        hospital: 'Rhode Island Hospital',
        languages: ['English', 'Hindi', 'Gujarati'],
        acceptedInsurance: ['Blue Cross', 'Aetna', 'United', 'Cigna', 'Medicare'],
        rating: 4.8,
        yearsExperience: 14,
        slots: generateSlots('dr-patel', {
            startOffset: 1,
            endOffset: 48,
            times: [
                { hour: 8, minute: 0 },
                { hour: 8, minute: 30 },
                { hour: 11, minute: 0 },
                { hour: 11, minute: 30 },
                { hour: 13, minute: 0 },
                { hour: 15, minute: 30 },
                { hour: 16, minute: 0 },
            ],
            skipDays: [0, 6],
            skipWeekPattern: [1],
        }),
    },
    {
        id: 'dr-rivera',
        name: 'Dr. Sofia Rivera',
        title: 'MD, FACG',
        specialty: 'gastroenterology',
        bio: 'Gastroenterologist focused on IBD, endoscopy, and digestive disorder management with 11 years of clinical experience.',
        location: 'Providence, RI',
        address: '593 Eddy Street, Suite 300, Providence, RI 02903',
        hospital: 'The Miriam Hospital',
        languages: ['English', 'Spanish'],
        acceptedInsurance: ['Blue Cross', 'Aetna', 'Tufts', 'Harvard Pilgrim'],
        rating: 4.7,
        yearsExperience: 11,
        slots: generateSlots('dr-rivera', {
            startOffset: 2,
            endOffset: 55,
            times: [
                { hour: 9, minute: 30 },
                { hour: 10, minute: 0 },
                { hour: 10, minute: 30 },
                { hour: 13, minute: 30 },
                { hour: 14, minute: 0 },
                { hour: 16, minute: 30 },
            ],
            skipDays: [0, 2, 6],     // Sun, Tue (endoscopy days), Sat
            skipWeekPattern: [3],
        }),
    },
    {
        id: 'dr-kim',
        name: 'Dr. James Kim',
        title: 'MD, PhD, FAAN',
        specialty: 'neurology',
        bio: "Neurologist with 18 years of expertise in migraines, epilepsy, Parkinson's disease, and movement disorders.",
        location: 'Cranston, RI',
        address: '1045 Park Avenue, Suite 200, Cranston, RI 02910',
        hospital: 'Rhode Island Hospital',
        languages: ['English', 'Korean'],
        acceptedInsurance: ['Blue Cross', 'United', 'Medicare', 'Medicaid'],
        rating: 4.9,
        yearsExperience: 18,
        slots: generateSlots('dr-kim', {
            startOffset: 5,
            endOffset: 60,
            times: [
                { hour: 8, minute: 30 },
                { hour: 9, minute: 0 },
                { hour: 11, minute: 0 },
                { hour: 14, minute: 30 },
                { hour: 15, minute: 0 },
            ],
            skipDays: [0, 5, 6],     // Mon–Thu only (Fri admin, no weekends)
            skipWeekPattern: [0, 2], // Very limited — neurologists book up fast
        }),
    },
    {
        id: 'dr-webb',
        name: 'Dr. Marcus Webb',
        title: 'MD, FACC',
        specialty: 'cardiology',
        bio: 'Interventional cardiologist specializing in structural heart disease, advanced heart failure, and cardiac imaging. 12 years of experience.',
        location: 'Providence, RI',
        address: '593 Eddy Street, Suite 105, Providence, RI 02903',
        hospital: 'Rhode Island Hospital',
        languages: ['English', 'French'],
        acceptedInsurance: ['Blue Cross', 'United', 'Medicare', 'Medicaid'],
        rating: 4.7,
        yearsExperience: 12,
        slots: generateSlots('dr-webb', {
            startOffset: 2,
            endOffset: 50,
            times: [
                { hour: 8, minute: 0 },
                { hour: 8, minute: 30 },
                { hour: 11, minute: 30 },
                { hour: 12, minute: 0 },
                { hour: 15, minute: 30 },
                { hour: 16, minute: 0 },
            ],
            skipDays: [0, 4, 6],     // Skip Sun, Thu (cath lab), Sat
            skipWeekPattern: [1],
        }),
    },
    {
        id: 'dr-santos',
        name: 'Dr. Lucia Santos',
        title: 'MD, FAAOS',
        specialty: 'orthopedics',
        bio: 'Orthopedic surgeon focused on hip and knee replacement, complex fracture care, and rehabilitation. 10 years of experience.',
        location: 'Providence, RI',
        address: '593 Eddy Street, Suite 210, Providence, RI 02903',
        hospital: 'The Miriam Hospital',
        languages: ['English', 'Spanish', 'Portuguese'],
        acceptedInsurance: ['Blue Cross', 'Tufts', 'Harvard Pilgrim', 'Medicare'],
        rating: 4.8,
        yearsExperience: 10,
        slots: generateSlots('dr-santos', {
            startOffset: 2,
            endOffset: 46,
            times: [
                { hour: 9, minute: 0 },
                { hour: 9, minute: 30 },
                { hour: 10, minute: 0 },
                { hour: 13, minute: 30 },
                { hour: 14, minute: 0 },
                { hour: 16, minute: 30 },
            ],
            skipDays: [0, 3, 6],     // Skip Sun, Wed (OR days), Sat
            skipWeekPattern: [2],
        }),
    },
    {
        id: 'dr-okafor',
        name: 'Dr. David Okafor',
        title: 'MD, FACG',
        specialty: 'gastroenterology',
        bio: 'Gastroenterologist with expertise in colorectal cancer screening, advanced endoscopy, and hepatology. 13 years of experience.',
        location: 'Cranston, RI',
        address: '1045 Park Avenue, Suite 300, Cranston, RI 02910',
        hospital: 'Rhode Island Hospital',
        languages: ['English', 'Igbo'],
        acceptedInsurance: ['Blue Cross', 'United', 'Aetna', 'Medicare', 'Medicaid'],
        rating: 4.9,
        yearsExperience: 13,
        slots: generateSlots('dr-okafor', {
            startOffset: 3,
            endOffset: 54,
            times: [
                { hour: 8, minute: 30 },
                { hour: 9, minute: 0 },
                { hour: 11, minute: 0 },
                { hour: 14, minute: 0 },
                { hour: 14, minute: 30 },
            ],
            skipDays: [0, 5, 6],     // Mon–Thu only
            skipWeekPattern: [0],
        }),
    },
    {
        id: 'dr-singh',
        name: 'Dr. Amara Singh',
        title: 'MD, FAAN',
        specialty: 'neurology',
        bio: 'Neurologist specializing in multiple sclerosis, headache medicine, and neuro-immunology with 8 years of experience.',
        location: 'Cranston, RI',
        address: '1045 Park Avenue, Suite 205, Cranston, RI 02910',
        hospital: 'The Miriam Hospital',
        languages: ['English', 'Hindi', 'Punjabi'],
        acceptedInsurance: ['Blue Cross', 'Aetna', 'Tufts', 'Harvard Pilgrim'],
        rating: 4.8,
        yearsExperience: 8,
        slots: generateSlots('dr-singh', {
            startOffset: 4,
            endOffset: 56,
            times: [
                { hour: 9, minute: 30 },
                { hour: 10, minute: 0 },
                { hour: 10, minute: 30 },
                { hour: 13, minute: 0 },
                { hour: 15, minute: 0 },
                { hour: 15, minute: 30 },
            ],
            skipDays: [0, 6],
            skipWeekPattern: [3],
        }),
    },
    {
        id: 'dr-mehta',
        name: 'Dr. Priya Mehta',
        title: 'MD, FAAD',
        specialty: 'dermatology',
        bio: 'Dermatologist specializing in medical and cosmetic dermatology, skin cancer screening, eczema, and psoriasis management.',
        location: 'Cranston, RI',
        address: '1045 Park Avenue, Suite 100, Cranston, RI 02910',
        hospital: 'The Miriam Hospital',
        languages: ['English', 'Hindi'],
        acceptedInsurance: ['Blue Cross', 'Aetna', 'United', 'Cigna', 'Tufts'],
        rating: 4.8,
        yearsExperience: 9,
        slots: generateSlots('dr-mehta', {
            startOffset: 1,
            endOffset: 45,
            times: [
                { hour: 10, minute: 0 },
                { hour: 10, minute: 30 },
                { hour: 11, minute: 0 },
                { hour: 13, minute: 0 },
                { hour: 13, minute: 30 },
                { hour: 14, minute: 0 },
                { hour: 15, minute: 0 },
                { hour: 15, minute: 30 },
            ],
            skipDays: [0, 6],
            skipWeekPattern: [3],
        }),
    },
]

// ─── Helpers ──────────────────────────────────────────────────────────────────

export function getDoctorById(id: string): Doctor | undefined {
    return DOCTORS.find(d => d.id === id)
}

export function getDoctorBySpecialty(specialty: Specialty): Doctor | undefined {
    return DOCTORS.find(d => d.specialty === specialty)
}

export function getDoctorsBySpecialty(specialty: Specialty): Doctor[] {
    return DOCTORS.filter(d => d.specialty === specialty)
}

export function getAvailableSlots(doctorId: string, limit = 8): TimeSlot[] {
    const doctor = getDoctorById(doctorId)
    if (!doctor) return []
    const now = new Date()
    return doctor.slots
        .filter(s => !s.isBooked && new Date(s.datetime) > now)
        .slice(0, limit)
}

export function getSlotsForDayPreference(
    doctorId: string,
    preference: string
): TimeSlot[] {
    const doctor = getDoctorById(doctorId)
    if (!doctor) return []

    const now = new Date()
    const lower = preference.toLowerCase()
    const available = doctor.slots.filter(
        s => !s.isBooked && new Date(s.datetime) > now
    )

    const DAY_MAP: Record<string, number> = {
        sunday: 0, monday: 1, tuesday: 2, wednesday: 3,
        thursday: 4, friday: 5, saturday: 6,
        sun: 0, mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6,
    }

    for (const [name, num] of Object.entries(DAY_MAP)) {
        if (lower.includes(name)) {
            const filtered = available.filter(
                s => new Date(s.datetime).getDay() === num
            )
            if (filtered.length > 0) return filtered.slice(0, 5)
        }
    }

    if (lower.includes('morning')) {
        return available
            .filter(s => new Date(s.datetime).getHours() < 12)
            .slice(0, 5)
    }
    if (lower.includes('afternoon') || lower.includes('evening')) {
        return available
            .filter(s => new Date(s.datetime).getHours() >= 12)
            .slice(0, 5)
    }
    if (lower.includes('next week')) {
        const daysUntilMon = (8 - now.getDay()) % 7 || 7
        const nextMon = new Date(now)
        nextMon.setDate(now.getDate() + daysUntilMon)
        nextMon.setHours(0, 0, 0, 0)
        const nextSun = new Date(nextMon)
        nextSun.setDate(nextMon.getDate() + 6)
        return available
            .filter(s => {
                const d = new Date(s.datetime)
                return d >= nextMon && d <= nextSun
            })
            .slice(0, 5)
    }

    return available.slice(0, 5)
}

export function bookSlot(slotId: string): boolean {
    for (const doctor of DOCTORS) {
        const slot = doctor.slots.find(s => s.id === slotId)
        if (slot) {
            if (slot.isBooked) return false
            slot.isBooked = true
            return true
        }
    }
    return false
}

export function getSlotById(slotId: string): TimeSlot | undefined {
    for (const doctor of DOCTORS) {
        const slot = doctor.slots.find(s => s.id === slotId)
        if (slot) return slot
    }
    return undefined
}

// Slot IDs are formatted as "{doctorId}-{YYYYMMDD}-{HHMM}" — extract doctor from prefix
export function getDoctorBySlotId(slotId: string): Doctor | undefined {
    return DOCTORS.find(d => slotId.startsWith(d.id + '-'))
}
