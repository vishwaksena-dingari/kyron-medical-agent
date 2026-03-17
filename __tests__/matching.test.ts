import { describe, it, expect } from 'vitest'
import { matchSpecialtyFromKeywords, resolveSpecialtySync } from '@/lib/matching'

describe('matchSpecialtyFromKeywords', () => {
    // ── Cardiology ────────────────────────────────────────────────────────────
    it('matches cardiology for "heart"', () => {
        const r = matchSpecialtyFromKeywords('I have heart problems')
        expect(r.specialty).toBe('cardiology')
    })

    it('matches cardiology for "chest pain"', () => {
        const r = matchSpecialtyFromKeywords('I have been experiencing chest pain')
        expect(r.specialty).toBe('cardiology')
    })

    it('matches cardiology for "palpitations"', () => {
        const r = matchSpecialtyFromKeywords('I keep having palpitations')
        expect(r.specialty).toBe('cardiology')
    })

    // ── Orthopedics ───────────────────────────────────────────────────────────
    it('matches orthopedics for "knee pain"', () => {
        const r = matchSpecialtyFromKeywords('I have knee pain when I walk')
        expect(r.specialty).toBe('orthopedics')
    })

    it('matches orthopedics for "ACL"', () => {
        const r = matchSpecialtyFromKeywords('I tore my ACL playing soccer')
        expect(r.specialty).toBe('orthopedics')
    })

    it('matches orthopedics for "back pain"', () => {
        const r = matchSpecialtyFromKeywords('My back pain has been terrible')
        expect(r.specialty).toBe('orthopedics')
    })

    // ── Gastroenterology ─────────────────────────────────────────────────────
    it('matches gastroenterology for "stomach pain"', () => {
        const r = matchSpecialtyFromKeywords('I have stomach pain after eating')
        expect(r.specialty).toBe('gastroenterology')
    })

    it('matches gastroenterology for "acid reflux"', () => {
        const r = matchSpecialtyFromKeywords('I suffer from acid reflux daily')
        expect(r.specialty).toBe('gastroenterology')
    })

    it('matches gastroenterology for "IBS"', () => {
        const r = matchSpecialtyFromKeywords('I was diagnosed with IBS')
        expect(r.specialty).toBe('gastroenterology')
    })

    // ── Neurology ─────────────────────────────────────────────────────────────
    it('matches neurology for "migraine"', () => {
        const r = matchSpecialtyFromKeywords('I get severe migraines weekly')
        expect(r.specialty).toBe('neurology')
    })

    it('matches neurology for "seizures"', () => {
        const r = matchSpecialtyFromKeywords('I had two seizures last month')
        expect(r.specialty).toBe('neurology')
    })

    it('matches neurology for "numbness"', () => {
        const r = matchSpecialtyFromKeywords('I have numbness in my hands')
        expect(r.specialty).toBe('neurology')
    })

    // ── Dermatology ───────────────────────────────────────────────────────────
    it('matches dermatology for "rash"', () => {
        const r = matchSpecialtyFromKeywords('I have a rash on my arm')
        expect(r.specialty).toBe('dermatology')
    })

    it('matches dermatology for "acne"', () => {
        const r = matchSpecialtyFromKeywords('My acne is getting worse')
        expect(r.specialty).toBe('dermatology')
    })

    it('matches dermatology for "eczema"', () => {
        const r = matchSpecialtyFromKeywords('I have eczema on my elbows')
        expect(r.specialty).toBe('dermatology')
    })

    // ── No match ──────────────────────────────────────────────────────────────
    it('returns null for unrelated input', () => {
        const r = matchSpecialtyFromKeywords('I need to schedule something')
        expect(r.specialty).toBeNull()
        expect(r.confidence).toBe('none')
    })

    it('returns null for empty string', () => {
        const r = matchSpecialtyFromKeywords('')
        expect(r.specialty).toBeNull()
    })

    // ── Confidence ────────────────────────────────────────────────────────────
    it('returns high confidence for strong, unambiguous match', () => {
        const r = matchSpecialtyFromKeywords('heart palpitations chest pain arrhythmia cholesterol')
        expect(r.specialty).toBe('cardiology')
        expect(r.confidence).toBe('high')
    })

    it('populates matchedTerms', () => {
        const r = matchSpecialtyFromKeywords('I have knee pain')
        expect(r.matchedTerms.length).toBeGreaterThan(0)
    })

    // ── Case insensitivity ────────────────────────────────────────────────────
    it('is case-insensitive', () => {
        const r = matchSpecialtyFromKeywords('HEART PAIN CHEST TIGHTNESS')
        expect(r.specialty).toBe('cardiology')
    })
})

describe('resolveSpecialtySync', () => {
    it('returns a specialty for clear input', () => {
        expect(resolveSpecialtySync('knee pain')).toBe('orthopedics')
    })

    it('returns null for unrecognized input', () => {
        expect(resolveSpecialtySync('flu shot appointment')).toBeNull()
    })
})
