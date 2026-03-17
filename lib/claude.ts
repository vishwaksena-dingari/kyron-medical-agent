import Anthropic from '@anthropic-ai/sdk'
// import { GoogleGenAI } from '@google/ggenai'   // wrong package — was a typo
import { GoogleGenAI } from '@google/genai'
import type { PatientContext, Specialty } from '@/types'
import {
    DOCTORS,
    getDoctorBySpecialty,
    getDoctorsBySpecialty,
    getDoctorById,
    getAvailableSlots,
    getSlotsForDayPreference,
    bookSlot,
    getSlotById,
} from '@/lib/doctors'
import { sendConfirmationEmail } from '@/lib/resend'
import { generateAppointmentId } from '@/lib/utils'

// ─── Client ───────────────────────────────────────────────────────────────────

// export const anthropic = new Anthropic({
//     apiKey: process.env.ANTHROPIC_API_KEY,
// })

export const anthropic =
    process.env.ANTHROPIC_API_KEY
        ? new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
        : null

export const gemini =
    process.env.GEMINI_API_KEY
        ? new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY })
        : null

export const GEMINI_MODEL =
    process.env.GEMINI_MODEL || 'gemini-2.5-flash'

export const ANTHROPIC_MODEL =
    process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-20250514'

// export function getPreferredProvider(): 'gemini' | 'anthropic' {
//     if (process.env.GEMINI_API_KEY) return 'gemini'
//     return 'anthropic'
// }

export function getPreferredProvider(): 'gemini' | 'anthropic' | 'langchain' {
    const pref = process.env.LLM_PROVIDER?.toLowerCase()
    if (pref === 'langchain' && hasAnthropic()) return 'langchain'
    if (pref === 'anthropic' && hasAnthropic()) return 'anthropic'
    if (pref === 'gemini' && hasGemini()) return 'gemini'
    if (hasGemini()) return 'gemini'
    if (hasAnthropic()) return 'anthropic'
    throw new Error('No LLM provider configured.')
}

export function hasGemini(): boolean {
    return Boolean(process.env.GEMINI_API_KEY && gemini)
}

export function hasAnthropic(): boolean {
    return Boolean(process.env.ANTHROPIC_API_KEY && anthropic)
}
// ─── System prompt ────────────────────────────────────────────────────────────

// export const SYSTEM_PROMPT = `
// You are Kyron Medical’s patient support assistant.You help patients with administrative tasks in a warm, calm, human way.

// Your job is to help patients with:
// 1. Scheduling appointments
// 2. Prescription refill inquiries
// 3. Office address, hours, and basic practice information

// You are patient - facing.Sound natural, kind, respectful, and efficient.Keep replies concise.Do not sound robotic, overly formal, or overly enthusiastic.Write like a thoughtful front - desk coordinator with excellent bedside manner.

// IMPORTANT SAFETY RULES
//     - Never give medical advice, medical opinions, diagnoses, treatment recommendations, or urgency assessments.
// - Never suggest medications, dosages, home remedies, or whether a condition is serious.
// - Never interpret symptoms clinically.
// - Never tell a patient to start, stop, increase, or decrease any medication.
// - If a patient asks for medical advice, respond briefly and safely:
// - say you can help with scheduling, refill requests, and office information
//     - encourage them to contact their clinician for medical guidance
//         - if they describe something that may be urgent or dangerous, tell them to call 911 or seek emergency care immediately
//             - Do not make up facts, appointments, refill status, providers, office hours, or policies.
// - Only rely on available tool results and known practice data.
// - If information is unavailable, say so clearly and offer the next best administrative step.

// GENERAL STYLE
//     - Be warm, human, and reassuring.
// - Be concise.Usually 1 to 4 short paragraphs or a few short sentences.
// - Ask only the next necessary question.
// - Do not ask for many details at once unless needed.
// - Guide the patient step by step.
// - Use plain language.
// - If the patient already provided information, do not ask for it again.
// - Confirm important actions clearly.

// CORE BEHAVIOR
// You should help the patient complete tasks, not just answer questions.

//     WORKFLOW 1: APPOINTMENT SCHEDULING
// Goal: help the patient book an appointment with the correct provider.

// When scheduling, collect or confirm:
// - first name
//     - last name
//         - date of birth
//             - phone number
//                 - email
//                 - reason for visit
//                     - body part or issue area, if relevant

// Then:
//     - identify the correct provider based on the body part or reason for visit
//         - if the practice does not treat that body part or issue, say so politely and clearly
//             - offer available dates and times from the scheduling tools
//                 - handle patient preferences naturally, such as:
// - “Do you have anything on Tuesday ?”
// - “I need something in the morning”
// - “Anything later this week ?”
// - if the patient gives a preference, use it when searching
//     - once a slot is chosen, confirm the appointment details clearly
//         - after booking, tell the patient a confirmation will be emailed
//             - if SMS is available, only mention text confirmation if the patient has opted in

//                 Important:
// - Never invent availability
//     - Never confirm a booking unless the booking tool succeeds
//         - If a slot is no longer available, apologize briefly and offer the next closest options

// WORKFLOW 2: PRESCRIPTION REFILL INQUIRIES
// Goal: help the patient with refill - related administrative support only.

// You may:
// - collect identifying information needed for the refill request
//     - collect the medication name if the workflow supports it
//         - check refill request status if tools allow
//             - submit or route a refill request if tools allow
//                 - explain expected administrative next steps

// You must not:
// - advise whether the patient should take the medication
//     - advise on side effects, safety, substitutions, missed doses, or dosage changes
//         - answer clinical questions about the medication

// If a patient asks a clinical medication question, say something like:
// “I can help with refill requests and status updates, but I’m not able to give medical advice about medications.Please contact your clinician or pharmacist for guidance.”

// WORKFLOW 3: OFFICE HOURS / LOCATION / PRACTICE INFO
// You may help with:
// - office hours
//     - office addresses
//         - phone numbers
//             - basic practice logistics
//                 - whether a location is open on a certain day, if known from tools / data

// Keep these answers direct and simple.
// Do not invent hours or locations.

// HANDLING MISSING OR AMBIGUOUS INFORMATION
//     - If the patient’s request is unclear, ask one focused follow - up question.
// - If multiple providers could fit, choose based on available matching logic or explain the closest option.
// - If the patient gives partial information, continue from there.
// - If a tool fails, apologize simply and offer the next best option.

// TONE EXAMPLES
// Good tone:
// - “I can help with that.”
// - “Sure — what day works best for you ?”
// - “I found two openings next Tuesday.”
// - “Thanks.I have your date of birth as March 8, 1998 — is that correct ?”
// - “I’m sorry, we don’t currently treat that area at this practice.”
// - “I can help with the refill request, but I can’t answer medical questions about the medication.”

// Avoid:
// - long explanations
//     - corporate language
//         - sounding like a bot
//             - excessive disclaimers unless safety requires it

// ESCALATION SAFETY
// If the patient mentions chest pain, trouble breathing, passing out, suicidal thoughts, stroke - like symptoms, severe bleeding, or another potentially dangerous emergency, do not analyze it.Say:
// “I’m not able to provide medical advice, but this may need urgent attention.Please call 911 or seek emergency care right away.”

// TOOL USAGE RULES
//     - Use tools for any real - world data lookup, scheduling, refill status, booking, or practice info.
// - Do not pretend to have performed an action if no tool confirms it.
// - Base confirmations only on tool results.
// - If tool data conflicts with earlier conversation, trust the latest tool result.

// FINAL BEHAVIOR RULE
// Be helpful, warm, and efficient.Help the patient complete the task.Stay strictly within administrative support.Never cross into medical advice.
// `

// export const ARIA_SYSTEM_PROMPT = `You are Aria, a warm and caring virtual assistant for Kyron Medical — a physician group serving patients in Providence, Rhode Island.

// You help patients with three things:
// 1. Scheduling appointments with the right specialist
// 2. Prescription refill inquiries
// 3. Office hours and location information

// You are NOT a doctor, nurse, or medical professional. You cannot and will NEVER provide medical advice, diagnoses, clinical guidance, medication recommendations, or anything that could be construed as treatment advice — no exceptions, even if rephrased, hypothetical, or asked indirectly.

// ════════════════════
// PERSONA & TONE
// ════════════════════
// Speak like a caring, warm front-desk coordinator at a patient-first practice. Conversational but professional. Use the patient's first name once you have it. Never be robotic or list-heavy in your responses. Short responses unless presenting options or confirming details — never more than 3 sentences unless necessary. One topic per message. Never ask two questions in the same message.

// ════════════════════
// HARD SAFETY RULES — NEVER BREAK THESE
// ════════════════════
// 1. If asked anything clinical (symptoms, diagnoses, medications, dosages, treatment options, "should I see a doctor?", "is this normal?", "what does this mean?"):
//    Respond: "I'm not able to offer any medical guidance — but I'd be happy to connect you with one of our providers. I can get you scheduled right now if you'd like."

// 2. If the patient sounds distressed, mentions chest pain, difficulty breathing, severe symptoms, or anything that sounds urgent:
//    Respond: "If this feels like an emergency, please call 911 or go to your nearest ER right away. I don't want you to wait."
//    Then offer to schedule a follow-up appointment.

// 3. Never confirm, deny, or comment on specific medications beyond acknowledging a refill request was submitted.

// 4. Never speculate about what a doctor might say, find, or recommend.

// ════════════════════
// WORKFLOW 1: APPOINTMENT SCHEDULING
// ════════════════════
// Collect in this exact order — ONE field per message, naturally woven into conversation:
// 1. Reason for visit (ask this FIRST — use it to determine specialty)
// 2. First and last name
// 3. Date of birth
// 4. Phone number
// 5. Email address

// After EACH field is collected, call update_patient_field immediately.

// After collecting the reason, internally determine the specialty — do NOT ask the patient which doctor or specialty they want. Call get_available_slots with the matched specialty.

// SPECIALTY MATCHING:
// • Heart, chest, blood pressure, palpitations, cardiovascular → Cardiology → Dr. Elena Chen
// • Bones, joints, knee, hip, shoulder, back, spine, sports injury, fracture, arthritis → Orthopedics → Dr. Raj Patel
// • Stomach, digestion, acid reflux, bowel, liver, colon, nausea, bloating → Gastroenterology → Dr. Sofia Rivera
// • Headaches, migraines, dizziness, memory, nerves, brain, seizures, tremors, numbness → Neurology → Dr. James Kim
// • Skin, rash, acne, moles, eczema, psoriasis, hair loss → Dermatology → Dr. Priya Mehta
// • Anything not matching: "I want to make sure we find the right provider for you. Our practice specializes in cardiology, orthopedics, gastroenterology, neurology, and dermatology. For other concerns, your primary care provider would be a great first step."

// Presenting slots — say something like:
// "Dr. Patel has a few openings coming up — here are some times that might work:"
// [The UI will render the slots as clickable pills]

// If patient asks for a specific day/time preference: call get_available_slots again with that day_preference.

// Once a slot is chosen, confirm all details:
// "Perfect — so that's [Name] with Dr. [X] on [day and date] at [time]. I'll send a confirmation to [email]. Does that all look right?"

// On explicit confirmation → call confirm_booking.

// ════════════════════
// WORKFLOW 2: PRESCRIPTION REFILL
// ════════════════════
// Ask for: full name, date of birth, phone number on file.
// Call check_refill for each field as you collect it, then call submit_refill.
// Say: "I've submitted a refill request for your account. Our pharmacy team typically follows up within 1–2 business days at the phone number on file."

// ════════════════════
// WORKFLOW 3: OFFICE HOURS & LOCATIONS
// ════════════════════
// Call get_office_info when patient asks about location, hours, address, parking, or directions.

// ════════════════════
// TOOL USAGE RULES
// ════════════════════
// • Call update_patient_field EVERY time you collect a piece of patient info — immediately after collecting it
// • Call get_available_slots as soon as you have the specialty (before asking for intake fields)
// • Call confirm_booking only after explicit patient confirmation ("yes", "confirm", "that works", "perfect", etc.)
// • Never make up slot data — always call get_available_slots
// • You may call multiple tools in sequence within the same turn

// ════════════════════
// VOICE CALL CONTEXT
// ════════════════════
// If this conversation begins with "[VOICE CALL CONTEXT]" — the patient has transferred from a web chat to a phone call. The full chat transcript is provided. Greet them by first name, acknowledge where you left off naturally, and continue as if it's one seamless conversation. Keep voice responses SHORT (2–3 sentences max). Do not reference "the chat" or "the website."

// ════════════════════
// STYLE RULES
// ════════════════════
// • If patient goes off-topic: "Let me make sure I get this taken care of for you — I'll pick back up after we finish scheduling."
// • No bullet points in responses (except when listing slot options in text form).
// • Plain English. No medical jargon.
// • Vary acknowledgments — don't say "Certainly!" or "Absolutely!" repeatedly.
// • End every completed workflow: "Is there anything else I can help you with today?"
// • If you make an error or collect wrong info, simply correct it: "My apologies — let me update that."
// `

export const ARIA_SYSTEM_PROMPT = `You are Aria, a warm and caring virtual assistant for Kyron Medical — a physician group serving patients in Providence, Rhode Island.

You help patients with three things:
1. Scheduling appointments with the right specialist
2. Prescription refill inquiries
3. Office hours and location information

You are NOT a doctor, nurse, or medical professional. You cannot and will NEVER provide medical advice, diagnoses, clinical guidance, medication recommendations, or anything that could be construed as treatment advice — no exceptions, even if rephrased, hypothetical, or asked indirectly.

════════════════════
PERSONA & TONE
════════════════════
Speak like a caring, warm front-desk coordinator at a patient-first practice. Conversational but professional. Use the patient's first name once you have it. Never be robotic or list-heavy in your responses. Short responses unless presenting options or confirming details — never more than 3 sentences unless necessary. One topic per message. Never ask two questions in the same message.

════════════════════
HARD SAFETY RULES — NEVER BREAK THESE
════════════════════
1. If asked anything clinical (symptoms, diagnoses, medications, dosages, treatment options, "should I see a doctor?", "is this normal?", "what does this mean?"):
   Respond: "I'm not able to offer any medical guidance — but I'd be happy to connect you with one of our providers. I can get you scheduled right now if you'd like."

2. If the patient sounds distressed, mentions chest pain, difficulty breathing, severe symptoms, or anything that sounds urgent:
   Respond: "If this feels like an emergency, please call 911 or go to your nearest ER right away. I don't want you to wait."
   Then offer to schedule a follow-up appointment.

3. Never confirm, deny, or comment on specific medications beyond acknowledging a refill request was submitted.

4. Never speculate about what a doctor might say, find, or recommend.

════════════════════
WORKFLOW 1: APPOINTMENT SCHEDULING
════════════════════
Collect in this exact order — ONE field per message, naturally woven into conversation:
1. Reason for visit (ask this FIRST — use it to determine specialty)
2. First and last name
3. Date of birth
4. Phone number
5. Email address

After EACH field is collected, call update_patient_field immediately.

After collecting the reason, internally determine the specialty — do NOT ask the patient which doctor or specialty they want.

DOCTOR SELECTION FLOW:
Step 1: ALWAYS call get_doctors_for_specialty FIRST — before saying anything about doctors. Never ask the patient to choose a doctor without calling this tool first.
Step 2: If only one doctor is available, proceed directly — say "I can get you in with [doctor name]" and immediately call get_available_slots with doctor_id from the tool result.
Step 3: If multiple doctors are available, say something like "We have a couple of [specialty] specialists available — here are your options:" [The UI will show clickable doctor cards] Then wait for the patient to choose.
Step 4: Once the patient chooses a doctor (by clicking a card or typing a name), call get_available_slots with the doctor_id from the get_doctors_for_specialty result. If you have the doctor_name but not the id, pass doctor_name instead.

SPECIALTY MATCHING:
• Heart, chest, blood pressure, palpitations, cardiovascular → cardiology
• Bones, joints, knee, hip, shoulder, back, spine, sports injury, fracture, arthritis → orthopedics
• Stomach, digestion, acid reflux, bowel, liver, colon, nausea, bloating → gastroenterology
• Headaches, migraines, dizziness, memory, nerves, brain, seizures, tremors, numbness → neurology
• Skin, rash, acne, moles, eczema, psoriasis, hair loss → dermatology
• Anything not matching: "I want to make sure we find the right provider for you. Our practice specializes in cardiology, orthopedics, gastroenterology, neurology, and dermatology. For other concerns, your primary care provider would be a great first step."

Presenting slots:
Say ONE short sentence to introduce the options, then STOP. Example: "Dr. Santos has some openings coming up — here are some times that might work:"
NEVER list slots as bullet points or dates in your text. The UI automatically renders clickable slot pills — your text message must not duplicate them.

Handle patient time preferences naturally — if they say something like "do you have anything on a Tuesday?", "I need a morning slot", or "anything later this week?", call get_available_slots again with that day_preference.

If a slot is no longer available when the patient tries to book it, apologize briefly in ONE sentence and say you are pulling up fresh options. NEVER list the new slots as text — the UI will show new clickable pills automatically.

Once a slot is chosen, confirm all details:
"Perfect — so that's [Name] with Dr. [X] on [day and date] at [time]. I'll send a confirmation to [email]. Does that all look right?"

On explicit confirmation → call confirm_booking.

════════════════════
WORKFLOW 2: PRESCRIPTION REFILL
════════════════════
Ask for: full name, date of birth, and phone number on file.
After collecting each field, call update_patient_field.
If the patient mentions a medication name, collect it naturally.
Once enough identifying information is available, call check_refill.
If no active refill request exists, call submit_refill.
Say only administrative information such as whether a refill is already pending, requires review, or has been submitted.
Never provide medication advice, dosage guidance, or clinical recommendations.

════════════════════
WORKFLOW 3: OFFICE HOURS & LOCATIONS
════════════════════
Call get_office_info when patient asks about location, hours, address, parking, or directions.

════════════════════
TOOL USAGE RULES
════════════════════
• Call update_patient_field EVERY time you collect a piece of patient info — immediately after collecting it
• ALWAYS call get_doctors_for_specialty as soon as you know the specialty — never skip this step
• After patient chooses a doctor, call get_available_slots with doctor_id (use the id from get_doctors_for_specialty result, e.g. "dr-santos") OR doctor_name if id is unavailable
• Never call get_available_slots with only specialty — always include doctor_id or doctor_name
• Call confirm_booking only after explicit patient confirmation ("yes", "confirm", "that works", "perfect", etc.)
• Never make up slot data — always call get_available_slots
• Never confirm a booking unless confirm_booking tool returns success
• If a tool fails, apologize simply ("I'm having a little trouble pulling that up — let me try another way") and offer the next best administrative step
• If the patient gives partial information, continue collecting from where they left off — never restart
• You may call multiple tools in sequence within the same turn

════════════════════
VOICE CALL CONTEXT
════════════════════
If this conversation begins with "[VOICE CALL CONTEXT]" — the patient has transferred from a web chat to a phone call. The full chat transcript is provided. Greet them by first name, acknowledge where you left off naturally, and continue as if it's one seamless conversation. Keep voice responses SHORT (2–3 sentences max). Do not reference "the chat" or "the website."

════════════════════
STYLE RULES
════════════════════
• If patient goes off-topic: "Let me make sure I get this taken care of for you — I'll pick back up after we finish scheduling."
• No bullet points in responses (except when listing slot options in text form).
• Plain English. No medical jargon.
• Vary acknowledgments — don't say "Certainly!" or "Absolutely!" repeatedly.
• End every completed workflow: "Is there anything else I can help you with today?"
• If you make an error or collect wrong info, simply correct it: "My apologies — let me update that."
`

// ─── Tool definitions ─────────────────────────────────────────────────────────

export const TOOLS: Anthropic.Tool[] = [
    {
        name: 'update_patient_field',
        description:
            'Call this EVERY time you collect a patient intake field. Updates the patient info panel in real-time. Call immediately after collecting each field.',
        input_schema: {
            type: 'object' as const,
            properties: {
                field: {
                    type: 'string',
                    enum: ['name', 'dob', 'phone', 'email', 'reason'],
                    description: 'Which patient field was just collected',
                },
                value: {
                    type: 'string',
                    description: 'The value the patient provided',
                },
            },
            required: ['field', 'value'],
        },
    },
    {
        name: 'get_doctors_for_specialty',
        description:
            'Get all available doctors for a specialty. Call this FIRST when you know the specialty, before get_available_slots. Returns a list of doctors the patient can choose from.',
        input_schema: {
            type: 'object' as const,
            properties: {
                specialty: {
                    type: 'string',
                    enum: ['cardiology', 'orthopedics', 'gastroenterology', 'neurology', 'dermatology'],
                },
            },
            required: ['specialty'],
        },
    },
    {
        name: 'get_available_slots',
        description:
            'Retrieve available appointment slots for a specific doctor. Call this after the patient has chosen a doctor. Pass doctor_id (from get_doctors_for_specialty result) or doctor_name to identify the doctor.',
        input_schema: {
            type: 'object' as const,
            properties: {
                specialty: {
                    type: 'string',
                    enum: ['cardiology', 'orthopedics', 'gastroenterology', 'neurology', 'dermatology'],
                    description: 'The specialty',
                },
                doctor_id: {
                    type: 'string',
                    description: 'The doctor ID from get_doctors_for_specialty result (e.g. "dr-santos"). Use this if available.',
                },
                doctor_name: {
                    type: 'string',
                    description: 'The doctor full name (e.g. "Dr. Lucia Santos"). Used as fallback if doctor_id is not available.',
                },
                day_preference: {
                    type: 'string',
                    description:
                        'Optional patient day/time preference e.g. "tuesday", "morning", "afternoon", "next week"',
                },
            },
            required: ['specialty'],
        },
    },
    {
        name: 'confirm_booking',
        description:
            'Book the appointment and send confirmation email with ICS calendar file. Only call after explicit patient confirmation. Do not call speculatively.',
        input_schema: {
            type: 'object' as const,
            properties: {
                slot_id: { type: 'string', description: 'The slot ID from get_available_slots' },
                doctor_id: { type: 'string', description: 'The doctor ID' },
                patient_name: { type: 'string' },
                patient_email: { type: 'string' },
                patient_phone: { type: 'string' },
                patient_dob: { type: 'string' },
            },
            required: ['slot_id', 'doctor_id', 'patient_name', 'patient_email', 'patient_phone'],
        },
    },
    {
        name: 'get_office_info',
        description: 'Get office locations, hours, addresses, and phone numbers.',
        input_schema: {
            type: 'object' as const,
            properties: {
                location: {
                    type: 'string',
                    enum: ['providence', 'cranston', 'all'],
                },
            },
            required: ['location'],
        },
    },
    {
        name: 'submit_refill',
        description: 'Submit a prescription refill inquiry for a patient.',
        input_schema: {
            type: 'object' as const,
            properties: {
                patient_name: { type: 'string' },
                patient_dob: { type: 'string' },
                patient_phone: { type: 'string' },
                medication_name: {
                    type: 'string',
                    description: 'Optional medication name if provided by the patient',
                },
            },
            required: ['patient_name', 'patient_phone'],
        },
    },
    {
        name: 'check_refill',
        description: 'Check refill request status or whether a refill can be submitted for a patient. Administrative only. Never provides medical advice.',
        input_schema: {
            type: 'object' as const,
            properties: {
                patient_name: { type: 'string' },
                patient_dob: { type: 'string' },
                patient_phone: { type: 'string' },
                medication_name: {
                    type: 'string',
                    description: 'Optional medication name if the patient mentions it',
                },
            },
            required: ['patient_name', 'patient_dob', 'patient_phone'],
        },
    },
]

// ─── Neutral model types ──────────────────────────────────────────────────────

export type NeutralMessage =
    | { role: 'user'; content: string }
    | { role: 'assistant'; content: string; toolCalls?: ModelToolCall[] }
    | { role: 'tool'; name: string; toolCallId: string; content: string }

export interface ModelToolCall {
    id: string
    name: string
    input: Record<string, unknown>
}

export interface ModelTurnResult {
    assistantText: string
    toolCalls: ModelToolCall[]
}

// ─── Anthropic adapter ────────────────────────────────────────────────────────

type AnthropicMessage = { role: 'user' | 'assistant'; content: unknown }

function toAnthropicMessages(messages: NeutralMessage[]): AnthropicMessage[] {
    const result: AnthropicMessage[] = []
    let i = 0
    while (i < messages.length) {
        const msg = messages[i]
        if (msg.role === 'tool') {
            const toolResults: Array<{ type: 'tool_result'; tool_use_id: string; content: string }> = []
            while (i < messages.length && messages[i].role === 'tool') {
                const t = messages[i] as { role: 'tool'; name: string; toolCallId: string; content: string }
                toolResults.push({ type: 'tool_result', tool_use_id: t.toolCallId, content: t.content })
                i++
            }
            result.push({ role: 'user', content: toolResults })
            continue
        }
        if (msg.role === 'assistant' && msg.toolCalls && msg.toolCalls.length > 0) {
            // Anthropic requires tool_use blocks inside the assistant message content array
            const content: unknown[] = []
            if (msg.content) content.push({ type: 'text', text: msg.content })
            for (const tc of msg.toolCalls) {
                content.push({ type: 'tool_use', id: tc.id, name: tc.name, input: tc.input })
            }
            result.push({ role: 'assistant', content })
            i++
            continue
        }
        result.push({ role: msg.role as 'user' | 'assistant', content: msg.content })
        i++
    }
    return result
}

export async function runAnthropicTurn(params: {
    messages: NeutralMessage[]
    systemPrompt: string
    onText?: (text: string) => void
}): Promise<ModelTurnResult> {
    if (!anthropic) throw new Error('Anthropic client not configured')

    const response = await anthropic.messages.create({
        model: ANTHROPIC_MODEL,
        max_tokens: 1024,
        temperature: 0.4,
        system: params.systemPrompt,
        tools: TOOLS,
        messages: toAnthropicMessages(params.messages) as never,
        stream: true,
    })

    let assistantText = ''
    const toolCalls: ModelToolCall[] = []
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
                    params.onText?.(event.delta.text)
                } else if (event.delta.type === 'input_json_delta') {
                    currentToolInputRaw += event.delta.partial_json
                }
                break
            case 'content_block_stop':
                if (currentToolId && currentToolName) {
                    let parsedInput: Record<string, unknown> = {}
                    try { parsedInput = JSON.parse(currentToolInputRaw) as Record<string, unknown> } catch { parsedInput = {} }
                    toolCalls.push({ id: currentToolId, name: currentToolName, input: parsedInput })
                    currentToolId = ''
                    currentToolName = ''
                    currentToolInputRaw = ''
                }
                break
        }
    }

    return { assistantText, toolCalls }
}

// ─── Gemini adapter ───────────────────────────────────────────────────────────

// function toGeminiTools() {
//     return [{
//         functionDeclarations: TOOLS.map((tool) => ({
//             name: tool.name,
//             description: tool.description,
//             parameters: tool.input_schema,
//         })),
//     }]
// }

function toGeminiTools() {
    return [
        {
            functionDeclarations: TOOLS.map((tool) => ({
                name: tool.name,
                description: tool.description,
                parameters: tool.input_schema as unknown as Record<string, unknown>,
            })),
        },
    ] as unknown as import('@google/genai').ToolUnion[]
}

type GeminiPart =
    | { text: string }
    | { functionCall: { name: string; args: Record<string, unknown> } }
    | { functionResponse: { name: string; response: { result: unknown } } }

type GeminiContent = { role: 'user' | 'model'; parts: GeminiPart[] }

function toGeminiContents(messages: NeutralMessage[]): GeminiContent[] {
    const result: GeminiContent[] = []
    let i = 0
    while (i < messages.length) {
        const msg = messages[i]
        if (msg.role === 'tool') {
            const parts: GeminiPart[] = []
            while (i < messages.length && messages[i].role === 'tool') {
                const t = messages[i] as { role: 'tool'; name: string; toolCallId: string; content: string }
                let parsed: unknown = {}
                try { parsed = JSON.parse(t.content) } catch { parsed = {} }
                parts.push({ functionResponse: { name: t.name, response: { result: parsed } } })
                i++
            }
            result.push({ role: 'user', parts })
            continue
        }
        result.push({
            role: msg.role === 'assistant' ? 'model' : 'user',
            parts: [{ text: msg.content }],
        })
        i++
    }
    return result
}

function genId(): string {
    if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID()
    return `tool-${Math.random().toString(36).slice(2, 10)}`
}

export async function runGeminiTurn(params: {
    messages: NeutralMessage[]
    systemPrompt: string
    onText?: (text: string) => void
}): Promise<ModelTurnResult> {
    if (!gemini) throw new Error('Gemini client not configured')

    const response = await gemini.models.generateContent({
        model: GEMINI_MODEL,
        contents: toGeminiContents(params.messages),
        config: {
            systemInstruction: params.systemPrompt,
            tools: toGeminiTools(),
        },
    })

    const parts = response.candidates?.[0]?.content?.parts ?? []
    let assistantText = ''
    const toolCalls: ModelToolCall[] = []

    for (const part of parts) {
        if ('text' in part && part.text) assistantText += part.text
        if ('functionCall' in part && part.functionCall) {
            toolCalls.push({
                id: genId(),
                name: part.functionCall.name ?? '',
                input: (part.functionCall.args ?? {}) as Record<string, unknown>,
            })
        }
    }

    if (assistantText) params.onText?.(assistantText)
    return { assistantText, toolCalls }
}

// ─── Unified runner ───────────────────────────────────────────────────────────

export async function runModelTurn(params: {
    preferredProvider?: 'gemini' | 'anthropic' | 'langchain'
    messages: NeutralMessage[]
    systemPrompt: string
    onText?: (text: string) => void
}): Promise<ModelTurnResult> {
    const preferred = params.preferredProvider ?? getPreferredProvider()

    if (preferred === 'langchain') {
        // Lazy import to avoid pulling LangChain into the bundle when not needed
        const { runLangChainTurn } = await import('@/lib/langchain')
        try {
            return await runLangChainTurn(params)
        } catch (err) {
            if (!hasAnthropic()) throw err
            console.warn('[chat] LangChain failed, falling back to Claude:', err)
            return await runAnthropicTurn(params)
        }
    }

    if (preferred === 'gemini' && hasGemini()) {
        try {
            return await runGeminiTurn(params)
        } catch (err) {
            if (!hasAnthropic()) throw err
            console.warn('[chat] Gemini failed, falling back to Claude:', err)
            return await runAnthropicTurn(params)
        }
    }

    if (hasAnthropic()) return await runAnthropicTurn(params)
    if (hasGemini()) return await runGeminiTurn(params)

    throw new Error('No LLM provider configured. Set GEMINI_API_KEY or ANTHROPIC_API_KEY in .env.local')
}

// ─── Tool executor ────────────────────────────────────────────────────────────

// Old signature — kept for reference
// export async function executeTool(
//     name: string,
//     input: Record<string, string>,
//     _patientContext: PatientContext
// ): Promise<Record<string, unknown>>

export async function executeTool(
    name: string,
    input: Record<string, unknown>,
    patientContext: PatientContext
): Promise<Record<string, unknown>> {
    switch (name) {
        case 'update_patient_field': {
            // Side effect collected in the API route — just acknowledge here
            return { success: true, field: input.field, value: input.value }
        }

        case 'get_doctors_for_specialty': {
            const specialty = input.specialty as Specialty
            const doctors = getDoctorsBySpecialty(specialty)
            if (doctors.length === 0) {
                return { error: 'No providers found for that specialty' }
            }
            return {
                specialty,
                doctors: doctors.map(d => ({
                    id: d.id,
                    name: d.name,
                    title: d.title,
                    specialty: d.specialty,
                    rating: d.rating,
                    yearsExperience: d.yearsExperience,
                    location: d.location,
                })),
            }
        }

        case 'get_available_slots': {
            // Priority: doctor_id → doctor_name match → first in specialty
            let doctor = input.doctor_id
                ? getDoctorById(input.doctor_id as string)
                : undefined

            if (!doctor && input.doctor_name) {
                const nameLower = (input.doctor_name as string).toLowerCase()
                doctor = DOCTORS.find(d => d.name.toLowerCase().includes(nameLower) || nameLower.includes(d.name.toLowerCase().replace('dr. ', '')))
            }

            if (!doctor) {
                doctor = getDoctorBySpecialty(input.specialty as Specialty)
            }

            if (!doctor) {
                return { error: 'No provider found for that specialty' }
            }

            const slots = input.day_preference
                ? getSlotsForDayPreference(doctor.id, String(input.day_preference))
                : getAvailableSlots(doctor.id, 6)

            if (slots.length === 0) {
                return {
                    doctor: { id: doctor.id, name: doctor.name, specialty: doctor.specialty },
                    slots: [],
                    message: 'No available slots found. Try a different time range.',
                }
            }

            return {
                doctor: {
                    id: doctor.id,
                    name: doctor.name,
                    title: doctor.title,
                    specialty: doctor.specialty,
                    location: doctor.location,
                    rating: doctor.rating,
                    yearsExperience: doctor.yearsExperience,
                    acceptedInsurance: doctor.acceptedInsurance,
                    languages: doctor.languages,
                },
                slots: slots.map(s => ({
                    id: s.id,
                    doctorId: s.doctorId,
                    label: s.label,
                    dayLabel: s.dayLabel,
                    timeLabel: s.timeLabel,
                    datetime: s.datetime,
                    available: !s.isBooked,
                })),
            }
        }

        case 'confirm_booking': {
            // patientContext.selectedSlotId is set when patient clicks a slot pill —
            // it is the ground truth. Claude's input.slot_id may be wrong because
            // the slot IDs are not included in the text conversation history.
            const slotId = patientContext.selectedSlotId || (input.slot_id as string) || ''
            const doctorId = (input.doctor_id as string) || patientContext.matchedDoctorId || ''

            const slotBooked = bookSlot(slotId)
            if (!slotBooked) {
                return {
                    success: false,
                    error: 'That slot is no longer available. Please choose another time.',
                }
            }

            const doctor = getDoctorById(doctorId)
            if (!doctor) {
                return { success: false, error: 'Provider not found.' }
            }

            const slot = getSlotById(slotId)
            if (!slot) {
                return { success: false, error: 'Slot not found.' }
            }

            const appointmentId = generateAppointmentId()

            // Send confirmation email (non-blocking — don't fail booking if email fails)
            sendConfirmationEmail({
                appointmentId,
                patientName: input.patient_name as string,
                patientEmail: input.patient_email as string,
                doctorName: doctor.name,
                specialty: doctor.specialty,
                slotLabel: slot.label,
                slotDatetime: slot.datetime,
                officeAddress: doctor.address,
            }).catch(err => console.error('[Email] Failed to send confirmation:', err))

            return {
                success: true,
                appointmentId,
                doctorName: doctor.name,
                specialty: doctor.specialty,
                slotLabel: slot.label,
                slotDatetime: slot.datetime,
                address: doctor.address,
            }
        }

        case 'get_office_info': {
            const OFFICES = {
                providence: {
                    name: 'Main Office — Providence',
                    address: '593 Eddy Street, Suite 100, Providence, RI 02903',
                    hours:
                        'Monday–Friday: 8:00 AM – 6:00 PM | Saturday: 9:00 AM – 1:00 PM | Sunday: Closed',
                    phone: '(401) 555-0192',
                    parking: 'Free parking available in the attached garage (enter from Eddy St)',
                },
                cranston: {
                    name: 'Satellite Office — Cranston',
                    address: '1045 Park Avenue, Suite 200, Cranston, RI 02910',
                    hours:
                        'Monday, Wednesday, Friday: 9:00 AM – 5:00 PM | Tuesday, Thursday, Saturday, Sunday: Closed',
                    phone: '(401) 555-0193',
                    parking: 'Street parking and lot available adjacent to building',
                },
            }

            if (input.location === 'all') {
                return {
                    offices: Object.values(OFFICES),
                    emergencyLine: '(401) 555-0911 (after-hours, non-emergency only)',
                }
            }

            const office = OFFICES[input.location as keyof typeof OFFICES]
            if (!office) return { error: 'Office not found' }

            return {
                office,
                emergencyLine: '(401) 555-0911 (after-hours, non-emergency only)',
            }
        }

        case 'submit_refill': {
            return {
                success: true,
                message: 'Refill inquiry submitted',
                estimatedResponse: '1–2 business days',
                contactPhone: '(401) 555-0192',
                medicationName: input.medication_name ?? null,
            }
        }

        case 'check_refill': {
            const MOCK_REFILL_DB = [
                {
                    patientName: 'John Smith',
                    dob: '1990-04-12',
                    phone: '+14015550111',
                    medicationName: 'atorvastatin',
                    status: 'pending',
                    detail: 'A refill request is already in progress.',
                    lastUpdated: '2026-03-15',
                },
                {
                    patientName: 'Maria Lopez',
                    dob: '1985-09-03',
                    phone: '+14015550112',
                    medicationName: 'omeprazole',
                    status: 'eligible',
                    detail: 'No active refill request found. A new refill request can be submitted.',
                    lastUpdated: '2026-03-10',
                },
                {
                    patientName: 'David Kim',
                    dob: '1978-01-22',
                    phone: '+14015550113',
                    medicationName: 'gabapentin',
                    status: 'requires_review',
                    detail: 'This refill requires clinician review before approval.',
                    lastUpdated: '2026-03-14',
                },
            ]

            const normalize = (s: string) => s.trim().toLowerCase()
            const normalizePhoneValue = (s: string) => s.replace(/\D/g, '')

            const match = MOCK_REFILL_DB.find(entry => {
                const sameName =
                    normalize(entry.patientName) === normalize(input.patient_name as string)
                const sameDob =
                    normalize(entry.dob) === normalize(input.patient_dob as string)
                const samePhone =
                    normalizePhoneValue(entry.phone) === normalizePhoneValue(input.patient_phone as string)

                const medicationMatches =
                    !input.medication_name ||
                    normalize(entry.medicationName) === normalize(input.medication_name as string)

                return sameName && sameDob && samePhone && medicationMatches
            })

            if (!match) {
                return {
                    success: false,
                    found: false,
                    status: 'not_found',
                    message:
                        'No matching refill record was found. A new refill request can still be submitted for review.',
                }
            }

            return {
                success: true,
                found: true,
                status: match.status,
                medicationName: match.medicationName,
                detail: match.detail,
                lastUpdated: match.lastUpdated,
            }
        }

        default:
            return { error: `Unknown tool: ${name}` }
    }
}
