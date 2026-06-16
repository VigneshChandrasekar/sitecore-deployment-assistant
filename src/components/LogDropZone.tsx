'use client'

import { useCallback, useRef, useState } from 'react'
import { Upload, FileText, Archive, X } from 'lucide-react'
import JSZip from 'jszip'

interface Props {
  onFiles: (files: { name: string; content: string }[]) => void
}

const ACCEPTED_EXTS = ['.log', '.txt', '.json', '.zip']
const MAX_BYTES = 100 * 1024 * 1024 // 100 MB

export default function LogDropZone({ onFiles }: Props) {
  const [dragging, setDragging] = useState(false)
  const [queuedFiles, setQueuedFiles] = useState<{ name: string; size: number }[]>([])
  const inputRef = useRef<HTMLInputElement>(null)

  const readFile = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = e => resolve(e.target?.result as string)
      reader.onerror = reject
      reader.readAsText(file)
    })

  const processFiles = useCallback(async (raw: File[]) => {
    const result: { name: string; content: string }[] = []

    for (const file of raw) {
      if (file.size > MAX_BYTES) continue
      if (file.name.endsWith('.zip')) {
        const buf = await file.arrayBuffer()
        const zip = await JSZip.loadAsync(buf)
        for (const [name, entry] of Object.entries(zip.files)) {
          if (entry.dir) continue
          const ext = name.toLowerCase()
          if (ACCEPTED_EXTS.some(e => ext.endsWith(e) && e !== '.zip')) {
            const text = await entry.async('text')
            result.push({ name, content: text })
          }
        }
      } else {
        const content = await readFile(file)
        result.push({ name: file.name, content })
      }
    }

    if (result.length > 0) {
      setQueuedFiles(raw.map(f => ({ name: f.name, size: f.size })))
      onFiles(result)
    }
  }, [onFiles])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragging(false)
    const files = Array.from(e.dataTransfer.files).filter(f =>
      ACCEPTED_EXTS.some(ext => f.name.toLowerCase().endsWith(ext))
    )
    processFiles(files)
  }, [processFiles])

  const handleInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? [])
    processFiles(files)
    e.target.value = ''
  }, [processFiles])

  return (
    <div className="max-w-2xl mx-auto mt-12 flex flex-col gap-4">
      <div
        onDragOver={e => { e.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
        className={`cursor-pointer rounded-xl border-2 border-dashed p-12 flex flex-col items-center gap-4 transition-colors
          ${dragging ? 'border-blue-400 bg-blue-50' : 'border-slate-300 bg-white hover:border-blue-300 hover:bg-slate-50'}`}
      >
        <div className="w-14 h-14 rounded-full bg-slate-100 flex items-center justify-center">
          <Upload className="h-6 w-6 text-slate-400" />
        </div>
        <div className="text-center">
          <p className="text-[14px] font-semibold text-slate-700">Drop log files here</p>
          <p className="text-[12px] text-slate-400 mt-1">
            .log, .txt, .json — or a .zip archive of multiple logs
          </p>
          <p className="text-[11px] text-slate-400 mt-0.5">Up to 100 MB per file</p>
        </div>
        <span className="px-4 py-2 rounded-lg bg-blue-600 text-white text-[12px] font-medium hover:bg-blue-700 transition-colors">
          Browse files
        </span>
        <input
          ref={inputRef}
          type="file"
          accept=".log,.txt,.json,.zip"
          multiple
          className="hidden"
          onChange={handleInput}
        />
      </div>

      {/* Supported formats */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { icon: FileText, label: 'Sitecore Log4Net', desc: '7772 11:27:50 ERROR …' },
          { icon: FileText, label: 'Serilog Text', desc: '2026-06-16 [ERR] …' },
          { icon: FileText, label: 'Serilog JSON (CLEF)', desc: '{"@t":"…","@l":"Error"}' },
        ].map(({ icon: Icon, label, desc }) => (
          <div key={label} className="rounded-lg border border-slate-200 bg-white p-3">
            <div className="flex items-center gap-2 mb-1">
              <Icon className="h-3.5 w-3.5 text-slate-400" />
              <span className="text-[12px] font-medium text-slate-700">{label}</span>
            </div>
            <p className="text-[10px] font-mono text-slate-400">{desc}</p>
          </div>
        ))}
      </div>
    </div>
  )
}
