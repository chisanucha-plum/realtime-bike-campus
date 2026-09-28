import type React from "react"
import type { Metadata } from "next"
import { GeistSans } from "geist/font/sans"
import { GeistMono } from "geist/font/mono"
import { Analytics } from "@vercel/analytics/next"
// Analytics only runs in production; Vercel injects it via edge middleware in dev environments
import { Suspense } from "react"
import { AppLayout } from "@/components/app-layout"
import { PwaRegister } from "@/components/pwa-register"
import { Toaster } from "@/components/ui/sonner"
import "./globals.css"

export const metadata: Metadata = {
  title: "ระบบตรวจจับการขับขี่สำหรับมหาวิทยาลัย",
  description: "ระบบตรวจจับการขับขี่สำหรับมหาวิทยาลัย",
  generator: "v0.app",
  manifest: "/manifest.json",
  icons: {
    icon: [
      { url: '/favicon.ico', sizes: '32x32', type: 'image/x-icon' },
      { url: '/favicon.ico', sizes: '16x16', type: 'image/x-icon' },
    ],
    shortcut: '/favicon.ico',
    apple: '/favicon.ico',
    other: [
      {
        rel: 'apple-touch-icon-precomposed',
        url: '/favicon.ico',
      },
    ],
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="th" suppressHydrationWarning>
      <head>
        {/* Apply saved theme before first paint to avoid a light-mode flash */}
        <script
          dangerouslySetInnerHTML={{
            __html: `try{if(localStorage.getItem("theme")==="dark"){document.documentElement.classList.add("dark")}}catch(e){}`,
          }}
        />
        {/* Load react-scan in development only so it doesn't run in production */}
        {process.env.NODE_ENV === 'development' && (
          <script
            // load the global auto-initializing build from unpkg
            crossOrigin="anonymous"
            src="//unpkg.com/react-scan/dist/auto.global.js"
          />
        )}
      </head>
      <body className={`font-sans ${GeistSans.variable} ${GeistMono.variable} antialiased`}>
        <AppLayout>
          <Suspense fallback={null}>{children}</Suspense>
        </AppLayout>
        <PwaRegister />
        <Toaster />
        {process.env.NODE_ENV === "production" && <Analytics />}
      </body>
    </html>
  )
}
