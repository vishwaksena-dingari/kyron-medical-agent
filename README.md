# Kyron Medical — Patient Portal

A patient-facing web application where patients chat with **Aria** (AI assistant) to schedule appointments, check prescriptions, and find office information — then seamlessly continue the conversation as a live phone call.

**Built for the Kyron Medical hiring exercise · 32-hour solo build**

---

## Live Demo

[kyron-medical-agent.vercel.app](https://kyron-medical-agent.vercel.app) *(replace with your deployed URL)*

---

## Features

### Core
- **Conversational appointment scheduling** — Aria collects patient intake one field at a time, semantically matches symptoms to the right specialist, presents available slots, confirms bookings
- **Chat-to-voice handoff** — Patient clicks "Continue by phone," Aria calls them in ~4 seconds and picks up the conversation mid-sentence with full context
- **5 specialists** — Cardiology, Orthopedics, Gastroenterology, Neurology, Dermatology — 30–60 days of realistic availability
- **Live intake tracker** — Left panel updates in real-time as Aria collects each field
- **Prescription refill inquiries** and **office hours/locations** workflows
- **Incremental session persistence** — Patient data saved to Upstash Redis as each field is entered

### Pioneer Features (unasked-for)
- **ICS calendar attachment** — Booking confirmation email includes a `.ics` file that adds the appointment to Google Calendar, Apple Calendar, or Outlook in one click
- **Returning caller recognition** — When a patient calls back, Aria recognizes their phone number, greets them by name, and resumes exactly where they left off — even if they were mid-booking

### UI
- Liquid-glass design with animated mesh background
- Dark / light theme toggle (persisted to localStorage)
- Fully responsive — bottom-sheet chat on mobile
- CSS-only animations — no heavy animation library
- Pills disabled while Aria is typing to prevent double-submission

---

## Tech Stack

| | |
|---|---|
| **Framework** | Next.js 14.2 (App Router) |
| **AI — Primary** | Claude claude-sonnet-4-20250514 via Anthropic SDK |
| **AI — Fallback** | Gemini 2.5 Flash via Google GenAI SDK |
| **AI — Orchestration** | LangChain (`@langchain/anthropic`) — swap any model with one config line |
| **Voice** | Vapi.ai — outbound call API with `assistantOverrides` |
| **Memory** | Upstash Redis (Vercel KV) — caller session + patient data persistence |
| **Email** | Resend — HTML template + ICS calendar attachment |
| **Hosting** | Vercel — HTTPS, serverless functions, zero config |

---

## Multi-Provider LLM

The LLM layer is fully abstracted. Set `LLM_PROVIDER` in `.env.local` to switch providers without touching any other code:

```bash
LLM_PROVIDER=anthropic   # Claude claude-sonnet-4-20250514 (default)
LLM_PROVIDER=gemini      # Gemini 2.5 Flash
LLM_PROVIDER=langchain   # LangChain + Claude (swap to OpenAI/Mistral in one line)
```

The LangChain path (`lib/langchain.ts`) uses the same tool definitions, system prompt, and SSE streaming as the direct adapters — making model swaps completely transparent to the rest of the app.

---

## Getting Started

### Prerequisites

- Node.js 18+
- [Anthropic API key](https://console.anthropic.com)
- [Vapi.ai account](https://vapi.ai) (free trial credits)
- [Resend account](https://resend.com) (free tier)
- [Vercel account](https://vercel.com) (free tier)

### Setup

```bash
# Clone
git clone https://github.com/YOUR_USERNAME/kyron-medical-agent.git
cd kyron-medical-agent
npm install

# Set up Vercel KV (auto-populates 4 KV env vars)
npx vercel link
npx vercel env pull .env.local

# Fill in remaining keys in .env.local
# ANTHROPIC_API_KEY, VAPI_*, RESEND_*

# Run locally
npm run dev
# → http://localhost:3000
```

### Environment Variables

```bash
# LLM providers (at least one required)
ANTHROPIC_API_KEY=
GEMINI_API_KEY=           # optional — enables Gemini provider
LLM_PROVIDER=anthropic    # anthropic | gemini | langchain

# Voice
VAPI_API_KEY=
VAPI_ASSISTANT_ID=
VAPI_PHONE_NUMBER_ID=
VAPI_WEBHOOK_SECRET=

# Email
RESEND_API_KEY=
RESEND_FROM_EMAIL=

# Upstash Redis (used by default — upstash.com → your database → REST tab)
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=

# Alternative: Vercel KV (auto-filled by: npx vercel link && npx vercel env pull)
# Swap lib/kv.ts to use @vercel/kv if you prefer this route
# KV_URL=
# KV_REST_API_URL=
# KV_REST_API_TOKEN=
# KV_REST_API_READ_ONLY_TOKEN=

NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### Vapi Dashboard Setup

1. Create an assistant named **"Aria — Kyron Medical"**
   - Model: Claude (claude-sonnet-4-20250514)
   - Voice: ElevenLabs Rachel or Vapi native Paige
2. Buy a US phone number
3. Set **Server URL** on your assistant → `https://your-app.vercel.app/api/vapi-webhook`
4. Set **Server URL** on your phone number → `https://your-app.vercel.app/api/vapi-inbound`
5. Copy Assistant ID, Phone Number ID, API Key → `.env.local`

### Test LangChain (standalone)

```bash
# Start dev server, then:
curl http://localhost:3000/api/test-langchain
# Returns JSON with assistantText + tool calls — no frontend needed
```

### Deploy

```bash
git add -A
git commit -m "feat: initial deploy"
git push origin main
# Vercel auto-deploys. Update NEXT_PUBLIC_APP_URL in Vercel dashboard.
```

---

## Architecture

```
Browser (ChatInterface)
    │ POST /api/chat  →  SSE stream back
    ▼
runModelTurn()  [lib/claude.ts]
    ├── LLM_PROVIDER=anthropic  →  runAnthropicTurn()   (streaming)
    ├── LLM_PROVIDER=gemini     →  runGeminiTurn()       (streaming)
    └── LLM_PROVIDER=langchain  →  runLangChainTurn()    (streaming, swap model in 1 line)
         │
         └── Tool-calling loop (max 5 iterations)
              ├── update_patient_field  → live panel updates + save to KV
              ├── get_doctors_for_specialty → doctor pills in chat
              ├── get_available_slots   → slot pills in chat
              ├── confirm_booking       → books slot + sends email + ICS
              ├── get_office_info       → office hours response
              └── submit_refill         → refill acknowledgment

"Continue by phone" click  →  POST /api/initiate-call
    └── Vapi outbound call with full chat context injected via assistantOverrides

call.ended  →  POST /api/vapi-webhook
    └── voice transcript saved to Upstash KV

Patient calls back  →  POST /api/vapi-inbound
    └── KV lookup → returning caller context injected → Aria greets by name
```

---

## Project Structure

```
├── app/
│   ├── globals.css              # Liquid-glass CSS design system
│   ├── layout.tsx
│   ├── page.tsx                 # Root state: messages, patientContext, theme
│   └── api/
│       ├── chat/route.ts        # Tool-calling loop + SSE streaming
│       ├── book/route.ts        # Standalone booking endpoint
│       ├── initiate-call/       # Vapi outbound + KV session save
│       ├── vapi-webhook/        # call.ended transcript capture
│       ├── vapi-inbound/        # Returning caller context injection
│       └── test-langchain/      # Standalone LangChain adapter test
├── components/
│   ├── ChatInterface.tsx        # Chat UI + SSE orchestration
│   ├── MessageBubble.tsx        # Message + slot/doctor pills
│   ├── VoiceHandoffButton.tsx   # 4-state call button
│   ├── LeftPanel.tsx            # 3-tab shell
│   ├── PatientInfoPanel.tsx     # Live intake tracker
│   ├── ProviderPanel.tsx        # Matched doctor + slots
│   └── SpecialistsPanel.tsx     # All 5 doctors
├── lib/
│   ├── claude.ts                # System prompt, tool definitions, all LLM adapters
│   ├── langchain.ts             # LangChain adapter (model-agnostic)
│   ├── doctors.ts               # Doctor data + slot generator
│   ├── matching.ts              # Symptom → specialty matching
│   ├── kv.ts                    # Caller session + patient persistence
│   ├── resend.ts                # Email template + ICS
│   ├── utils.ts                 # Phone, dates, ICS, transcripts
│   └── vapi.ts                  # Call builder + context injectors
└── types/index.ts               # Shared TypeScript interfaces
```

---

## Known Limitations

- **Slot data is in-memory** — `bookSlot()` mutates a module-level array. Vercel serverless cold starts reset it. Production fix: MongoDB with row-level locking.
- **No SMS** — Twilio A2P 10DLC registration requires 2–5 business days.
- **No authentication** — Phone number is the identity key. Production requires SMS 2FA before reading PHI over voice.
- **Email sandbox** — Resend free tier only delivers to your verified email. Production requires a verified sending domain.

---

## Future Roadmap

See [ROADMAP.md](ROADMAP.md) for the full versioned roadmap.

### Highlights
- **LangChain AgentExecutor** — give LangChain ownership of the tool loop; swap Claude for OpenAI/Mistral in one line
- **LangGraph** — typed state graph for multi-step workflows (insurance check → booking → reminder)
- **MongoDB Atlas** — persistent appointments and patient records across cold starts
- **Amazon EC2 / ECS** — always-on server, WebSocket real-time transcripts, no cold starts
- **Vector search** — embed symptoms with `text-embedding-3-small`, semantic specialty matching via Pinecone
- **SMS OTP via Twilio** — real identity verification before reading PHI
- **EHR integration** — FHIR R4 client for Epic/Cerner/Athena real availability and booking

---

## License

MIT — built as a hiring exercise for Kyron Medical.
