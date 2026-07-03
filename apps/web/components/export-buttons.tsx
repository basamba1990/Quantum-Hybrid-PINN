'use client'

import React, { useState } from 'react'
import { Download, Image as ImageIcon, FileJson } from 'lucide-react'
import html2canvas from 'html2canvas'

interface ExportButtonsProps {
  containerRef: React.RefObject<HTMLDivElement>
  fileName?: string
  onExportStart?: () => void
  onExportEnd?: () => void
  showPDF?: boolean
  showPNG?: boolean
  showJSON?: boolean
  jsonData?: any
}

/**
 * Reusable export buttons component
 * Supports PNG, JSON, and PDF export formats
 */
export const ExportButtons: React.FC<ExportButtonsProps> = ({
  containerRef,
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

  // Export to PNG
  const exportToPNG = async () => {
    if (!containerRef.current) return
    
    handleExportStart()
    try {
      const canvas = await html2canvas(containerRef.current, {
        backgroundColor: '#0f172a',
        scale: 2,
        logging: false,
        allowTaint: true,
        useCORS: true
      })
      
      const link = document.createElement('a')
      link.href = canvas.toDataURL('image/png')
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

  // Export to PDF
  const exportToPDF = async () => {
    if (!containerRef.current) return
    
    handleExportStart()
    try {
      const canvas = await html2canvas(containerRef.current, {
        backgroundColor: '#0f172a',
        scale: 2,
        logging: false,
        allowTaint: true,
        useCORS: true
      })
      
      const { jsPDF } = await import('jspdf')
      const pdf = new jsPDF({
        orientation: 'landscape',
        unit: 'mm',
        format: 'a4'
      })
      
      const imgData = canvas.toDataURL('image/png')
      const imgWidth = 280
      const imgHeight = (canvas.height * imgWidth) / canvas.width
      
      pdf.addImage(imgData, 'PNG', 10, 10, imgWidth, imgHeight)
      
      pdf.setProperties({
        title: fileName,
        subject: 'Export',
        author: 'Quantum Hybrid PINN',
        keywords: 'export, visualization',
        creator: 'Export Utility'
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
          className="px-3 py-2 rounded-lg text-[9px] font-black uppercase bg-blue-600/20 text-blue-400 hover:bg-blue-600/40 transition-all flex items-center gap-1 border border-blue-500/30 disabled:opacity-50 disabled:cursor-not-allowed"
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
          className="px-3 py-2 rounded-lg text-[9px] font-black uppercase bg-purple-600/20 text-purple-400 hover:bg-purple-600/40 transition-all flex items-center gap-1 border border-purple-500/30 disabled:opacity-50 disabled:cursor-not-allowed"
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
          className="px-3 py-2 rounded-lg text-[9px] font-black uppercase bg-red-600/20 text-red-400 hover:bg-red-600/40 transition-all flex items-center gap-1 border border-red-500/30 disabled:opacity-50 disabled:cursor-not-allowed"
          title="Export as PDF document"
        >
          <Download className="w-3 h-3" />
          PDF
        </button>
      )}
    </div>
  )
}

export default ExportButtons
