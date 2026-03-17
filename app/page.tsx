'use client'

import { useState, useCallback, useEffect } from 'react'
import type { Message, PatientContext, CallState, Doctor } from '@/types'
import { DOCTORS } from '@/lib/doctors'
import LeftPanel from '@/components/LeftPanel'
import ChatInterface from '@/components/ChatInterface'

// const INITIAL_MESSAGE: Message = {
//   id: 'init-1',
//   role: 'assistant',
//   content:
//     "Hi! I'm Aria, your Kyron Medical assistant. I can help you schedule an appointment, check on a prescription, or find office hours.\n\nWhat brings you in today?",
//   timestamp: new Date(),
// }

// const INITIAL_MESSAGE: Message = {
//   id: 'init-1',
//   role: 'assistant',
//   content:
//     "Hi! I'm Aria, your Kyron Medical assistant. I can help with appointment scheduling, prescription refill requests, or office information.\n\nTo get started, tell me which one you need — and if you're booking, briefly describe the issue, like knee pain, rash, or headaches.",
//   timestamp: new Date(),
// }

const INITIAL_MESSAGE: Message = {
  id: 'init-1',
  role: 'assistant',
  content:
    "Hi! I'm Aria, your Kyron Medical assistant. I can help schedule appointments, request prescription refills, or share office information.\n\nWhat can I help you with today? You can tell me your health concern, refill request, or location question.",
  timestamp: new Date(),
}

type NavTab = 'Schedule' | 'Prescriptions' | 'Locations'
type LeftTab = 'info' | 'provider' | 'specialists'

export default function Home() {
  const [messages, setMessages] = useState<Message[]>([INITIAL_MESSAGE])
  const [patientContext, setPatientContext] = useState<PatientContext>({})
  const [isTyping, setIsTyping] = useState(false)
  const [callState, setCallState] = useState<CallState>('idle')
  const [activeNavTab, setActiveNavTab] = useState<NavTab>('Schedule')
  const [activeLeftTab, setActiveLeftTab] = useState<LeftTab>('info')
  const [theme, setTheme] = useState<'dark' | 'light'>('dark')
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [mobileChatOpen, setMobileChatOpen] = useState(false)
  const [pendingDoctorMsg, setPendingDoctorMsg] = useState<string | null>(null)

  // Load + apply theme
  useEffect(() => {
    const saved = localStorage.getItem('kyron-theme') as 'dark' | 'light' | null
    const t = saved ?? 'dark'
    setTheme(t)
    document.documentElement.setAttribute('data-theme', t)
  }, [])

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    localStorage.setItem('kyron-theme', theme)
  }, [theme])

  const handlePatientUpdate = useCallback((update: Partial<PatientContext>) => {
    setPatientContext(prev => {
      const next = { ...prev, ...update }
      // Auto-switch left panel to provider when doctor matched
      if (update.matchedDoctorId && !prev.matchedDoctorId) {
        setActiveLeftTab('provider')
      }
      return next
    })
  }, [])

  const handleBookingConfirmed = useCallback(
    (appointmentId: string, slotLabel: string) => {
      setPatientContext(prev => ({
        ...prev,
        bookingConfirmed: true,
        appointmentId,
        selectedSlotLabel: slotLabel,
      }))
    },
    []
  )

  const handleDoctorSelectFromPanel = useCallback((doctor: Doctor) => {
    setActiveLeftTab('provider')
    setPendingDoctorMsg(`I'd like to see ${doctor.name}`)
  }, [])

  const toggleTheme = useCallback(() => {
    setTheme(prev => (prev === 'dark' ? 'light' : 'dark'))
  }, [])

  const openMenu = useCallback(() => setMobileMenuOpen(true), [])
  const closeMenu = useCallback(() => setMobileMenuOpen(false), [])

  const switchNavTab = useCallback((tab: NavTab) => {
    setActiveNavTab(tab)
    closeMenu()
  }, [closeMenu])

  const matchedDoctor = patientContext.matchedDoctorId
    ? DOCTORS.find(d => d.id === patientContext.matchedDoctorId) ?? null
    : null

  return (
    <div data-theme={theme}>
      {/* Background layers */}
      <div className="gl" />
      <div className="gv" />
      <div className="oa" />
      <div className="ob" />

      <div className="page">
        {/* ── Nav ── */}
        <nav>
          <div className="brand">
            <div className="brand-ic">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
              </svg>
            </div>
            <div className="brand-n">Kyron <em>Medical</em></div>
          </div>

          <div className="nav-tabs">
            {(['Schedule', 'Prescriptions', 'Locations'] as NavTab[]).map(tab => (
              <button
                key={tab}
                className={`nt${activeNavTab === tab ? ' on' : ''}`}
                onClick={() => switchNavTab(tab)}
              >
                {tab}
              </button>
            ))}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
            <button
              className="theme-toggle"
              onClick={toggleTheme}
              title="Toggle theme"
              aria-label="Toggle color theme"
            >
              {theme === 'dark' ? '☀' : '☾'}
            </button>
            <div className="nav-right">
              <div
                className={`ham-btn${mobileMenuOpen ? ' open' : ''}`}
                onClick={mobileMenuOpen ? closeMenu : openMenu}
                role="button"
                aria-label="Menu"
              >
                <span />
                <span />
              </div>
            </div>
          </div>
        </nav>

        {/* ── Fullscreen mobile menu ── */}
        <div className={`fs-menu${mobileMenuOpen ? ' open' : ''}`}>
          <div className="fs-top">
            <div className="fs-brand">
              <div className="fs-brand-ic">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
                </svg>
              </div>
              <div className="fs-brand-n">Kyron <em>Medical</em></div>
            </div>
            <div className="fs-close" onClick={closeMenu}>✕</div>
          </div>

          <div className="fs-items">
            {(['Schedule', 'Prescriptions', 'Locations'] as NavTab[]).map((tab, i) => (
              <button
                key={tab}
                className={`fs-item${activeNavTab === tab ? ' on' : ''}`}
                onClick={() => switchNavTab(tab)}
              >
                <span className="fs-num">0{i + 1}</span>
                {tab}
                <div className="fs-dot" />
              </button>
            ))}
          </div>

          <div className="fs-footer">
            <div className="fs-footer-txt">Kyron Medical · Patient Portal</div>
            <div className="fs-footer-pill">
              <div className="fs-footer-dot" />
              Aria is online
            </div>
          </div>
        </div>

        {/* ── Main bento layout ── */}
        <div className="bento">
          <LeftPanel
            activeTab={activeLeftTab}
            onTabChange={setActiveLeftTab}
            patientContext={patientContext}
            matchedDoctor={matchedDoctor}
            allDoctors={DOCTORS}
            onDoctorSelect={handleDoctorSelectFromPanel}
          />

          <ChatInterface
            messages={messages}
            setMessages={setMessages}
            patientContext={patientContext}
            onPatientUpdate={handlePatientUpdate}
            onBookingConfirmed={handleBookingConfirmed}
            isTyping={isTyping}
            setIsTyping={setIsTyping}
            callState={callState}
            setCallState={setCallState}
            mobileChatOpen={mobileChatOpen}
            setMobileChatOpen={setMobileChatOpen}
            activeNavTab={activeNavTab}
            pendingMessage={pendingDoctorMsg}
            onPendingMessageSent={() => setPendingDoctorMsg(null)}
          />
        </div>
      </div>

      {/* ── Mobile FAB ── */}
      <button
        className="fab"
        style={{ opacity: mobileChatOpen ? 0 : 1, pointerEvents: mobileChatOpen ? 'none' : 'all' }}
        onClick={() => setMobileChatOpen(true)}
      >
        <div className="fab-av">
          Ar
        </div>
        <div>
          <span className="fab-t">Chat with Aria</span>
          <span className="fab-s">Kyron Medical · Online</span>
        </div>
      </button>
    </div>
  )
}
