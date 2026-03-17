// import { type NextRequest } from 'next/server'
// import { anthropic, ARIA_SYSTEM_PROMPT, TOOLS, executeTool } from '@/lib/claude'
// import type { PatientContext, StreamEvent } from '@/types'
// import type { Specialty } from '@/types'

// Old multi-provider imports (pre-adapter refactor) — kept for reference:
// import crypto from 'crypto'
// import { anthropic, gemini, GEMINI_MODEL, ANTHROPIC_MODEL, hasGemini, hasAnthropic } from '@/lib/claude'

import { type NextRequest } from 'next/server'
import {
    ARIA_SYSTEM_PROMPT,
    executeTool,
    getPreferredProvider,
    runModelTurn,
    type NeutralMessage,
} from '@/lib/claude'
import type { PatientContext, StreamEvent, Specialty, DoctorOption } from '@/types'
import { normalizePhone, formatPhoneDisplay } from '@/lib/phone'
import { getAvailableSlots, getDoctorById, getDoctorBySlotId } from '@/lib/doctors'
import { savePatientData } from '@/lib/kv'

function formatDobDisplay(raw: string): string {
    // Try parsing common formats: MM/DD/YYYY, YYYY-MM-DD, "January 2 2001", etc.
    const d = new Date(raw)
    if (!isNaN(d.getTime())) {
        return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    }
    return raw // return as-is if unparseable
}

function normalizeField(field: string, value: string): string {
    if (field === 'phone') return formatPhoneDisplay(normalizePhone(value))
    if (field === 'dob')   return formatDobDisplay(value)
    return value
}

export const runtime = 'nodejs'
export const maxDuration = 60

// ─── SSE helper ───────────────────────────────────────────────────────────────

function encode(event: StreamEvent): string {
    return `data: ${JSON.stringify(event)}\n\n`
}

// ------------------------------------------------------------------------------
// These adapter functions have moved to lib/claude.ts (runAnthropicTurn, runGeminiTurn)
// Kept here commented out for reference:

/*
function toGeminiTools() {
    return [
        {
            functionDeclarations: TOOLS.map((tool) => ({
                name: tool.name,
                description: tool.description,
                parameters: tool.input_schema,
            })),
        },
    ]
}

async function runGeminiTurn(params: {
    currentMessages: Array<{ role: 'user' | 'assistant'; content: string }>
    systemPrompt: string
    emit: (event: StreamEvent) => void
}) {
    if (!gemini) {
        throw new Error('Gemini client not configured')
    }

    const contents = params.currentMessages.map((m) => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: m.content }],
    }))

    const response = await gemini.models.generateContent({
        model: GEMINI_MODEL,
        contents,
        config: {
            systemInstruction: params.systemPrompt,
            tools: toGeminiTools(),
        },
    })

    const candidate = response.candidates?.[0]
    const parts = candidate?.content?.parts ?? []

    let assistantText = ''
    const toolUses: Array<{
        id: string
        name: string
        input: Record<string, string>
    }> = []

    for (const part of parts) {
        if ('text' in part && part.text) {
            assistantText += part.text
        }

        if ('functionCall' in part && part.functionCall) {
            toolUses.push({
                id: crypto.randomUUID(),
                name: part.functionCall.name,
                input: (part.functionCall.args ?? {}) as Record<string, string>,
            })
        }
    }

    if (assistantText) {
        params.emit({ type: 'text', text: assistantText })
    }

    return { assistantText, toolUses }
}

async function runAnthropicTurn(params: {
    currentMessages: Array<{ role: 'user' | 'assistant'; content: string }>
    systemPrompt: string
    emit: (event: StreamEvent) => void
}) {
    if (!anthropic) {
        throw new Error('Anthropic client not configured')
    }

    const response = await anthropic.messages.create({
        model: ANTHROPIC_MODEL,
        max_tokens: 1024,
        temperature: 0.4,
        system: params.systemPrompt,
        tools: TOOLS,
        messages: params.currentMessages,
        stream: true,
    })

    let assistantText = ''
    const toolUses: Array<{
        id: string
        name: string
        input: Record<string, string>
    }> = []

    let currentToolId = ''
    let currentToolName = ''
    let currentToolInputRaw = ''

    for await (const event of response) {
        switch (event.type) {
            case 'content_block_start':
                if (event.content_block.type === 'tool_use') {
                    currentToolId = event.content_block.id
                    currentToolName = event.content_block.name
                    currentToolInputRaw = ''
                }
                break

            case 'content_block_delta':
                if (event.delta.type === 'text_delta') {
                    assistantText += event.delta.text
                    params.emit({ type: 'text', text: event.delta.text })
                } else if (event.delta.type === 'input_json_delta') {
                    currentToolInputRaw += event.delta.partial_json
                }
                break

            case 'content_block_stop':
                if (currentToolId && currentToolName) {
                    let parsedInput: Record<string, string> = {}
                    try {
                        parsedInput = JSON.parse(currentToolInputRaw) as Record<string, string>
                    } catch { }

                    toolUses.push({
                        id: currentToolId,
                        name: currentToolName,
                        input: parsedInput,
                    })

                    currentToolId = ''
                    currentToolName = ''
                    currentToolInputRaw = ''
                }
                break
        }
    }

    return { assistantText, toolUses }
}
*/

// ─── Route handler ────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
    const { messages, patientContext: initialContext, activeTab } = await req.json() as {
        messages: Array<{ role: 'user' | 'assistant'; content: string }>
        patientContext: PatientContext
        activeTab?: string
    }
    let patientContext = initialContext

    // Build system prompt with active tab context
    let systemPrompt = ARIA_SYSTEM_PROMPT

    // Inject confirmed booking context so Claude doesn't restart the booking flow
    if (patientContext.bookingConfirmed && patientContext.matchedDoctorName && patientContext.selectedSlotLabel) {
        systemPrompt += `\n\nPATIENT SESSION STATUS: The patient already has a CONFIRMED appointment with ${patientContext.matchedDoctorName} on ${patientContext.selectedSlotLabel}. Do NOT start a new booking flow for the same doctor unless the patient explicitly asks. If they ask about their appointment, confirm the existing booking details.`
    } else if (patientContext.matchedDoctorName && patientContext.selectedSlotLabel) {
        systemPrompt += `\n\nPATIENT SESSION STATUS: The patient has selected ${patientContext.selectedSlotLabel} with ${patientContext.matchedDoctorName} but has not yet confirmed. Continue from this point.`
    }

    if (activeTab === 'Prescriptions') {
        systemPrompt += '\n\nThe patient has navigated to the Prescriptions tab. Lead with the prescription refill workflow.'
    } else if (activeTab === 'Locations') {
        systemPrompt += '\n\nThe patient has navigated to the Locations tab. Call get_office_info immediately.'
    }

    const stream = new ReadableStream({
        async start(controller) {
            const emit = (event: StreamEvent) => {
                controller.enqueue(new TextEncoder().encode(encode(event)))
            }

            try {
                // ── Old loop (pre-adapter, Anthropic-style tool_result history) — kept for reference ──
                /*
                const trimmedMessages = messages.slice(-20)
                let currentMessages = trimmedMessages
                const MAX_ROUNDS = 8

                for (let round = 0; round < MAX_ROUNDS; round++) {
                    let assistantText = ''
                    let toolUses: Array<{
                        id: string
                        name: string
                        input: Record<string, string>
                    }> = []

                    const provider = getPreferredProvider()

                    if (provider === 'gemini' && hasGemini()) {
                        try {
                            const result = await runGeminiTurn({ currentMessages, systemPrompt, emit })
                            assistantText = result.assistantText
                            toolUses = result.toolUses
                        } catch (err) {
                            console.warn('[chat] Gemini failed, falling back to Claude:', err)
                            if (!hasAnthropic()) throw err
                            const result = await runAnthropicTurn({ currentMessages, systemPrompt, emit })
                            assistantText = result.assistantText
                            toolUses = result.toolUses
                        }
                    } else {
                        const result = await runAnthropicTurn({ currentMessages, systemPrompt, emit })
                        assistantText = result.assistantText
                        toolUses = result.toolUses
                    }

                    if (toolUses.length === 0) {
                        emit({ type: 'done' })
                        controller.close()
                        return
                    }

                    const toolResults: Array<{
                        type: 'tool_result'
                        tool_use_id: string
                        content: string
                    }> = []

                    for (const tool of toolUses) {
                        const result = await executeTool(tool.name, tool.input, patientContext)

                        if (tool.name === 'update_patient_field') {
                            const fieldMap: Record<string, string> = {
                                name: 'name', dob: 'dob', phone: 'phone', email: 'email', reason: 'reason',
                            }
                            const mappedField = fieldMap[tool.input.field]
                            if (mappedField) {
                                emit({ type: 'intake_update', patientUpdate: { [mappedField]: tool.input.value } })
                            }
                        }

                        if (tool.name === 'get_available_slots') {
                            const r = result as {
                                doctor?: { id: string; name: string; specialty: string }
                                slots?: Array<{ id: string; label: string; doctorId: string; datetime: string }>
                            }
                            if (r.doctor?.id) {
                                emit({ type: 'intake_update', patientUpdate: {
                                    matchedDoctorId: r.doctor.id,
                                    matchedDoctorName: r.doctor.name,
                                    matchedSpecialty: r.doctor.specialty as Specialty,
                                }})
                            }
                            if (r.slots && r.slots.length > 0) {
                                emit({ type: 'slots', doctorId: r.doctor?.id ?? '', doctorName: r.doctor?.name ?? '',
                                    slots: r.slots.map(s => ({ id: s.id, label: s.label })) })
                            }
                        }

                        if (tool.name === 'confirm_booking') {
                            const r = result as { success?: boolean; appointmentId?: string; doctorName?: string; slotLabel?: string }
                            if (r.success && r.doctorName && r.slotLabel) {
                                emit({ type: 'confirmed', confirmed: {
                                    appointmentId: r.appointmentId ?? '',
                                    doctorName: r.doctorName,
                                    slotLabel: r.slotLabel,
                                    email: patientContext.email ?? '',
                                }})
                            }
                        }

                        toolResults.push({ type: 'tool_result', tool_use_id: tool.id, content: JSON.stringify(result) })
                    }

                    const assistantContent: Array<
                        | { type: 'text'; text: string }
                        | { type: 'tool_use'; id: string; name: string; input: Record<string, string> }
                    > = []
                    if (assistantText) assistantContent.push({ type: 'text', text: assistantText })
                    for (const tool of toolUses) {
                        assistantContent.push({ type: 'tool_use', id: tool.id, name: tool.name, input: tool.input })
                    }

                    currentMessages = [
                        ...currentMessages,
                        { role: 'assistant' as const, content: assistantContent as never },
                        { role: 'user' as const, content: toolResults as never },
                    ]
                }

                emit({ type: 'done' })
                controller.close()
                */
                // ── New neutral-format loop ───────────────────────────────────────────
                const trimmedMessages = messages.slice(-20)
                let conversation: NeutralMessage[] = trimmedMessages.map((m) => ({
                    role: m.role,
                    content: m.content,
                }))
                const MAX_ROUNDS = 8

                for (let round = 0; round < MAX_ROUNDS; round++) {
                    const result = await runModelTurn({
                        preferredProvider: getPreferredProvider(),
                        messages: conversation,
                        systemPrompt,
                        onText: (text) => emit({ type: 'text', text }),
                    })

                    conversation.push({
                        role: 'assistant',
                        content: result.assistantText,
                        toolCalls: result.toolCalls.length > 0 ? result.toolCalls : undefined,
                    })

                    if (result.toolCalls.length === 0) {
                        emit({ type: 'done' })
                        controller.close()
                        return
                    }

                    for (const tool of result.toolCalls) {
                        const toolResult = await executeTool(tool.name, tool.input, patientContext)

                        if (tool.name === 'update_patient_field') {
                            const fieldMap: Record<string, keyof PatientContext> = {
                                name: 'name', dob: 'dob', phone: 'phone', email: 'email', reason: 'reason',
                            }
                            const mappedField = fieldMap[String(tool.input.field ?? '')]
                            if (mappedField) {
                                const rawValue = String(tool.input.value ?? '')
                                const formattedValue = normalizeField(String(tool.input.field ?? ''), rawValue)
                                patientContext = { ...patientContext, [mappedField]: formattedValue }
                                emit({
                                    type: 'intake_update',
                                    patientUpdate: { [mappedField]: formattedValue },
                                })
                                // Persist to Upstash as soon as phone is known (non-blocking)
                                savePatientData(patientContext).catch(() => {})
                            }
                        }

                        if (tool.name === 'get_doctors_for_specialty') {
                            const r = toolResult as {
                                specialty: string
                                doctors: DoctorOption[]
                            }
                            if (r.doctors && r.doctors.length > 0) {
                                emit({
                                    type: 'doctors',
                                    specialty: r.specialty,
                                    doctors: r.doctors,
                                })
                            }
                        }

                        if (tool.name === 'get_available_slots') {
                            const r = toolResult as {
                                doctor?: { id: string; name: string; specialty: string }
                                slots?: Array<{ id: string; label: string; doctorId: string; datetime: string }>
                            }
                            if (r.doctor?.id) {
                                emit({
                                    type: 'intake_update',
                                    patientUpdate: {
                                        matchedDoctorId: r.doctor.id,
                                        matchedDoctorName: r.doctor.name,
                                        matchedSpecialty: r.doctor.specialty as Specialty,
                                    },
                                })
                            }
                            if (r.slots && r.slots.length > 0) {
                                emit({
                                    type: 'slots',
                                    doctorId: r.doctor?.id ?? '',
                                    doctorName: r.doctor?.name ?? '',
                                    slots: r.slots.map((s) => ({ id: s.id, label: s.label })),
                                })
                            }
                        }

                        if (tool.name === 'confirm_booking') {
                            const r = toolResult as {
                                success?: boolean
                                appointmentId?: string
                                doctorName?: string
                                slotLabel?: string
                            }
                            if (r.success && r.doctorName && r.slotLabel) {
                                emit({
                                    type: 'confirmed',
                                    confirmed: {
                                        appointmentId: r.appointmentId ?? '',
                                        doctorName: r.doctorName,
                                        slotLabel: r.slotLabel,
                                        email: patientContext.email ?? '',
                                    },
                                })
                            } else if (!r.success) {
                                // Slot taken — find doctor via doctor_id → slot_id prefix → patientContext fallback
                                const slotId = patientContext.selectedSlotId || String(tool.input.slot_id ?? '')
                                const doctor =
                                    getDoctorById(String(tool.input.doctor_id ?? '')) ??
                                    getDoctorBySlotId(slotId) ??
                                    getDoctorById(patientContext.matchedDoctorId ?? '')
                                if (doctor) {
                                    const freshSlots = getAvailableSlots(doctor.id, 6)
                                    if (freshSlots.length > 0) {
                                        emit({
                                            type: 'booking_failed',
                                            doctorId: doctor.id,
                                            doctorName: doctor.name,
                                            slots: freshSlots.map(s => ({ id: s.id, label: s.label })),
                                        })
                                    }
                                }
                            }
                        }

                        conversation.push({
                            role: 'tool',
                            name: tool.name,
                            toolCallId: tool.id,
                            content: JSON.stringify(toolResult),
                        })
                    }
                }

                emit({ type: 'done' })
                controller.close()

            } catch (err) {
                console.error('[/api/chat]', err)
                emit({ type: 'error', error: 'Something went wrong. Please try again.' })
                controller.close()
            }
        },
    })

    return new Response(stream, {
        headers: {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            Connection: 'keep-alive',
        },
    })
}


// import { NextResponse } from 'next/server'
// import type { MessageParam } from '@anthropic-ai/sdk/resources/messages'
// import { anthropic, ARIA_SYSTEM_PROMPT, TOOLS, executeTool } from '@/lib/claude'
// import type { PatientContext, SlotOption, BookingResult } from '@/types'

// export const maxDuration = 30

// interface ChatRequest {
//   messages: { role: 'user' | 'assistant'; content: string }[]
//   patientContext: PatientContext
//   activeTab?: string
// }

// export async function POST(req: Request) {
//   try {
//     const body: ChatRequest = await req.json()
//     const { messages, patientContext, activeTab } = body

//     if (!messages?.length) {
//       return NextResponse.json({ error: 'No messages provided' }, { status: 400 })
//     }

//     // Build system prompt — append active tab context if not scheduling
//     let systemPrompt = ARIA_SYSTEM_PROMPT
//     if (activeTab === 'Prescriptions') {
//       systemPrompt += '\n\nThe patient has navigated to the Prescriptions tab. Lead with the prescription refill workflow.'
//     } else if (activeTab === 'Locations') {
//       systemPrompt += '\n\nThe patient has navigated to the Locations tab. Lead with office info — call get_office_info immediately.'
//     }

//     // Convert to Anthropic MessageParam format
//     const anthropicMessages: MessageParam[] = messages.map(m => ({
//       role: m.role,
//       content: m.content,
//     }))

//     // Accumulators for tool call side effects
//     const patientUpdate: Partial<PatientContext> = {}
//     let slots: SlotOption[] = []
//     let booking: BookingResult | null = null
//     let finalText = ''

//     // Tool-calling loop — max 5 iterations to prevent runaway
//     let iteration = 0
//     const MAX_ITER = 5
//     let currentMessages = [...anthropicMessages]

//     while (iteration < MAX_ITER) {
//       iteration++

//       const response = await anthropic.messages.create({
//         model: 'claude-sonnet-4-20250514',
//         max_tokens: 1024,
//         temperature: 0.4,
//         system: systemPrompt,
//         tools: TOOLS,
//         messages: currentMessages,
//       })

//       // Extract text from this turn
//       const textBlock = response.content.find(b => b.type === 'text')
//       if (textBlock?.type === 'text') {
//         finalText = textBlock.text
//       }

//       // No tool use — we're done
//       if (response.stop_reason === 'end_turn' || !response.content.some(b => b.type === 'tool_use')) {
//         break
//       }

//       // Process all tool calls in this turn
//       const toolUseBlocks = response.content.filter(b => b.type === 'tool_use')
//       const toolResults: MessageParam = {
//         role: 'user',
//         content: [],
//       }

//       for (const block of toolUseBlocks) {
//         if (block.type !== 'tool_use') continue

//         const input = block.input as Record<string, string>
//         const result = await executeTool(block.name, input, patientContext)

//         // Side effects per tool
//         if (block.name === 'update_patient_field') {
//           const field = input.field as keyof PatientContext
//           const value = input.value
//           switch (field) {
//             case 'name':    patientUpdate.name  = value; break
//             case 'dob':     patientUpdate.dob   = value; break
//             case 'phone':   patientUpdate.phone = value; break
//             case 'email':   patientUpdate.email = value; break
//             case 'reason':  patientUpdate.reason = value; break
//           }
//         }

//         if (block.name === 'get_available_slots' && !('error' in result)) {
//           const r = result as { doctor: { id: string; name: string; specialty: string }; slots: SlotOption[] }
//           slots = r.slots ?? []
//           // Also update matched doctor
//           if (r.doctor?.id) {
//             patientUpdate.matchedDoctorId   = r.doctor.id
//             patientUpdate.matchedDoctorName = r.doctor.name
//             patientUpdate.matchedSpecialty  = r.doctor.specialty
//           }
//         }

//         if (block.name === 'confirm_booking') {
//           const r = result as BookingResult & { success: boolean }
//           if (r.success) {
//             booking = r
//             patientUpdate.bookingConfirmed  = true
//             patientUpdate.appointmentId     = r.appointmentId
//             patientUpdate.selectedSlotLabel = r.slotLabel
//           }
//         }

//         // Add tool result to the next message turn
//         ;(toolResults.content as Array<{
//           type: string
//           tool_use_id: string
//           content: string
//         }>).push({
//           type: 'tool_result',
//           tool_use_id: block.id,
//           content: JSON.stringify(result),
//         })
//       }

//       // Append assistant turn + tool results and continue loop
//       currentMessages = [
//         ...currentMessages,
//         { role: 'assistant', content: response.content },
//         toolResults,
//       ]
//     }

//     return NextResponse.json({
//       text: finalText || "I'm sorry, I didn't catch that. Could you say that again?",
//       slots: slots.length > 0 ? slots : undefined,
//       booking: booking ?? undefined,
//       patientUpdate: Object.keys(patientUpdate).length > 0 ? patientUpdate : undefined,
//     })

//   } catch (err) {
//     console.error('[/api/chat]', err)
//     return NextResponse.json(
//       { error: 'Something went wrong. Please try again.' },
//       { status: 500 }
//     )
//   }
// }
