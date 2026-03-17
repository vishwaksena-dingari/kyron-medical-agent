import { NextResponse } from 'next/server'
import { getCallerSession } from '@/lib/kv'
import { buildReturningCallerPrompt } from '@/lib/vapi'
import { normalizePhone } from '@/lib/utils'

// Vapi hits this URL when a patient calls the practice number directly.
// We look up the caller by phone number and inject their session context.
//
// Set this in Vapi dashboard:
//   Phone Numbers → your number → Inbound call handling → Server URL
//   → https://your-domain.com/api/vapi-inbound
//
// IMPORTANT: Set to "Server URL" mode (not "Assistant" mode)
// so Vapi sends a POST here before starting the call.

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const callerPhone: string = body?.call?.customer?.number ?? ''

    if (!callerPhone) {
      // Unknown number — use base assistant with no overrides
      return NextResponse.json({
        assistantId: process.env.VAPI_ASSISTANT_ID,
      })
    }

    const e164 = normalizePhone(callerPhone)
    const session = await getCallerSession(e164).catch(() => null)

    if (!session || !session.patientName) {
      // Never called before — fresh start
      return NextResponse.json({
        assistantId: process.env.VAPI_ASSISTANT_ID,
      })
    }

    // Returning patient — inject their context
    const { systemPrompt, firstMessage } = buildReturningCallerPrompt(session)

    return NextResponse.json({
      assistantId: process.env.VAPI_ASSISTANT_ID,
      assistantOverrides: {
        firstMessage,
        model: {
          provider: 'anthropic',
          model: 'claude-sonnet-4-20250514',
          temperature: 0.4,
          messages: [
            { role: 'system', content: systemPrompt },
          ],
        },
      },
    })

  } catch (err) {
    console.error('[/api/vapi-inbound]', err)
    // On any error, fall back to base assistant — never block the call
    return NextResponse.json({
      assistantId: process.env.VAPI_ASSISTANT_ID,
    })
  }
}
