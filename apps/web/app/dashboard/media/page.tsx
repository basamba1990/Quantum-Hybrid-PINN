'use client'

import React from 'react'
import { FileVideo, Image as ImageIcon, FileText, Download, Search, Filter } from 'lucide-react'

export default function MediaPage() {
  const mediaFiles = [
    { id: 1, name: 'Simulation_Pipeline_H2_V8.mp4', type: 'video', size: '45 MB', date: '12.07.2026' },
    { id: 2, name: 'Analysis_Report_Gold_Certification.pdf', type: 'document', size: '2.4 MB', date: '11.07.2026' },
    { id: 3, name: 'Visualisation_3D_Champ_Scalaire.png', type: 'image', size: '12 MB', date: '10.07.2026' },
  ]

  return (
    <div className="p-8 space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-4xl font-black text-white tracking-tighter uppercase">Bibliothèque Média <span className="text-blue-500 text-xl">V8.1</span></h1>
          <p className="text-gray-400 mt-2 font-medium">Gestionnaire centralisé des actifs visuels et rapports scientifiques.</p>
        </div>
        
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
            <input 
              type="text" 
              placeholder="Rechercher un média..." 
              className="bg-white/5 border border-white/10 rounded-2xl py-3 pl-12 pr-6 text-sm text-white focus:border-blue-500/50 outline-none transition-all w-64"
            />
          </div>
          <button className="p-3 bg-white/5 border border-white/10 rounded-2xl text-gray-400 hover:text-white transition-all">
            <Filter className="w-5 h-5" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {mediaFiles.map((file) => (
          <div key={file.id} className="bg-white/[0.03] border border-white/10 rounded-[32px] p-6 hover:border-blue-500/30 transition-all group">
            <div className="aspect-video bg-black/40 rounded-2xl mb-6 flex items-center justify-center relative overflow-hidden">
              {file.type === 'video' && <FileVideo className="w-12 h-12 text-blue-500" />}
              {file.type === 'image' && <ImageIcon className="w-12 h-12 text-emerald-500" />}
              {file.type === 'document' && <FileText className="w-12 h-12 text-amber-500" />}
              <div className="absolute inset-0 bg-blue-600/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                <button className="p-4 bg-white text-black rounded-full scale-90 group-hover:scale-100 transition-transform shadow-xl">
                  <Download className="w-6 h-6" />
                </button>
              </div>
            </div>
            <div className="space-y-1">
              <h3 className="font-bold text-white truncate">{file.name}</h3>
              <div className="flex items-center justify-between text-[10px] font-mono text-gray-500 uppercase tracking-widest">
                <span>{file.size}</span>
                <span>{file.date}</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="bg-blue-600/5 border border-blue-500/20 rounded-[32px] p-10 text-center">
        <h2 className="text-xl font-black text-white uppercase mb-2">Stockage Industriel Sécurisé</h2>
        <p className="text-sm text-gray-400 max-w-lg mx-auto leading-relaxed">
          Tous vos médias sont chiffrés et stockés sur des serveurs conformes aux normes de sécurité Quantum-Hybrid.
        </p>
      </div>
    </div>
  )
}
