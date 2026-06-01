import type { Metadata, Viewport } from 'next'
import './globals.css'
import { Suspense } from 'react'

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  themeColor: '#0D0D0D',
}

export const metadata: Metadata = {
  title: 'Laaluyadav — The Movie Oracle',
  description: 'Desi uncle certified. World cinema & TV. Community sentiment + IMDB + RT Audience + TMDB. No filmy nonsense.',
  icons: {
    icon: [
      { url: '/favicon.svg',        type: 'image/svg+xml' },
      { url: '/icons/icon-32.png',  sizes: '32x32',   type: 'image/png' },
      { url: '/icons/icon-16.png',  sizes: '16x16',   type: 'image/png' },
      { url: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: [
      { url: '/icons/apple-touch-icon.png', sizes: '180x180', type: 'image/png' },
    ],
    shortcut: '/favicon.ico',
  },
  manifest: '/manifest.json',
  openGraph: {
    title: 'Laaluyadav — The Movie Oracle',
    description: 'Desi uncle certified. Unemployable unc. No filmy nonsense.',
    type: 'website',
    images: [{ url: '/icons/icon-512.png', width: 512, height: 512 }],
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Suspense fallback={null}>
          {children}
        </Suspense>
      </body>
    </html>
  )
}