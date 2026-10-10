/**
 * Centralized types for helmet detection feature
 */

export interface DetectionResult {
  id: string
  trackId?: number | string
  timestamp: string
  camera: string
  helmetStatus: "wearing" | "not-wearing"
  passengerCount: number
  overCapacity?: boolean
  violation: boolean
  framePath?: string  // Optional path to saved frame image
}

export interface DetectionHistoryItem {
  id: string
  track_id?: number
  timestamp?: string
  helmet_status: boolean
  passenger_count?: number
  over_capacity?: boolean
  violation?: boolean
  frame_path?: string  // Optional path to saved frame image
}

export interface DetectionEvent {
  motorcycle_track_id: string
  helmet_status: boolean
  passenger_count?: number
  over_capacity?: boolean
  violation?: boolean
  frame_path?: string
}

export interface UseRealTimeDetectionsReturn {
  detections: DetectionResult[]
  isLoading: boolean
  error: Error | null
  isRecording: boolean
  setIsRecording: (value: boolean) => void
}

/** Aggregated counts for one time bucket from GET /helmet/stats */
export interface StatsBucket {
  label: string  // "2026-08-23" (day) or "2026-08-23 14" (hour)
  total: number
  violations: number
}

export interface ViolationTypeCount {
  type: "no_helmet" | "over_capacity"
  count: number
}

export interface StatsSummary {
  total_detections: number
  total_violations: number
  helmet_on: number
  helmet_off: number
  excess_passengers: number
  compliance_percent: number
}

/** Response shape of GET /helmet/stats */
export interface HelmetStats {
  range_from: string
  range_to: string
  bucket_size: "hour" | "day"
  summary: StatsSummary
  series: StatsBucket[]
  violation_types: ViolationTypeCount[]
}

export type StatsBucketSize = "hour" | "day"

export type StatsTimeRange = "today" | "week" | "month"
