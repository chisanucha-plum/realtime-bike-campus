import { useState, useEffect, useCallback } from "react"
import enTranslations from "@/locales/en.json"
import thTranslations from "@/locales/th.json"

type Language = "en" | "th"

type Translations = {
  [key: string]: string | Translations
}

// Global event bus for language changes
const languageChangeEvent = "language-changed"

const flattenedTranslations: Record<Language, Record<string, string>> = {
  en: {},
  th: {},
}

function flatten(obj: Translations, prefix = "", target: Record<string, string>) {
  for (const key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      const val = obj[key]
      const fullKey = prefix ? `${prefix}.${key}` : key
      if (typeof val === "string") {
        target[fullKey] = val
      } else if (val && typeof val === "object") {
        flatten(val as Translations, fullKey, target)
      }
    }
  }
}

flatten(enTranslations, "", flattenedTranslations.en)
flatten(thTranslations, "", flattenedTranslations.th)

export function useLanguage(defaultLang: Language = "en") {
  const [language, setLanguageState] = useState<Language>(defaultLang)

  // Sync saved language from localStorage on client mount (avoids SSR hydration mismatch)
  useEffect(() => {
    try {
      const saved = localStorage.getItem("language") as Language | null
      if (saved && (saved === "en" || saved === "th")) {
        setLanguageState(saved)
      }
    } catch {
      // ignore storage access errors
    }
  }, [])

  // Listen for language changes from other components
  useEffect(() => {
    const handleLanguageChange = (e: Event) => {
      const customEvent = e as CustomEvent<Language>
      if (customEvent.detail && (customEvent.detail === "en" || customEvent.detail === "th")) {
        setLanguageState(customEvent.detail)
      }
    }

    window.addEventListener(languageChangeEvent, handleLanguageChange)
    return () => {
      window.removeEventListener(languageChangeEvent, handleLanguageChange)
    }
  }, [])

  const t = useCallback(
    (key: string): string => {
      return flattenedTranslations[language]?.[key] ?? key
    },
    [language]
  )

  const setLang = useCallback((lang: Language) => {
    setLanguageState(lang)
    try {
      localStorage.setItem("language", lang)
    } catch {
      // ignore storage errors
    }
    // Dispatch event to notify all other components
    const event = new CustomEvent<Language>(languageChangeEvent, { detail: lang })
    window.dispatchEvent(event)
  }, [])

  return { language, t, setLang }
}
