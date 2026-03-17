import { NextResponse } from 'next/server'
import crypto from 'crypto'
import { updateCallerSession, getCallerSession } from '@/lib/kv'
import { normalizePhone } from '@/lib/utils'

// Vapi sends webhooks for call lifecycle events.
// We use call.ended to capture the voice transcript and update the KV session.
// Set this URL in Vapi dashboard → Assistants → your assistant → Server URL

export async function POST(req: Request) {
    try {
        const rawBody = await req.text()
        const signature = req.headers.get('x-vapi-signature') ?? ''

        // Verify webhook authenticity
        if (!verifySignature(rawBody, signature)) {
            console.warn('[vapi-webhook] Invalid signature — rejecting')
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const event = JSON.parse(rawBody)
        const { type, call } = event

        switch (type) {
            case 'call.started': {
                // Log for debugging — no KV write needed here since
                // initiate-call already saved the session before dialing
                console.log('[vapi-webhook] call.started', call?.id)
                break
            }

            case 'call.ended': {
                const phone: string | undefined = call?.customer?.number
                if (!phone) break

                const e164 = normalizePhone(phone)

                // call.artifact.transcript is the full voice transcript
                const fullTranscript: string = call?.artifact?.transcript ?? ''

                // Store last 800 chars — enough context, not overwhelming
                const snippet = fullTranscript.length > 800
                    ? '...[earlier trimmed]\n' + fullTranscript.slice(-800)
                    : fullTranscript

                const existing = await getCallerSession(e164).catch(() => null)
                if (existing) {
                    await updateCallerSession(e164, {
                        callTranscriptSnippet: snippet || existing.callTranscriptSnippet,
                        lastCallId: call?.id ?? existing.lastCallId,
                        lastSeenAt: Date.now(),
                    }).catch(err => console.error('[vapi-webhook] KV update failed:', err))
                }

                console.log('[vapi-webhook] call.ended — transcript saved for', e164)
                break
            }

            case 'call.failed': {
                // Call never connected — log only
                console.warn('[vapi-webhook] call.failed', call?.id, call?.endedReason)
                break
            }

            default:
                // Other events (speech, transcript partials etc.) — ignore
                break
        }

        return NextResponse.json({ received: true })

    } catch (err) {
        console.error('[/api/vapi-webhook]', err)
        // Always return 200 to Vapi — otherwise it retries endlessly
        return NextResponse.json({ received: true })
    }
}

// function verifySignature(body: string, signature: string): boolean {
//   const secret = process.env.VAPI_WEBHOOK_SECRET
//   if (!secret) {
//     // In development without a secret set, skip verification
//     if (process.env.NODE_ENV === 'development') return true
//     console.warn('[vapi-webhook] VAPI_WEBHOOK_SECRET not set')
//     return false
//   }
//   try {
//     const hmac = crypto
//       .createHmac('sha256', secret)
//       .update(body)
//       .digest('hex')
//     return hmac === signature
//   } catch {
//     return false
//   }
// }

function verifySignature(body: string, signature: string): boolean {
    const secret = process.env.VAPI_WEBHOOK_SECRET

    // If no secret configured, allow all (fine for demo)
    if (!secret) return true

    try {
        const expected = crypto
            .createHmac('sha256', secret)
            .update(body)
            .digest('hex')

        const provided = signature.replace(/^sha256=/, '').trim()

        return crypto.timingSafeEqual(
            Buffer.from(expected, 'utf8'),
            Buffer.from(provided, 'utf8')
        )
    } catch {
        return false
    }
}
