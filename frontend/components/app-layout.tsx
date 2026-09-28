"use client"

import { ErrorBoundary } from "@/components/error-boundary"
import { ApiError, getCurrentUser, refreshAccessToken } from "@/lib/api/auth"
import type { CurrentUserResponse } from "@/lib/api/auth"
import { Header } from "@/components/header"
import { FloatingToolbar } from "@/components/floating-toolbar"
import {
  getStoredAccessToken,
  getStoredUserRole,
  setStoredAccessToken,
  setStoredCurrentUser,
} from "@/stores/auth-store"
import { usePathname, useRouter } from "next/navigation"
import type React from "react"
import { useEffect, useState } from "react"

interface AppLayoutProps {
  children: React.ReactNode
}

export function AppLayout({ children }: AppLayoutProps) {
  const pathname = usePathname()
  const router = useRouter()
  // True once the first /user/me attempt after a page load has settled, so
  // route guards do not act on the not-yet-restored (null) role.
  const [isSessionReady, setIsSessionReady] = useState(false)

  const enforceRouteAccess = (role: string | null, currentPath: string) => {
    const isAdminOnlyPage = currentPath === "/dashboard"
    const isSettingsPage = currentPath === "/settings"

    if (isAdminOnlyPage && role !== "admin") {
      router.replace("/not-found")
      return false
    }

    if (isSettingsPage && role !== "admin" && role !== "security") {
      router.replace("/not-found")
      return false
    }

    return true
  }

  useEffect(() => {
    // Wait for the session restore to settle first — right after a reload the
    // in-memory role is null even for a logged-in user.
    if (!isSessionReady) return
    const role = getStoredUserRole()
    enforceRouteAccess(role, pathname)
  }, [pathname, router, isSessionReady])

  useEffect(() => {
    setIsSessionReady(false)

    if (pathname === "/") return

    let cancelled = false
    // Latch that stops the 15s interval from hammering /refresh_token once the
    // session is conclusively gone (expired cookie, rejected refresh).
    let refreshExhausted = false

    const applyCurrentUser = (currentUser: CurrentUserResponse) => {
      setStoredCurrentUser({
        role: currentUser.role,
        email: currentUser.email,
        fullName: currentUser.full_name,
        username: currentUser.username,
      })
      // Route enforcement happens in the guard effect above, which re-runs
      // once isSessionReady flips true.
      setIsSessionReady(true)
    }

    /** Return an access token; after a reload the in-memory token is gone, so
     * restore the session from the refresh-token cookie first. */
    const ensureAccessToken = async (): Promise<string | null> => {
      const existing = getStoredAccessToken()
      if (existing) return existing
      if (refreshExhausted) return null

      try {
        const tokens = await refreshAccessToken()
        setStoredAccessToken(tokens.access_token)
        return tokens.access_token
      } catch (error: unknown) {
        // Definitive rejection — no valid refresh cookie. Mark settled so the
        // route guard can act; network errors stay retryable on later ticks.
        if (error instanceof ApiError && (error.status === 401 || error.status === 403)) {
          refreshExhausted = true
          if (!cancelled) setIsSessionReady(true)
        }
        return null
      }
    }

    const syncCurrentUser = async () => {
      const token = await ensureAccessToken()
      if (!token || cancelled) return

      let currentUser: CurrentUserResponse
      try {
        currentUser = await getCurrentUser(token)
      } catch (error: unknown) {
        // Keep existing local cache for network/other errors (offline, server down)
        if (!(error instanceof ApiError) || error.status !== 401) return

        // Access token expired — rotate tokens via refresh endpoint and retry once.
        // If the refresh itself fails, the session is truly over (user must log in again).
        try {
          const tokens = await refreshAccessToken()
          setStoredAccessToken(tokens.access_token)
          currentUser = await getCurrentUser(tokens.access_token)
        } catch (refreshError: unknown) {
          console.warn("Session refresh failed - please login again:", refreshError)
          refreshExhausted = true
          if (!cancelled) setIsSessionReady(true)
          return
        }
      }

      if (cancelled) return
      applyCurrentUser(currentUser)
    }

    const onFocus = () => {
      void syncCurrentUser()
    }

    void syncCurrentUser()
    const intervalId = window.setInterval(syncCurrentUser, 15000)
    window.addEventListener("focus", onFocus)

    return () => {
      cancelled = true
      window.clearInterval(intervalId)
      window.removeEventListener("focus", onFocus)
    }
  }, [pathname])

  if (pathname === "/") {
    return <>{children}</>
  }

  return (
    <ErrorBoundary>
      <div className="flex h-screen bg-background overflow-hidden relative">
        {/* Responsive Floating Action Navigation (Left on Desktop, Bottom Dock on Mobile) */}
        <FloatingToolbar />

        {/* Main Content Area */}
        <div className="flex-1 flex flex-col overflow-hidden min-w-0 pl-0 pb-16 md:pb-0 md:pl-[84px] lg:pl-[88px]">
          <Header />
          <main className="flex-1 overflow-auto p-2.5 sm:p-4 md:p-6">
            <ErrorBoundary>{children}</ErrorBoundary>
          </main>
        </div>
      </div>
    </ErrorBoundary>
  )
}
