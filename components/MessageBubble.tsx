'use client'

import type { Message, SlotOption, DoctorOption } from '@/types'

interface Props {
  message: Message
  initials: string
  delay?: number
  onSlotSelect: (slot: SlotOption) => void
  onDoctorSelect: (doctor: DoctorOption) => void
  isTyping?: boolean
}

export default function MessageBubble({ message, initials, delay = 0, onSlotSelect, onDoctorSelect, isTyping = false }: Props) {
  const isUser = message.role === 'user'

  // Render newlines as <br> and highlight doctor names (text between ** or wrapped in hi class)
  const renderContent = (text: string) => {
    return text.split('\n').map((line, i, arr) => (
      <span key={i}>
        {line}
        {i < arr.length - 1 && <br />}
      </span>
    ))
  }

  return (
    <div
      className={`msg${isUser ? ' u' : ''}`}
      style={delay ? { animationDelay: `${delay}s` } : undefined}
    >
      <div className={`mav${isUser ? ' uav' : ''}`}>
        {isUser ? initials : 'Ar'}
      </div>

      <div className={`bub${isUser ? ' usr' : ' ai'}`}>
        {renderContent(message.content)}

        {/* Doctor option pills — disabled while Aria is responding */}
        {!isUser && message.doctorOptions && message.doctorOptions.length > 0 && (
          <div className="slots">
            {message.doctorOptions.map(doc => (
              <div
                key={doc.id}
                className={`doc-pill${isTyping ? ' slt-disabled' : ''}`}
                onClick={() => !isTyping && onDoctorSelect(doc)}
                role="button"
                tabIndex={isTyping ? -1 : 0}
                onKeyDown={e => {
                  if (!isTyping && (e.key === 'Enter' || e.key === ' ')) {
                    e.preventDefault()
                    onDoctorSelect(doc)
                  }
                }}
              >
                {doc.name}
                <span className="doc-pill-meta">
                  · ★{doc.rating} · {doc.yearsExperience}y
                </span>
              </div>
            ))}
          </div>
        )}

        {/* Slot pills — disabled while Aria is responding */}
        {!isUser && message.slots && message.slots.length > 0 && (
          <div className="slots">
            {message.slots.map(slot => (
              <div
                key={slot.id}
                className={`slt${isTyping ? ' slt-disabled' : ''}`}
                onClick={() => !isTyping && onSlotSelect(slot)}
                role="button"
                tabIndex={isTyping ? -1 : 0}
                onKeyDown={e => {
                  if (!isTyping && (e.key === 'Enter' || e.key === ' ')) {
                    e.preventDefault()
                    onSlotSelect(slot)
                  }
                }}
              >
                {slot.label}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
