import type { Metadata } from 'next'

import './globals.css'
import { ClientSecurity } from '@/components/client-security'

export const metadata: Metadata = {
  title: 'SatLoom',
  description: 'Secure, anonymous, real-time communication.',
  manifest: '/satloom/manifest.json',
  icons: {
    icon: [
      { url: '/satloom/satloom-logo.svg', type: 'image/svg+xml' },
      { url: '/satloom/satloom-icon.png', sizes: '192x192', type: 'image/png' },
    ],
    shortcut: '/satloom/satloom-logo.svg',
    apple: '/satloom/apple-icon.png',
  },
  openGraph: {
    title: 'SatLoom',
    description: 'Secure, anonymous, real-time communication.',
    siteName: 'SatLoom',
    type: 'website',
    images: [
      {
        url: '/satloom/satloom-icon.png',
        width: 512,
        height: 512,
        alt: 'SatLoom - Secure Communication',
      },
    ],
  },
  twitter: {
    card: 'summary',
    title: 'SatLoom',
    description: 'Secure, anonymous, real-time communication.',
    images: ['/satloom/satloom-icon.png'],
  },
  other: {
    'theme-color': '#0891b2',
  },
}

export const viewport = {
  themeColor: '#0891b2',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body suppressHydrationWarning>
        <ClientSecurity />
        {children}
      </body>
    </html>
  )
}
