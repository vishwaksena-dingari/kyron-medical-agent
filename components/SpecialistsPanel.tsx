'use client'

import type { Doctor } from '@/types'
import SpecialtyIcon from './SpecialtyIcon'

interface Props {
  doctors: Doctor[]
  matchedDoctorId?: string
  onDoctorSelect?: (doctor: Doctor) => void
}

const SLOT_TAG: Record<string, { label: string; className: string }> = {
  cardiology:       { label: 'Available',   className: 'stag tga' },
  orthopedics:      { label: 'Available',   className: 'stag tga' },
  gastroenterology: { label: 'Available',   className: 'stag tga' },
  neurology:        { label: '2 slots left', className: 'stag tgb' },
  dermatology:      { label: 'Available',   className: 'stag tga' },
}

const ICON_BG: Record<string, string> = {
  cardiology:       'rgba(239,68,68,0.10)',
  orthopedics:      'rgba(37,99,235,0.10)',
  gastroenterology: 'rgba(16,185,129,0.10)',
  neurology:        'rgba(139,92,246,0.10)',
  dermatology:      'rgba(245,158,11,0.10)',
}

export default function SpecialistsPanel({ doctors, matchedDoctorId, onDoctorSelect }: Props) {
  return (
    <div id="lp-specialists" className="lpanel show">
      {doctors.map(doc => {
        const tag   = SLOT_TAG[doc.specialty]  ?? { label: 'Available', className: 'stag tga' }
        const iconBg = ICON_BG[doc.specialty] ?? 'rgba(37,99,235,0.10)'
        const isMatched = doc.id === matchedDoctorId

        return (
          <div
            key={doc.id}
            className="spec-item"
            style={isMatched ? {
              background: 'var(--blue-d)',
              borderLeft: '2px solid var(--blue)',
            } : undefined}
            onClick={() => onDoctorSelect?.(doc)}
            role="button"
            tabIndex={0}
            onKeyDown={e => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                onDoctorSelect?.(doc)
              }
            }}
          >
            <div className="spec-ic" style={{ background: iconBg }}>
              {/* {doc.emoji} */}
              <SpecialtyIcon specialty={doc.specialty} />
            </div>
            <div>
              <div className="spec-n">
                {doc.name}
                {isMatched && (
                  <span style={{
                    marginLeft: '6px',
                    fontSize: '10px',
                    color: 'var(--blue-text)',
                    fontWeight: 500,
                  }}>
                    · matched
                  </span>
                )}
              </div>
              <div className="spec-s">
                {doc.specialty.charAt(0).toUpperCase() + doc.specialty.slice(1)}
                {' · '}{doc.title}
              </div>
            </div>
            <div className={tag.className}>{tag.label}</div>
          </div>
        )
      })}
    </div>
  )
}
