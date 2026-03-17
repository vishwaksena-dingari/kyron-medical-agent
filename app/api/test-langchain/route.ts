// app/api/test-langchain/route.ts
// Standalone test for the LangChain adapter.
// GET /api/test-langchain  → runs one turn with a test message and returns JSON
// Useful for verifying LangChain is wired up before switching the main chat.

import { NextResponse } from 'next/server'
import { runLangChainTurn } from '@/lib/langchain'
import { ARIA_SYSTEM_PROMPT } from '@/lib/claude'

export const runtime = 'nodejs'

export async function GET() {
    try {
        const result = await runLangChainTurn({
            messages: [
                { role: 'user', content: 'Hi, I have knee pain and need to see a doctor.' },
            ],
            systemPrompt: ARIA_SYSTEM_PROMPT,
            onText: (text) => process.stdout.write(text), // logs to server terminal in real-time
        })

        return NextResponse.json({
            ok: true,
            provider: 'langchain + claude',
            assistantText: result.assistantText,
            toolCallCount: result.toolCalls.length,
            toolCalls: result.toolCalls.map(tc => ({
                name: tc.name,
                input: tc.input,
            })),
        })
    } catch (err) {
        return NextResponse.json(
            { ok: false, error: String(err) },
            { status: 500 }
        )
    }
}
