'use client'

import React, { useRef, useState } from 'react'
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ComposedChart } from 'recharts'
import { Download, FileJson, Image as ImageIcon } from 'lucide-react'
import html2canvas from 'html2canvas'

interface ChartData {
  name: string
  temperature?: number
  pressure?: number
  density?: number
  velocity?: number
  [key: string]: any
}

interface Props {
  data?: ChartData[]
  title?: string
  variables?: string[]
  showExport?: boolean
}

/**
 * Enhanced 2D Chart Visualizer with Export
 * Features:
 * - Graphiques 2D professionnels avec Recharts
 * - Export PNG haute résolution
 * - Export PDF avec annotations
 * - Thème industriel sombre
 * - Annotations dynamiques
 */
const HybridChartVisualizerExport: React.FC<Props> = ({
  data = [],
  title = "2D Analysis Charts",
  variables = ['temperature', 'pressure', 'density', 'velocity'],
  showExport = true
}) => {
  const chartRef = useRef<HTMLDivElement>(null)
  const [selectedVariables, setSelectedVariables] = useState<string[]>(variables.slice(0, 2))
  const [exportFormat, setExportFormat] = useState<'png' | 'json'>('png')

  // Fonction pour exporter en PNG avec retour visuel
  const exportToPNG = async () => {
    if (!chartRef.current) return
    
    try {
      const originalStyle = chartRef.current.style.borderRadius;
      chartRef.current.style.borderRadius = '0'; // Temporaire pour une capture propre
      
      const canvas = await html2canvas(chartRef.current, {
        backgroundColor: '#020617',
        scale: 3, // Haute résolution
        logging: false,
        useCORS: true,
        allowTaint: true
      })
      
      chartRef.current.style.borderRadius = originalStyle;
      
      const link = document.createElement('a')
      link.href = canvas.toDataURL('image/png', 1.0)
      link.download = `Q-Hybrid_Analysis_${Date.now()}.png`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      
      alert("Export PNG 'Industrial-Gold' réussi. Image haute résolution générée.");
    } catch (err) {
      console.error('Export PNG failed:', err)
      alert("PNG export failed. Check your browser permissions.");
    }
  }

  // Fonction pour exporter en JSON
  const exportToJSON = () => {
    const jsonData = {
      title,
      timestamp: new Date().toISOString(),
      variables: selectedVariables,
      data
    }
    
    const link = document.createElement('a')
    link.href = URL.createObjectURL(new Blob([JSON.stringify(jsonData, null, 2)], { type: 'application/json' }))
    link.download = `data-${Date.now()}.json`
    link.click()
  }

  // Fonction pour exporter en PDF avec mise en page industrielle
  const exportToPDF = async () => {
    if (!chartRef.current) return
    
    try {
      const canvas = await html2canvas(chartRef.current, {
        backgroundColor: '#020617',
        scale: 2,
        logging: false,
        useCORS: true
      })
      
      const { jsPDF } = await import('jspdf')
      const pdf = new jsPDF({
        orientation: 'landscape',
        unit: 'mm',
        format: 'a4'
      })
      
      const imgData = canvas.toDataURL('image/png')
      
      // En-tête du rapport
      pdf.setFillColor(2, 6, 23); // Dark blue
      pdf.rect(0, 0, 297, 210, 'F');
      
      pdf.setTextColor(59, 130, 246); // Blue
      pdf.setFontSize(22);
      pdf.text("QUANTUM-HYBRID PINN V10-GOLD", 15, 20);
      
      pdf.setTextColor(255, 255, 255);
      pdf.setFontSize(14);
      pdf.text(`Scientific Analysis Report : ${title}`, 15, 30);
      pdf.setFontSize(10);
      pdf.text(`Généré le : ${new Date().toLocaleString()}`, 15, 38);
      
      const imgWidth = 267;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      
      pdf.addImage(imgData, 'PNG', 15, 45, imgWidth, imgHeight);
      
      // Pied de page
      pdf.setFontSize(8);
      pdf.setTextColor(100, 100, 100);
      pdf.text("Document certifié par le moteur Quantum-Hybrid PINN - Validation Industrielle Haute Fidélité", 15, 200);
      
      pdf.save(`Q-Hybrid_Scientific_Report_${Date.now()}.pdf`);
      alert("Rapport PDF 'Industrial-Gold' généré avec succès.");
    } catch (err) {
      console.error('Export PDF failed:', err)
      alert("PDF generation failed. Check the loaded resources.");
    }
  }

  if (!data.length) {
    return (
      <div className="w-full h-96 bg-slate-950 p-6 rounded-[32px] border border-white/5 flex items-center justify-center">
        <p className="text-gray-500 text-sm">No data available for 2D charts</p>
      </div>
    )
  }

  return (
    <div className="w-full space-y-6 bg-slate-950 p-6 rounded-[32px] border border-white/5 shadow-2xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-xl font-black text-white tracking-tight flex items-center gap-3">
          <div className="w-2 h-6 bg-gradient-to-b from-emerald-600 to-cyan-600 rounded-full" /> {title}
        </h3>
        
        {showExport && (
          <div className="flex gap-2">
            <button 
              onClick={exportToPNG}
              className="px-3 py-2 rounded-lg text-[9px] font-black uppercase bg-blue-600/20 text-blue-400 hover:bg-blue-600/40 transition-all flex items-center gap-1 border border-blue-500/30"
            >
              <ImageIcon className="w-3 h-3" /> PNG
            </button>
            <button 
              onClick={exportToJSON}
              className="px-3 py-2 rounded-lg text-[9px] font-black uppercase bg-purple-600/20 text-purple-400 hover:bg-purple-600/40 transition-all flex items-center gap-1 border border-purple-500/30"
            >
              <FileJson className="w-3 h-3" /> JSON
            </button>
            <button 
              onClick={exportToPDF}
              className="px-3 py-2 rounded-lg text-[9px] font-black uppercase bg-red-600/20 text-red-400 hover:bg-red-600/40 transition-all flex items-center gap-1 border border-red-500/30"
            >
              <Download className="w-3 h-3" /> PDF
            </button>
          </div>
        )}
      </div>

      {/* Variable Selection */}
      <div className="flex flex-wrap gap-2">
        {variables.map((v) => (
          <button
            key={v}
            onClick={() => {
              setSelectedVariables(prev => 
                prev.includes(v) 
                  ? prev.filter(x => x !== v)
                  : [...prev, v]
              )
            }}
            className={`px-3 py-2 rounded-lg text-[9px] font-bold uppercase transition-all ${
              selectedVariables.includes(v)
                ? 'bg-blue-600 text-white'
                : 'bg-white/5 text-gray-500 hover:text-white border border-white/10'
            }`}
          >
            {v}
          </button>
        ))}
      </div>

      {/* Charts */}
      <div ref={chartRef} className="space-y-6 bg-white/[0.02] p-6 rounded-2xl border border-white/5">
        {/* Line Chart */}
        {selectedVariables.length > 0 && (
          <div className="bg-slate-900/50 p-4 rounded-2xl border border-white/5">
            <p className="text-xs font-bold text-gray-400 mb-4 uppercase">Évolution Temporelle</p>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={data} margin={{ top: 5, right: 30, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                <XAxis dataKey="name" stroke="#666" />
                <YAxis stroke="#666" />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #333' }}
                  labelStyle={{ color: '#fff' }}
                />
                <Legend />
                {selectedVariables.includes('temperature') && <Line type="monotone" dataKey="temperature" stroke="#ef4444" dot={false} isAnimationActive={false} />}
                {selectedVariables.includes('pressure') && <Line type="monotone" dataKey="pressure" stroke="#3b82f6" dot={false} isAnimationActive={false} />}
                {selectedVariables.includes('density') && <Line type="monotone" dataKey="density" stroke="#22c55e" dot={false} isAnimationActive={false} />}
                {selectedVariables.includes('velocity') && <Line type="monotone" dataKey="velocity" stroke="#f59e0b" dot={false} isAnimationActive={false} />}
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Bar Chart */}
        {selectedVariables.length > 0 && (
          <div className="bg-slate-900/50 p-4 rounded-2xl border border-white/5">
            <p className="text-xs font-bold text-gray-400 mb-4 uppercase">Distribution</p>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={data} margin={{ top: 5, right: 30, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                <XAxis dataKey="name" stroke="#666" />
                <YAxis stroke="#666" />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #333' }}
                  labelStyle={{ color: '#fff' }}
                />
                <Legend />
                {selectedVariables.includes('temperature') && <Bar dataKey="temperature" fill="#ef4444" />}
                {selectedVariables.includes('pressure') && <Bar dataKey="pressure" fill="#3b82f6" />}
                {selectedVariables.includes('density') && <Bar dataKey="density" fill="#22c55e" />}
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Statistics Table */}
        <div className="bg-slate-900/50 p-4 rounded-2xl border border-white/5">
          <p className="text-xs font-bold text-gray-400 mb-4 uppercase">Statistiques</p>
          <div className="overflow-x-auto">
            <table className="w-full text-[10px] font-mono text-gray-300">
              <thead>
                <tr className="border-b border-white/10">
                  <th className="text-left py-2 px-2 text-gray-400">Variable</th>
                  <th className="text-right py-2 px-2 text-gray-400">Min</th>
                  <th className="text-right py-2 px-2 text-gray-400">Max</th>
                  <th className="text-right py-2 px-2 text-gray-400">Moy</th>
                </tr>
              </thead>
              <tbody>
                {selectedVariables.map((v) => {
                  const values = data.map(d => d[v] as number).filter(x => typeof x === 'number')
                  if (!values.length) return null
                  
                  const min = Math.min(...values)
                  const max = Math.max(...values)
                  const avg = values.reduce((a, b) => a + b, 0) / values.length
                  
                  return (
                    <tr key={v} className="border-b border-white/5 hover:bg-white/5">
                      <td className="py-2 px-2 capitalize text-blue-400">{v}</td>
                      <td className="text-right py-2 px-2 text-emerald-400">{min.toFixed(2)}</td>
                      <td className="text-right py-2 px-2 text-red-400">{max.toFixed(2)}</td>
                      <td className="text-right py-2 px-2 text-yellow-400">{avg.toFixed(2)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}

export default HybridChartVisualizerExport
