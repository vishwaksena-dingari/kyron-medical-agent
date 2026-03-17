# Interview Script — Kyron Medical Demo
# Total time: ~20 minutes

> FORMAT:
> [SPEAK]  = say this out loud
> [DO]     = action to take on screen
> [SHOW]   = point camera / cursor at this
> [NOTE]   = reminder to yourself, do not say out loud

---

## SETUP BEFORE RECORDING
- [NOTE] Deploy to Vercel first. Demo on Vercel URL, NOT localhost.
- [NOTE] Have your phone on the desk, volume UP, ringer ON.
- [NOTE] Have Gmail/inbox open in a tab — you'll check email live.
- [NOTE] Have VS Code open with kyron-medical folder, terminals closed.
- [NOTE] Chrome DevTools closed. Browser zoom at 110%.
- [NOTE] Use YOUR real phone number and email for the demo so the call actually rings.
- [NOTE] Pre-verify your email in Resend so you actually receive the confirmation.
- [NOTE] Test the full flow once before recording.

---

## PART 1 — BEHAVIORAL (0:00 – 5:00)
> Face camera. No screen share yet.

[SPEAK]
"Hi, I'm Vishwaksena Dingari — I go by Vish. I'm finishing my Master's in Data Science at the University of Maryland in April, GPA 3.9. My background is Computer Science from NIT Manipur in India, and I've been building full-stack AI applications — Python, React, Next.js, and I work with the Claude API regularly. Before UMD I was doing data engineering work at AXA XL.

What makes me different? I ship. I built this entire patient portal in 32 hours — not a mockup, not a Figma prototype — a working app with voice AI, calendar attachments, and returning caller memory. Nobody asked for those last two. I built them because that's what a real product needs.

For new technology, my approach is: read the docs for 30 minutes, test with curl before writing a single line of application code. For Vapi — the voice AI layer here — I read their assistantOverrides documentation, confirmed the JSON payload shape with a raw curl call, and then built the integration. The fastest way to get stuck is to assume the docs are correct without verifying.

The outcome I'm most proud of is the voice handoff context injection. When the patient clicks 'Continue by phone,' Aria calls them in about 4 seconds — and she already knows their name, their reason for the visit, which doctor they picked, and what slot they were considering. That's the full chat transcript injected into Vapi's system prompt at call time. The effect for the patient is seamless."

[NOTE] Pause. Take a breath. Switch to screen share now.

---

## PART 2 — DEMO WALKTHROUGH (5:00 – 10:00)
> Screen share ON. Open the Vercel URL.

[SPEAK]
"Let me show you the product. This is the Kyron Medical patient portal — running live on Vercel right now."

[DO] Open https://your-app.vercel.app

[SPEAK]
"Liquid-glass design — you can see the animated background. Dark mode by default."

[DO] Click the theme toggle (sun/moon icon, top right)

[SPEAK]
"Light mode works too. I'll switch back to dark — that's persisted in localStorage."

[DO] Toggle back to dark mode

---

### Symptom → Specialty Matching

[SPEAK]
"Let me walk through a patient's full journey. I'll type a symptom."

[DO] Click the chat input, type: "Hi, I've been having knee pain for a few weeks"
[DO] Press Enter

[SPEAK]
"Aria comes back — watch the typing indicator — she's matched 'knee pain' to Orthopedics. That matching lives in lib/matching.ts — keyword map with a Claude semantic fallback for edge cases."

[NOTE] Wait for Aria to respond and ask for name.

---

### Live Intake Panel

[SPEAK]
"She's collecting intake now. Watch the left panel — every field Aria collects updates in real time. This is server-sent events — the tool call result streams back to the UI as it happens."

[DO] Type your full name when Aria asks
[DO] Point cursor at the left panel — show name appeared

[SPEAK]
"Name appeared instantly. No page refresh, no polling — pure SSE."

[DO] Type your date of birth when asked
[DO] Point at left panel again — DOB filled in

[DO] Type your real phone number when asked
[DO] Type your real email when asked

[SPEAK]
"Phone number is the identity key — normalized to E.164 format and saved to Upstash Redis the moment it's collected. If I close the browser right now, the session isn't lost."

[NOTE] If you want to show Upstash: after the demo, open dashboard.upstash.com → Data Browser → show patient:{phone} key

---

### Doctor Selection

[SPEAK]
"Now she's matched the specialty and pulled doctor options."

[DO] Click the Dr. Raj Patel doctor pill

[SPEAK]
"I'll pick Dr. Patel. Doctor pills are clickable — disabled while Aria is still responding to prevent double submission."

---

### Slot Selection

[SPEAK]
"Slots come back — generated dynamically with 30 to 60 days of realistic availability."

[DO] Click any slot pill

[SPEAK]
"I'll pick this one."

[NOTE] Wait for Aria to ask for confirmation — "Does that all look right?"

[DO] Type: "Yes, confirm"

---

### Booking Confirmation + Calendar

[SPEAK]
"Booking confirmed. Let me check the email."

[DO] Switch to Gmail tab

[SPEAK]
"Here it is — confirmation from Aria, sent by Resend."

[DO] Open the email, scroll to the calendar attachment

[SPEAK]
"The key part — this .ics attachment. I click it —"

[DO] Click the .ics file

[SPEAK]
"— and the appointment lands in my calendar automatically. Doctor name, location, date, time. That took 45 minutes to build and nobody asked for it. That's the kind of engineer I am."

[NOTE] If Google Calendar opens and shows the event, point at it. If not, just describe it.

---

### Voice Handoff — THE MONEY MOMENT

[DO] Switch back to the app tab

[SPEAK]
"Now — this is the killer feature. I'll click 'Continue by phone.'"

[DO] Click the "Continue by phone" button

[SPEAK]
"The button says 'Calling you now...' Watch my phone."

[NOTE] Put phone on camera so viewer can see it ring.

[DO] Phone rings in ~4 seconds. Pick it up.

[SPEAK — to Aria on the phone, let viewer hear it]
"Hello?"

[NOTE] Aria will say something like: "Hi Vishwaksena, it's Aria from Kyron Medical. Your appointment with Dr. Patel is confirmed for [date]..."

[SPEAK — back to camera after hanging up]
"She knew my name. She knew the doctor. She knew the slot. Zero repetition, zero 'how can I help you today?' — she picked up exactly where we left off. That's the full chat transcript injected into Vapi at call time."

---

### Bonus: Responsive Design (30 seconds)

[DO] Open Chrome DevTools → Toggle device toolbar → select iPhone 14

[SPEAK]
"Fully responsive — bottom-sheet chat on mobile. CSS-only, no animation library."

[DO] Close DevTools

---

## PART 3 — CODE WALKTHROUGH (10:00 – 20:00)
> Switch to VS Code

[SPEAK]
"Let me show you how this actually works. 30-second file tour."

[DO] Show the folder tree collapsed

[SPEAK]
"App Router — API routes co-located with the UI. lib/ is all business logic. Clean separation."

---

### lib/claude.ts — The Brain

[DO] Open lib/claude.ts, scroll to ARIA_SYSTEM_PROMPT (line ~291)

[SPEAK]
"This is the brain. The system prompt has two hard rules I want to point at."

[DO] Highlight these lines:
"1. If asked anything clinical... respond: 'I'm not able to offer any medical guidance'"
"2. If emergency... 'Please call 911 or go to your nearest ER right away'"

[SPEAK]
"These are non-negotiable safety guardrails — no exceptions, even if rephrased. That's not just good engineering, it's a legal requirement for a medical-adjacent product."

[DO] Scroll down to TOOLS array (line ~408)

[SPEAK]
"Below that — the TOOLS array. Five tools Claude can call: update_patient_field for intake, get_doctors_for_specialty, get_available_slots, confirm_booking, get_office_info. Claude decides which tool to call and with what arguments. We just execute them."

[DO] Scroll to runModelTurn (line ~749)

[SPEAK]
"And here — runModelTurn. This is where I abstracted the LLM layer. Set LLM_PROVIDER=anthropic, you get Claude directly. Set it to gemini, Gemini 2.5 Flash. Set it to langchain — and I'll show you that in a second — and LangChain takes over as the orchestration layer. The rest of the codebase doesn't change at all."

[NOTE] Callout: "In production, I'd add LangSmith tracing here — wraps this function, and every token, tool call, and latency shows up in a dashboard automatically."

---

### app/api/chat/route.ts — The Loop

[DO] Open app/api/chat/route.ts

[DO] Scroll to the while loop

[SPEAK]
"This is the tool-calling loop. It's a while loop — max 5 iterations so it can never run away forever. Claude calls a tool, we execute it, we feed the result back, Claude decides if it needs another tool or if it's ready to respond."

[DO] Find the savePatientData line

[SPEAK]
"Right here — every time a patient field is collected, it saves to Upstash Redis. Non-blocking, fire-and-forget. If the patient picks up the phone instead of finishing the web chat, we haven't lost a thing."

[NOTE] Callout: "The manual while loop here — this is what LangChain's AgentExecutor would replace in v1.1. The loop logic moves into LangChain, and you get automatic tracing and observability for free."

---

### lib/langchain.ts — One-Line Model Swap

[DO] Open lib/langchain.ts

[SPEAK]
"This is the LangChain adapter I built today. The key insight: LangChain is an abstraction layer — same tools, same system prompt, same SSE streaming. If I want to swap Claude for OpenAI GPT-4o or Mistral Large, it's one line change here."

[DO] Highlight the ChatAnthropic import and constructor (lines 5–6 of the imports, line 26–29)

[SPEAK]
"Change ChatAnthropic to ChatOpenAI, point it at an OpenAI key — nothing else changes. The tools, the system prompt, the streaming — all identical. That's the power of abstracting the LLM layer."

[NOTE] Callout: "Right now this is a thin wrapper — one model call per turn. The v1.1 roadmap item is using AgentExecutor to give LangChain ownership of the full loop, which also unlocks LangSmith observability automatically."

---

### lib/vapi.ts — Where the Magic Happens

[DO] Open lib/vapi.ts, scroll to buildHandoffSystemPrompt (line ~72)

[SPEAK]
"This is where the voice handoff magic happens. When the patient clicks 'Continue by phone,' we build a system prompt that includes the full chat transcript, the patient's name, reason for visit, matched doctor, selected slot — everything."

[DO] Highlight the transcript injection section:
"--- FULL CHAT TRANSCRIPT ---"
"${transcript}"

[SPEAK]
"This gets injected into Vapi's assistantOverrides — it completely replaces whatever the dashboard has. Aria on the phone is running the same Claude model with this exact context. She's not a different agent. She's the same Aria."

[NOTE] Callout: "In production, the transcript would be truncated more aggressively and stored in a database — right now it's truncated to 3000 characters. Longer conversations need chunking or summarization before injection."

---

### app/api/vapi-inbound/route.ts — Returning Caller

[DO] Open app/api/vapi-inbound/route.ts

[SPEAK]
"This is the returning caller feature — nobody asked for it, it took about 2 hours. When a patient calls back, Vapi hits this endpoint. We look up their phone in Upstash KV."

[DO] Scroll to the isRecent check

[SPEAK]
"If they called back within 2 hours — probably got disconnected — Aria says 'looks like we got cut off, let me pick up right where we left off.' If it's been a day, she says 'welcome back, how can I help?' That's a deliberate UX decision, not just a feature."

[NOTE] Callout: "No auth before reading session data is fine for a demo. Production gets SMS OTP verification before any PHI is spoken back over the phone. The hooks are already there — it's a matter of plugging Twilio in."

---

### lib/utils.ts — ICS Calendar

[DO] Open lib/utils.ts, scroll to generateICS function

[SPEAK]
"Calendar attachment — 45 minutes to build. The ICS format is plain text — VCALENDAR spec. We generate it, pass it to Resend as a base64 attachment. Patient clicks it, one-click into their calendar."

[NOTE] Callout: "For production — add a cancel link in the email that hits DELETE /api/appointments/:id. The ICS spec supports CANCEL events too, so the appointment would remove itself from their calendar."

---

### lib/kv.ts — Production Path

[DO] Open lib/kv.ts briefly

[SPEAK]
"The KV layer — Upstash Redis. In production, three things change here: add a 7-day TTL on sessions, add a HIPAA audit log entry on every patient data read, and add AES-256 encryption before writing to storage. The structure is already there — it's additive work, not a rewrite."

---

## CLOSING

[SPEAK]
"One-line summary: I built a full patient portal with Claude-powered chat, Vapi voice handoff with full context injection, returning caller recognition, ICS calendar attachments, LangChain multi-provider abstraction, and Upstash session persistence — in 32 hours. The code is clean, the architecture is extensible, and the safety guardrails are non-negotiable.

That's the kind of engineer I am. Happy to go deeper on any part of this."

---

## THINGS TO POINT AT IF ASKED FOLLOW-UP QUESTIONS

| Question | Point at |
|---|---|
| "How does specialty matching work?" | `lib/matching.ts` — KEYWORD_MAP at top, Claude fallback at bottom |
| "What if Claude fails?" | `runModelTurn` in `lib/claude.ts` — fallback chain: langchain → anthropic → gemini |
| "How do you prevent prompt injection?" | System prompt SAFETY RULES section in ARIA_SYSTEM_PROMPT |
| "How is PHI protected?" | `lib/kv.ts` — phone as key, KV only, note: no logging of content |
| "What would you build next?" | `ROADMAP.md` — LangGraph state graph, MongoDB, EHR/FHIR integration |
| "How does Vapi know who's calling?" | `app/api/vapi-inbound/route.ts` — E.164 phone lookup in KV |
| "Why not use Twilio for voice?" | Vapi manages WebRTC + STT + TTS + LLM loop. Twilio would require building all of that manually. |
| "Is this HIPAA compliant?" | Not yet — designed for compliance path. Missing: encryption at rest, audit log, BAA with vendors. Point at ROADMAP v1.5. |
