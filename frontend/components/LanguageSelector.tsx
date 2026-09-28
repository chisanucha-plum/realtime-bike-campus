"use client"

import { Globe, Check } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { memo } from "react"

type Language = "en" | "th"

interface LanguageSelectorProps {
  currentLanguage: Language
  onLanguageChange: (lang: Language) => void
}

const languages: { code: Language; name: string; flag: string }[] = [
  { code: "en", name: "English", flag: "🇬🇧" },
  { code: "th", name: "ไทย", flag: "🇹🇭" },
]

export const LanguageSelector = memo(function LanguageSelector({ currentLanguage, onLanguageChange }: LanguageSelectorProps) {
  const current = languages.find((l) => l.code === currentLanguage)

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="flex items-center gap-2 rounded-full h-8 px-3 bg-white/80 dark:bg-neutral-900/80 border-neutral-200/80 dark:border-neutral-700/60 text-neutral-700 dark:text-neutral-200 shadow-xs"
        >
          <Globe className="h-3.5 w-3.5" />
          <span className="text-xs sm:text-sm font-medium">{current?.name}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-40 rounded-xl">
        {languages.map((lang) => (
          <DropdownMenuItem
            key={lang.code}
            onClick={() => onLanguageChange(lang.code)}
            className="flex items-center justify-between gap-2 cursor-pointer rounded-lg"
          >
            <div className="flex items-center gap-2">
              <span className="text-lg">{lang.flag}</span>
              <span className="text-sm">{lang.name}</span>
            </div>
            {currentLanguage === lang.code && (
              <Check className="h-4 w-4 text-emerald-600" />
            )}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
})
