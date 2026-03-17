'use client'

import type { Specialty } from '@/types'
import { HeartPulse, Bone, Brain, Stethoscope, Sparkles } from 'lucide-react'

interface Props {
  specialty: Specialty
  className?: string
  size?: number
}

const ICON_MAP: Record<Specialty, React.ComponentType<{ className?: string; size?: number }>> = {
  cardiology: HeartPulse,
  orthopedics: Bone,
  gastroenterology: Stethoscope,
  neurology: Brain,
  dermatology: Sparkles,
}

export default function SpecialtyIcon({ specialty, className, size = 18 }: Props) {
  const Icon = ICON_MAP[specialty]
  return <Icon className={className} size={size} />
}


// 'use client'

// import type { Specialty } from '@/types'

// interface Props {
//   specialty: Specialty
//   className?: string
// }

// const SPECIALTY_EMOJI: Record<Specialty, string> = {
//   cardiology: '❤️',
//   orthopedics: '🦴',
//   gastroenterology: '🩺',
//   neurology: '🧠',
//   dermatology: '🔬',
// }

// export default function SpecialtyIcon({ specialty, className }: Props) {
//   return <span className={className}>{SPECIALTY_EMOJI[specialty]}</span>
// }