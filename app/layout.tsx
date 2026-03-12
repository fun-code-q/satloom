import type { Metadata } from 'next'

import './globals.css'
import { ClientSecurity } from '@/components/client-security'

export const metadata: Metadata = {
  metadataBase: new URL('https://fun-code-q.github.io/satloom'),
  title: 'SatLoom',
  description: 'Secure, anonymous, real-time communication.',
  manifest: "/satloom/manifest.json",
  icons: {
    icon: "/satloom/favicon.ico",
    shortcut: "/satloom/favicon.ico",
    apple: "/satloom/apple-touch-icon.png",
  },
  openGraph: {
    title: 'SatLoom',
    description: 'Secure, anonymous, real-time communication.',
    siteName: 'SatLoom',
    url: './',
    type: 'website',
    images: [
      {
        url: "/satloom/og-image.png",
        width: 1200,
        height: 630,
        alt: "SatLoom - Ultimate Real-time Chat & Collaboration",
      },
    ],
  },
  twitter: {
    card: 'summary',
    title: 'SatLoom',
    description: 'Secure, anonymous, real-time communication.',
    images: ['/satloom/og-image.png'],
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
