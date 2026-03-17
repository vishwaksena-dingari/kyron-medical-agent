import { Redis } from '@upstash/redis'
import type { CallerSession, PatientContext } from '@/types'
import { normalizePhone } from '@/lib/phone'

const TTL_SECONDS = 60 * 60 * 24 * 30 // 30 days

const redis =
    process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN
        ? new Redis({
            url: process.env.UPSTASH_REDIS_REST_URL,
            token: process.env.UPSTASH_REDIS_REST_TOKEN,
        })
        : null

const inMemory = new Map<string, string>()

const KEY = (phone: string) => `caller:${normalizePhone(phone)}`

async function kvGet(key: string): Promise<string | null> {
    try {
        if (!redis) return inMemory.get(key) ?? null
        const val = await redis.get<string>(key)
        return val ?? null
    } catch {
        return inMemory.get(key) ?? null
    }
}

async function kvSet(key: string, value: string): Promise<void> {
    try {
        if (!redis) {
            inMemory.set(key, value)
            return
        }
        await redis.set(key, value, { ex: TTL_SECONDS })
    } catch {
        inMemory.set(key, value)
    }
}

async function kvDel(key: string): Promise<void> {
    try {
        if (!redis) {
            inMemory.delete(key)
            return
        }
        await redis.del(key)
    } catch {
        inMemory.delete(key)
    }
}

export async function saveCallerSession(
    phone: string,
    data: Omit<CallerSession, 'phone' | 'lastSeenAt' | 'sessionCount'>,
    existingSession?: CallerSession | null
): Promise<void> {
    const session: CallerSession = {
        ...data,
        phone: normalizePhone(phone),
        lastSeenAt: Date.now(),
        sessionCount: (existingSession?.sessionCount ?? 0) + 1,
    }

    await kvSet(KEY(phone), JSON.stringify(session))
}

export async function getCallerSession(phone: string): Promise<CallerSession | null> {
    try {
        const raw = await kvGet(KEY(phone))
        if (!raw) return null
        return JSON.parse(raw) as CallerSession
    } catch {
        return null
    }
}

export async function updateCallerSession(
    phone: string,
    patch: Partial<CallerSession>
): Promise<void> {
    const existing = await getCallerSession(phone)
    if (!existing) return

    const updated: CallerSession = {
        ...existing,
        ...patch,
        phone: existing.phone,
        lastSeenAt: Date.now(),
        sessionCount: existing.sessionCount,
    }

    await kvSet(KEY(phone), JSON.stringify(updated))
}

export async function clearCallerSession(phone: string): Promise<void> {
    await kvDel(KEY(phone))
}

// Save patient intake data as fields are collected during chat
// Key: patient:{E.164_phone} — only persists once phone is known
export async function savePatientData(ctx: PatientContext): Promise<void> {
    if (!ctx.phone) return
    const key = `patient:${normalizePhone(ctx.phone)}`
    await kvSet(key, JSON.stringify({ ...ctx, savedAt: Date.now() }))
}
// import type { CallerSession } from '@/types'
// import { normalizePhone } from '@/lib/phone'

// // ─── KV abstraction ────────────────────────────────────────────────────────────
// // Uses @vercel/kv in production.
// // Falls back to in-memory Map in local dev (no KV credentials needed).
// // In-memory resets on server restart — acceptable for demo.

// const TTL_SECONDS = 60 * 60 * 24 * 30 // 30 days

// const inMemory = new Map<string, string>()

// async function kvGet(key: string): Promise<string | null> {
//     try {
//         const { kv } = await import('@vercel/kv')
//         const val = await kv.get<string>(key)
//         return val ?? null
//     } catch {
//         // Fall back to in-memory (local dev without KV env vars)
//         return inMemory.get(key) ?? null
//     }
// }

// async function kvSet(key: string, value: string): Promise<void> {
//     try {
//         const { kv } = await import('@vercel/kv')
//         await kv.set(key, value, { ex: TTL_SECONDS })
//     } catch {
//         // Fall back to in-memory
//         inMemory.set(key, value)
//     }
// }

// async function kvDel(key: string): Promise<void> {
//     try {
//         const { kv } = await import('@vercel/kv')
//         await kv.del(key)
//     } catch {
//         inMemory.delete(key)
//     }
// }

// // ─── Phone normalization ───────────────────────────────────────────────────────

// // export function normalizePhone(phone: string): string {
// //     const digits = phone.replace(/\D/g, '')
// //     if (digits.startsWith('1') && digits.length === 11) return `+${digits}`
// //     if (digits.length === 10) return `+1${digits}`
// //     return `+${digits}`
// // }


// const KEY = (phone: string) => `caller:${normalizePhone(phone)}`

// // ─── Public API ───────────────────────────────────────────────────────────────

// export async function saveCallerSession(
//     phone: string,
//     data: Omit<CallerSession, 'phone' | 'lastSeenAt' | 'sessionCount'>,
//     existingSession?: CallerSession | null,
// ): Promise<void> {
//     const session: CallerSession = {
//         ...data,
//         phone: normalizePhone(phone),
//         lastSeenAt: Date.now(),
//         sessionCount: (existingSession?.sessionCount ?? 0) + 1,
//     }
//     await kvSet(KEY(phone), JSON.stringify(session))
// }

// export async function getCallerSession(phone: string): Promise<CallerSession | null> {
//     try {
//         const raw = await kvGet(KEY(phone))
//         if (!raw) return null
//         return JSON.parse(raw) as CallerSession
//     } catch {
//         return null
//     }
// }

// export async function updateCallerSession(
//     phone: string,
//     patch: Partial<CallerSession>,
// ): Promise<void> {
//     const existing = await getCallerSession(phone)
//     if (!existing) return
//     const updated: CallerSession = {
//         ...existing,
//         ...patch,
//         phone: existing.phone,
//         lastSeenAt: Date.now(),
//         sessionCount: existing.sessionCount,
//     }
//     await kvSet(KEY(phone), JSON.stringify(updated))
// }

// export async function clearCallerSession(phone: string): Promise<void> {
//     await kvDel(KEY(phone))
// }





// // import { kv } from '@vercel/kv'
// // import type { CallerSession } from '@/types'
// // import { normalizePhone } from '@/lib/utils'

// // const PREFIX = 'caller:'
// // const TTL = 60 * 60 * 24 * 30  // 30 days

// // function key(phone: string): string {
// //   return `${PREFIX}${normalizePhone(phone)}`
// // }

// // export async function saveCallerSession(
// //   phone: string,
// //   data: Omit<CallerSession, 'phone' | 'lastSeenAt' | 'sessionCount'>,
// //   existing?: CallerSession | null
// // ): Promise<void> {
// //   const session: CallerSession = {
// //     ...data,
// //     phone: normalizePhone(phone),
// //     lastSeenAt: Date.now(),
// //     sessionCount: (existing?.sessionCount ?? 0) + 1,
// //   }
// //   await kv.set(key(phone), session, { ex: TTL })
// // }

// // export async function getCallerSession(
// //   phone: string
// // ): Promise<CallerSession | null> {
// //   try {
// //     return await kv.get<CallerSession>(key(phone))
// //   } catch {
// //     return null
// //   }
// // }

// // export async function updateCallerSession(
// //   phone: string,
// //   patch: Partial<CallerSession>
// // ): Promise<void> {
// //   const existing = await getCallerSession(phone)
// //   if (!existing) return

// //   const updated: CallerSession = {
// //     ...existing,
// //     ...patch,
// //     phone: existing.phone,       // never overwrite key
// //     lastSeenAt: Date.now(),
// //     sessionCount: existing.sessionCount,
// //   }
// //   await kv.set(key(phone), updated, { ex: TTL })
// // }

// // export async function clearCallerSession(phone: string): Promise<void> {
// //   await kv.del(key(phone))
// // }
