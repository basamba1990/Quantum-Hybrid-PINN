'use client'

import React, { useState } from 'react'
import { Download, Image as ImageIcon, FileJson } from 'lucide-react'

interface ExportButtonsImprovedProps {
  containerRef: React.RefObject<HTMLDivElement | null>
  canvasRef?: React.RefObject<HTMLCanvasElement | null>
  fileName?: string
  onExportStart?: () => void
  onExportEnd?: () => void
  showPDF?: boolean
  showPNG?: boolean
  showJSON?: boolean
  jsonData?: any
}

export const ExportButtonsImproved: React.FC<ExportButtonsImprovedProps> = ({
  containerRef,
  canvasRef,
  fileName = 'export',
  onExportStart,
  onExportEnd,
  showPDF = true,
  showPNG = true,
  showJSON = true,
  jsonData
}) => {
  const [exporting, setExporting] = useState(false)

  const handleExportStart = () => {
    setExporting(true)
    onExportStart?.()
  }

  const handleExportEnd = () => {
    setExporting(false)
    onExportEnd?.()
  }

  // Export to PNG using canvas directly (for Three.js scenes)
  const exportToPNG = async () => {
    handleExportStart()
    try {
      let canvas: HTMLCanvasElement | null = null
      
      // Try to get canvas from ref first (Three.js)
      if (canvasRef?.current) {
        canvas = canvasRef.current
      } else if (containerRef.current) {
        // Fallback: find canvas inside container
        canvas = containerRef.current.querySelector('canvas')
      }

      if (!canvas) {
        console.error('No canvas found for PNG export')
        handleExportEnd()
        return
      }

      // Create a new canvas to avoid CORS issues
      const exportCanvas = document.createElement('canvas')
      exportCanvas.width = canvas.width
      exportCanvas.height = canvas.height
      const ctx = exportCanvas.getContext('2d')
      if (!ctx) {
        handleExportEnd()
        return
      }

      // Copy the canvas content
      ctx.drawImage(canvas, 0, 0)

      // Download
      const link = document.createElement('a')
      link.href = exportCanvas.toDataURL('image/png')
      link.download = `${fileName}-${Date.now()}.png`
      link.click()
    } catch (err) {
      console.error('Export PNG failed:', err)
    } finally {
      handleExportEnd()
    }
  }

  // Export to JSON
  const exportToJSON = () => {
    handleExportStart()
    try {
      const data = jsonData || {
        title: fileName,
        timestamp: new Date().toISOString(),
        exported: true
      }
      
      const link = document.createElement('a')
      link.href = URL.createObjectURL(
        new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
      )
      link.download = `${fileName}-${Date.now()}.json`
      link.click()
    } catch (err) {
      console.error('Export JSON failed:', err)
    } finally {
      handleExportEnd()
    }
  }

  // Export to PDF using canvas
  const exportToPDF = async () => {
    handleExportStart()
    try {
      let canvas: HTMLCanvasElement | null = null
      
      if (canvasRef?.current) {
        canvas = canvasRef.current
      } else if (containerRef.current) {
        canvas = containerRef.current.querySelector('canvas')
      }

      if (!canvas) {
        console.error('No canvas found for PDF export')
        handleExportEnd()
        return
      }

      const { jsPDF } = await import('jspdf')
      const pdf = new jsPDF({
        orientation: canvas.width > canvas.height ? 'landscape' : 'portrait',
        unit: 'mm',
        format: 'a4'
      })

      const imgData = canvas.toDataURL('image/png')
      const imgWidth = pdf.internal.pageSize.getWidth() - 20
      const imgHeight = (canvas.height * imgWidth) / canvas.width

      pdf.addImage(imgData, 'PNG', 10, 10, imgWidth, imgHeight)
      pdf.setProperties({
        title: fileName,
        subject: 'Scientific Visualization Export',
        author: 'Quantum Hybrid PINN',
        keywords: 'visualization, 3d, scientific',
        creator: 'Industrial Visualizer'
      })

      pdf.save(`${fileName}-${Date.now()}.pdf`)
    } catch (err) {
      console.error('Export PDF failed:', err)
    } finally {
      handleExportEnd()
    }
  }

  return (
    <div className="flex gap-2 flex-wrap">
      {showPNG && (
        <button
          onClick={exportToPNG}
          disabled={exporting}
          className="px-3 py-2 rounded-lg text-[9px] font-black uppercase bg-blue-600/20 text-blue-400 hover:bg-blue-600/40 transition-all flex items-center gap-1 border border-blue-500/30 disabled:opacity-50 disabled:cursor-not-allowed active:scale-95"
          title="Export as PNG image"
        >
          <ImageIcon className="w-3 h-3" />
          PNG
        </button>
      )}
      
      {showJSON && (
        <button
          onClick={exportToJSON}
          disabled={exporting}
          className="px-3 py-2 rounded-lg text-[9px] font-black uppercase bg-purple-600/20 text-purple-400 hover:bg-purple-600/40 transition-all flex items-center gap-1 border border-purple-500/30 disabled:opacity-50 disabled:cursor-not-allowed active:scale-95"
          title="Export as JSON data"
        >
          <FileJson className="w-3 h-3" />
          JSON
        </button>
      )}
      
      {showPDF && (
        <button
          onClick={exportToPDF}
          disabled={exporting}
          className="px-3 py-2 rounded-lg text-[9px] font-black uppercase bg-red-600/20 text-red-400 hover:bg-red-600/40 transition-all flex items-center gap-1 border border-red-500/30 disabled:opacity-50 disabled:cursor-not-allowed active:scale-95"
          title="Export as PDF document"
        >
          <Download className="w-3 h-3" />
          PDF
        </button>
      )}
    </div>
  )
}

export default ExportButtonsImproved
