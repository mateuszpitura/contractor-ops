"use client"

import { useState, useCallback, useEffect } from "react"
import { Document, Page, pdfjs } from "react-pdf"
import {
  ChevronLeft,
  ChevronRight,
  ZoomIn,
  ZoomOut,
  Maximize2,
} from "lucide-react"

import { cn } from "@/lib/utils"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { ScrollArea } from "@/components/ui/scroll-area"

pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/build/pdf.worker.min.mjs",
  import.meta.url
).toString()

const MIN_SCALE = 0.5
const MAX_SCALE = 2.0
const SCALE_STEP = 0.25

interface PdfViewerProps {
  url: string
  className?: string
}

export function PdfViewer({ url, className }: PdfViewerProps) {
  const [numPages, setNumPages] = useState<number>(0)
  const [currentPage, setCurrentPage] = useState<number>(1)
  const [scale, setScale] = useState<number>(1.0)

  // Load react-pdf CSS dynamically to avoid Next.js build issues
  useEffect(() => {
    import("react-pdf/dist/Page/AnnotationLayer.css" as never)
    import("react-pdf/dist/Page/TextLayer.css" as never)
  }, [])

  const onDocumentLoadSuccess = useCallback(
    ({ numPages: total }: { numPages: number }) => {
      setNumPages(total)
      setCurrentPage(1)
    },
    []
  )

  const goToPreviousPage = useCallback(() => {
    setCurrentPage((prev) => Math.max(1, prev - 1))
  }, [])

  const goToNextPage = useCallback(() => {
    setCurrentPage((prev) => Math.min(numPages, prev + 1))
  }, [numPages])

  const zoomIn = useCallback(() => {
    setScale((prev) => Math.min(MAX_SCALE, prev + SCALE_STEP))
  }, [])

  const zoomOut = useCallback(() => {
    setScale((prev) => Math.max(MIN_SCALE, prev - SCALE_STEP))
  }, [])

  const fitWidth = useCallback(() => {
    setScale(1.0)
  }, [])

  return (
    <Card
      className={cn(
        "sticky top-20 min-h-[240px] bg-muted/30 md:min-h-[400px]",
        className
      )}
    >
      {/* Toolbar */}
      <div className="flex items-center gap-2 px-4 py-2">
        <span className="text-sm font-semibold tabular-nums">
          {currentPage} of {numPages || "..."}
        </span>

        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={goToPreviousPage}
            disabled={currentPage <= 1}
            aria-label="Previous page"
          >
            <ChevronLeft />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={goToNextPage}
            disabled={currentPage >= numPages}
            aria-label="Next page"
          >
            <ChevronRight />
          </Button>
        </div>

        <Separator orientation="vertical" className="mx-1 h-5" />

        <Button variant="ghost" size="sm" onClick={fitWidth}>
          <Maximize2 />
          <span className="hidden sm:inline">Fit width</span>
        </Button>

        <Button
          variant="ghost"
          size="icon-sm"
          onClick={zoomOut}
          disabled={scale <= MIN_SCALE}
          aria-label="Zoom out"
        >
          <ZoomOut />
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={zoomIn}
          disabled={scale >= MAX_SCALE}
          aria-label="Zoom in"
        >
          <ZoomIn />
        </Button>
      </div>

      <Separator />

      {/* PDF Content */}
      <CardContent className="p-0">
        <ScrollArea className="h-[calc(100vh-240px)] min-h-[200px]">
          <div className="flex justify-center p-4">
            <Document file={url} onLoadSuccess={onDocumentLoadSuccess}>
              <Page
                pageNumber={currentPage}
                scale={scale}
                className="shadow-md"
              />
            </Document>
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  )
}
