import type { Metadata } from 'next'

import './globals.css'
import { ClientSecurity } from '@/components/client-security'
import { ThemeProvider } from '@/contexts/theme-context'
import { AccessibilityProvider } from '@/contexts/accessibility-context'
import { InAppToasts } from '@/components/in-app-toasts'
import { Toaster } from '@/components/ui/sonner'

export const metadata: Metadata = {
  metadataBase: new URL('https://fun-code-q.github.io/satloom'),
  title: 'SatLoom',
  description: 'Secure, anonymous, real-time communication.',
  manifest: "/satloom/manifest.json",
  icons: {
    icon: "/satloom/favicon.ico",
    shortcut: "/satloom/favicon.ico",
    apple: "/satloom/apple-icon.png",
  },
  openGraph: {
    title: 'SatLoom',
    description: 'Secure, anonymous, real-time communication.',
    siteName: 'SatLoom',
    url: './',
    type: 'website',
    images: [
      {
        url: "/og-image.png",
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
    images: ['/og-image.png'],
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
        <ThemeProvider>
          <AccessibilityProvider>
            <ClientSecurity />
            {children}
            <InAppToasts />
            {/* sonner's Toaster. 75 toast.success/error calls across 14 components
                — games, calls, theater, breakout rooms, the media recorder, room
                vibe, attachments — rendered nowhere, because the only Toaster was
                inside profile-modal and therefore mounted only while THAT modal
                was open. */}
            <Toaster />
          </AccessibilityProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
