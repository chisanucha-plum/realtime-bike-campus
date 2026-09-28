"use client"

import { Button } from "@/components/ui/button"
import { LogOut } from "lucide-react"
import { useRouter } from 'next/navigation'
import { useLanguage } from "@/hooks/useLanguage"
import { LanguageSelector } from "@/components/LanguageSelector"
import { ThemeToggle } from "@/components/theme-toggle"
import { logoutApi } from "@/lib/api/auth"
import { clearStoredCurrentUser } from "@/stores/auth-store"

interface HeaderProps {
  onMenuClick?: () => void
}

export function Header({ onMenuClick }: HeaderProps) {
  const router = useRouter()
  const { language, setLang, t } = useLanguage("en")

  const handleLogout = async () => {
    clearStoredCurrentUser()

    // Reset language preference (existing behavior on logout)
    try {
      localStorage.removeItem('language')
    } catch {
      // ignore storage errors and continue logout flow
    }

    await logoutApi() // best effort — clears refresh-token cookie
    router.replace('/')
  }

  return (
    <header className="h-12 bg-white/95 dark:bg-[#181818]/95 backdrop-blur-xl border border-neutral-200/80 dark:border-neutral-800/80 flex items-center justify-between px-3.5 sm:px-4 rounded-2xl mx-3 sm:mx-4 mt-3 sm:mt-4 mb-1 shadow-xs">
      <div className="flex items-center gap-2.5 sm:gap-3 min-w-0 flex-1">
        {/* Mobile Logo */}
        <div className="flex md:hidden items-center justify-center w-8 h-8 rounded-xl bg-white dark:bg-neutral-900 shadow-xs border border-neutral-200/80 dark:border-neutral-700/60 overflow-hidden flex-shrink-0">
          <img src="/icon.png" alt="Logo" className="w-6 h-6 object-contain" />
        </div>

        <div className="flex flex-col min-w-0">
          <span className="text-xs sm:text-sm font-semibold tracking-tight text-neutral-900 dark:text-neutral-100 truncate">
            {t("login.title")}
          </span>
          <span className="text-[10px] sm:text-[11px] font-medium text-neutral-400 dark:text-neutral-500 truncate hidden sm:inline">
            KMUTT Real-time Safety Monitoring
          </span>
        </div>
      </div>

      <div className="flex items-center gap-1.5 sm:gap-2 flex-shrink-0">
        <LanguageSelector currentLanguage={language as "en" | "th"} onLanguageChange={setLang} />
        <ThemeToggle />
        <Button
          variant="ghost"
          size="sm"
          onClick={handleLogout}
          className="hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-600 dark:text-neutral-300 hover:text-neutral-900 dark:hover:text-white h-7 sm:h-8 rounded-full px-2.5 sm:px-3 transition-colors"
        >
          <LogOut className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
          <span className="ml-1.5 text-xs hidden sm:inline font-medium">{t("buttons.logout")}</span>
        </Button>
      </div>
    </header>
  )
}
