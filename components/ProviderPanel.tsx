'use client'

import type { Doctor, TimeSlot } from '@/types'
import { getAvailableSlots } from '@/lib/doctors'
import SpecialtyIcon from './SpecialtyIcon'

interface Props {
  doctor: Doctor | null
  selectedSlotId?: string
  onSlotSelect?: (slot: TimeSlot) => void
}

export default function ProviderPanel({ doctor, selectedSlotId, onSlotSelect }: Props) {
  if (!doctor) {
    return (
      <div id="lp-provider" className="lpanel show">
        <div style={{
          padding: '24px 16px',
          color: 'var(--t3)',
          fontSize: '13px',
          textAlign: 'center',
          lineHeight: 1.6,
        }}>
          Provider details will appear here once Aria matches you with a specialist.
        </div>
      </div>
    )
  }

  const slots = getAvailableSlots(doctor.id, 6)
  const specialtyDisplay =
    doctor.specialty.charAt(0).toUpperCase() + doctor.specialty.slice(1)

  return (
    <div id="lp-provider" className="lpanel show">
      <div className="provider-panel">

        {/* Doctor header */}
        <div className="prov-header">
          <div className="prov-ic" aria-hidden="true">
            {/* {doctor.emoji} */}
            <SpecialtyIcon specialty={doctor.specialty} />
          </div>
          <div>
            <div className="prov-name">{doctor.name}</div>
            <div className="prov-spec">{specialtyDisplay}</div>
            <div className="prov-deg">
              {doctor.title} · {doctor.yearsExperience} yrs experience
            </div>
          </div>
        </div>

        {/* Meta grid */}
        <div className="meta-grid">
          <div className="meta-item">
            <div className="meta-label">Location</div>
            <div className="meta-val">{doctor.location}</div>
          </div>
          <div className="meta-item">
            <div className="meta-label">Next available</div>
            <div className="meta-val" style={{ color: 'var(--green-text)' }}>
              {slots.length > 0 ? slots[0].dayLabel : 'Check chat'}
            </div>
          </div>
          <div className="meta-item">
            <div className="meta-label">Accepts</div>
            <div className="meta-val">{doctor.acceptedInsurance.slice(0, 2).join(', ')}</div>
          </div>
          <div className="meta-item">
            <div className="meta-label">Rating</div>
            <div className="meta-val">★ {doctor.rating} / 5.0</div>
          </div>
          <div className="meta-item">
            <div className="meta-label">Languages</div>
            <div className="meta-val">{doctor.languages.join(', ')}</div>
          </div>
          <div className="meta-item">
            <div className="meta-label">Hospital</div>
            <div className="meta-val">{doctor.hospital}</div>
          </div>
        </div>

        <div className="divider" />

        {/* Available slots */}
        <div className="slots-label">Available slots</div>
        {slots.length === 0 ? (
          <div style={{ fontSize: '12px', color: 'var(--t3)', padding: '4px 0' }}>
            No slots found — try a broader date range in chat.
          </div>
        ) : (
          <div className="slots-grid">
            {slots.map(slot => (
              <div
                key={slot.id}
                className={`sg${selectedSlotId === slot.id ? ' on' : ''}`}
                onClick={() => onSlotSelect?.(slot)}
                role="button"
                tabIndex={0}
                onKeyDown={e => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    onSlotSelect?.(slot)
                  }
                }}
              >
                {slot.dayLabel}
                <br />
                <span style={{
                  color: selectedSlotId === slot.id ? undefined : 'var(--t3)',
                  fontSize: '10.5px',
                }}>
                  {slot.timeLabel}
                  {selectedSlotId === slot.id ? ' ✓' : ''}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* Confirmed badge */}
        {selectedSlotId && (
          <div className="appt-badge">
            <div className="bdot" />
            Appointment selected
          </div>
        )}

      </div>
    </div>
  )
}
