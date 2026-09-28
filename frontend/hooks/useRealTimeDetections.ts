"use client"

import { useEffect, useRef, useState, useCallback } from "react"
import { DetectionResult, UseRealTimeDetectionsReturn } from "@/types/detection.types"
import {
  fetchHelmetHistory,
  subscribeToHelmetEvents,
} from "@/services/helmet-detection.service"

const MAX_DETECTIONS = 50
const SSE_RETRY_DELAY_MS = 5000
const MAX_SILENT_FAILURES = 3

interface UseRealTimeDetectionsOptions {
  maxItems?: number
  cameraId?: string
  onDetections?: (detections: DetectionResult[]) => void
}

export function useRealTimeDetections(
  options: UseRealTimeDetectionsOptions = {}
): UseRealTimeDetectionsReturn {
  const { maxItems = MAX_DETECTIONS, cameraId = "camera-1" } = options

  const onDetectionsRef = useRef(options.onDetections)
  useEffect(() => {
    onDetectionsRef.current = options.onDetections
  })

  const throttleTimer = useRef<NodeJS.Timeout | null>(null)

  const [detections, setDetections] = useState<DetectionResult[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)
  const [isRecording, setIsRecording] = useState(false)

  const sseRef = useRef<(() => void) | null>(null)
  const isMountedRef = useRef(true)
  const failureCountRef = useRef(0)

  // Load initial history
  useEffect(() => {
    isMountedRef.current = true

    const loadHistory = async () => {
      try {
        setIsLoading(true)
        setError(null)
        const history = await fetchHelmetHistory(maxItems)
        if (isMountedRef.current) setDetections(history)
      } catch (err) {
        const error = err instanceof Error ? err : new Error("Failed to load history")
        if (isMountedRef.current) setError(error)
        console.error("Error loading helmet history:", error)
      } finally {
        if (isMountedRef.current) setIsLoading(false)
      }
    }

    loadHistory()
    return () => {
      isMountedRef.current = false
    }
  }, [maxItems])

  // SSE subscription - controlled by isRecording
  useEffect(() => {
    if (!isRecording) {
      sseRef.current?.()
      sseRef.current = null
      return
    }

    isMountedRef.current = true
    let retryTimer: ReturnType<typeof setTimeout> | null = null

    const connect = () => {
      if (!isMountedRef.current) return
      
      // Clean up previous connection
      sseRef.current?.()
      sseRef.current = null
      failureCountRef.current = 0

      sseRef.current = subscribeToHelmetEvents(
        (newDetections) => {
          if (!isMountedRef.current) return
          failureCountRef.current = 0
          setError(null)
          if (throttleTimer.current) clearTimeout(throttleTimer.current)
          throttleTimer.current = setTimeout(() => {
            if (isMountedRef.current) {
              setDetections((prev) => [...newDetections, ...prev].slice(0, maxItems))
              onDetectionsRef.current?.(newDetections)
            }
          }, 150)
        },
        (err) => {
          if (!isMountedRef.current) return
          failureCountRef.current += 1
          console.warn(`Detection stream error (${failureCountRef.current}):`, err.message)
          if (failureCountRef.current >= MAX_SILENT_FAILURES) setError(err)
          retryTimer = setTimeout(connect, SSE_RETRY_DELAY_MS)
        },
        cameraId
      )
    }

    connect()

    return () => {
      isMountedRef.current = false
      if (retryTimer) clearTimeout(retryTimer)
      sseRef.current?.()
      sseRef.current = null
    }
  }, [cameraId, isRecording, maxItems])

  const handleSetIsRecording = useCallback((value: boolean) => {
    setIsRecording(value)
  }, [])

  return { detections, isLoading, error, isRecording, setIsRecording: handleSetIsRecording }
}
