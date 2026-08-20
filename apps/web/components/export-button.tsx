'use client'

import * as XLSX from 'xlsx'

interface ExportButtonProps {
  data: any[]
  filename: string
  type: 'csv' | 'xlsx'
}

export default function ExportButton({
  data,
  filename,
  type,
}: ExportButtonProps) {
  const handleExport = () => {
    const ws = XLSX.utils.json_to_sheet(data)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Sheet1')
    XLSX.writeFile(wb, `${filename}.${type === 'csv' ? 'csv' : 'xlsx'}`)
  }

  return (
    <button
      onClick={handleExport}
      className="bg-blue-600 text-white px-3 py-1 rounded text-sm hover:bg-blue-700"
    >
      Exporter en {type.toUpperCase()}
    </button>
  )
}