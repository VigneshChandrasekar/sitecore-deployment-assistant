'use client'

import { useMemo, useState } from 'react'
import { X, ChevronRight, ChevronDown, Terminal, Folder, FileText } from 'lucide-react'
import type { ParsedPackage } from '@/lib/types'
import type { RepackageMode } from '@/lib/repackageScriptGenerator'
import { classifyItems } from '@/lib/repackageScriptGenerator'

interface Props {
  pkg:     ParsedPackage
  mode:    RepackageMode
  onClose: () => void
}

export default function RepackageModal({ pkg, mode, onClose }: Props) {
  const { singles, roots, rootChildren, media } = useMemo(
    () => classifyItems(pkg.items),
    [pkg],
  )

  const [excluded, setExcluded] = useState<Set<string>>(new Set())
  const [expanded, setExpanded] = useState<Set<string>>(new Set(roots.map(r => r.path)))

  const toggle = (path: string) =>
    setExcluded(prev => {
      const next = new Set(prev)
      next.has(path) ? next.delete(path) : next.add(path)
      return next
    })

  const toggleRoot = (rootPath: string, childPaths: string[]) => {
    const allPaths = [rootPath, ...childPaths]
    const allExcluded = allPaths.every(p => excluded.has(p))
    setExcluded(prev => {
      const next = new Set(prev)
      if (allExcluded) allPaths.forEach(p => next.delete(p))
      else             allPaths.forEach(p => next.add(p))
      return next
    })
  }

  const toggleExpand = (path: string) =>
    setExpanded(prev => {
      const next = new Set(prev)
      next.has(path) ? next.delete(path) : next.add(path)
      return next
    })

  const totalItems    = singles.length + roots.length + [...rootChildren.values()].flat().length + media.length
  const totalExcluded = excluded.size
  const included      = totalItems - totalExcluded

  const download = async () => {
    const { downloadRepackageScript } = await import('@/lib/repackageScriptGenerator')
    downloadRepackageScript(pkg, mode, excluded)
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="relative w-[580px] max-h-[80vh] flex flex-col rounded-xl bg-slate-900 shadow-2xl border border-slate-700">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-slate-800 border border-slate-700">
              <Terminal className="h-4 w-4 text-slate-300" />
            </div>
            <div>
              <p className="text-sm font-semibold text-white">Re-package Script</p>
              <p className="text-xs text-slate-500 mt-0.5">
                {included} of {totalItems} items included
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-md hover:bg-slate-800 text-slate-500 hover:text-slate-300 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Item list */}
        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-1 dark-scroll">

          {singles.length > 0 && (
            <Group label="Single Items">
              {singles.map(item => (
                <ItemRow
                  key={item.path}
                  label={item.name}
                  path={item.path}
                  checked={!excluded.has(item.path)}
                  onToggle={() => toggle(item.path)}
                  icon={<FileText className="h-3.5 w-3.5 text-slate-500" />}
                />
              ))}
            </Group>
          )}

          {roots.length > 0 && (
            <Group label="Root + Children">
              {roots.map(root => {
                const children    = rootChildren.get(root.id) ?? []
                const isExpanded  = expanded.has(root.path)
                const allExcluded = [root.path, ...children.map(c => c.path)].every(p => excluded.has(p))
                const someExcluded = [root.path, ...children.map(c => c.path)].some(p => excluded.has(p))

                return (
                  <div key={root.path}>
                    <div className="flex items-center gap-2 py-1 px-2 rounded-md hover:bg-slate-800 group">
                      <input
                        type="checkbox"
                        checked={!allExcluded}
                        ref={el => { if (el) el.indeterminate = someExcluded && !allExcluded }}
                        onChange={() => toggleRoot(root.path, children.map(c => c.path))}
                        className="h-3.5 w-3.5 rounded border-slate-600 accent-red-600 shrink-0"
                      />
                      <button
                        onClick={() => toggleExpand(root.path)}
                        className="flex items-center gap-1.5 flex-1 min-w-0 text-left"
                      >
                        {isExpanded
                          ? <ChevronDown  className="h-3.5 w-3.5 text-slate-500 shrink-0" />
                          : <ChevronRight className="h-3.5 w-3.5 text-slate-500 shrink-0" />
                        }
                        <Folder className="h-3.5 w-3.5 text-red-500 shrink-0" />
                        <span className="text-xs font-medium text-slate-200 truncate">{root.name}</span>
                        <span className="text-[10px] text-slate-600 shrink-0 ml-1">{children.length} children</span>
                      </button>
                    </div>

                    {isExpanded && (
                      <div className="ml-7 space-y-0.5">
                        {children.map(child => (
                          <ItemRow
                            key={child.path}
                            label={child.name}
                            path={child.path}
                            checked={!excluded.has(child.path)}
                            onToggle={() => toggle(child.path)}
                            icon={<FileText className="h-3.5 w-3.5 text-slate-600" />}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                )
              })}
            </Group>
          )}

          {media.length > 0 && (
            <Group label="Media Library">
              {media.map(item => (
                <ItemRow
                  key={item.path}
                  label={item.name}
                  path={item.path}
                  checked={!excluded.has(item.path)}
                  onToggle={() => toggle(item.path)}
                  icon={<FileText className="h-3.5 w-3.5 text-emerald-600" />}
                />
              ))}
            </Group>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-5 py-3 border-t border-slate-800 bg-slate-950/60 rounded-b-xl shrink-0">
          <p className="text-xs">
            {totalExcluded > 0
              ? <span className="text-amber-400 font-medium">{totalExcluded} item{totalExcluded !== 1 ? 's' : ''} excluded</span>
              : <span className="text-slate-500">All items included</span>
            }
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-3 py-1.5 rounded-md text-xs font-medium text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={download}
              disabled={included === 0}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-red-600 hover:bg-white hover:text-red-700 text-white text-xs font-medium border border-red-700 hover:border-red-300 transition-all hover:-translate-y-0.5 hover:shadow-md disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:translate-y-0 disabled:hover:shadow-none"
            >
              <Terminal className="h-3.5 w-3.5" />
              Download Script
            </button>
          </div>
        </div>

      </div>
    </div>
  )
}

function Group({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-[10px] font-bold uppercase tracking-widest text-slate-600 px-2 mb-1 mt-3">{label}</p>
      {children}
    </div>
  )
}

function ItemRow({ label, path, checked, onToggle, icon }: {
  label:    string
  path:     string
  checked:  boolean
  onToggle: () => void
  icon:     React.ReactNode
}) {
  return (
    <label className="flex items-center gap-2 py-1 px-2 rounded-md hover:bg-slate-800 cursor-pointer">
      <input
        type="checkbox"
        checked={checked}
        onChange={onToggle}
        className="h-3.5 w-3.5 rounded border-slate-600 accent-red-600 shrink-0"
      />
      {icon}
      <div className="min-w-0 flex-1">
        <span className="text-xs font-medium text-slate-300">{label}</span>
        <p className="text-[10px] text-slate-600 truncate font-mono leading-tight">{path}</p>
      </div>
    </label>
  )
}
