'use client'

import type { Doctor, PatientContext } from '@/types'
import PatientInfoPanel from './PatientInfoPanel'
import ProviderPanel from './ProviderPanel'
import SpecialistsPanel from './SpecialistsPanel'

type LeftTab = 'info' | 'provider' | 'specialists'

interface Props {
  activeTab: LeftTab
  onTabChange: (tab: LeftTab) => void
  patientContext: PatientContext
  matchedDoctor: Doctor | null
  allDoctors: Doctor[]
  onDoctorSelect?: (doctor: Doctor) => void
}

export default function LeftPanel({
  activeTab,
  onTabChange,
  patientContext,
  matchedDoctor,
  allDoctors,
  onDoctorSelect,
}: Props) {
  return (
    <div className="left-panel" style={{ animation: 'fU .5s .08s var(--ease) both' }}>

      {/* Tab bar */}
      <div className="left-tabs">
        {([
          { id: 'info',        icon: '👤', label: 'Patient'    },
          { id: 'provider',    icon: '🩺', label: 'Provider'   },
          { id: 'specialists', icon: '👨‍⚕️', label: 'Specialists' },
        ] as { id: LeftTab; icon: string; label: string }[]).map(tab => (
          <div
            key={tab.id}
            className={`ltab${activeTab === tab.id ? ' on' : ''}`}
            onClick={() => onTabChange(tab.id)}
            role="button"
            tabIndex={0}
            onKeyDown={e => {
              if (e.key === 'Enter' || e.key === ' ') onTabChange(tab.id)
            }}
          >
            <span className="ltab-icon">{tab.icon}</span>
            <span className="ltab-label">{tab.label}</span>
          </div>
        ))}
      </div>

      {/* Panel content */}
      <div className="left-content">

        {/* Patient tab */}
        <div className={`lpanel${activeTab === 'info' ? ' show' : ''}`}>
          <PatientInfoPanel patientContext={patientContext} />
        </div>

        {/* Provider tab */}
        <div className={`lpanel${activeTab === 'provider' ? ' show' : ''}`}>
          <ProviderPanel
            doctor={matchedDoctor}
            selectedSlotId={patientContext.selectedSlotId}
          />
        </div>

        {/* Specialists tab */}
        <div className={`lpanel${activeTab === 'specialists' ? ' show' : ''}`}>
          <SpecialistsPanel
            doctors={allDoctors}
            matchedDoctorId={patientContext.matchedDoctorId}
            onDoctorSelect={onDoctorSelect}
          />
        </div>

      </div>
    </div>
  )
}
