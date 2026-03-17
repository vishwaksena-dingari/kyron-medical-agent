// lib/langchain.ts
// LangChain adapter — same interface as runAnthropicTurn / runGeminiTurn.
// Uses ChatAnthropic under the hood, but routed through LangChain's
// abstraction layer. Swap `ChatAnthropic` for `ChatOpenAI` or `ChatGoogleGenerativeAI`
// and the rest of the codebase is unchanged.

import { ChatAnthropic } from '@langchain/anthropic'
import {
    HumanMessage,
    AIMessage,
    SystemMessage,
    ToolMessage,
    AIMessageChunk,
    type BaseMessage,
} from '@langchain/core/messages'
import { concat } from '@langchain/core/utils/stream'
import { TOOLS, ANTHROPIC_MODEL, type NeutralMessage, type ModelTurnResult, type ModelToolCall } from '@/lib/claude'

// ─── LangChain model instance ─────────────────────────────────────────────────

function makeLangChainModel() {
    if (!process.env.ANTHROPIC_API_KEY) throw new Error('ANTHROPIC_API_KEY not configured')
    return new ChatAnthropic({
        apiKey: process.env.ANTHROPIC_API_KEY,
        model: ANTHROPIC_MODEL,
        temperature: 0.4,
        streaming: true,
    })
}

// ─── Message format conversion ────────────────────────────────────────────────
// NeutralMessage → LangChain BaseMessage

function toBaseMessages(messages: NeutralMessage[]): BaseMessage[] {
    return messages.map(msg => {
        if (msg.role === 'user') {
            return new HumanMessage(msg.content)
        }
        if (msg.role === 'tool') {
            return new ToolMessage({
                content: msg.content,
                tool_call_id: msg.toolCallId,
            })
        }
        // assistant — may include tool calls
        if (msg.toolCalls && msg.toolCalls.length > 0) {
            return new AIMessage({
                content: msg.content,
                tool_calls: msg.toolCalls.map(tc => ({
                    id: tc.id,
                    name: tc.name,
                    args: tc.input,
                    type: 'tool_call' as const,
                })),
            })
        }
        return new AIMessage(msg.content)
    })
}

function genId(): string {
    if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID()
    return `lc-${Math.random().toString(36).slice(2, 10)}`
}

// ─── Main runner ──────────────────────────────────────────────────────────────

export async function runLangChainTurn(params: {
    messages: NeutralMessage[]
    systemPrompt: string
    onText?: (text: string) => void
}): Promise<ModelTurnResult> {
    const model = makeLangChainModel()

    // Bind our existing Anthropic-format TOOLS directly — @langchain/anthropic
    // accepts them natively alongside LangChain StructuredTools.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const modelWithTools = model.bindTools(TOOLS as any)

    const lcMessages: BaseMessage[] = [
        new SystemMessage(params.systemPrompt),
        ...toBaseMessages(params.messages),
    ]

    // Stream the response so text tokens reach the UI in real-time.
    const stream = await modelWithTools.stream(lcMessages)

    let accumulated: AIMessageChunk | undefined

    for await (const chunk of stream) {
        // Accumulate for final tool_calls extraction
        accumulated = accumulated ? (concat(accumulated, chunk) as AIMessageChunk) : (chunk as AIMessageChunk)

        // Stream text deltas to the caller as they arrive
        if (typeof chunk.content === 'string' && chunk.content) {
            params.onText?.(chunk.content)
        } else if (Array.isArray(chunk.content)) {
            for (const part of chunk.content) {
                if (typeof part === 'object' && part !== null && 'type' in part && part.type === 'text' && 'text' in part) {
                    params.onText?.((part as { type: string; text: string }).text)
                }
            }
        }
    }

    // Extract final text from accumulated message
    let assistantText = ''
    if (accumulated) {
        if (typeof accumulated.content === 'string') {
            assistantText = accumulated.content
        } else if (Array.isArray(accumulated.content)) {
            for (const part of accumulated.content) {
                if (typeof part === 'object' && part !== null && 'type' in part && part.type === 'text' && 'text' in part) {
                    assistantText += (part as { type: string; text: string }).text
                }
            }
        }
    }

    // Extract fully-assembled tool calls from the accumulated message
    const toolCalls: ModelToolCall[] = (accumulated?.tool_calls ?? []).map(tc => ({
        id: tc.id ?? genId(),
        name: tc.name,
        input: (tc.args ?? {}) as Record<string, unknown>,
    }))

    return { assistantText, toolCalls }
}
