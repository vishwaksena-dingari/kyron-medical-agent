import { describe, it, expect, beforeEach } from 'vitest'
import {
    DOCTORS,
    getDoctorById,
    getDoctorBySpecialty,
    getAvailableSlots,
    getSlotsForDayPreference,
    bookSlot,
    getSlotById,
} from '@/lib/doctors'

// Reset booked slots before each test so tests don't bleed into each other
beforeEach(() => {
    for (const doctor of DOCTORS) {
        for (const slot of doctor.slots) {
            slot.isBooked = false
        }
    }
})

describe('getDoctorById', () => {
    it('returns a doctor for a valid id', () => {
        const doc = getDoctorById('dr-chen')
        expect(doc).toBeDefined()
        expect(doc?.name).toBe('Dr. Elena Chen')
    })

    it('returns undefined for an unknown id', () => {
        expect(getDoctorById('dr-nobody')).toBeUndefined()
    })

    it('finds all 5 doctors', () => {
        const ids = ['dr-chen', 'dr-patel', 'dr-rivera', 'dr-kim', 'dr-mehta']
        for (const id of ids) {
            expect(getDoctorById(id)).toBeDefined()
        }
    })
})

describe('getDoctorBySpecialty', () => {
    it('returns cardiologist for cardiology', () => {
        expect(getDoctorBySpecialty('cardiology')?.id).toBe('dr-chen')
    })

    it('returns orthopedist for orthopedics', () => {
        expect(getDoctorBySpecialty('orthopedics')?.id).toBe('dr-patel')
    })

    it('returns gastroenterologist for gastroenterology', () => {
        expect(getDoctorBySpecialty('gastroenterology')?.id).toBe('dr-rivera')
    })

    it('returns neurologist for neurology', () => {
        expect(getDoctorBySpecialty('neurology')?.id).toBe('dr-kim')
    })

    it('returns dermatologist for dermatology', () => {
        expect(getDoctorBySpecialty('dermatology')?.id).toBe('dr-mehta')
    })
})

describe('getAvailableSlots', () => {
    it('returns slots for a valid doctor', () => {
        const slots = getAvailableSlots('dr-patel')
        expect(slots.length).toBeGreaterThan(0)
    })

    it('returns at most the requested limit', () => {
        const slots = getAvailableSlots('dr-patel', 3)
        expect(slots.length).toBeLessThanOrEqual(3)
    })

    it('returns empty array for unknown doctor', () => {
        expect(getAvailableSlots('dr-nobody')).toEqual([])
    })

    it('all returned slots are in the future', () => {
        const now = new Date()
        const slots = getAvailableSlots('dr-chen', 20)
        for (const s of slots) {
            expect(new Date(s.datetime) > now).toBe(true)
        }
    })

    it('all returned slots are not booked', () => {
        const slots = getAvailableSlots('dr-patel', 10)
        for (const s of slots) {
            expect(s.isBooked).toBe(false)
        }
    })

    it('excludes a slot after it is booked', () => {
        const slots = getAvailableSlots('dr-patel', 5)
        const first = slots[0]
        bookSlot(first.id)
        const after = getAvailableSlots('dr-patel', 5)
        expect(after.find(s => s.id === first.id)).toBeUndefined()
    })
})

describe('getSlotsForDayPreference', () => {
    it('returns morning slots for "morning"', () => {
        const slots = getSlotsForDayPreference('dr-mehta', 'morning')
        for (const s of slots) {
            expect(new Date(s.datetime).getHours()).toBeLessThan(12)
        }
    })

    it('returns afternoon slots for "afternoon"', () => {
        const slots = getSlotsForDayPreference('dr-patel', 'afternoon')
        for (const s of slots) {
            expect(new Date(s.datetime).getHours()).toBeGreaterThanOrEqual(12)
        }
    })

    it('returns no more than 5 slots', () => {
        const slots = getSlotsForDayPreference('dr-patel', 'morning')
        expect(slots.length).toBeLessThanOrEqual(5)
    })

    it('falls back to next available slots for unrecognized preference', () => {
        const slots = getSlotsForDayPreference('dr-patel', 'asap')
        expect(slots.length).toBeGreaterThan(0)
    })
})

describe('bookSlot', () => {
    it('returns true when booking an available slot', () => {
        const slots = getAvailableSlots('dr-chen', 1)
        expect(slots.length).toBeGreaterThan(0)
        expect(bookSlot(slots[0].id)).toBe(true)
    })

    it('marks the slot as booked after booking', () => {
        const slots = getAvailableSlots('dr-chen', 1)
        const id = slots[0].id
        bookSlot(id)
        const slot = getSlotById(id)
        expect(slot?.isBooked).toBe(true)
    })

    it('returns false when booking an already-booked slot (idempotency)', () => {
        const slots = getAvailableSlots('dr-chen', 1)
        const id = slots[0].id
        bookSlot(id)
        expect(bookSlot(id)).toBe(false)
    })

    it('returns false for an unknown slot id', () => {
        expect(bookSlot('dr-fake-99999999-0900')).toBe(false)
    })
})

describe('getSlotById', () => {
    it('finds an existing slot', () => {
        const slots = getAvailableSlots('dr-patel', 1)
        const found = getSlotById(slots[0].id)
        expect(found).toBeDefined()
        expect(found?.id).toBe(slots[0].id)
    })

    it('returns undefined for a nonexistent slot id', () => {
        expect(getSlotById('does-not-exist')).toBeUndefined()
    })
})

describe('slot data integrity', () => {
    it('all doctors have at least 5 available slots', () => {
        for (const doctor of DOCTORS) {
            const slots = getAvailableSlots(doctor.id, 100)
            expect(slots.length).toBeGreaterThanOrEqual(5)
        }
    })

    it('slot IDs are unique across all doctors', () => {
        const allIds = DOCTORS.flatMap(d => d.slots.map(s => s.id))
        const uniqueIds = new Set(allIds)
        expect(uniqueIds.size).toBe(allIds.length)
    })

    it('all slot datetimes are valid ISO strings', () => {
        for (const doctor of DOCTORS) {
            for (const slot of doctor.slots.slice(0, 5)) {
                expect(new Date(slot.datetime).toString()).not.toBe('Invalid Date')
            }
        }
    })

    it('each doctor has the correct specialty assigned', () => {
        const expected: Record<string, string> = {
            'dr-chen':   'cardiology',
            'dr-patel':  'orthopedics',
            'dr-rivera': 'gastroenterology',
            'dr-kim':    'neurology',
            'dr-mehta':  'dermatology',
        }
        for (const [id, specialty] of Object.entries(expected)) {
            expect(getDoctorById(id)?.specialty).toBe(specialty)
        }
    })
})
