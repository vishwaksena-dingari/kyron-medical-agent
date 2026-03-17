# Kyron Medical Patient Portal — Product Roadmap

## Current State (v1.0 — Demo Build)

### Features Shipped
| Feature | Implementation | Notes |
|---|---|---|
| AI chat with Aria (Claude) | `lib/claude.ts`, `app/api/chat/route.ts` | Tool-calling loop, multi-provider fallback |
| Specialty matching | `lib/matching.ts` | Keyword map + Claude semantic fallback |
| Appointment scheduling | `lib/doctors.ts`, `app/api/chat/route.ts` | 5 doctors, hardcoded slots 30-60 days |
| Live patient info panel | `components/PatientInfoPanel.tsx` | Updates field-by-field as Aria collects |
| Provider panel | `components/ProviderPanel.tsx` | Doctor card, slots, rating, insurance |
| Specialists panel | `components/SpecialistsPanel.tsx` | All 5 doctors, matched doctor highlighted |
| Slot pills (clickable) | `components/MessageBubble.tsx` | Rendered in chat, cleared after booking |
| Voice handoff (Vapi) | `lib/vapi.ts`, `app/api/initiate-call/route.ts` | Chat context injected into call |
| Returning caller memory | `lib/kv.ts`, `app/api/vapi-inbound/route.ts` | Upstash KV, keyed by phone (E.164) |
| Voice transcript save | `app/api/vapi-webhook/route.ts` | Saved after call.ended |
| Confirmation email + ICS | `lib/resend.ts`, `lib/utils.ts` | Calendar attachment, works with all clients |
| Prescription refill workflow | `lib/claude.ts` (WORKFLOW 2) | Submit + check refill via tools |
| Office info workflow | `lib/claude.ts` (WORKFLOW 3) | Hours, address, phone via get_office_info tool |
| Dark/light theme toggle | `app/page.tsx`, `app/globals.css` | Persisted in localStorage |
| Liquid glass UI | `app/globals.css` | Full CSS variables, animations |
| Phone + DOB formatting | `lib/phone.ts`, `app/api/chat/route.ts` | Normalized before storage and display |
| Slot booking idempotency | `lib/doctors.ts → bookSlot()` | Prevents double-booking within session |
| Booking failed → fresh pills | `app/api/chat/route.ts`, `components/ChatInterface.tsx` | booking_failed SSE event |
| Multi-provider LLM fallback | `lib/claude.ts → runModelTurn()` | Gemini primary → Claude fallback |
| LangChain adapter | `lib/langchain.ts` | `LLM_PROVIDER=langchain` — model-agnostic, SSE streaming works |
| Safety guardrails | `lib/claude.ts → ARIA_SYSTEM_PROMPT` | Hard rules, emergency escalation, topic lock |
| Unit tests | `__tests__/` | phone, matching, utils, doctors |

### Known Limitations (v1.0)
- Slots are in-memory — reset on server restart (Vercel: each cold start resets)
- No auth — phone number is identity key
- No SMS — Twilio A2P 10DLC registration takes days
- No database — patient data lives in browser state only
- Slots can only be booked once per server session

---

## v1.1 — LangChain Deep Integration

### LangChain AgentExecutor (Full Loop Ownership)
**What**: Move from a thin LangChain wrapper (one model call) to `AgentExecutor` owning the entire tool-calling loop. The manual `while` loop in `route.ts` disappears.

**How**:
- Define each tool as a `DynamicStructuredTool` with a real `func` implementation wrapping `executeTool()`
- Use `createToolCallingAgent` + `AgentExecutor` from `langchain/agents`
- `AgentExecutor.invoke()` replaces the while loop in `app/api/chat/route.ts`
- Streaming: use LangChain's `callbacks` (`handleLLMNewToken`) to pipe SSE tokens to the browser

**Why it matters**: Unlocks LangSmith tracing for free — every tool call, token count, and latency shows up in the LangSmith dashboard automatically.

**File changes**: `lib/langchain.ts` (rewrite), `app/api/chat/route.ts` (simplify loop)

---

### OpenAI / Mistral Hot-Swap
**What**: Since LangChain abstracts the model, swap Claude for OpenAI GPT-4o or Mistral Large in one line — same tools, same system prompt, same SSE streaming.

**How**:
```typescript
// lib/langchain.ts — change this one import + constructor:
import { ChatOpenAI } from '@langchain/openai'
const model = new ChatOpenAI({ apiKey: process.env.OPENAI_API_KEY, model: 'gpt-4o' })

// Or Mistral:
import { ChatMistralAI } from '@langchain/mistralai'
const model = new ChatMistralAI({ apiKey: process.env.MISTRAL_API_KEY, model: 'mistral-large-latest' })
```

**New env var**: `LLM_PROVIDER=openai` | `LLM_PROVIDER=mistral`

---

### LangGraph State Graph (Multi-Step Orchestration)
**What**: Replace the flat tool-calling loop with a typed state graph. Each workflow stage is a node with typed inputs/outputs and conditional edges.

**Graph nodes**:
```
intake → specialty_match → doctor_select → slot_select → confirm → done
                                                ↑
                                         slot_unavailable (re-fetch)
```

**Why**: Makes complex flows (insurance check before booking, pre-visit form, multi-doctor comparison) trivial to add. Each node is independently testable.

**Stack**: `@langchain/langgraph`

---

### Semantic Symptom Matching (Vector Search)
**What**: Replace the keyword map in `lib/matching.ts` with vector embeddings. Handles edge cases like "my chest feels tight" or "trouble walking upstairs" that keywords miss.

**How**:
- Embed each specialty's description with `text-embedding-3-small` (OpenAI) or `models/text-embedding-004` (Gemini)
- Store in Pinecone or MongoDB Atlas Vector Search
- On new symptom: embed → nearest-neighbor search → return top specialty
- Fallback: current keyword map for zero-latency common cases

**LangChain integration**: use `OpenAIEmbeddings` + `PineconeStore` from `@langchain/pinecone`

---

## v1.3 — Persistence & Identity

### Returning User — Web Chat
**What**: When a patient opens the web chat and provides their phone or email, look up Upstash KV for any prior session and pre-fill the intake form. Aria greets them by name.

**How**:
- Add a "Welcome back" flow: collect phone/email first → KV lookup → inject context
- `lib/kv.ts → getCallerSession(phone)` already exists, just call it from the chat route
- Emit `intake_update` with all pre-filled fields on session start
- System prompt addition: "If [RETURNING USER CONTEXT] is provided, greet by name and confirm pre-filled info"

**Data stored**: name, DOB, phone, email, last doctor, last appointment, reason for visit

---

### OTP Verification (No SMS — In-App)
**What**: Before reading any PHI back to the user (name, appointments, refill status), verify identity with a 6-digit OTP shown in the UI and spoken by Aria on the phone.

**How**:
- Generate OTP: `Math.floor(100000 + Math.random() * 900000).toString()`
- Store in Upstash KV with 5-minute TTL: `kv.set(`otp:${phone}`, otp, { ex: 300 })`
- Web chat: show OTP input modal before revealing PHI
- Voice: Aria reads OTP prompt, patient says the 6 digits, Vapi transcribes, backend verifies
- No Twilio needed — OTP lives in-app only

**API routes needed**:
- `POST /api/generate-otp` → generates + stores OTP, returns masked phone
- `POST /api/verify-otp` → verifies, returns session token

---

### Slot Booking — KV Persistence
**What**: Booked slots persist across server restarts and Vercel cold starts.

**How**:
- On `bookSlot()`, also write to KV: `kv.set(`slot:${slotId}`, 'booked')`
- On `getAvailableSlots()`, check KV for each slot: `kv.get(`slot:${slotId}`)` → filter out booked
- TTL: 30 days (appointment window)

**Consideration**: Adds latency to `getAvailableSlots`. Batch the KV reads with `kv.mget()`.

---

## v1.4 — Database & Structured Records

### MongoDB Atlas (Patient Records)
**What**: Persistent patient records with full appointment history, refill history, raw chat logs.

**Schema**:
```typescript
// Patient
{
  _id: ObjectId,
  phone: string,          // E.164, indexed
  email: string,          // indexed
  name: string,
  dob: string,            // MM/DD/YYYY
  createdAt: Date,
  updatedAt: Date,
}

// Appointment
{
  _id: ObjectId,
  appointmentId: string,  // KM-XXXXXXXX
  patientPhone: string,   // FK → Patient.phone
  doctorId: string,
  slotId: string,
  slotLabel: string,
  bookedAt: Date,
  status: 'confirmed' | 'cancelled' | 'completed',
  rawChatTranscript: string,
  rawVoiceTranscript: string,
}

// RefillRequest
{
  _id: ObjectId,
  patientPhone: string,
  medication: string,
  submittedAt: Date,
  status: 'pending' | 'approved' | 'requires_review',
}
```

**Stack**: MongoDB Atlas free tier (512MB) + `mongoose` or native `mongodb` driver

**Migration path**: Replace in-memory `DOCTORS` slot mutation with MongoDB writes. Replace Upstash KV caller sessions with MongoDB patient lookup.

---

### Doctor Selection from Specialists Tab
**What**: Patient can click a doctor in the Specialists tab to request that doctor directly, without going through chat.

**How**:
- Add `onDoctorSelect?: (doctor: Doctor) => void` prop to `SpecialistsPanel`
- On click → call `sendMessage(`I'd like to see ${doctor.name}`)` in ChatInterface
- Aria picks it up and adjusts the booking flow

---

## v1.5 — Auth & Security

### SMS OTP via Twilio (Production Auth)
**What**: Real SMS verification before reading PHI. Patient receives 6-digit code by text.

**Requirements**:
- Twilio A2P 10DLC registration (2-5 business days)
- Explicit SMS opt-in checkbox in UI (required by Twilio ToS)
- Patient types code → verified → session token issued (JWT, 30-min TTL)

**Flow**:
1. Patient provides phone → opt-in checkbox → "Send code"
2. `POST /api/send-otp` → Twilio SMS → OTP in KV (5 min TTL)
3. Patient enters code → `POST /api/verify-otp` → JWT returned
4. All subsequent requests include JWT in header

---

### HIPAA Audit Log
**What**: Every read of PHI is logged with timestamp, accessor, and data accessed.

**How**:
- Middleware on all API routes that read patient data
- Write to append-only KV list: `kv.lpush(`audit:${phone}`, JSON.stringify({ ts, route, fields }))`
- Or MongoDB collection with no-delete policy

---

### JWT Session Tokens
**What**: Replace phone-as-identity with signed JWT sessions.

**How**:
- After OTP verification → issue JWT: `{ sub: phone, exp: 30min }`
- All API routes validate JWT before touching patient data
- Refresh token stored in KV, access token in memory only

---

## v1.6 — Voice Upgrades

### Real-Time Voice Transcript in UI
**What**: While the patient is on the call, show a live transcript in the web UI.

**How**:
- Vapi supports WebSocket transcript streaming
- Open WebSocket from frontend to Vapi during active call
- Render transcript tokens in a read-only chat bubble overlay
- Close WebSocket on call.ended

---

### Doctor Selection via Voice
**What**: Patient can say "can I see a different doctor?" during the call, Aria checks availability and switches.

**How**:
- Add `switch_doctor` tool to Vapi assistant's tool list
- Tool fetches available slots for requested specialty
- Aria confirms new doctor and slot verbally

---

### Post-Call Summary Email
**What**: After the call ends, send a summary email with the voice transcript and any actions taken.

**How**:
- `vapi-webhook` already saves transcript to KV
- Add `sendPostCallSummary()` to `lib/resend.ts`
- Call it from `vapi-webhook` after saving to KV

---

## v1.7 — Admin & Analytics

### Admin Dashboard
**What**: Internal view for practice staff to see appointments, refill requests, call logs.

**Stack**: Next.js route group `/admin`, protected by NextAuth

**Views**:
- Today's appointments (all doctors)
- Pending refill requests
- Call logs with transcripts
- Patient lookup by phone/name

---

### LangSmith Observability
**What**: Trace every LLM call, tool invocation, and latency in production.

**How**:
- Wrap `runModelTurn()` with LangSmith trace callbacks
- Dashboard shows: token usage, tool call frequency, error rate, p95 latency
- Alert on: tool call loops > 5 iterations, error rate > 2%

---

### Appointment Reminder Emails
**What**: Automated email 24 hours before appointment with rescheduling link.

**How**:
- Cron job (Vercel Cron) runs daily at 8 AM
- Queries appointments for next day
- Sends reminder via Resend with ICS re-attachment

---

## v2.0 — Multi-Tenant (Kyron Medical Product)

### Multi-Practice Support
**What**: Each physician group gets their own branded portal with their own doctors, slots, and Vapi phone number.

**How**:
- Tenant config: `{ practiceId, name, logo, colors, doctors[], vapiAssistantId, vapiPhoneId }`
- All KV keys prefixed with `practiceId`
- Subdomain routing: `{practice}.kyronmedical.com`

---

### EHR Integration
**What**: Pull real patient data and availability from Epic/Cerner/Athena via FHIR API.

**Replaces**: Hardcoded `DOCTORS` array and in-memory slots

**How**:
- `lib/fhir.ts` — FHIR R4 client
- `getAvailableSlots()` → FHIR `Slot` resource query
- `bookSlot()` → FHIR `Appointment` resource write
- Patient lookup → FHIR `Patient` resource by phone/DOB

---

### Insurance Verification
**What**: Real-time insurance eligibility check before booking.

**How**:
- Integrate with Availity or Change Healthcare API
- Check `{ memberId, groupId, DOB }` against payer
- Return: eligible/not eligible, copay, deductible remaining
- Aria communicates result: "Looks like your Blue Cross plan covers this visit with a $30 copay."

---
