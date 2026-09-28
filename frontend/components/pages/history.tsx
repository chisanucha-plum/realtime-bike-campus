"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { AlertCircle, Download, History as HistoryIcon, RotateCw, SlidersHorizontal } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { DetectionList } from "@/components/real-time/DetectionList"
import { useLanguage } from "@/hooks/useLanguage"
import { downloadCsv } from "@/lib/export-csv"
import { fetchHelmetHistory } from "@/services/helmet-detection.service"
import type { DetectionResult } from "@/types/detection.types"

const HISTORY_LIMIT = 500

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
    return detections.filter((detection) => {
      if (dayFilter && dayOf(detection) !== dayFilter) return false
      if (statusFilter === "violation") return detection.violation
      if (statusFilter === "compliant") return !detection.violation
      if (statusFilter === "overCapacity") return detection.passengerCount > 2
      return true
    })
  }, [detections, statusFilter, dayFilter])

  const exportCsv = () => {
    downloadCsv(
      `helmet-history-${new Date().toISOString().slice(0, 10)}.csv`,
      filtered.map((detection) => ({
        timestamp: detection.timestamp,
        helmet: detection.helmetStatus,
        passengers: detection.passengerCount,
        overCapacity: detection.passengerCount > 2 ? "yes" : "no",
        violation: detection.violation ? "yes" : "no",
        frame: detection.framePath ?? "",
      }))
    )
  }

  const violationCount = filtered.filter((detection) => detection.violation).length

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
          className="gap-2 rounded-xl bg-card border-border/80 shadow-xs hover:bg-muted"
          onClick={exportCsv}
          disabled={filtered.length === 0}
        >
          <Download className="h-4 w-4" />
          {t("history.exportCsv")}
        </Button>
      </div>

      {/* Error Notice */}
      {error && (
        <div className="bg-destructive/10 border border-destructive/20 rounded-2xl p-4 flex items-start justify-between gap-3">
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

      {/* Filter Toolbar */}
      <Card className="rounded-2xl border-border/80 shadow-xs bg-card/90 backdrop-blur-md">
        <CardContent className="flex flex-col sm:flex-row sm:items-center gap-3 p-3.5 sm:p-4">
          <div className="flex items-center gap-2">
            <SlidersHorizontal className="w-4 h-4 text-muted-foreground hidden sm:inline" />
            <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as StatusFilter)}>
              <SelectTrigger className="w-full sm:w-[200px] rounded-xl">
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

          <Input
            type="date"
            value={dayFilter}
            onChange={(event) => setDayFilter(event.target.value)}
            className="w-full sm:w-[170px] rounded-xl"
            aria-label={t("history.dayFilter")}
          />

          {(statusFilter !== "all" || dayFilter) && (
            <Button
              variant="ghost"
              size="sm"
              className="rounded-xl h-9 text-xs"
              onClick={() => { setStatusFilter("all"); setDayFilter("") }}
            >
              {t("history.clearFilters")}
            </Button>
          )}

          <div className="sm:ml-auto flex items-center gap-2 pt-2 sm:pt-0 border-t sm:border-t-0 border-border/60">
            <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-semibold bg-muted border border-border/80 text-foreground">
              {filtered.length} / {detections.length}
            </span>
            <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-semibold bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/20">
              {t("history.violationsBadge")}: {violationCount}
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Detection List Container */}
      <div className="relative min-h-[200px]">
        {!isLoading && <DetectionList detections={filtered} t={t} />}
        {isLoading && (
          <div className="flex items-center justify-center py-16">
            <div className="flex flex-col items-center gap-3 text-muted-foreground">
              <div className="w-10 h-10 border-3 border-primary/20 border-t-primary rounded-full animate-spin" />
              <p className="text-sm font-medium">{t("common.loading")}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
