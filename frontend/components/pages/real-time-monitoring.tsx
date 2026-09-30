"use client"

import React, { useEffect, useRef, useState, useMemo } from "react"
import {
  AlertCircle,
  AlertTriangle,
  BikeIcon,
  Camera,
  CheckCircle,
  Clock,
  Eye,
  EyeOff,
  MapPin,
  RotateCw,
  X,
  Users,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { toast } from "sonner"
import { useRealTimeDetections } from "@/hooks/useRealTimeDetections"
import { useHelmetStats } from "@/hooks/useHelmetStats"
import { useLanguage } from "@/hooks/useLanguage"
import { loadDisplayPrefs, HELMET_SETTINGS_UPDATED_EVENT } from "@/lib/app-settings"
import { playViolationBeep } from "@/lib/alert-sound"
import { getStreamUrl } from "@/services/helmet-detection.service"
import { DetectionList } from "@/components/real-time/DetectionList"
import type { DetectionResult } from "@/types/detection.types"

import { cn } from "@/lib/utils"

function NowClock() {
  const [now, setNow] = useState<Date | null>(null)

  useEffect(() => {
    setNow(new Date())
    const t = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(t)
  }, [])

  if (!now) return <span suppressHydrationWarning>--:--:--</span>
  return <>{now.toLocaleTimeString("th-TH")}</>
}

interface TodaySummary {
  total_detections: number
  total_violations: number
  excess_passengers: number
  compliance_percent: number
}

const FloatingStatsStack = React.memo(function FloatingStatsStack({
  summary,
  isLoading,
  isRecording,
  onToggleRecording,
  cameraLoading,
  t,
}: {
  summary: TodaySummary | null
  isLoading: boolean
  isRecording: boolean
  onToggleRecording: () => void
  cameraLoading: boolean
  t: (key: string) => string
}) {
  const statItems = useMemo(() => [
    {
      icon: BikeIcon,
      label: t("stats.motorcyclesDetected"),
      value: isLoading || !summary ? "-" : summary.total_detections,
    },
    {
      icon: Users,
      label: t("stats.overCapacity"),
      value: isLoading || !summary ? "-" : summary.excess_passengers,
    },
    {
      icon: AlertTriangle,
      label: t("stats.violations"),
      value: isLoading || !summary ? "-" : summary.total_violations,
    },
    {
      icon: CheckCircle,
      label: t("stats.complianceRate"),
      value: isLoading || !summary ? "-" : `${summary.compliance_percent}%`,
    },
  ], [summary, isLoading, t])

  return (
    <div className="absolute top-2 right-2 sm:top-3 sm:right-3 z-20 flex flex-col items-end gap-1.5 sm:gap-2 max-w-[calc(100%-16px)] sm:max-w-none w-64 xs:w-72 sm:w-80 pointer-events-auto">
      {/* Camera Controls & Status Badge directly above the 2x2 stats */}
      <div className="flex items-center justify-end gap-1 sm:gap-1.5 w-full">
        {/* Status Badge + Last Updated */}
        <div className="inline-flex items-center gap-1.5 px-2 py-1 sm:px-3 sm:py-1.5 rounded-full border border-neutral-200/80 dark:border-neutral-700/60 bg-white/95 dark:bg-[#1E1E1E]/95 backdrop-blur-md shadow-xs max-w-full">
          <span
            className={cn(
              "w-2 h-2 rounded-full flex-shrink-0",
              isRecording ? "bg-emerald-500 animate-pulse" : "bg-neutral-400"
            )}
          />
          <span className="text-[10px] sm:text-[11px] font-medium text-neutral-800 dark:text-neutral-200 whitespace-nowrap">
            {t("status." + (isRecording ? "running" : "stopped"))}
          </span>
          <span className="text-neutral-300 dark:text-neutral-600 select-none">•</span>
          <span className="text-[10px] sm:text-[11px] text-neutral-500 dark:text-neutral-400 font-mono whitespace-nowrap">
            <NowClock />
          </span>
        </div>

        {/* Recording Toggle Button */}
        <Button
          variant={isRecording ? "destructive" : "default"}
          size="sm"
          onClick={onToggleRecording}
          disabled={cameraLoading}
          className="gap-1 sm:gap-1.5 rounded-full h-7 sm:h-8 px-2.5 sm:px-3 text-[10px] sm:text-xs shadow-xs font-medium flex-shrink-0"
        >
          {isRecording ? <EyeOff className="h-3 w-3 sm:h-3.5 sm:w-3.5" /> : <Eye className="h-3 w-3 sm:h-3.5 sm:w-3.5" />}
          <span className="hidden sm:inline">{t("buttons." + (isRecording ? "stopRecording" : "startRecording"))}</span>
        </Button>
      </div>

      {/* 2x2 Grid Stats Cards (Clean Bright White Style, Minimal Shadow) */}
      <div className="grid grid-cols-2 gap-1.5 sm:gap-2 w-full p-1.5 sm:p-2 rounded-2xl bg-white/90 dark:bg-[#181818]/90 backdrop-blur-xl border border-white/80 dark:border-neutral-800/80 shadow-[0_4px_20px_rgba(0,0,0,0.06)] dark:shadow-[0_4px_20px_rgba(0,0,0,0.3)]">
        {statItems.map((item, idx) => {
          const Icon = item.icon
          return (
            <div
              key={idx}
              className={cn(
                "group relative overflow-hidden rounded-xl p-2 sm:p-3",
                "bg-[#FBFBFA] dark:bg-[#222222] hover:bg-[#F5F5F3] dark:hover:bg-[#282828]",
                "border border-neutral-100 dark:border-neutral-700/50",
                "transition-colors duration-150"
              )}
            >
              <div className="flex items-start justify-between gap-1">
                <div className="w-5 h-5 sm:w-6 sm:h-6 rounded-md flex items-center justify-center text-neutral-600 dark:text-neutral-300">
                  <Icon className="h-3.5 w-3.5 sm:h-4 sm:w-4 stroke-[1.75]" />
                </div>
              </div>
              <div className="mt-1 sm:mt-2 min-w-0">
                <p className="text-[9px] sm:text-[10px] font-medium text-neutral-400 dark:text-neutral-400 tracking-tight truncate">
                  {item.label}
                </p>
                <p className="text-sm xs:text-base sm:text-xl font-semibold text-neutral-900 dark:text-white tracking-tight mt-0.5">
                  {item.value}
                </p>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
})

/** Upper bound for the SSE/history buffer regardless of display settings */
const MAX_SSE_BUFFER = 50

/** Camera location on campus_map.png, as % of image size (building S13) */
const CAMERA_LOCATION = { x: 29.1, y: 6.1, label: "S13" }

/** Pin gradient by violation rate */
const LEVEL_STYLES = {
  high: "linear-gradient(135deg,#E8543E,#C43D2C)", // > 30%
  mid: "linear-gradient(135deg,#E0A23D,#B87F26)", // 10-30%
  low: "linear-gradient(135deg,#2F8F63,#22714D)", // < 10%
} as const

type LevelKey = keyof typeof LEVEL_STYLES

/** Pin color level from violation rate (0-100) */
function levelFromRate(rate: number): LevelKey {
  if (rate > 30) return "high"
  if (rate >= 10) return "mid"
  return "low"
}

function CampusMap({
  t,
  mjpegUrl,
  cameraLabel,
  violationRate = 0,
  summary,
  isLoading = false,
  isRecording,
  onToggleRecording,
  cameraLoading,
}: {
  t: (key: string) => string
  mjpegUrl?: string
  cameraLabel: string
  violationRate?: number
  summary: TodaySummary | null
  isLoading?: boolean
  isRecording: boolean
  onToggleRecording: () => void
  cameraLoading: boolean
}) {
  const level = levelFromRate(violationRate)


  // Hover preview — shows instantly on pin enter; popup is a DOM child of the
  // pin wrapper, so moving the cursor onto it keeps the popup open.
  const [showPreview, setShowPreview] = useState(false)

  const [expanded, setExpanded] = useState(false)

  // ESC closes fullscreen (stream <img> below stays mounted, so closing never refetches)
  useEffect(() => {
    if (!expanded) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setExpanded(false)
    }
    document.addEventListener("keydown", onKey)
    return () => document.removeEventListener("keydown", onKey)
  }, [expanded])

  return (
    <div className="w-full [filter:drop-shadow(0_8px_24px_rgba(0,0,0,0.12))] dark:[filter:drop-shadow(0_8px_24px_rgba(0,0,0,0.4))]">
      <div className="relative rounded-2xl overflow-hidden bg-neutral-100/50 dark:bg-neutral-900/40">
        <img src="/campus_map.png" alt="KMUTT Bangmod campus map" width={1866} height={1166} className="w-full h-auto block rounded-2xl" />

        {/* Campus Map label — glass pill top-left */}
        <div className="absolute top-3 left-3 z-10 flex items-center gap-1.5 px-3 py-1.5 rounded-full
          bg-[#F6F5F2]/90 dark:bg-[#1E1E1E]/90 backdrop-blur-xl
          border border-neutral-200/80 dark:border-neutral-700/60 shadow-xs">
          <MapPin className="h-3.5 w-3.5 text-neutral-600 dark:text-neutral-400" />
          <span className="text-[11px] font-medium text-neutral-800 dark:text-neutral-200">{t("camera.campusMap")}</span>
        </div>

        {/* 2x2 Stats & Camera Controls at top-right */}
        <FloatingStatsStack
          summary={summary}
          isLoading={isLoading}
          isRecording={isRecording}
          onToggleRecording={onToggleRecording}
          cameraLoading={cameraLoading}
          t={t}
        />

          <div
            className="pin-wrap"
            style={{ left: `${CAMERA_LOCATION.x}%`, top: `${CAMERA_LOCATION.y}%` }}
            onMouseEnter={() => setShowPreview(true)}
            onMouseLeave={() => setShowPreview(false)}
          >
            <button
              type="button"
              className="pin cursor-pointer"
              style={{ background: LEVEL_STYLES[level] }}
              onClick={() => setExpanded(true)}
              aria-label={t("camera.livePreview")}
            >
              <div className="pin-inner">{CAMERA_LOCATION.label}</div>
            </button>
          </div>

          {/* Single persistent stream layer — hover popup and fullscreen share one <img>,
              so toggling between them never opens a second MJPEG connection. */}
          <div
            className={
              expanded
                ? "fixed inset-0 z-50 bg-black"
                : `absolute z-30 w-80 overflow-hidden rounded-lg border bg-popover shadow-xl ${showPreview ? "visible" : "invisible"}`}
            style={expanded ? undefined : { left: `calc(${CAMERA_LOCATION.x}% + 12px)`, top: `calc(${CAMERA_LOCATION.y}% - 12px)` }}
            onMouseEnter={() => setShowPreview(true)}
            onMouseLeave={() => setShowPreview(false)}
            onClick={expanded ? () => setExpanded(false) : undefined}
          >
          {!expanded && (
            <div className="flex items-center gap-2 px-2.5 py-1.5 text-xs font-medium border-b">
              <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
              {cameraLabel}
            </div>
          )}
          {mjpegUrl ? (
            <img
              src={mjpegUrl}
              alt="Live stream"
              className={expanded ? "absolute inset-0 h-full w-full object-contain" : "aspect-video w-full object-cover"}
            />
          ) : (
            <div className={`flex aspect-video w-full items-center justify-center bg-muted ${expanded ? "m-auto" : ""}`}>
              <Camera className={expanded ? "h-12 w-12" : "h-6 w-6"} />
            </div>
          )}
          {!expanded && (
            <button
              type="button"
              className="w-full py-1.5 text-xs text-muted-foreground hover:text-foreground hover:bg-accent/50"
              onClick={() => setExpanded(true)}
            >
              {t("camera.expandFullscreen")}
            </button>
          )}
          {expanded && (
            <>
              <div className="absolute top-3 left-3 flex items-center gap-2 bg-red-500 text-white px-2 py-1 rounded text-xs">
                <div className="w-2 h-2 bg-white rounded-full animate-pulse" />
                REC
              </div>
              <Button
                size="sm"
                variant="secondary"
                className="absolute top-3 right-3"
                onClick={(e) => { e.stopPropagation(); setExpanded(false) }}
              >
                <X className="h-4 w-4" />
              </Button>
              <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-black/70 backdrop-blur-sm rounded-lg px-4 py-2 text-white text-sm">
                {cameraLabel}
              </div>
            </>
          )}
          </div>
      </div>
    </div>
  )
}

export function RealTimeMonitoring() {
  const { t } = useLanguage("en")
  const cameraId = "camera-1"
  const cameraLabel = t("camera.camera1")

  // Client-effective preferences from the settings page (localStorage-backed)
  const [prefs, setPrefs] = useState(loadDisplayPrefs)

  useEffect(() => {
    const handleSettingsUpdated = () => {
      setPrefs(loadDisplayPrefs())
    }
    window.addEventListener(HELMET_SETTINGS_UPDATED_EVENT, handleSettingsUpdated)
    return () => window.removeEventListener(HELMET_SETTINGS_UPDATED_EVENT, handleSettingsUpdated)
  }, [])

  // Real today stats from database
  const { stats: todayStats, isStatsLoading, refetch: refetchStats } = useHelmetStats("today")
  const summary = todayStats?.summary ?? null

  // Auto-refresh today stats every 15 seconds
  const refetchRef = useRef(refetchStats)
  useEffect(() => {
    refetchRef.current = refetchStats
  })
  useEffect(() => {
    const id = setInterval(() => refetchRef.current(), 15_000)
    return () => clearInterval(id)
  }, [])

  const handleNewDetections = (batch: DetectionResult[]) => {
    if (!prefs.notifyInApp && !prefs.notifySound) return
    const hasViolation = batch.some((detection) => detection.violation)
    if (!hasViolation) return

    if (prefs.notifyInApp) {
      toast.error(t("alerts.newViolation"), { description: t("alerts.newViolationDesc") })
    }
    if (prefs.notifySound) {
      playViolationBeep()
    }
  }

  const { detections, isLoading, error, isRecording, setIsRecording } = useRealTimeDetections({
    maxItems: Math.min(prefs.realtimeRows, MAX_SSE_BUFFER),
    cameraId,
    onDetections: (batch) => {
      handleNewDetections(batch)
      // When a new detection arrives, also trigger stats refresh
      refetchRef.current()
    },
  })

  const visibleDetections = useMemo(
    () =>
      prefs.showOnlyViolations ? detections.filter((d) => d.violation) : detections,
    [detections, prefs.showOnlyViolations]
  )

  const [mjpegUrl, setMjpegUrl] = useState<string | undefined>(undefined)

  useEffect(() => {
    setMjpegUrl(isRecording ? getStreamUrl(cameraId) : undefined)
  }, [cameraId, isRecording])

  const violationRate = useMemo(() => {
    if (summary && summary.total_detections > 0) {
      return Math.round((summary.total_violations / summary.total_detections) * 100)
    }
    if (detections.length === 0) return 0
    const violations = detections.filter(
      (d) => d.violation || d.helmetStatus === "not-wearing"
    ).length
    return Math.round((violations / detections.length) * 100)
  }, [summary, detections])

  return (
    <div className="space-y-5 sm:space-y-6">
      {error && (
        <div className="bg-destructive/10 border border-destructive/20 rounded-2xl p-4 flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-destructive flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-foreground">{t("errors.errorOccurred")}</p>
              <p className="text-sm text-muted-foreground">{error.message}</p>
            </div>
          </div>
          <Button size="sm" variant="outline" onClick={() => window.location.reload()} className="gap-2 rounded-xl">
            <RotateCw className="h-4 w-4" />
            {t("buttons.retry")}
          </Button>
        </div>
      )}

      <CampusMap
        t={t}
        mjpegUrl={mjpegUrl}
        cameraLabel={cameraLabel}
        violationRate={violationRate}
        summary={summary}
        isLoading={isStatsLoading}
        isRecording={isRecording}
        onToggleRecording={() => setIsRecording(!isRecording)}
        cameraLoading={isLoading}
      />

      {/* Latest Results Card - Clean Warm Minimalist */}
      <Card className="rounded-2xl border-neutral-200/60 dark:border-neutral-800/80 bg-white/90 dark:bg-[#18181A]/90 backdrop-blur-xl shadow-[0_4px_20px_rgba(0,0,0,0.04)]">
        <CardHeader className="pb-3 border-b border-neutral-100 dark:border-neutral-800/60">
          <CardTitle className="flex items-center gap-2 text-base font-semibold text-neutral-900 dark:text-white">
            <Clock className="h-4 w-4 text-neutral-500 dark:text-neutral-400" />
            {t("detection.latestResults")}
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-4">
          {isLoading && detections.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <div className="w-8 h-8 border-2 border-primary/20 border-t-primary rounded-full animate-spin mx-auto mb-3" />
              <p className="text-xs font-medium">{t("detection.loading")}</p>
            </div>
          ) : (
            <DetectionList detections={visibleDetections} t={t} />
          )}
        </CardContent>
      </Card>
    </div>
  )
}
