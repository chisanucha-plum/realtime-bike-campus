import { AlertTriangle, Check, CheckCircle, Clock, Copy, Download, Users, X } from "lucide-react"
import { useEffect, useState } from "react"
import { createPortal } from "react-dom"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import type { DetectionResult } from "@/types/detection.types"

interface DetectionModalProps {
  isOpen: boolean
  detection?: DetectionResult | null
  imageUrl: string
  onClose: () => void
  t?: (key: string) => string
}

export function DetectionModal({
  isOpen,
  detection,
  imageUrl,
  onClose,
  t = (k) => k,
}: DetectionModalProps) {
  const [mounted, setMounted] = useState(false)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  // Prevent body scroll when modal is open
  useEffect(() => {
    if (!isOpen) return
    const originalOverflow = document.body.style.overflow
    document.body.style.overflow = "hidden"
    return () => {
      document.body.style.overflow = originalOverflow
    }
  }, [isOpen])

  // ESC key to close
  useEffect(() => {
    if (!isOpen) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose()
    }
    document.addEventListener("keydown", onKeyDown)
    return () => document.removeEventListener("keydown", onKeyDown)
  }, [isOpen, onClose])

  if (!isOpen || !mounted) return null

  const isWearing = detection?.helmetStatus === "wearing"
  const isOverCapacity = detection?.overCapacity || (detection?.passengerCount ?? 0) > 2
  const confidencePercent = detection?.confidence ? `${Math.round(detection.confidence * 100)}%` : null

  const handleCopyDetails = () => {
    if (!detection) return
    const statusText = isWearing ? t("detection.wearingHelmet") : t("detection.notWearingHelmet")
    const lines = [
      `[KMUTT Helmet Detection Evidence]`,
      `Time: ${detection.timestamp}`,
      `Track ID: #${detection.trackId ?? "-"}`,
      `Status: ${statusText}`,
      `Passengers: ${detection.passengerCount}`,
      isOverCapacity ? `Over Capacity: Yes` : null,
      confidencePercent ? `AI Confidence: ${confidencePercent}` : null,
    ].filter(Boolean).join("\n")

    navigator.clipboard.writeText(lines).then(() => {
      setCopied(true)
      toast.success(t("detection.detailsCopied"))
      setTimeout(() => setCopied(false), 2000)
    })
  }

  const handleDownload = async () => {
    const filename = `evidence-${detection?.trackId ?? "snapshot"}-${Date.now()}.jpg`
    try {
      const res = await fetch(imageUrl)
      if (!res.ok) throw new Error("Download failed")
      const blob = await res.blob()
      const blobUrl = URL.createObjectURL(blob)
      const link = document.createElement("a")
      link.href = blobUrl
      link.download = filename
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(blobUrl)
    } catch {
      window.open(imageUrl, "_blank", "noopener,noreferrer")
    }
  }

  return createPortal(
    <div
      className="fixed inset-0 z-[99999] bg-black/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-5 animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="relative max-w-3xl w-full bg-white dark:bg-[#18181B] border border-neutral-200 dark:border-neutral-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 sm:px-5 py-3 sm:py-3.5 border-b border-neutral-100 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-900/40">
          <div className="flex items-center gap-2 sm:gap-3 flex-wrap min-w-0">
            <h3 className="text-sm sm:text-base font-semibold text-neutral-900 dark:text-neutral-100 truncate">
              {t("detection.evidenceModalTitle")}
            </h3>
            {detection?.trackId !== undefined && (
              <Badge variant="outline" className="text-xs font-mono rounded-lg">
                #{detection.trackId}
              </Badge>
            )}
            {detection && (
              <span
                className={cn(
                  "inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium border",
                  isWearing
                    ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
                    : "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20"
                )}
              >
                {isWearing ? (
                  <CheckCircle className="h-3 w-3" />
                ) : (
                  <AlertTriangle className="h-3 w-3" />
                )}
                {isWearing ? t("detection.wearingHelmet") : t("detection.notWearingHelmet")}
              </span>
            )}
            {isOverCapacity && (
              <Badge variant="destructive" className="text-[11px] px-2 py-0.5 rounded-md">
                {t("detection.overCapacityBadge")}
              </Badge>
            )}
          </div>

          <Button
            size="icon"
            variant="ghost"
            className="h-8 w-8 rounded-full text-neutral-500 hover:text-neutral-900 dark:hover:text-white"
            onClick={onClose}
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Snapshot View */}
        <div className="relative flex-1 bg-black flex items-center justify-center overflow-hidden min-h-[240px] max-h-[58vh]">
          <img
            src={imageUrl}
            alt="Detection Evidence Frame"
            className="w-full h-full object-contain max-h-[58vh]"
            loading="eager"
          />
        </div>

        {/* Evidence Metadata & Actions Footer */}
        <div className="p-3.5 sm:p-4 bg-white dark:bg-[#18181B] border-t border-neutral-100 dark:border-neutral-800 space-y-3">
          {detection && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
              <div className="p-2 rounded-xl bg-neutral-100/70 dark:bg-neutral-800/60 flex items-center gap-2">
                <Clock className="h-3.5 w-3.5 text-neutral-500 flex-shrink-0" />
                <div className="min-w-0">
                  <p className="text-[10px] text-muted-foreground">{t("detection.timestamp")}</p>
                  <p className="font-medium truncate text-foreground">{detection.timestamp}</p>
                </div>
              </div>

              <div className="p-2 rounded-xl bg-neutral-100/70 dark:bg-neutral-800/60 flex items-center gap-2">
                <Users className="h-3.5 w-3.5 text-neutral-500 flex-shrink-0" />
                <div className="min-w-0">
                  <p className="text-[10px] text-muted-foreground">{t("detection.passengers")}</p>
                  <p className="font-medium truncate text-foreground">{detection.passengerCount} คน</p>
                </div>
              </div>

              {confidencePercent && (
                <div className="p-2 rounded-xl bg-neutral-100/70 dark:bg-neutral-800/60 flex items-center gap-2">
                  <CheckCircle className="h-3.5 w-3.5 text-emerald-500 flex-shrink-0" />
                  <div className="min-w-0">
                    <p className="text-[10px] text-muted-foreground">{t("detection.confidence")}</p>
                    <p className="font-semibold text-emerald-600 dark:text-emerald-400">{confidencePercent}</p>
                  </div>
                </div>
              )}

              <div className="p-2 rounded-xl bg-neutral-100/70 dark:bg-neutral-800/60 flex items-center gap-2">
                <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4 rounded">
                  {detection.camera}
                </Badge>
                <div className="min-w-0">
                  <p className="text-[10px] text-muted-foreground">Location</p>
                  <p className="font-medium text-foreground truncate">Building S13</p>
                </div>
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-2 pt-1">
            {detection && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleCopyDetails}
                className="gap-1.5 rounded-xl h-8 text-xs"
              >
                {copied ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
                <span>{t("detection.copyDetails")}</span>
              </Button>
            )}

            <Button
              variant="outline"
              size="sm"
              onClick={handleDownload}
              className="gap-1.5 rounded-xl h-8 text-xs"
            >
              <Download className="h-3.5 w-3.5" />
              <span>{t("detection.downloadEvidence")}</span>
            </Button>

            <Button
              variant="default"
              size="sm"
              onClick={onClose}
              className="rounded-xl h-8 px-4 text-xs font-medium"
            >
              {t("common.close")}
            </Button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  )
}
