/**
 * Reader for the client-effective preferences the settings page persists to
 * localStorage under "helmet_app_settings". Server-managed values (camera
 * source, thresholds, retention) are NOT part of this — they live only in
 * backend config files.
 */

export interface DisplayPrefs {
  notifyInApp: boolean
  notifySound: boolean
  /** How many recent rows the real-time list should render */
  realtimeRows: number
  showOnlyViolations: boolean
}

export const DEFAULT_DISPLAY_PREFS: DisplayPrefs = {
  notifyInApp: true,
  notifySound: true,
  realtimeRows: 20,
  showOnlyViolations: false,
}

export const STORAGE_KEY = "helmet_app_settings"
export const HELMET_SETTINGS_UPDATED_EVENT = "helmet_settings_updated"

export function loadDisplayPrefs(): DisplayPrefs {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return DEFAULT_DISPLAY_PREFS

    const parsed: unknown = JSON.parse(raw)
    if (typeof parsed !== "object" || parsed === null) return DEFAULT_DISPLAY_PREFS

    const source = parsed as Partial<Record<keyof DisplayPrefs, unknown>>
    const boolOr = (value: unknown, fallback: boolean): boolean =>
      typeof value === "boolean" ? value : fallback
    const rowOptions = [10, 20, 50]

    return {
      notifyInApp: boolOr(source.notifyInApp, DEFAULT_DISPLAY_PREFS.notifyInApp),
      notifySound: boolOr(source.notifySound, DEFAULT_DISPLAY_PREFS.notifySound),
      realtimeRows:
        typeof source.realtimeRows === "string" &&
        rowOptions.includes(Number(source.realtimeRows))
          ? Number(source.realtimeRows)
          : DEFAULT_DISPLAY_PREFS.realtimeRows,
      showOnlyViolations: boolOr(
        source.showOnlyViolations,
        DEFAULT_DISPLAY_PREFS.showOnlyViolations
      ),
    }
  } catch {
    return DEFAULT_DISPLAY_PREFS
  }
}
