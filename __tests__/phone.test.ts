import { describe, it, expect } from 'vitest'
import { normalizePhone, formatPhoneDisplay } from '@/lib/phone'

describe('normalizePhone', () => {
    it('normalizes a 10-digit number', () => {
        expect(normalizePhone('4015550192')).toBe('+14015550192')
    })

    it('normalizes with dashes', () => {
        expect(normalizePhone('401-555-0192')).toBe('+14015550192')
    })

    it('normalizes with parentheses and spaces', () => {
        expect(normalizePhone('(401) 555-0192')).toBe('+14015550192')
    })

    it('normalizes an 11-digit number starting with 1', () => {
        expect(normalizePhone('14015550192')).toBe('+14015550192')
    })

    it('keeps already-formatted E.164', () => {
        expect(normalizePhone('+14015550192')).toBe('+14015550192')
    })

    it('handles dots as separators', () => {
        expect(normalizePhone('401.555.0192')).toBe('+14015550192')
    })
})

describe('formatPhoneDisplay', () => {
    it('formats a raw 10-digit number', () => {
        expect(formatPhoneDisplay('4015550192')).toBe('+1 (401) 555-0192')
    })

    it('formats an E.164 number', () => {
        expect(formatPhoneDisplay('+14015550192')).toBe('+1 (401) 555-0192')
    })

    it('returns the original string if it cannot be parsed', () => {
        expect(formatPhoneDisplay('123')).toBe('123')
    })
})
