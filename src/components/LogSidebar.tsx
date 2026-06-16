'use client'

import type { LogAnalysis, LogLevel, LogCategory } from '@/lib/logTypes'

interface Props {
  analysis: LogAnalysis
  levelFilter: Set<string>
  categoryFilter: Set<string>
  threadFilter: string | null
  onLevelFilter: (f: Set<string>) => void
  onCategoryFilter: (f: Set<string>) => void
  onThreadFilter: (t: string | null) => void
  onClear: () => void
}

const LEVEL_ORDER: LogLevel[] = ['FATAL', 'ERROR', 'WARN', 'INFO', 'DEBUG', 'VERBOSE']
const LEVEL_COLOR: Record<LogLevel, string> = {
  FATAL: 'bg-red-700 text-white',
  ERROR: 'bg-red-100 text-red-700',
  WARN: 'bg-amber-100 text-amber-700',
  INFO: 'bg-blue-50 text-blue-600',
  DEBUG: 'bg-slate-100 text-slate-500',
  VERBOSE: 'bg-slate-50 text-slate-400',
}

const CATEGORY_LABELS: Record<LogCategory, string> = {
  publishing: 'Publishing',
  search: 'Search / Index',
  jobs: 'Jobs / Scheduler',
  cache: 'Cache',
  security: 'Security',
  pipelines: 'Pipelines',
  media: 'Media',
  xa: 'SXA / XA',
  xconnect: 'xConnect / xDB',
  sync: 'CD/CM Sync',
  general: 'General',
}

function toggle<T>(set: Set<T>, val: T): Set<T> {
  const next = new Set(set)
  if (next.has(val)) next.delete(val)
  else next.add(val)
  return next
}

function SectionHead({ label }: { label: string }) {
  return (
    <div className="px-3 pt-4 pb-1">
      <span className="text-[11px] font-semibold text-slate-400 tracking-wide">{label}</span>
    </div>
  )
}

export default function LogSidebar({
  analysis, levelFilter, categoryFilter, threadFilter,
  onLevelFilter, onCategoryFilter, onThreadFilter,
}: Props) {
  const files = analysis.files
  const topExceptions = analysis.exceptionGroups.slice(0, 8)
  const hotThreads = analysis.hotThreads.filter(t => t.errorCount > 1).slice(0, 6)

  const catEntries = (Object.keys(CATEGORY_LABELS) as LogCategory[])
    .map(cat => ({ cat, count: analysis.categoryBreakdown[cat] ?? 0 }))
    .filter(({ count }) => count > 0)
  const catMax = Math.max(1, ...catEntries.map(e => e.count))

  return (
    <div className="w-56 shrink-0 flex flex-col bg-slate-900 text-slate-300 border-r border-slate-700 overflow-y-auto">

      {/* Files */}
      <SectionHead label="Files" />
      <div className="px-3 flex flex-col gap-0.5">
        {files.map(f => (
          <div key={f.fileName} className="text-[12px] text-slate-400 truncate" title={f.fileName}>
            {f.fileName.split(/[\\/]/).pop()}
            <span className="ml-1 text-[10px] text-slate-600">{f.format}</span>
          </div>
        ))}
      </div>

      {/* Category with relative progress bars */}
      <SectionHead label="Category" />
      <div className="px-3 flex flex-col gap-0.5">
        {catEntries.map(({ cat, count }) => {
          const active = categoryFilter.has(cat)
          const pct = Math.round((count / catMax) * 100)
          return (
            <button
              key={cat}
              onClick={() => onCategoryFilter(toggle(categoryFilter, cat))}
              className={`relative flex items-center justify-between px-2 py-1.5 rounded text-[13px] transition-colors overflow-hidden
                ${active ? 'bg-blue-600 text-white' : 'hover:bg-slate-800'}`}
            >
              {/* Progress bar background */}
              {!active && (
                <span
                  className="absolute left-0 top-0 h-full bg-slate-700/50 rounded"
                  style={{ width: `${pct}%` }}
                />
              )}
              <span className="relative truncate">{CATEGORY_LABELS[cat]}</span>
              <span className="relative tabular-nums ml-1 shrink-0 text-[12px]">{count.toLocaleString()}</span>
            </button>
          )
        })}
      </div>

      {/* Top exceptions */}
      {topExceptions.length > 0 && (
        <>
          <SectionHead label={topExceptions.length === 1 ? 'Top exception' : 'Top exceptions'} />
          <div className="px-3 flex flex-col gap-1">
            {topExceptions.map(eg => (
              <div key={eg.key} className="flex items-start justify-between gap-1 py-0.5">
                <span className="text-[12px] text-orange-300 truncate" title={eg.exceptionType}>
                  {eg.exceptionType}
                </span>
                <span className="shrink-0 text-[11px] text-slate-500 tabular-nums">{eg.count}×</span>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Hot threads — only if any thread has > 1 error */}
      {hotThreads.length > 0 && (
        <>
          <SectionHead label="Hot threads" />
          <div className="px-3 flex flex-col gap-0.5 pb-4">
            {hotThreads.map(({ thread, errorCount }) => (
              <button
                key={thread}
                onClick={() => onThreadFilter(threadFilter === thread ? null : thread)}
                className={`flex items-center justify-between px-2 py-1 rounded text-[13px] transition-colors
                  ${threadFilter === thread ? 'bg-blue-600 text-white' : 'hover:bg-slate-800'}`}
              >
                <span className="truncate text-[12px]">{thread}</span>
                <span className="shrink-0 text-[12px] tabular-nums ml-1 text-red-400">{errorCount}×</span>
              </button>
            ))}
          </div>
        </>
      )}

      <div className="pb-4" />
    </div>
  )
}
