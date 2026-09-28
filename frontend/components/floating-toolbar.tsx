"use client"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import {
  AUTH_USER_UPDATED_EVENT,
  getStoredUserEmail,
  getStoredUserRole,
  type UserRole,
} from "@/stores/auth-store"
import {
  BarChart3,
  HelpCircle,
  History as HistoryIcon,
  Home,
  Settings,
  ShieldAlert,
  User,
} from "lucide-react"
import { usePathname, useRouter } from "next/navigation"
import type React from "react"
import { useEffect, useMemo, useState } from "react"
import { useLanguage } from "@/hooks/useLanguage"

interface NavItem {
  icon: React.ComponentType<{ className?: string }>
  label: string
  path: string
  description?: string
  badge?: string
}

export function FloatingToolbar() {
  const pathname = usePathname()
  const router = useRouter()
  const { t } = useLanguage("en")
  const [role, setRole] = useState<UserRole>(null)
  const [email, setEmail] = useState<string | null>(null)

  useEffect(() => {
    const syncUserFromStorage = () => {
      setRole(getStoredUserRole())
      setEmail(getStoredUserEmail())
    }

    syncUserFromStorage()
    window.addEventListener(AUTH_USER_UPDATED_EVENT, syncUserFromStorage)

    return () => {
      window.removeEventListener(AUTH_USER_UPDATED_EVENT, syncUserFromStorage)
    }
  }, [])

  const mainNavItems = useMemo<NavItem[]>(() => {
    const items: NavItem[] = [
      {
        icon: Home,
        label: t("sidebar.home"),
        path: "/real-time-monitoring",
        description: t("sidebar.realtimeMonitoring"),
      },
      {
        icon: HistoryIcon,
        label: t("sidebar.history"),
        path: "/history",
        description: t("sidebar.historyDesc"),
      },
    ]

    if (role === "admin") {
      items.push({
        icon: BarChart3,
        label: t("sidebar.dashboard"),
        path: "/dashboard",
        description: t("sidebar.dashboardDesc"),
      })
    }

    return items
  }, [role, t])

  const secondaryNavItems = useMemo<NavItem[]>(() => {
    const items: NavItem[] = []

    if (role === "admin" || role === "security") {
      items.push({
        icon: Settings,
        label: t("sidebar.settings"),
        path: "/settings",
        description: t("sidebar.settingsDesc"),
      })
    }

    items.push({
      icon: HelpCircle,
      label: t("sidebar.help"),
      path: "/help",
      description: t("sidebar.helpDesc"),
    })

    return items
  }, [role, t])

  const allNavItems = useMemo<NavItem[]>(() => {
    return [...mainNavItems, ...secondaryNavItems]
  }, [mainNavItems, secondaryNavItems])

  const handleNavigate = (path: string) => {
    router.push(path)
  }

  const roleDisplay = role ?? "unknown"
  const roleBadgeColor =
    role === "admin"
      ? "bg-blue-500/15 text-blue-500 border-blue-500/30"
      : role === "security"
        ? "bg-green-500/15 text-green-500 border-green-500/30"
        : "bg-card/90 text-muted-foreground border-border/80"

  return (
    <>
      {/* DESKTOP VIEW (md+): Separate Vertical Floating Islands on Left Edge */}
      <aside
        aria-label="Desktop Floating Navigation"
        className="hidden md:flex fixed left-3 lg:left-4 top-3 lg:top-4 bottom-3 lg:bottom-4 z-40 flex-col items-center justify-between pointer-events-none select-none"
      >
        {/* 1. Top group: Logo icon — own small rounded-square background, floating alone */}
        <div className="pointer-events-auto relative group/logo">
          <button
            type="button"
            onClick={() => handleNavigate("/real-time-monitoring")}
            className={cn(
              "flex items-center justify-center w-12 h-12 lg:w-14 lg:h-14 p-2",
              "bg-card/90 dark:bg-card/95 backdrop-blur-xl border border-border/80 shadow-lg rounded-2xl",
              "hover:scale-105 active:scale-95 transition-all duration-200 group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            )}
            aria-label="KMUTT Helmet Detection Home"
          >
            <div className="w-8 h-8 lg:w-9 lg:h-9 bg-white rounded-xl flex items-center justify-center shadow-xs border border-border/40 overflow-hidden">
              <img
                src="/icon.png"
                alt="Logo"
                className="w-6 h-6 lg:w-7 lg:h-7 object-contain transition-transform duration-200 group-hover:scale-110"
              />
            </div>
          </button>

          {/* Zero-JS Pure CSS Tooltip */}
          <div
            role="tooltip"
            className="absolute left-full ml-3 top-1/2 -translate-y-1/2 z-50 pointer-events-none whitespace-nowrap px-3 py-1.5 rounded-lg text-xs font-semibold bg-popover text-popover-foreground border border-border/80 shadow-lg backdrop-blur-md opacity-0 -translate-x-1.5 scale-95 group-hover/logo:opacity-100 group-hover/logo:translate-x-0 group-hover/logo:scale-100 transition-all duration-150 ease-out"
          >
            <div className="text-center">
              <p className="text-xs font-bold text-foreground">{t("login.title")}</p>
              <p className="text-[10px] text-muted-foreground font-normal">KMUTT</p>
            </div>
          </div>
        </div>

        {/* 2. Middle group: 3 main navigation icons (home, history, analytics) — 
               share ONE small pill-shaped background together, floating in the vertical center of screen */}
        <div className="flex-1 flex flex-col items-center justify-center pointer-events-auto">
          <nav
            aria-label="Main Navigation"
            className={cn(
              "flex flex-col items-center gap-2 lg:gap-2.5 py-2.5 lg:py-3 px-1.5 lg:px-2",
              "bg-card/90 dark:bg-card/95 backdrop-blur-xl border border-border/80 shadow-xl rounded-2xl lg:rounded-3xl",
              "transition-all duration-200"
            )}
          >
            {mainNavItems.map((item) => {
              const Icon = item.icon
              const isActive = pathname === item.path

              return (
                <div key={item.path} className="relative group/nav">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleNavigate(item.path)}
                    className={cn(
                      "relative w-10 h-10 lg:w-11 lg:h-11 rounded-xl lg:rounded-2xl transition-all duration-200",
                      "hover:scale-105 active:scale-95",
                      isActive
                        ? "bg-orange-500 hover:bg-orange-600 text-white shadow-md shadow-orange-500/30 font-semibold"
                        : "text-muted-foreground hover:bg-muted hover:text-foreground"
                    )}
                    aria-label={item.label}
                  >
                    <Icon className="w-5 h-5 lg:w-5.5 lg:h-5.5" />
                  </Button>

                  {/* Zero-JS Pure CSS Tooltip */}
                  <div
                    role="tooltip"
                    className="absolute left-full ml-3 top-1/2 -translate-y-1/2 z-50 pointer-events-none whitespace-nowrap px-3 py-1.5 rounded-lg text-xs font-semibold bg-popover text-popover-foreground border border-border/80 shadow-lg backdrop-blur-md opacity-0 -translate-x-1.5 scale-95 group-hover/nav:opacity-100 group-hover/nav:translate-x-0 group-hover/nav:scale-100 transition-all duration-150 ease-out"
                  >
                    <p className="font-semibold text-xs text-foreground">{item.label}</p>
                    {item.description && (
                      <p className="text-[11px] text-muted-foreground font-normal">{item.description}</p>
                    )}
                  </div>
                </div>
              )
            })}
          </nav>
        </div>

        {/* 3 & 4. Bottom section: Settings + Help group, and Avatar floating at the very bottom */}
        <div className="flex flex-col items-center gap-3 pointer-events-auto">
          {/* 3. Bottom group: Settings + Help icons — own separate small pill/rounded background */}
          {secondaryNavItems.length > 0 && (
            <div
              className={cn(
                "flex flex-col items-center gap-1.5 lg:gap-2 py-2 lg:py-2.5 px-1.5 lg:px-2",
                "bg-card/90 dark:bg-card/95 backdrop-blur-xl border border-border/80 shadow-lg rounded-2xl lg:rounded-3xl",
                "transition-all duration-200"
              )}
            >
              {secondaryNavItems.map((item) => {
                const Icon = item.icon
                const isActive = pathname === item.path

                return (
                  <div key={item.path} className="relative group/sec">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleNavigate(item.path)}
                      className={cn(
                        "relative w-10 h-10 lg:w-11 lg:h-11 rounded-xl lg:rounded-2xl transition-all duration-200",
                        "hover:scale-105 active:scale-95",
                        isActive
                          ? "bg-orange-500 hover:bg-orange-600 text-white shadow-md shadow-orange-500/30 font-semibold"
                          : "text-muted-foreground hover:bg-muted hover:text-foreground"
                      )}
                      aria-label={item.label}
                    >
                      <Icon className="w-5 h-5 lg:w-5.5 lg:h-5.5" />
                    </Button>

                    {/* Zero-JS Pure CSS Tooltip */}
                    <div
                      role="tooltip"
                      className="absolute left-full ml-3 top-1/2 -translate-y-1/2 z-50 pointer-events-none whitespace-nowrap px-3 py-1.5 rounded-lg text-xs font-semibold bg-popover text-popover-foreground border border-border/80 shadow-lg backdrop-blur-md opacity-0 -translate-x-1.5 scale-95 group-hover/sec:opacity-100 group-hover/sec:translate-x-0 group-hover/sec:scale-100 transition-all duration-150 ease-out"
                    >
                      <p className="font-semibold text-xs text-foreground">{item.label}</p>
                      {item.description && (
                        <p className="text-[11px] text-muted-foreground font-normal">{item.description}</p>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {/* 4. Avatar — own circular background, no shared container, floating at the very bottom */}
          <div className="relative group/avatar">
            <div
              className={cn(
                "w-11 h-11 lg:w-12 lg:h-12 rounded-full flex items-center justify-center border shadow-lg backdrop-blur-xl cursor-default transition-all duration-200 hover:scale-105",
                roleBadgeColor
              )}
            >
              {role === "admin" ? (
                <ShieldAlert className="w-5 h-5" />
              ) : (
                <User className="w-5 h-5" />
              )}
            </div>

            {/* Zero-JS Pure CSS Tooltip */}
            <div
              role="tooltip"
              className="absolute left-full ml-3 top-1/2 -translate-y-1/2 z-50 pointer-events-none whitespace-nowrap px-3 py-1.5 rounded-lg text-xs font-semibold bg-popover text-popover-foreground border border-border/80 shadow-lg backdrop-blur-md opacity-0 -translate-x-1.5 scale-95 group-hover/avatar:opacity-100 group-hover/avatar:translate-x-0 group-hover/avatar:scale-100 transition-all duration-150 ease-out"
            >
              <div className="space-y-0.5">
                <p className="text-xs font-medium text-foreground">{email ?? "User"}</p>
                <div className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider bg-background/80 border border-border">
                  {roleDisplay}
                </div>
              </div>
            </div>
          </div>
        </div>
      </aside>

      {/* MOBILE VIEW (< md): Sleek Horizontal Floating Bottom Pill Dock */}
      <nav
        aria-label="Mobile Bottom Navigation"
        className={cn(
          "md:hidden fixed bottom-3 inset-x-0 mx-auto w-fit z-40 max-w-[calc(100vw-24px)]",
          "flex items-center gap-1.5 px-3 py-2",
          "bg-card/90 dark:bg-card/95 backdrop-blur-2xl border border-border/80 shadow-2xl rounded-full",
          "transition-all duration-300"
        )}
      >
        {allNavItems.map((item) => {
          const Icon = item.icon
          const isActive = pathname === item.path

          return (
            <button
              key={item.path}
              type="button"
              onClick={() => handleNavigate(item.path)}
              className={cn(
                "relative flex items-center justify-center w-10 h-10 rounded-full transition-all duration-200",
                "active:scale-95",
                isActive
                  ? "bg-orange-500 text-white shadow-md shadow-orange-500/30"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
              )}
              aria-label={item.label}
            >
              <Icon className="w-5 h-5" />
            </button>
          )
        })}

        {/* User Role Indicator in Mobile Dock */}
        <div
          className={cn(
            "w-9 h-9 rounded-full flex items-center justify-center border shadow-xs ml-1",
            roleBadgeColor
          )}
          title={`${email ?? "User"} (${roleDisplay})`}
        >
          {role === "admin" ? (
            <ShieldAlert className="w-4 h-4" />
          ) : (
            <User className="w-4 h-4" />
          )}
        </div>
      </nav>
    </>
  )
}
