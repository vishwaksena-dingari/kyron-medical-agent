import type { Specialty } from '@/types'

// ─── Keyword map ──────────────────────────────────────────────────────────────
// Two-tier: fast keyword match first, Claude fallback for ambiguous inputs.

const KEYWORD_MAP: Record<Specialty, string[]> = {
    cardiology: [
        'heart', 'cardiac', 'cardio', 'chest pain', 'chest tightness', 'chest pressure',
        'blood pressure', 'hypertension', 'palpitation', 'palpitations', 'arrhythmia',
        'afib', 'atrial fibrillation', 'murmur', 'angina', 'shortness of breath',
        'swollen ankles', 'racing heart', 'skipping beats', 'irregular heartbeat',
        'cholesterol', 'cardiovascular', 'aorta', 'vein', 'artery', 'edema',
    ],
    orthopedics: [
        'bone', 'bones', 'joint', 'joints', 'knee', 'hip', 'shoulder', 'back', 'spine',
        'spinal', 'neck', 'elbow', 'wrist', 'ankle', 'foot', 'feet', 'toe', 'toes',
        'hand', 'finger', 'tendon', 'ligament', 'cartilage', 'meniscus', 'rotator cuff',
        'acl', 'mcl', 'arthritis', 'fracture', 'broken', 'dislocation', 'sprain', 'strain',
        'sports injury', 'orthopedic', 'scoliosis', 'herniated disc', 'bulging disc',
        'sciatica', 'carpal tunnel', 'osteoporosis', 'bursitis', 'tendinitis',
        'plantar fasciitis', 'joint pain', 'back pain', 'knee pain', 'hip pain',
        'stiff', 'stiffness', 'clicking joint',
    ],
    gastroenterology: [
        'stomach', 'gut', 'intestine', 'intestines', 'colon', 'bowel', 'liver',
        'gallbladder', 'pancreas', 'esophagus', 'rectum', 'digestive', 'abdomen',
        'abdominal', 'gastrointestinal', 'gi tract', 'acid reflux', 'gerd', 'heartburn',
        'ibs', 'crohn', 'colitis', 'ulcer', 'constipation', 'diarrhea', 'bloating',
        'hemorrhoids', 'celiac', 'gastritis', 'pancreatitis', 'cirrhosis', 'fatty liver',
        'hepatitis', 'nausea', 'vomiting', 'indigestion', 'stomach pain', 'belly pain',
        'blood in stool', 'rectal bleeding', 'gas', 'flatulence',
    ],
    neurology: [
        'brain', 'nerve', 'nerves', 'neurological', 'spinal cord', 'migraine', 'migraines',
        'headache', 'headaches', 'epilepsy', 'seizure', 'seizures', 'alzheimer', 'dementia',
        'parkinson', 'multiple sclerosis', 'ms ', 'stroke', 'tia', 'neuropathy', 'tremor',
        'tremors', 'vertigo', 'tinnitus', 'dizziness', 'dizzy', 'memory loss',
        'forgetfulness', 'confusion', 'numbness', 'tingling', 'weakness in limbs',
        'vision changes', 'blurry vision', 'brain fog', 'loss of balance', 'fainting',
    ],
    dermatology: [
        'skin', 'rash', 'acne', 'mole', 'eczema', 'psoriasis', 'dermatitis', 'hives',
        'itching', 'itchy', 'hair loss', 'nail', 'nails', 'wart', 'warts', 'fungal',
        'ringworm', 'sunburn', 'spot', 'spots', 'lesion', 'lesions', 'freckle',
        'birthmark', 'cyst', 'blister', 'dry skin', 'oily skin', 'dandruff', 'scalp',
        'sunscreen', 'skin cancer', 'melanoma', 'basal cell', 'dermatology', 'cosmetic',
    ],
}

export interface MatchResult {
    specialty: Specialty | null
    confidence: 'high' | 'low' | 'none'
    matchedTerms: string[]
}

export function matchSpecialtyFromKeywords(reason: string): MatchResult {
    const lower = reason.toLowerCase()
    const scores: Record<Specialty, string[]> = {
        cardiology: [],
        orthopedics: [],
        gastroenterology: [],
        neurology: [],
        dermatology: [],
    }

    for (const [specialty, keywords] of Object.entries(KEYWORD_MAP) as [Specialty, string[]][]) {
        for (const kw of keywords) {
            if (lower.includes(kw)) {
                scores[specialty].push(kw)
            }
        }
    }

    const ranked = (Object.entries(scores) as [Specialty, string[]][])
        .filter(([, hits]) => hits.length > 0)
        .sort(([, a], [, b]) => {
            if (b.length !== a.length) return b.length - a.length
            // Tiebreaker: prefer the specialty whose matched keywords are longer (more specific).
            // e.g. "numbness" (8) beats "hand" (4); "eczema" (6) beats "elbow" (5).
            const avgLen = (arr: string[]) => arr.reduce((s, k) => s + k.length, 0) / arr.length
            return avgLen(b) - avgLen(a)
        })

    if (ranked.length === 0) {
        return { specialty: null, confidence: 'none', matchedTerms: [] }
    }

    const [topSpecialty, topHits] = ranked[0]
    const runnerUp = ranked[1]

    const confidence: 'high' | 'low' =
        topHits.length === 1 ||
            (runnerUp && runnerUp[1].length === topHits.length)
            ? 'low'
            : 'high'

    return {
        specialty: topSpecialty,
        confidence,
        matchedTerms: topHits,
    }
}

// ─── Claude fallback for ambiguous cases ─────────────────────────────────────
// Called from the chat API route when keyword confidence is low

// export async function matchSpecialtyWithAI(reason: string): Promise<Specialty | null> {
//   try {
//     const res = await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/match-specialty`, {
//       method: 'POST',
//       headers: { 'Content-Type': 'application/json' },
//       body: JSON.stringify({ reason }),
//     })
//     const data = await res.json()
//     return (data.specialty as Specialty) ?? null
//   } catch {
//     return null
//   }
// }

export async function matchSpecialtyWithAI(reason: string): Promise<Specialty | null> {
    return resolveSpecialtySync(reason)
}

// ─── Unified resolver ─────────────────────────────────────────────────────────

export function resolveSpecialtySync(reason: string): Specialty | null {
    const result = matchSpecialtyFromKeywords(reason)
    if (result.confidence === 'high') return result.specialty
    if (result.confidence === 'low') return result.specialty  // use best guess
    return null
}
