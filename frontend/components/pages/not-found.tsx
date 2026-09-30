"use client"

import { useRouter } from "next/navigation"
import { Home, ArrowLeft } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { useLanguage } from "@/hooks/useLanguage"

interface NotFoundProps {
  readonly message?: string
}

export function NotFound({ message }: Readonly<NotFoundProps>) {
  const router = useRouter()
  const { t } = useLanguage("en")
  const displayMessage = message || t("errors.pageNotFoundMessage")

  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <Card className="w-full max-w-md text-center rounded-2xl border-neutral-200/60 dark:border-neutral-800/80 bg-white/90 dark:bg-[#18181A]/90 backdrop-blur-xl shadow-[0_4px_20px_rgba(0,0,0,0.04)]">
        <CardHeader className="pb-3 border-b border-neutral-100 dark:border-neutral-800/60">
          <div className="w-16 h-16 bg-muted/60 border border-neutral-200/80 dark:border-neutral-800/80 rounded-2xl flex items-center justify-center mx-auto mb-3 shadow-xs">
            <span className="text-3xl font-extrabold text-neutral-500 dark:text-neutral-400">404</span>
          </div>
          <CardTitle className="text-lg font-bold text-neutral-900 dark:text-white">{t("errors.pageNotFound")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5 pt-4">
          <p className="text-sm text-muted-foreground">{displayMessage}</p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Button onClick={() => router.back()} variant="outline" className="gap-2 rounded-xl border-neutral-200/80 dark:border-neutral-800/80 shadow-xs">
              <ArrowLeft className="w-4 h-4 text-neutral-500 dark:text-neutral-400" />
              {t("buttons.back")}
            </Button>
            <Button onClick={() => router.push("/")} className="gap-2 rounded-xl shadow-xs">
              <Home className="w-4 h-4" />
              {t("buttons.home")}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
