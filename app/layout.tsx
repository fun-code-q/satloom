import type { Metadata } from 'next'

import './globals.css'
import { ClientSecurity } from '@/components/client-security'

export const metadata: Metadata = {
  metadataBase: new URL('https://fun-code-q.github.io/satloom'),
  title: 'SatLoom',
  description: 'Secure, anonymous, real-time communication.',
  manifest: 'manifest.json',
  icons: {
    icon: [
      { url: 'satloom-logo.svg', type: 'image/svg+xml' },
      { url: 'satloom-icon.png', sizes: '192x192', type: 'image/png' },
    ],
    shortcut: 'satloom-logo.svg',
    apple: 'apple-icon.png',
  },
  openGraph: {
    title: 'SatLoom',
    description: 'Secure, anonymous, real-time communication.',
    siteName: 'SatLoom',
    url: './',
    type: 'website',
    images: [
      {
        url: 'satloom-icon.png',
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
    images: ['satloom-icon.png'],
  },
  other: {
    'theme-color': '#0891b2',
    'mobile-web-app-capable': 'yes',
    'apple-mobile-web-app-capable': 'yes',
    'apple-mobile-web-app-status-bar-style': 'black-translucent',
  },
}

export const viewport = {
  themeColor: '#0891b2',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
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
