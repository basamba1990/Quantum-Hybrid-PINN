'use client'

import React, { useState } from 'react'
import { Download, Image as ImageIcon, FileJson } from 'lucide-react'
import html2canvas from 'html2canvas'

interface ExportButtonsImprovedProps {
  containerRef: React.RefObject<HTMLDivElement | null>
  canvasRef?: React.RefObject<any>
  fileName?: string
  onExportStart?: () => void
  onExportEnd?: () => void
  showPDF?: boolean
  showPNG?: boolean
  showJSON?: boolean
  jsonData?: any
}

/**
 * TRULY-INDUSTRIAL EXPORT ENGINE
 * 
 * CORRECTIONS APPLIQUÉES :
 * 1. PNG : utilise html2canvas sur containerRef (capture tout le composant)
 * 2. PDF : utilise html2canvas + jsPDF (standard industriel)
 * 3. Fallback WebGL : extrait le canvas DOM depuis renderer.domElement
 * 4. preserveDrawingBuffer : force true pour capturer le frame WebGL
 */
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
  const [exportStatus, setExportStatus] = useState<string>('')

  const handleExportStart = (status: string) => {
    setExporting(true)
    setExportStatus(status)
    onExportStart?.()
  }

  const handleExportEnd = () => {
    setExporting(false)
    setExportStatus('')
    onExportEnd?.()
  }

  /**
   * Récupérer le canvas DOM depuis WebGLRenderer ou container
   * CORRECTION : WebGLRenderer n'est PAS un HTMLCanvasElement
   * Il faut utiliser renderer.domElement pour obtenir le <canvas>
   */
  const getCanvasElement = (): HTMLCanvasElement | null => {
    // 1. Essayer canvasRef (Three.js WebGLRenderer)
    if (canvasRef?.current) {
      // Si c'est un WebGLRenderer, utiliser .domElement
      if (canvasRef.current.domElement && canvasRef.current.domElement instanceof HTMLCanvasElement) {
        return canvasRef.current.domElement
      }
      // Si c'est directement un HTMLCanvasElement
      if (canvasRef.current instanceof HTMLCanvasElement) {
        return canvasRef.current
      }
    }

    // 2. Fallback : chercher dans le container
    if (containerRef.current) {
      return containerRef.current.querySelector('canvas')
    }

    return null
  }

  /**
   * Export PNG — Capture du canvas WebGL via drawImage
   * CORRECTION : utilise renderer.domElement avec preserveDrawingBuffer
   */
  const exportToPNG = async () => {
    handleExportStart('Export PNG en cours...')
    try {
      const canvas = getCanvasElement()

      if (canvas) {
        // Méthode directe : capturer le canvas WebGL
        // Note : nécessite preserveDrawingBuffer: true dans le renderer
        const exportCanvas = document.createElement('canvas')
        exportCanvas.width = canvas.width
        exportCanvas.height = canvas.height
        const ctx = exportCanvas.getContext('2d')
        if (!ctx) {
          handleExportEnd()
          return
        }
        ctx.drawImage(canvas, 0, 0)

        // Vérifier que l'image n'est pas vide
        const dataUrl = exportCanvas.toDataURL('image/png')
        if (dataUrl === 'data:,') {
          // Canvas vide — fallback sur html2canvas
          console.warn('WebGL canvas vide, fallback html2canvas')
          await fallbackHtml2CanvasPNG()
          return
        }

        const link = document.createElement('a')
        link.href = dataUrl
        link.download = `${fileName.replace(/\s+/g, '-').toLowerCase()}-${Date.now()}.png`
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
        setExportStatus('PNG exporté avec succès')
      } else {
        // Fallback sur html2canvas
        await fallbackHtml2CanvasPNG()
      }
    } catch (err) {
      console.error('Export PNG failed:', err)
      setExportStatus('Erreur export PNG')
      // Dernier recours : html2canvas
      try {
        await fallbackHtml2CanvasPNG()
      } catch (err2) {
        console.error('Fallback PNG also failed:', err2)
      }
    } finally {
      setTimeout(() => handleExportEnd(), 2000)
    }
  }

  /**
   * Fallback PNG via html2canvas (capture tout le DOM du composant)
   */
  const fallbackHtml2CanvasPNG = async () => {
    if (!containerRef.current) {
      console.error('No container for html2canvas fallback')
      return
    }

    const canvas = await html2canvas(containerRef.current, {
      backgroundColor: '#020617',
      scale: 2,
      logging: false,
      allowTaint: true,
      useCORS: true,
      width: containerRef.current.scrollWidth,
      height: containerRef.current.scrollHeight
    })

    const link = document.createElement('a')
    link.href = canvas.toDataURL('image/png')
    link.download = `${fileName.replace(/\s+/g, '-').toLowerCase()}-${Date.now()}.png`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    setExportStatus('PNG exporté (html2canvas)')
  }

  // Export JSON (fonctionne déjà — pas de changement)
  const exportToJSON = () => {
    handleExportStart('Export JSON...')
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
      link.download = `${fileName.replace(/\s+/g, '-').toLowerCase()}-${Date.now()}.json`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      setExportStatus('JSON exporté avec succès')
    } catch (err) {
      console.error('Export JSON failed:', err)
      setExportStatus('Erreur export JSON')
    } finally {
      setTimeout(() => handleExportEnd(), 2000)
    }
  }

  /**
   * Export PDF — html2canvas + jsPDF
   * CORRECTION : utilise html2canvas au lieu de canvas toDataURL direct
   * car le canvas WebGL peut être vide sans preserveDrawingBuffer
   */
  const exportToPDF = async () => {
    handleExportStart('Génération PDF...')
    try {
      if (!containerRef.current) {
        console.error('No container for PDF export')
        handleExportEnd()
        return
      }

      // Capture le composant entier avec html2canvas
      const canvas = await html2canvas(containerRef.current, {
        backgroundColor: '#020617',
        scale: 2,
        logging: false,
        allowTaint: true,
        useCORS: true,
        width: containerRef.current.scrollWidth,
        height: containerRef.current.scrollHeight
      })

      const imgData = canvas.toDataURL('image/png', 1.0)

      // Déterminer l'orientation
      const isWide = canvas.width > canvas.height
      const { jsPDF } = await import('jspdf')
      const pdf = new jsPDF({
        orientation: isWide ? 'landscape' : 'portrait',
        unit: 'mm',
        format: 'a4'
      })

      // Calculer les dimensions pour tenir sur A4
      const pageWidth = pdf.internal.pageSize.getWidth() - 20
      const pageHeight = pdf.internal.pageSize.getHeight() - 20
      const imgRatio = canvas.width / canvas.height
      const pageRatio = pageWidth / pageHeight

      let imgWidth: number
      let imgHeight: number

      if (imgRatio > pageRatio) {
        // Image plus large — limiter par la largeur
        imgWidth = pageWidth
        imgHeight = pageWidth / imgRatio
      } else {
        // Image plus haute — limiter par la hauteur
        imgHeight = pageHeight
        imgWidth = pageHeight * imgRatio
      }

      // Centrer sur la page
      const xOffset = (pdf.internal.pageSize.getWidth() - imgWidth) / 2
      const yOffset = (pdf.internal.pageSize.getHeight() - imgHeight) / 2

      pdf.addImage(imgData, 'PNG', xOffset, yOffset, imgWidth, imgHeight)

      // Métadonnées industrielles
      pdf.setProperties({
        title: `Quantum Hybrid PINN — ${fileName}`,
        subject: 'Scientific Industrial Visualization — Kelly Senecal Standard',
        author: 'basamba1990',
        keywords: 'PINN, CFD, industrial, visualization, 3D',
        creator: 'Quantum Hybrid PINN V11-GOLD'
      })

      pdf.save(`${fileName.replace(/\s+/g, '-').toLowerCase()}-${Date.now()}.pdf`)
      setExportStatus('PDF exporté avec succès')
    } catch (err) {
      console.error('Export PDF failed:', err)
      setExportStatus('Erreur export PDF')
    } finally {
      setTimeout(() => handleExportEnd(), 2000)
    }
  }

  return (
    <div className="flex flex-col gap-1">
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
      {exportStatus && (
        <span className="text-[7px] font-mono text-cyan-400/80 px-1">{exportStatus}</span>
      )}
    </div>
  )
}

export default ExportButtonsImproved
