"use client"

import { useCallback, useEffect, useState } from "react"
import { fetchHelmetStats } from "@/services/helmet-detection.service"
import type { HelmetStats, StatsBucketSize, StatsTimeRange } from "@/types/detection.types"

interface RangeWindow {
  from: string
  to: string
  bucket: StatsBucketSize
}

export interface UseHelmetStatsReturn {
  stats: HelmetStats | null
  /** Same-length window immediately before the current one, for trend deltas */
  previousStats: HelmetStats | null
  isStatsLoading: boolean
  isPreviousLoading: boolean
  isLoading: boolean
  error: Error | null
  refetch: () => void
}

/** Local-time ISO date ("YYYY-MM-DD") — backend stores timestamps in server-local time */
function toISODate(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

function shiftDays(date: Date, days: number): Date {
  const shifted = new Date(date)
  shifted.setDate(shifted.getDate() + days)
  return shifted
}

/** Current window + the immediately-preceding equal-length window (for trend deltas) */
function getRangeWindows(range: StatsTimeRange): { current: RangeWindow; previous: RangeWindow } {
  const days = range === "today" ? 1 : range === "week" ? 7 : 30
  const today = new Date()
  const currentStart = shiftDays(today, -(days - 1))
  return {
    current: {
      from: toISODate(currentStart),
      to: toISODate(today),
      bucket: range === "today" ? "hour" : "day",
    },
    previous: {
      from: toISODate(shiftDays(currentStart, -days)),
      to: toISODate(shiftDays(currentStart, -1)),
      bucket: "day",
    },
  }
}

export function useHelmetStats(range: StatsTimeRange): UseHelmetStatsReturn {
  const [stats, setStats] = useState<HelmetStats | null>(null)
  const [previousStats, setPreviousStats] = useState<HelmetStats | null>(null)
  const [isStatsLoading, setIsStatsLoading] = useState(true)
  const [isPreviousLoading, setIsPreviousLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    const { current, previous } = getRangeWindows(range)
    let cancelled = false

    const load = async () => {
      setIsStatsLoading(true)
      setIsPreviousLoading(true)
      setError(null)

      try {
        const currentStats = await fetchHelmetStats(
          current.from,
          current.to,
          current.bucket
        )
        if (!cancelled) setStats(currentStats)
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err : new Error("Failed to load stats"))
          console.error("Error loading current helmet stats:", err)
        }
      } finally {
        if (!cancelled) setIsStatsLoading(false)
      }

      try {
        const prevStats = await fetchHelmetStats(
          previous.from,
          previous.to,
          previous.bucket
        )
        if (!cancelled) setPreviousStats(prevStats)
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err : new Error("Failed to load previous stats"))
          console.error("Error loading previous helmet stats:", err)
        }
      } finally {
        if (!cancelled) setIsPreviousLoading(false)
      }
    }

    load()
    return () => {
      cancelled = true
    }
  }, [range, reloadKey])

  const refetch = useCallback(() => setReloadKey((key) => key + 1), [])

  return {
    stats,
    previousStats,
    isStatsLoading,
    isPreviousLoading,
    isLoading: isStatsLoading || isPreviousLoading,
    error,
    refetch,
  }
}
