'use client'

import { useState } from 'react'
import { Terminal, ChevronDown, Check } from 'lucide-react'
import type { ParsedPackage } from '@/lib/types'
import type { RepackageMode } from '@/lib/repackageScriptGenerator'
import RepackageModal from './RepackageModal'

interface Props {
  pkg: ParsedPackage
}

const MODES: { value: RepackageMode; label: string; sub: string }[] = [
  {
    value: 'exact',
    label: 'Exact',
    sub:   'Same items as original — no extras',
  },
  {
    value: 'expand-roots',
    label: 'Expand Roots',
    sub:   'Roots re-taken with all current children',
  },
]

export default function RepackageScriptButton({ pkg }: Props) {
  const [mode, setMode]           = useState<RepackageMode>('exact')
  const [dropOpen, setDropOpen]   = useState(false)
  const [modalOpen, setModalOpen] = useState(false)

  const selected = MODES.find(m => m.value === mode)!

  return (
    <>
      <div className="relative flex items-stretch rounded-md shadow-sm">
        {/* Main button */}
        <button
          onClick={() => setModalOpen(true)}
          className="flex items-center gap-1.5 pl-3 pr-2.5 py-1.5 rounded-l-md bg-slate-800 hover:bg-white hover:text-slate-900 text-white text-xs font-medium border border-r-0 border-slate-700 hover:border-slate-300 transition-all hover:-translate-y-0.5 hover:shadow-md"
        >
          <Terminal className="h-3.5 w-3.5 text-slate-300" />
          Re-package Script
        </button>

        {/* Mode picker toggle */}
        <button
          onClick={() => setDropOpen(o => !o)}
          className="flex items-center gap-0.5 px-2 py-1.5 rounded-r-md bg-slate-800 hover:bg-white hover:text-slate-900 text-slate-300 border border-slate-700 hover:border-slate-300 transition-all hover:-translate-y-0.5 hover:shadow-md"
          title={selected.label + ' — ' + selected.sub}
        >
          <span className="text-[10px] font-semibold">{selected.label}</span>
          <ChevronDown className={`h-3 w-3 transition-transform ${dropOpen ? 'rotate-180' : ''}`} />
        </button>

        {/* Mode dropdown — dark, matches app nav */}
        {dropOpen && (
          <div
            className="absolute right-0 top-full mt-1 z-20 w-64 rounded-lg bg-slate-900 border border-slate-700 shadow-xl overflow-hidden"
            onMouseLeave={() => setDropOpen(false)}
          >
            <div className="px-3 py-2 border-b border-slate-800">
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">
                Re-package Mode
              </p>
            </div>
            {MODES.map(m => (
              <button
                key={m.value}
                onClick={() => { setMode(m.value); setDropOpen(false) }}
                className={`w-full flex items-start gap-2.5 px-3 py-2.5 text-left hover:bg-slate-800 transition-colors
                  ${m.value === mode ? 'bg-slate-800/60' : ''}`}
              >
                <span className={`mt-0.5 flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full border
                  ${m.value === mode ? 'border-red-500 bg-red-600' : 'border-slate-600'}`}>
                  {m.value === mode && <Check className="h-2 w-2 text-white" strokeWidth={3} />}
                </span>
                <div>
                  <p className={`text-xs font-semibold ${m.value === mode ? 'text-white' : 'text-slate-300'}`}>
                    {m.label}
                  </p>
                  <p className="text-[11px] text-slate-500 leading-snug mt-0.5">{m.sub}</p>
                </div>
              </button>
            ))}
            <div className="px-3 py-2 border-t border-slate-800 bg-slate-950/60">
              <p className="text-[10px] text-slate-500 leading-relaxed">
                Run the downloaded <span className="font-mono text-slate-400">.ps1</span> in Sitecore PowerShell Extensions to re-create this package.
              </p>
            </div>
          </div>
        )}
      </div>

      {modalOpen && (
        <RepackageModal
          pkg={pkg}
          mode={mode}
          onClose={() => setModalOpen(false)}
        />
      )}
    </>
  )
}
