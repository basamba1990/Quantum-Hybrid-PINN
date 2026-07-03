'use client'

import React, { useRef, useState } from 'react'
import { Download, Image as ImageIcon, FileJson } from 'lucide-react'
import html2canvas from 'html2canvas'

interface Point3D {
  x: number
  y: number
  z: number
  temperature?: number
  pressure?: number
  density?: number
  velocity_magnitude?: number
}

interface Props {
  data: Point3D[]
  title?: string
  colorVariable?: 'temperature' | 'pressure' | 'density' | 'velocity_magnitude'
  onExport?: (format: 'png' | 'json' | 'pdf') => void
}

/**
 * Export utilities for 3D visualization
 * Supports PNG, JSON, and PDF export formats
 */
const Industrial3DVisualizerExport: React.FC<Props> = ({
  data = [],
  title = "3D Visualization",
  colorVariable = 'temperature',
  onExport
}) => {
  const containerRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [exporting, setExporting] = useState(false)

  // Export to PNG
  const exportToPNG = async () => {
    if (!containerRef.current) return
    
    setExporting(true)
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
      link.download = `3d-visualization-${Date.now()}.png`
      link.click()
      
      onExport?.('png')
    } catch (err) {
      console.error('Export PNG failed:', err)
    } finally {
      setExporting(false)
    }
  }

  // Export to JSON
  const exportToJSON = () => {
    setExporting(true)
    try {
      const jsonData = {
        title,
        timestamp: new Date().toISOString(),
        colorVariable,
        pointCount: data.length,
        data: data,
        statistics: calculateStatistics(data, colorVariable)
      }
      
      const link = document.createElement('a')
      link.href = URL.createObjectURL(
        new Blob([JSON.stringify(jsonData, null, 2)], { type: 'application/json' })
      )
      link.download = `3d-data-${Date.now()}.json`
      link.click()
      
      onExport?.('json')
    } catch (err) {
      console.error('Export JSON failed:', err)
    } finally {
      setExporting(false)
    }
  }

  // Export to PDF
  const exportToPDF = async () => {
    if (!containerRef.current) return
    
    setExporting(true)
    try {
      const canvas = await html2canvas(containerRef.current, {
        backgroundColor: '#0f172a',
        scale: 2,
        logging: false,
        allowTaint: true,
        useCORS: true
      })
      
      // Dynamic import to avoid issues if jsPDF is not available
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
      
      // Add metadata
      pdf.setProperties({
        title: title,
        subject: '3D Visualization Export',
        author: 'Quantum Hybrid PINN',
        keywords: 'visualization, 3d, export',
        creator: 'Industrial 3D Visualizer'
      })
      
      pdf.save(`3d-visualization-${Date.now()}.pdf`)
      
      onExport?.('pdf')
    } catch (err) {
      console.error('Export PDF failed:', err)
    } finally {
      setExporting(false)
    }
  }

  // Calculate statistics for exported data
  const calculateStatistics = (points: Point3D[], variable: string) => {
    const values = points
      .map(p => (p as any)[variable])
      .filter(v => typeof v === 'number')
    
    if (!values.length) return null
    
    return {
      min: Math.min(...values),
      max: Math.max(...values),
      avg: values.reduce((a, b) => a + b, 0) / values.length,
      count: values.length
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div ref={containerRef} className="w-full">
        {/* 3D visualization content goes here */}
      </div>
      
      <div className="flex gap-2 justify-end">
        <button
          onClick={exportToPNG}
          disabled={exporting}
          className="px-4 py-2 rounded-lg text-sm font-bold bg-blue-600/20 text-blue-400 hover:bg-blue-600/40 transition-all flex items-center gap-2 border border-blue-500/30 disabled:opacity-50"
        >
          <ImageIcon className="w-4 h-4" />
          {exporting ? 'Exporting...' : 'PNG'}
        </button>
        
        <button
          onClick={exportToJSON}
          disabled={exporting}
          className="px-4 py-2 rounded-lg text-sm font-bold bg-purple-600/20 text-purple-400 hover:bg-purple-600/40 transition-all flex items-center gap-2 border border-purple-500/30 disabled:opacity-50"
        >
          <FileJson className="w-4 h-4" />
          {exporting ? 'Exporting...' : 'JSON'}
        </button>
        
        <button
          onClick={exportToPDF}
          disabled={exporting}
          className="px-4 py-2 rounded-lg text-sm font-bold bg-red-600/20 text-red-400 hover:bg-red-600/40 transition-all flex items-center gap-2 border border-red-500/30 disabled:opacity-50"
        >
          <Download className="w-4 h-4" />
          {exporting ? 'Exporting...' : 'PDF'}
        </button>
      </div>
    </div>
  )
}

export default Industrial3DVisualizerExport
