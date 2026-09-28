import { X } from "lucide-react"
import { useEffect, useState } from "react"
import { createPortal } from "react-dom"

interface DetectionModalProps {
  isOpen: boolean
  imageUrl: string
  onClose: () => void
}

export function DetectionModal({ isOpen, imageUrl, onClose }: DetectionModalProps) {
  const [mounted, setMounted] = useState(false)

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

  return createPortal(
    <div
      className="fixed inset-0 z-[99999] bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6"
      onClick={onClose}
    >
      <div
        className="relative max-w-4xl max-h-[90vh] w-full flex items-center justify-center"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute -top-10 right-0 sm:top-2 sm:right-2 z-10 bg-black/50 hover:bg-black/75 text-white rounded-full p-2 backdrop-blur-md transition-colors"
          aria-label="Close modal"
        >
          <X className="h-5 w-5" />
        </button>
        <img
          src={imageUrl}
          alt="Detection Frame"
          className="max-w-full max-h-[85vh] w-auto h-auto object-contain rounded-xl shadow-2xl bg-black"
          loading="eager"
        />
      </div>
    </div>,
    document.body
  )
}
