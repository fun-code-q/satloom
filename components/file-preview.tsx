import { useEffect, useState } from "react"
import { Button } from "./ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "./ui/dialog"
import { Download, Loader2, RotateCcw, Volume2, ZoomIn, ZoomOut } from "lucide-react"

import { CodePreview } from "./previews/code-preview"
import { ModelPreview } from "./previews/model-preview"
import { OfficePreview } from "./previews/office-preview"
import dynamic from "next/dynamic"
import { EncryptionManager } from "@/utils/infra/encryption-manager"

const PDFPreview = dynamic(() => import("./previews/pdf-preview").then(mod => mod.PDFPreview), {
  ssr: false,
  loading: () => <div className="flex items-center justify-center p-10"><Loader2 className="w-8 h-8 animate-spin text-cyan-400" /></div>
})

interface FilePreviewProps {
  isOpen: boolean
  onClose: () => void
  file: {
    name: string
    type: string
    url: string
    size?: number
    encrypted?: boolean
    p2p?: boolean
    fileId?: string
    senderId?: string
  }
  roomId: string
}

export function FilePreview({ isOpen, onClose, file, roomId }: FilePreviewProps) {
  const [decryptedUrl, setDecryptedUrl] = useState<string | null>(null)
  const [isDecrypting, setIsDecrypting] = useState(false)
  const [zoomLevel, setZoomLevel] = useState(1)

  const isBlobOrDataUrl = file.url.startsWith("blob:") || file.url.startsWith("data:")
  const shouldDecrypt = Boolean(file.encrypted && !isBlobOrDataUrl)

  useEffect(() => {
    setDecryptedUrl(null)
    setIsDecrypting(false)
  }, [file.url, file.encrypted])

  useEffect(() => {
    if (!isOpen || !shouldDecrypt || decryptedUrl || !file.url) return

    let isMounted = true
    const decrypt = async () => {
      setIsDecrypting(true)
      try {
        const response = await fetch(file.url)
        const encryptedBuffer = await response.arrayBuffer()
        const encryptionManager = EncryptionManager.getInstance()
        const decryptedBuffer = await encryptionManager.decryptBuffer(encryptedBuffer, roomId)
        const blob = new Blob([decryptedBuffer], { type: file.type })
        const url = URL.createObjectURL(blob)
        if (isMounted) {
          setDecryptedUrl(url)
        } else {
          URL.revokeObjectURL(url)
        }
      } catch (error) {
        console.error("Decryption failed:", error)
      } finally {
        if (isMounted) {
          setIsDecrypting(false)
        }
      }
    }

    decrypt()

    return () => {
      isMounted = false
    }
  }, [isOpen, shouldDecrypt, decryptedUrl, file.url, file.type, roomId])

  useEffect(() => {
    if (!isOpen) return
    setZoomLevel(1)
  }, [isOpen, file.url])

  useEffect(() => {
    return () => {
      if (decryptedUrl?.startsWith("blob:")) {
        URL.revokeObjectURL(decryptedUrl)
      }
    }
  }, [decryptedUrl])

  const effectiveUrl = shouldDecrypt ? decryptedUrl || "" : file.url

  const ext = file.name.split(".").pop()?.toLowerCase() || ""
  const isImage = file.type.startsWith("image/")
  const isVideo = file.type.startsWith("video/")
  const isAudio = file.type.startsWith("audio/")

  const isCode = ["js", "jsx", "ts", "tsx", "py", "html", "css", "json", "md", "sql", "java", "c", "cpp", "h"].includes(ext)
  const is3D = ["glb", "gltf", "obj"].includes(ext)
  const isPDF = file.type === "application/pdf" || ext === "pdf"
  const isOffice = ["doc", "docx", "ppt", "pptx", "xls", "xlsx"].includes(ext)

  const canZoom = isImage || isVideo || isCode || is3D || isPDF || isOffice
  const clampedZoom = Math.min(3, Math.max(0.5, zoomLevel))
  const zoomStyle = canZoom
    ? { transform: `scale(${clampedZoom})`, transformOrigin: "center center" as const }
    : undefined

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return "Unknown size"
    const sizes = ["Bytes", "KB", "MB", "GB"]
    const i = Math.floor(Math.log(bytes) / Math.log(1024))
    return Math.round((bytes / Math.pow(1024, i)) * 100) / 100 + " " + sizes[i]
  }

  const downloadFile = () => {
    if (!effectiveUrl) return
    const link = document.createElement("a")
    link.href = effectiveUrl
    link.download = file.name
    link.click()
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="bg-slate-800 border-slate-700 text-white max-w-5xl max-h-[95vh] w-[95vw]">
        <DialogHeader>
          <DialogTitle className="text-cyan-400 flex items-center justify-between gap-2">
            <span className="truncate max-w-[70%]">{file.name}</span>
            <div className="flex flex-wrap justify-end gap-2">
              {canZoom && (
                <>
                  <Button
                    onClick={() => setZoomLevel((prev) => Math.max(0.5, prev - 0.25))}
                    variant="outline"
                    size="icon"
                    className="border-slate-600 bg-transparent"
                    disabled={clampedZoom <= 0.5}
                  >
                    <ZoomOut className="w-4 h-4" />
                  </Button>
                  <Button
                    onClick={() => setZoomLevel((prev) => Math.min(3, prev + 0.25))}
                    variant="outline"
                    size="icon"
                    className="border-slate-600 bg-transparent"
                    disabled={clampedZoom >= 3}
                  >
                    <ZoomIn className="w-4 h-4" />
                  </Button>
                  <Button
                    onClick={() => setZoomLevel(1)}
                    variant="outline"
                    size="sm"
                    className="border-slate-600 bg-transparent"
                    disabled={clampedZoom === 1}
                  >
                    <RotateCcw className="w-4 h-4 mr-1" />
                    Reset
                  </Button>
                  <span className="text-xs text-gray-300 px-1 min-w-[48px] text-right self-center">
                    {Math.round(clampedZoom * 100)}%
                  </span>
                </>
              )}
              <Button onClick={downloadFile} variant="outline" size="sm" className="border-slate-600 bg-transparent" disabled={!effectiveUrl}>
                <Download className="w-4 h-4 mr-2" />
                Download
              </Button>
            </div>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 max-h-[80vh] overflow-auto p-1">
          <div className="text-sm text-gray-400 text-center mb-2">
            {file.type || ext.toUpperCase()} | {formatFileSize(file.size)}
          </div>

          <div className="min-h-[300px] flex items-center justify-center bg-slate-900/50 rounded-lg overflow-auto p-3">
            {isDecrypting && !effectiveUrl ? (
              <div className="flex items-center gap-3 text-cyan-300 text-sm">
                <Loader2 className="w-5 h-5 animate-spin" />
                Decrypting file...
              </div>
            ) : (
              <>
                {isImage && (
                  <img
                    src={effectiveUrl || "/placeholder.svg"}
                    alt={file.name}
                    className="max-w-full max-h-[70vh] object-contain rounded-lg"
                    style={zoomStyle}
                  />
                )}

                {isVideo && (
                  <video
                    controls
                    className="max-w-full max-h-[70vh] rounded-lg"
                    style={zoomStyle}
                  >
                    <source src={effectiveUrl} type={file.type} />
                    Your browser does not support the video tag.
                  </video>
                )}

                {isAudio && (
                  <div className="bg-slate-900 rounded-lg p-6 w-full max-w-md">
                    <div className="flex items-center justify-center mb-4">
                      <div className="w-16 h-16 bg-cyan-500 rounded-full flex items-center justify-center animate-pulse">
                        <Volume2 className="w-8 h-8 text-white" />
                      </div>
                    </div>
                    <audio controls className="w-full">
                      <source src={effectiveUrl} type={file.type} />
                      Your browser does not support the audio tag.
                    </audio>
                  </div>
                )}

                {isCode && (
                  <div style={zoomStyle}>
                    <CodePreview url={effectiveUrl} name={file.name} />
                  </div>
                )}
                {is3D && (
                  <div style={zoomStyle}>
                    <ModelPreview url={effectiveUrl} />
                  </div>
                )}
                {isPDF && (
                  <div style={zoomStyle}>
                    <PDFPreview url={effectiveUrl} />
                  </div>
                )}
                {isOffice && (
                  <div style={zoomStyle}>
                    <OfficePreview url={effectiveUrl} />
                  </div>
                )}

                {!isImage && !isVideo && !isAudio && !isCode && !is3D && !isPDF && !isOffice && (
                  <div className="text-center p-10">
                    <div className="w-20 h-20 bg-gray-700 rounded-xl flex items-center justify-center mx-auto mb-4">
                      <span className="text-4xl">FILE</span>
                    </div>
                    <p className="text-gray-300 mb-6 text-lg">No preview available for this file type</p>
                    <Button onClick={downloadFile} size="lg" className="bg-cyan-500 hover:bg-cyan-600" disabled={isDecrypting || !effectiveUrl}>
                      {isDecrypting ? (
                        <>
                          <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                          Decrypting...
                        </>
                      ) : (
                        <>
                          <Download className="w-5 h-5 mr-2" />
                          Download File
                        </>
                      )}
                    </Button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
