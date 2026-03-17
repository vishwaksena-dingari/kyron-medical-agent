import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Kyron Medical — Patient Portal',
  description:
    'Chat with Aria to schedule appointments, check prescriptions, and find office hours at Kyron Medical.',
  icons: { icon: '/favicon.ico' },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body suppressHydrationWarning>{children}</body>
    </html>
  )
}
