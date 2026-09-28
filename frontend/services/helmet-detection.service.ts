/**
 * Centralized service for helmet detection API calls
 * Handles all communication with backend endpoints
 */

import {
  DetectionEvent,
  DetectionHistoryItem,
  DetectionResult,
  HelmetStats,
  StatsBucketSize,
} from "@/types/detection.types"
import { createAuthHeadersFromStore } from "@/stores/auth-store"
import { API_BASE_URL, CAMERA_NAME } from "@/lib/api/config"

/** Fields shared by history items and SSE events */
interface RawDetection {
  helmet_status: boolean
  passenger_count?: number
  violation?: boolean
  frame_path?: string
}

function toDetectionResult(item: RawDetection, id: string, timestamp: string): DetectionResult {
  return {
    id,
    timestamp,
    camera: CAMERA_NAME,
    helmetStatus: item.helmet_status === true ? "wearing" : "not-wearing",
    passengerCount: item.passenger_count ?? 1,
    violation: item.violation ?? false,
    framePath: item.frame_path,
  }
}

/**
 * Fetch helmet detection history from the database
 * @param limit Number of records to fetch
 * @returns Array of detection results
 */
export async function fetchHelmetHistory(limit: number = 50): Promise<DetectionResult[]> {
  const headers = createAuthHeadersFromStore()
  const response = await fetch(`${API_BASE_URL}/helmet/history?limit=${limit}`, {
    headers,
  })

  if (!response.ok) {
    throw new Error(`Failed to fetch helmet history: ${response.status}`)
  }

  const data: DetectionHistoryItem[] = await response.json()

  return data.map((item) => toDetectionResult(item, item.id, item.timestamp ?? ""))
}

/**
 * Fetch aggregated detection statistics for an inclusive date range
 * @param fromDate Range start ISO date "YYYY-MM-DD"
 * @param toDate Range end ISO date "YYYY-MM-DD"
 * @param bucket Time-series granularity
 * @returns Aggregated stats with zero-filled series and violation breakdown
 */
export async function fetchHelmetStats(
  fromDate: string,
  toDate: string,
  bucket: StatsBucketSize = "day"
): Promise<HelmetStats> {
  const params = new URLSearchParams({ from: fromDate, to: toDate, bucket })
  const headers = createAuthHeadersFromStore()
  const response = await fetch(`${API_BASE_URL}/helmet/stats?${params}`, {
    headers,
  })

  if (!response.ok) {
    throw new Error(`Failed to fetch helmet stats: ${response.status}`)
  }

  return response.json()
}

/**
 * Subscribe to real-time helmet detection events via Server-Sent Events (SSE)
 * @param onDetection Callback when new detections arrive
 * @param onError Callback on connection error
 * @returns Cleanup function to close the connection
 */
export function subscribeToHelmetEvents(
  onDetection: (detections: DetectionResult[]) => void,
  onError: (error: Error) => void,
  cameraId: string = "camera-1"
): () => void {
  try {
    const params = new URLSearchParams({ camera_id: cameraId })
    const es = new EventSource(`${API_BASE_URL}/helmet/events?${params}`)

    es.onmessage = (event) => {
      try {
        const raw = JSON.parse(event.data)
        const items: DetectionEvent[] = Array.isArray(raw) ? raw : [raw]

        const mapped: DetectionResult[] = items.map((item) =>
          toDetectionResult(
            item,
            `trk_${item.motorcycle_track_id}_${Date.now()}`,
            new Date().toLocaleString("th-TH")
          )
        )

        onDetection(mapped)
      } catch (parseError) {
        console.warn("Failed to parse SSE detection event:", parseError)
      }
    }

    es.onerror = () => {
      console.warn("SSE connection error on /helmet/events")
      onError(new Error("SSE connection error"))
      es.close()
    }

    // Return cleanup function
    return () => {
      es.close()
    }
  } catch (error) {
    const err = error instanceof Error ? error : new Error("Unknown error")
    onError(err)
    return () => {}
  }
}

/**
 * Get the MJPEG stream URL for live video feed
 * @returns The stream URL
 */
export function getStreamUrl(cameraId: string = "camera-1"): string {
  const params = new URLSearchParams({ camera_id: cameraId })
  return `${API_BASE_URL}/helmet/stream?${params}`
}
