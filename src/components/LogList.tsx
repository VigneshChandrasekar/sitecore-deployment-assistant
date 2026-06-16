'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import type { LogEntry } from '@/lib/logTypes'
import { ChevronDown, ChevronRight, Copy, Check } from 'lucide-react'

interface Props {
  entries: LogEntry[]
  onThreadSelect: (thread: string) => void
}

const ROW_H = 36
const EXPANDED_EXTRA = 360
const OVERSCAN = 10

// Left border accent for instant severity scanning
const LEVEL_BORDER: Record<string, string> = {
  FATAL: 'border-l-4 border-l-red-600',
  ERROR: 'border-l-4 border-l-red-400',
  WARN:  'border-l-4 border-l-amber-400',
  INFO:  'border-l-4 border-l-transparent',
  DEBUG: 'border-l-4 border-l-transparent',
  VERBOSE: 'border-l-4 border-l-transparent',
}

const LEVEL_BADGE: Record<string, string> = {
  FATAL: 'bg-red-700 text-white',
  ERROR: 'bg-red-100 text-red-700',
  WARN: 'bg-amber-100 text-amber-700',
  INFO: 'bg-blue-50 text-blue-600',
  DEBUG: 'bg-slate-100 text-slate-500',
  VERBOSE: 'bg-slate-50 text-slate-400',
}

const LEVEL_ROW: Record<string, string> = {
  FATAL: 'bg-red-50 border-red-200',
  ERROR: 'bg-red-50/40',
  WARN: 'bg-amber-50/40',
  INFO: '',
  DEBUG: '',
  VERBOSE: '',
}

function fmtTime(d: Date | null) {
  if (!d) return '—'
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

export default function LogList({ entries, onThreadSelect }: Props) {
  const [expanded, setExpanded] = useState<Set<number>>(new Set())
  const containerRef = useRef<HTMLDivElement>(null)
  const [scrollTop, setScrollTop] = useState(0)
  const [clientH, setClientH] = useState(400)

  useEffect(() => {
    setExpanded(new Set())
  }, [entries])

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const ro = new ResizeObserver(() => setClientH(el.clientHeight))
    ro.observe(el)
    setClientH(el.clientHeight)
    return () => ro.disconnect()
  }, [])

  const toggleExpand = useCallback((id: number) => {
    setExpanded(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  // Calculate row heights including expanded rows
  const rowHeights: number[] = entries.map(e =>
    expanded.has(e.id) ? ROW_H + EXPANDED_EXTRA : ROW_H
  )
  const totalH = rowHeights.reduce((a, b) => a + b, 0)

  // Find visible range
  let accum = 0
  let startIdx = 0
  for (let i = 0; i < rowHeights.length; i++) {
    if (accum + rowHeights[i] > scrollTop - OVERSCAN * ROW_H) { startIdx = i; break }
    accum += rowHeights[i]
  }
  startIdx = Math.max(0, startIdx - OVERSCAN)

  let offsetTop = rowHeights.slice(0, startIdx).reduce((a, b) => a + b, 0)
  const visibleEntries: { entry: LogEntry; top: number }[] = []
  let runningH = offsetTop
  for (let i = startIdx; i < entries.length; i++) {
    if (runningH > scrollTop + clientH + OVERSCAN * ROW_H) break
    visibleEntries.push({ entry: entries[i], top: runningH })
    runningH += rowHeights[i]
  }

  if (entries.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center text-[13px] text-slate-400">
        No log entries match the current filters.
      </div>
    )
  }

  return (
    <div
      ref={containerRef}
      className="flex-1 overflow-auto font-mono text-[11px] bg-white"
      onScroll={e => setScrollTop((e.target as HTMLDivElement).scrollTop)}
    >
      {/* Header */}
      <div className="sticky top-0 z-10 flex items-center bg-slate-100 border-b border-slate-200 px-2 py-1.5 gap-2">
        <span className="w-4 shrink-0" />
        <span className="w-20 text-[12px] font-medium text-slate-500 shrink-0">Time</span>
        <span className="w-16 text-[12px] font-medium text-slate-500 shrink-0">Level</span>
        <span className="w-20 text-[12px] font-medium text-slate-500 shrink-0">Thread</span>
        <span className="flex-1 text-[12px] font-medium text-slate-500">Message</span>
      </div>

      <div className="relative" style={{ height: totalH }}>
        {visibleEntries.map(({ entry: e, top }) => {
          const isExp = expanded.has(e.id)
          const rowBg = LEVEL_ROW[e.level] || ''
          return (
            <div
              key={e.id}
              className={`absolute left-0 right-0 border-b border-slate-100 ${rowBg} ${LEVEL_BORDER[e.level] || ''}`}
              style={{ top }}
            >
              {/* Main row */}
              <div
                className="flex items-center gap-2 px-2 cursor-pointer hover:bg-slate-50/80"
                style={{ height: ROW_H }}
                onClick={() => toggleExpand(e.id)}
              >
                <span className="w-4 shrink-0 text-slate-300">
                  {isExp ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                </span>
                <span className="w-20 text-[12px] text-slate-500 shrink-0 tabular-nums">{fmtTime(e.timestamp)}</span>
                <span className={`w-16 shrink-0 px-2 py-0.5 rounded text-[11px] font-bold text-center ${LEVEL_BADGE[e.level] || ''}`}>
                  {e.level.charAt(0) + e.level.slice(1).toLowerCase()}
                </span>
                <span
                  className="w-20 text-[12px] text-slate-400 shrink-0 truncate cursor-pointer hover:text-blue-500"
                  title={e.thread || '—'}
                  onClick={ev => { ev.stopPropagation(); if (e.thread) onThreadSelect(e.thread) }}
                >
                  {e.thread || '—'}
                </span>
                <span className="flex-1 truncate text-[13px] text-slate-700">{e.message}</span>
                {e.exceptionType && (
                  <span className="shrink-0 ml-2 text-[11px] px-2 py-0.5 rounded bg-orange-100 text-orange-600 font-medium">
                    {e.exceptionType}
                  </span>
                )}
              </div>

              {/* Expanded detail */}
              {isExp && (
                <ExpandedDetail entry={e} onThreadSelect={onThreadSelect} />
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

function ExpandedDetail({ entry: e, onThreadSelect }: { entry: LogEntry; onThreadSelect: (t: string) => void }) {
  const [copied, setCopied] = useState(false)

  function copyStack() {
    navigator.clipboard.writeText(e.stackTrace.join('\n'))
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="px-8 pb-3 pt-2 bg-white border-t border-slate-100 overflow-auto" style={{ maxHeight: EXPANDED_EXTRA - 8 }}>
      <div className="grid grid-cols-2 gap-x-8 gap-y-1 mb-2 text-[12px]">
        {e.logger && <div><span className="text-slate-400">Logger: </span><span className="text-slate-600">{e.logger}</span></div>}
        <div><span className="text-slate-400">Category: </span><span className="text-slate-600 capitalize">{e.category}</span></div>
        {e.thread && (
          <div>
            <span className="text-slate-400">Thread: </span>
            <button onClick={() => onThreadSelect(e.thread)} className="text-blue-500 hover:underline">{e.thread}</button>
          </div>
        )}
        {e.exceptionType && <div><span className="text-slate-400">Exception: </span><span className="text-orange-600 font-medium">{e.exceptionType}</span></div>}
      </div>
      {e.stackTrace.length > 0 && (
        <div className="rounded bg-slate-950 overflow-hidden">
          <div className="flex items-center justify-between px-3 py-1.5 border-b border-slate-800">
            <span className="text-[10px] text-slate-400 tracking-wide">Stack trace</span>
            <button onClick={copyStack} className="flex items-center gap-1 text-[11px] text-slate-400 hover:text-slate-200 transition-colors">
              {copied ? <Check className="h-3 w-3 text-green-400" /> : <Copy className="h-3 w-3" />}
              {copied ? 'Copied' : 'Copy'}
            </button>
          </div>
          <div className="p-2 overflow-auto max-h-32">
            {e.stackTrace.map((line, i) => (
              <div key={i} className="text-[11px] text-slate-300 leading-relaxed whitespace-pre">{line}</div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
