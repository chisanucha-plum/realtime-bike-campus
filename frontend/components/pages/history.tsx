"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import {
  AlertCircle,
  Calendar,
  Download,
  History as HistoryIcon,
  RotateCw,
  Search,
  SlidersHorizontal,
  X,
} from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { DetectionList, DetectionSkeletonList } from "@/components/real-time/DetectionList"
import { useLanguage } from "@/hooks/useLanguage"
import { downloadCsv } from "@/lib/export-csv"
import { fetchHelmetHistory } from "@/services/helmet-detection.service"
import type { DetectionResult } from "@/types/detection.types"

const HISTORY_LIMIT = 500

const CARD_CLASS =
  "rounded-2xl border-neutral-200/60 dark:border-neutral-800/80 bg-white/90 dark:bg-[#18181A]/90 backdrop-blur-xl shadow-[0_4px_20px_rgba(0,0,0,0.04)]"
const CARD_HEADER_CLASS = "pb-3 border-b border-neutral-100 dark:border-neutral-800/60"
const CARD_TITLE_CLASS = "flex items-center gap-2 text-base font-semibold text-neutral-900 dark:text-white"

type StatusFilter = "all" | "violation" | "compliant" | "overCapacity"

/** ISO date (YYYY-MM-DD) of a stored timestamp string, "" when unparseable */
function dayOf(detection: DetectionResult): string {
  const match = detection.timestamp.match(/^(\d{4}-\d{2}-\d{2})/)
  return match ? match[1] : ""
}

export function HistoryPage() {
  const { t } = useLanguage("en")
  const [detections, setDetections] = useState<DetectionResult[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all")
  const [dayFilter, setDayFilter] = useState<string>("")
  const [searchQuery, setSearchQuery] = useState<string>("")

  const todayStr = useMemo(() => new Date().toISOString().slice(0, 10), [])
  const yesterdayStr = useMemo(
    () => new Date(Date.now() - 86400000).toISOString().slice(0, 10),
    []
  )

  const load = useCallback(async () => {
    try {
      setIsLoading(true)
      setError(null)
      setDetections(await fetchHelmetHistory(HISTORY_LIMIT))
    } catch (err) {
      setError(err instanceof Error ? err : new Error("Failed to load history"))
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    return detections.filter((detection) => {
      if (dayFilter && dayOf(detection) !== dayFilter) return false
      if (statusFilter === "violation") return detection.violation
      if (statusFilter === "compliant") return !detection.violation
      if (statusFilter === "overCapacity") return Boolean(detection.overCapacity)

      if (q) {
        const matchesTrack = String(detection.trackId ?? "").toLowerCase().includes(q)
        const matchesTime = detection.timestamp.toLowerCase().includes(q)
        const matchesCam = detection.camera.toLowerCase().includes(q)
        if (!matchesTrack && !matchesTime && !matchesCam) return false
      }

      return true
    })
  }, [detections, statusFilter, dayFilter, searchQuery])

  const exportCsv = () => {
    downloadCsv(
      `helmet-history-${new Date().toISOString().slice(0, 10)}.csv`,
      filtered.map((detection) => ({
        timestamp: detection.timestamp,
        track_id: detection.trackId ?? "",
        helmet_status: detection.helmetStatus === "wearing" ? "helmet on" : "helmet off",
        passenger_count: detection.passengerCount,
        over_capacity: detection.overCapacity ? "yes" : "no",
        violation: detection.violation ? "yes" : "no",
        frame_path: detection.framePath ?? "",
      }))
    )
  }

  const violationCount = filtered.filter((detection) => detection.violation).length
  const hasActiveFilters = statusFilter !== "all" || dayFilter !== "" || searchQuery !== ""

  const handleClearFilters = () => {
    setStatusFilter("all")
    setDayFilter("")
    setSearchQuery("")
  }

  return (
    <div className="space-y-5 sm:space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-foreground">{t("history.title")}</h2>
          <p className="text-sm text-muted-foreground mt-0.5">{t("history.subtitle")}</p>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="gap-2 rounded-xl bg-card border-neutral-200/80 dark:border-neutral-800/80 shadow-xs hover:bg-muted"
          onClick={exportCsv}
          disabled={filtered.length === 0}
        >
          <Download className="h-4 w-4 text-neutral-500 dark:text-neutral-400" />
          {t("history.exportCsv")}
        </Button>
      </div>

      {/* Error Notice */}
      {error && (
        <div className="bg-destructive/10 border border-destructive/20 rounded-2xl p-4 flex items-start justify-between gap-3 shadow-xs">
          <div className="flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-destructive flex-shrink-0 mt-0.5" />
            <p className="text-sm text-foreground">{error.message}</p>
          </div>
          <Button size="sm" variant="outline" onClick={load} className="gap-2 rounded-xl">
            <RotateCw className="h-4 w-4" />
            {t("buttons.retry")}
          </Button>
        </div>
      )}

      {/* Filter & Search Toolbar */}
      <Card className={CARD_CLASS}>
        <CardContent className="p-3.5 sm:p-4 space-y-3">
          <div className="flex flex-col md:flex-row md:items-center gap-3">
            {/* Search Input */}
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={t("history.searchPlaceholder")}
                className="pl-9 pr-8 rounded-xl border-neutral-200/80 dark:border-neutral-800/80 shadow-xs text-xs sm:text-sm"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>

            {/* Status Select */}
            <div className="flex items-center gap-2">
              <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as StatusFilter)}>
                <SelectTrigger className="w-full sm:w-[180px] rounded-xl border-neutral-200/80 dark:border-neutral-800/80 shadow-xs text-xs sm:text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="rounded-xl">
                  <SelectItem value="all">{t("history.filterAll")}</SelectItem>
                  <SelectItem value="violation">{t("history.filterViolations")}</SelectItem>
                  <SelectItem value="compliant">{t("history.filterCompliant")}</SelectItem>
                  <SelectItem value="overCapacity">{t("history.filterOverCapacity")}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Date Input */}
            <Input
              type="date"
              value={dayFilter}
              onChange={(event) => setDayFilter(event.target.value)}
              className="w-full sm:w-[160px] rounded-xl border-neutral-200/80 dark:border-neutral-800/80 shadow-xs text-xs sm:text-sm"
              aria-label={t("history.dayFilter")}
            />
          </div>

          {/* Quick Date Chips & Counts Row */}
          <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-border/50 text-xs">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-muted-foreground text-[11px] mr-1 hidden sm:inline">Presets:</span>
              <Button
                variant={dayFilter === todayStr ? "secondary" : "outline"}
                size="sm"
                className="h-7 px-2.5 rounded-lg text-xs font-normal"
                onClick={() => setDayFilter(dayFilter === todayStr ? "" : todayStr)}
              >
                {t("history.todayPreset")}
              </Button>
              <Button
                variant={dayFilter === yesterdayStr ? "secondary" : "outline"}
                size="sm"
                className="h-7 px-2.5 rounded-lg text-xs font-normal"
                onClick={() => setDayFilter(dayFilter === yesterdayStr ? "" : yesterdayStr)}
              >
                {t("history.yesterdayPreset")}
              </Button>
              {hasActiveFilters && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2.5 rounded-lg text-xs text-muted-foreground hover:text-foreground"
                  onClick={handleClearFilters}
                >
                  <X className="h-3 w-3 mr-1" />
                  {t("history.clearFilters")}
                </Button>
              )}
            </div>

            <div className="flex items-center gap-2 ml-auto">
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-muted border border-border/60 text-foreground">
                {filtered.length} / {detections.length}
              </span>
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20">
                {t("history.violationsBadge")}: {violationCount}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Detection List Container */}
      <Card className={CARD_CLASS}>
        <CardHeader className={CARD_HEADER_CLASS}>
          <CardTitle className={CARD_TITLE_CLASS}>
            <HistoryIcon className="h-4 w-4 text-neutral-500 dark:text-neutral-400" />
            {t("history.title")}
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-4">
          <div className="relative min-h-[200px]">
            {isLoading ? (
              <DetectionSkeletonList count={4} />
            ) : (
              <DetectionList
                detections={filtered}
                t={t}
                emptyMessage={hasActiveFilters ? t("history.noMatchingResults") : undefined}
                emptyAction={
                  hasActiveFilters ? (
                    <Button
                      variant="outline"
                      size="sm"
                      className="rounded-xl text-xs gap-1.5"
                      onClick={handleClearFilters}
                    >
                      <RotateCw className="h-3.5 w-3.5" />
                      <span>{t("history.clearFilters")}</span>
                    </Button>
                  ) : undefined
                }
              />
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
