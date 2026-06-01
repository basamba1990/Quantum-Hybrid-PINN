'use client'

import { useState, useEffect } from 'react'
import { Document, Page, pdfjs } from 'react-pdf'
import 'react-pdf/dist/Page/AnnotationLayer.css'
import 'react-pdf/dist/Page/TextLayer.css'

// Configuration dynamique du worker pour éviter les erreurs de chargement sur Vercel
const setWorker = () => {
  if (typeof window !== 'undefined') {
    pdfjs.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.js`
  }
}

interface PDFViewerProps {
  url: string
}

export default function PDFViewer({ url }: PDFViewerProps) {
  const [numPages, setNumPages] = useState<number | null>(null)
  const [pageNumber, setPageNumber] = useState(1)
  const [isMounted, setIsMounted] = useState(false)

  useEffect(() => {
    setIsMounted(true)
    setWorker()
  }, [])

  function onDocumentLoadSuccess({ numPages }: { numPages: number }) {
    setNumPages(numPages)
  }

  if (!isMounted) return <div className="flex items-center justify-center h-64 text-gray-500">Chargement du visualiseur...</div>

  return (
    <div className="flex flex-col items-center gap-4 w-full overflow-hidden">
      <div className="w-full flex justify-center bg-black/20 rounded-xl p-4 overflow-auto max-h-[70vh]">
        <Document 
          file={url} 
          onLoadSuccess={onDocumentLoadSuccess}
          loading={<div className="text-blue-400 animate-pulse">Chargement du document scientifique...</div>}
          error={<div className="text-red-400">Erreur lors du chargement du PDF.</div>}
        >
          {isMounted && (
            <Page 
              pageNumber={pageNumber} 
              renderTextLayer={true}
              renderAnnotationLayer={true}
              width={Math.min(typeof window !== 'undefined' ? window.innerWidth * 0.8 : 800, 800)}
            />
          )}
        </Document>
      </div>
      
      {numPages && (
        <div className="flex gap-4 items-center bg-white/5 px-6 py-3 rounded-full border border-white/10">
          <button
            onClick={() => setPageNumber(Math.max(1, pageNumber - 1))}
            disabled={pageNumber <= 1}
            className="p-2 hover:bg-white/10 rounded-full disabled:opacity-30 transition-all"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
          </button>
          <span className="text-xs font-mono font-bold text-gray-400 uppercase tracking-widest">
            Page {pageNumber} / {numPages}
          </span>
          <button
            onClick={() => setPageNumber(Math.min(numPages, pageNumber + 1))}
            disabled={pageNumber >= numPages}
            className="p-2 hover:bg-white/10 rounded-full disabled:opacity-30 transition-all"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6"/></svg>
          </button>
        </div>
      )}
    </div>
  )
}