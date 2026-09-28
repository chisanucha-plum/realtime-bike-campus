"use client"

import { Badge } from "@/components/ui/badge"
import { AlertTriangle, Camera, CheckCircle, Clock, Users } from "lucide-react"
import { memo, useCallback, useRef, useState } from "react"
import { useVirtualizer } from "@tanstack/react-virtual"
import { DetectionModal } from "./DetectionModal"
import { API_BASE_URL } from "@/lib/api/config"
import { cn } from "@/lib/utils"
import type { DetectionResult } from "@/types/detection.types"

interface DetectionListProps {
  detections: DetectionResult[]
  t: (key: string) => string
}

const VIRTUALIZER_ESTIMATED_SIZE = 120
const VIRTUALIZER_OVERSCAN = 6

/** memo: page-level state (filters, loading) re-renders without item props changing —
 *  detection/t identities are stable, so 500 items must not re-render with them.
 *  onOpenImage is a stable useCallback ref so memo actually works. */
const DetectionItem = memo(function DetectionItem({
  detection,
  t,
  onOpenImage,
}: {
  detection: DetectionResult
  t: (key: string) => string
  /** Stable callback — receives framePath so the parent doesn't need to close over it */
  onOpenImage: (framePath: string | undefined) => void
}) {
  const isWearing = detection.helmetStatus === "wearing"

  return (
    <div className="group flex flex-row items-center gap-2.5 sm:gap-3.5 p-2.5 sm:p-3.5 bg-card/80 hover:bg-card border border-border/80 hover:border-border rounded-xl transition-all duration-200 shadow-xs hover:shadow-md">
      {detection.framePath ? (
        <div
          className="relative flex-shrink-0 w-16 h-16 xs:w-20 xs:h-20 sm:w-22 sm:h-22 rounded-xl overflow-hidden bg-muted border border-border/80 cursor-pointer shadow-xs group/img"
          onClick={() => onOpenImage(detection.framePath)}
        >
          <img
            src={`${API_BASE_URL}/helmet/frame/${detection.framePath}`}
            alt={`Detection ${detection.id}`}
            className="w-full h-full object-cover transition-transform duration-300 group-hover/img:scale-110"
            loading="lazy"
          />
          <div className="absolute inset-0 bg-black/20 opacity-0 group-hover/img:opacity-100 transition-opacity flex items-center justify-center">
            <Camera className="w-5 h-5 text-white drop-shadow-md" />
          </div>
        </div>
      ) : (
        <div className="flex-shrink-0 w-20 h-20 sm:w-22 sm:h-22 rounded-xl bg-muted/60 border border-border/60 flex items-center justify-center">
          <Camera className="h-6 w-6 text-muted-foreground/60" />
        </div>
      )}

      <div className="flex-1 flex flex-col justify-between gap-2 min-w-0">
        <div>
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Clock className="w-3.5 h-3.5 text-muted-foreground/70" />
            <span>{detection.timestamp}</span>
          </div>

          <div className="flex items-center gap-2 mt-1">
            <div
              className={cn(
                "inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold border",
                isWearing
                  ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
                  : "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20 animate-pulse"
              )}
            >
              {isWearing ? (
                <CheckCircle className="h-3.5 w-3.5 flex-shrink-0" />
              ) : (
                <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0" />
              )}
              <span>{isWearing ? t("detection.wearingHelmet") : t("detection.notWearingHelmet")}</span>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs">
          <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-muted/60 border border-border/50 text-muted-foreground">
            <Users className="h-3.5 w-3.5" />
            <span>{detection.passengerCount} {t("detection.passengers")}</span>
          </div>

          {detection.passengerCount > 2 && (
            <Badge variant="destructive" className="text-[11px] px-2 py-0.5 rounded-md">
              {t("detection.overCapacityBadge")}
            </Badge>
          )}

          {detection.violation && (
            <Badge variant="destructive" className="text-[11px] px-2 py-0.5 rounded-md">
              {t("detection.violation")}
            </Badge>
          )}

          <span className="text-xs text-muted-foreground/70 ml-auto hidden sm:inline">{detection.camera}</span>
        </div>
      </div>
    </div>
  )
})

/** Virtualizer: history loads 500 rows — mounting all costs ~10k DOM nodes
 *  and heavy layout/image decode. Only visible rows (+overscan) exist in the DOM.
 *  Own scroll container because the app scrolls inside <main>, not the window. */
export function DetectionList({ detections, t }: DetectionListProps) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const [selectedImage, setSelectedImage] = useState<string | null>(null)

  const virtualizer = useVirtualizer({
    count: detections.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => VIRTUALIZER_ESTIMATED_SIZE,
    overscan: VIRTUALIZER_OVERSCAN,
  })

  // Stable reference — does NOT close over any per-item value,
  // so memo on DetectionItem can actually bail out on re-renders.
  const handleOpenImage = useCallback((framePath: string | undefined) => {
    if (framePath) {
      setSelectedImage(`${API_BASE_URL}/helmet/frame/${framePath}`)
    }
  }, [])

  const handleCloseModal = useCallback(() => setSelectedImage(null), [])

  if (detections.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <div className="w-14 h-14 rounded-2xl bg-muted/60 border border-border flex items-center justify-center mx-auto mb-3">
          <Camera className="h-7 w-7 text-muted-foreground/60" />
        </div>
        <p className="text-sm font-medium">{t("detection.noDetections")}</p>
      </div>
    )
  }

  return (
    <>
      <div ref={scrollRef} className="max-h-[calc(100vh-280px)] overflow-auto rounded-xl pr-1">
        <div className="relative" style={{ height: virtualizer.getTotalSize() }}>
          {virtualizer.getVirtualItems().map((virtualRow) => {
            const detection = detections[virtualRow.index]
            return (
              <div
                key={detection.id}
                ref={virtualizer.measureElement}
                data-index={virtualRow.index}
                className="absolute left-0 w-full pb-3"
                style={{ transform: `translateY(${virtualRow.start}px)` }}
              >
                <DetectionItem
                  detection={detection}
                  t={t}
                  onOpenImage={handleOpenImage}
                />
              </div>
            )
          })}
        </div>
      </div>

      <DetectionModal
        isOpen={selectedImage !== null}
        imageUrl={selectedImage || ""}
        onClose={handleCloseModal}
      />
    </>
  )
}
