import { useState, useEffect } from "react"
import { Document, Page } from "react-pdf"
// @ts-ignore
import * as pdfjs from "pdfjs-dist/legacy/build/pdf"
import { Button } from "../ui/button"
import { ChevronLeft, ChevronRight, Loader2 } from "lucide-react"

interface PDFPreviewProps {
    url: string
}

export function PDFPreview({ url }: PDFPreviewProps) {
    useEffect(() => {
        // Set worker source only on client mount - using legacy build
        pdfjs.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.js`
    }, [])
    const [numPages, setNumPages] = useState<number>(0)
    const [pageNumber, setPageNumber] = useState(1)
    const [loading, setLoading] = useState(true)

    function onDocumentLoadSuccess({ numPages }: { numPages: number }) {
        setNumPages(numPages)
        setLoading(false)
    }

    return (
        <div className="flex flex-col items-center gap-4">
            <div className="relative bg-slate-900 min-h-[400px] w-full flex justify-center p-4 rounded-lg overflow-auto max-h-[70vh]">
                {loading && (
                    <div className="absolute inset-0 flex items-center justify-center text-cyan-400">
                        <Loader2 className="w-8 h-8 animate-spin" />
                    </div>
                )}
                <Document
                    file={url}
                    onLoadSuccess={onDocumentLoadSuccess}
                    loading={null}
                    error={<div className="text-red-400 p-4">Failed to load PDF.</div>}
                >
                    <Page
                        pageNumber={pageNumber}
                        renderTextLayer={false}
                        renderAnnotationLayer={false}
                        width={600}
                        className="shadow-lg"
                    />
                </Document>
            </div>

            {numPages > 0 && (
                <div className="flex items-center gap-4 text-white">
                    <Button
                        variant="outline"
                        size="icon"
                        onClick={() => setPageNumber((prev) => Math.max(prev - 1, 1))}
                        disabled={pageNumber <= 1}
                    >
                        <ChevronLeft className="w-4 h-4" />
                    </Button>
                    <span className="text-sm">
                        Page {pageNumber} of {numPages}
                    </span>
                    <Button
                        variant="outline"
                        size="icon"
                        onClick={() => setPageNumber((prev) => Math.min(prev + 1, numPages))}
                        disabled={pageNumber >= numPages}
                    >
                        <ChevronRight className="w-4 h-4" />
                    </Button>
                </div>
            )}
        </div>
    )
}
