'use client'

import { useRef } from 'react'
import type { PatientContext } from '@/types'

interface Props {
  patientContext: PatientContext
}

export default function PatientInfoPanel({ patientContext: p }: Props) {
  const prevRef = useRef<PatientContext>({})
  const prev = prevRef.current

  // Which fields just changed — used to trigger flash animation
  const changed = new Set<string>()
  if (p.name    !== prev.name    && p.name)    changed.add('name')
  if (p.phone   !== prev.phone   && p.phone)   changed.add('phone')
  if (p.email   !== prev.email   && p.email)   changed.add('email')
  if (p.reason  !== prev.reason  && p.reason)  changed.add('reason')
  if (p.dob     !== prev.dob     && p.dob)     changed.add('dob')
  if (p.selectedSlotLabel !== prev.selectedSlotLabel && p.selectedSlotLabel) changed.add('slot')
  if (p.bookingConfirmed  !== prev.bookingConfirmed  && p.bookingConfirmed)  changed.add('confirm')

  // Persist current as previous for next render
  prevRef.current = { ...p }

  const rows: {
    icon: string
    iconBg: string
    label: string
    value: string | undefined
    className?: string
    fieldKey: string
  }[] = [
    {
      fieldKey: 'name',
      icon: '👤',
      iconBg: 'rgba(37,99,235,0.12)',
      label: 'Name',
      value: p.name,
    },
    {
      fieldKey: 'phone',
      icon: '📞',
      iconBg: 'rgba(139,92,246,0.10)',
      label: 'Phone',
      value: p.phone,
    },
    {
      fieldKey: 'email',
      icon: '📧',
      iconBg: 'rgba(37,99,235,0.12)',
      label: 'Email',
      value: p.email,
      className: 'bl',
    },
    {
      fieldKey: 'reason',
      icon: '🩺',
      iconBg: 'rgba(239,68,68,0.10)',
      label: 'Reason',
      value: p.reason,
    },
    {
      fieldKey: 'dob',
      icon: '📅',
      iconBg: 'rgba(16,185,129,0.10)',
      label: 'Date of birth',
      value: p.dob,
    },
    {
      fieldKey: 'slot',
      icon: '🗓',
      iconBg: 'rgba(16,185,129,0.10)',
      label: 'Appointment',
      value: p.selectedSlotLabel,
      className: 'gd',
    },
    {
      fieldKey: 'confirm',
      icon: '📋',
      iconBg: 'rgba(16,185,129,0.10)',
      label: 'Confirmation',
      value: p.bookingConfirmed
        ? `Confirmed · #${p.appointmentId ?? '—'}`
        : p.selectedSlotLabel
        ? 'Pending confirmation'
        : undefined,
      className: p.bookingConfirmed ? 'gr' : undefined,
    },
  ]

  const allEmpty = rows.every(r => !r.value)

  return (
    <div id="lp-info" className="lpanel show">
      <div className="info-status">
        <span className="info-label">Patient Info</span>
        <div className="live">
          <div className="live-dot" />
          {p.bookingConfirmed ? 'Complete' : 'In progress'}
        </div>
      </div>

      {allEmpty && (
        <div style={{
          padding: '24px 16px',
          color: 'var(--t3)',
          fontSize: '13px',
          textAlign: 'center',
          lineHeight: 1.6,
        }}>
          Patient details will appear here as Aria collects them.
        </div>
      )}

      {rows.map(row => {
        if (!row.value && !row.fieldKey) return null
        return (
          <div className="srow" key={row.fieldKey}>
            <div className="sicon" style={{ background: row.iconBg }}>
              {row.icon}
            </div>
            <span className="sk">{row.label}</span>
            <span
              className={[
                'sv',
                row.className ?? '',
                changed.has(row.fieldKey) ? 'sv-updated' : '',
              ]
                .filter(Boolean)
                .join(' ')}
              style={{ color: row.value ? undefined : 'var(--t3)', fontWeight: row.value ? undefined : 400 }}
            >
              {row.value ?? '—'}
            </span>
          </div>
        )
      })}
    </div>
  )
}
