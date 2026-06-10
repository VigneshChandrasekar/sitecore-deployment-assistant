'use client'

import { useState, useMemo, useCallback } from 'react'
import {
  ChevronRight, ChevronDown, Search, X, Database,
  LayoutTemplate, Component, Layout, Image, Settings,
  FileText, File, FolderOpen, Folder,
} from 'lucide-react'
import type { ParsedPackage, SitecoreItem, ItemType } from '@/lib/types'
import { buildDatabaseTrees, type TreeNode } from '@/lib/tree'
import DeployBadge from './DeployBadge'

const DB_ORDER = ['master', 'core', 'web']

// ── Type icon + color ─────────────────────────────────────────────────────────

const TYPE_META: Record<ItemType, { icon: React.ElementType; color: string; bg: string }> = {
  'Template':         { icon: LayoutTemplate, color: 'text-violet-600', bg: 'bg-violet-50' },
  'Template Field':   { icon: LayoutTemplate, color: 'text-violet-400', bg: 'bg-violet-50' },
  'Template Section': { icon: LayoutTemplate, color: 'text-purple-500', bg: 'bg-purple-50' },
  'Rendering':        { icon: Component,      color: 'text-blue-600',   bg: 'bg-blue-50'   },
  'Layout':           { icon: Layout,         color: 'text-sky-600',    bg: 'bg-sky-50'    },
  'Placeholder':      { icon: Layout,         color: 'text-cyan-600',   bg: 'bg-cyan-50'   },
  'Media':            { icon: Image,          color: 'text-emerald-600',bg: 'bg-emerald-50'},
  'Setting':          { icon: Settings,       color: 'text-amber-600',  bg: 'bg-amber-50'  },
  'Content':          { icon: FileText,       color: 'text-slate-600',  bg: 'bg-slate-50'  },
  'Unknown':          { icon: File,           color: 'text-slate-400',  bg: 'bg-slate-50'  },
}

function ItemIcon({ type }: { type: ItemType }) {
  const meta = TYPE_META[type] ?? TYPE_META['Unknown']
  const Icon = meta.icon
  return (
    <span className={`inline-flex items-center justify-center w-5 h-5 rounded ${meta.bg} shrink-0`}>
      <Icon className={`h-3 w-3 ${meta.color}`} strokeWidth={2} />
    </span>
  )
}

// ── Item detail panel ─────────────────────────────────────────────────────────

function ItemDetail({ item, onClose }: { item: SitecoreItem; onClose: () => void }) {
  return (
    <div className="border-l border-slate-200 w-80 shrink-0 flex flex-col overflow-hidden bg-white">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-100">
        <ItemIcon type={item.itemType} />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-slate-800 truncate">{item.name}</p>
          <p className="text-[10px] text-slate-400 uppercase tracking-wide">{item.itemType}</p>
        </div>
        <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors">
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {/* Attributes */}
        <div className="px-4 py-3 border-b border-slate-100">
          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2">Attributes</p>
          <dl className="space-y-1.5">
            <Attr label="id" value={item.id} mono />
            {item.key && <Attr label="key" value={item.key} mono />}
            <Attr label="path" value={item.path} mono />
            {item.templateName && <Attr label="template" value={item.templateName} />}
            {item.templateId && <Attr label="tid" value={item.templateId} mono />}
            {item.parentId && <Attr label="parentid" value={item.parentId} mono />}
            {item.sortOrder && <Attr label="sortorder" value={item.sortOrder} />}
            <Attr label="language" value={item.language} />
            <Attr label="version" value={String(item.version)} />
            <div className="flex gap-2 items-center pt-0.5">
              <dt className="text-[11px] text-slate-400 w-20 shrink-0">deploy</dt>
              <DeployBadge mode={item.deployMode} />
            </div>
          </dl>
        </div>

        {/* Fields */}
        {item.fields.length > 0 && (
          <div className="px-4 py-3">
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2">
              Fields ({item.fields.length})
            </p>
            <div className="space-y-3">
              {item.fields.map((f, i) => (
                <div key={f.tfid || i}>
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-xs font-semibold text-slate-700">{f.key}</span>
                    {f.type && <span className="text-[10px] text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">{f.type}</span>}
                  </div>
                  {f.value ? (
                    <p className="text-[11px] font-mono text-slate-600 break-all bg-slate-50 rounded px-2 py-1 leading-relaxed">
                      {f.value}
                    </p>
                  ) : (
                    <p className="text-[11px] text-slate-300 italic">empty</p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function Attr({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex gap-2 items-start">
      <dt className="text-[11px] text-slate-400 w-20 shrink-0 pt-0.5">{label}</dt>
      <dd className={`text-[11px] break-all text-slate-700 leading-relaxed ${mono ? 'font-mono' : ''}`}>{value || '—'}</dd>
    </div>
  )
}

// ── Tree node ─────────────────────────────────────────────────────────────────

interface TreeNodeProps {
  node: TreeNode
  depth: number
  selectedId: string | null
  onSelect: (item: SitecoreItem) => void
  defaultExpanded?: boolean
}

function TreeNodeView({ node, depth, selectedId, onSelect, defaultExpanded = false }: TreeNodeProps) {
  const [open, setOpen] = useState(defaultExpanded)
  const hasChildren = node.children.length > 0
  const isItem = node.item !== null
  const isSelected = isItem && selectedId === node.item!.id

  const indent = depth * 16

  return (
    <div>
      <div
        role="button"
        onClick={() => {
          if (hasChildren) setOpen((v) => !v)
          if (isItem) onSelect(node.item!)
        }}
        className={`group flex items-center gap-1.5 py-1 pr-3 rounded-md cursor-pointer select-none transition-colors
          ${isSelected ? 'bg-blue-50 text-blue-700' : 'hover:bg-slate-100 text-slate-800'}`}
        style={{ paddingLeft: `${8 + indent}px` }}
      >
        {/* Expand arrow */}
        <span className="w-4 h-4 flex items-center justify-center shrink-0">
          {hasChildren ? (
            open
              ? <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
              : <ChevronRight className="h-3.5 w-3.5 text-slate-400" />
          ) : null}
        </span>

        {/* Icon */}
        {isItem ? (
          <ItemIcon type={node.item!.itemType} />
        ) : (
          <span className="w-5 h-5 flex items-center justify-center shrink-0">
            {open
              ? <FolderOpen className="h-3.5 w-3.5 text-slate-400" />
              : <Folder className="h-3.5 w-3.5 text-slate-400" />}
          </span>
        )}

        {/* Name */}
        <span className={`text-sm truncate flex-1 ${isItem ? 'font-medium' : 'text-slate-500'}`}>
          {node.name}
        </span>

        {/* Deploy badge — only on package items, shown on hover or selected */}
        {isItem && (
          <span className={`shrink-0 transition-opacity ${isSelected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
            <DeployBadge mode={node.item!.deployMode} />
          </span>
        )}

        {/* Child count on virtual nodes */}
        {!isItem && hasChildren && (
          <span className="text-[10px] text-slate-400 shrink-0">{countItems(node)}</span>
        )}
      </div>

      {open && hasChildren && (
        <div className="relative">
          {/* Tree connector line */}
          <div
            className="absolute top-0 bottom-0 w-px bg-slate-200"
            style={{ left: `${8 + indent + 10}px` }}
          />
          {node.children.map((child) => (
            <TreeNodeView
              key={child.fullPath}
              node={child}
              depth={depth + 1}
              selectedId={selectedId}
              onSelect={onSelect}
              defaultExpanded={child.item !== null && child.children.length > 0}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function countItems(node: TreeNode): number {
  let count = node.item ? 1 : 0
  for (const child of node.children) count += countItems(child)
  return count
}

// ── Main component ────────────────────────────────────────────────────────────

export default function ItemTree({ pkg }: { pkg: ParsedPackage }) {
  const [search, setSearch] = useState('')
  const [selectedItem, setSelectedItem] = useState<SitecoreItem | null>(null)

  const dbTrees = useMemo(() => buildDatabaseTrees(pkg.items), [pkg.items])

  // Filter items by search, rebuild filtered tree
  const filtered = useMemo(() => {
    if (!search.trim()) return dbTrees
    const q = search.toLowerCase()
    const matchingItems = pkg.items.filter(
      (i) =>
        i.name.toLowerCase().includes(q) ||
        i.path.toLowerCase().includes(q) ||
        i.id.toLowerCase().includes(q)
    )
    return buildDatabaseTrees(matchingItems)
  }, [dbTrees, pkg.items, search])

  const sortedDbs = useMemo(() => {
    const dbs = Array.from(filtered.keys())
    return [...DB_ORDER.filter((d) => dbs.includes(d)), ...dbs.filter((d) => !DB_ORDER.includes(d))]
  }, [filtered])

  const handleSelect = useCallback((item: SitecoreItem) => {
    setSelectedItem((prev) => (prev?.id === item.id ? null : item))
  }, [])

  if (pkg.items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3 text-slate-400">
        <Component className="h-10 w-10 text-slate-200" />
        <p className="text-sm">No items found in this package.</p>
      </div>
    )
  }

  return (
    <div className="flex flex-1 overflow-hidden">
      {/* Tree panel */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Search */}
        <div className="shrink-0 px-4 py-3 border-b border-slate-200 bg-white">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400 pointer-events-none" />
            <input
              type="text"
              placeholder="Filter by name, path or ID…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-slate-50 pl-9 pr-8 py-2 text-sm text-slate-800 placeholder-slate-400
                focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-400 focus:bg-white transition-colors"
            />
            {search && (
              <button onClick={() => setSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Tree */}
        <div className="flex-1 overflow-y-auto px-3 py-3 space-y-3">
          {sortedDbs.length === 0 ? (
            <p className="text-sm text-slate-400 text-center mt-10">No items match your filter.</p>
          ) : (
            sortedDbs.map((db) => {
              const roots = filtered.get(db) ?? []
              const totalItems = pkg.items.filter((i) => i.database === db).length

              return (
                <div key={db} className="rounded-xl border border-slate-200 overflow-hidden shadow-sm">
                  {/* DB header */}
                  <div className="flex items-center gap-2.5 px-4 py-2.5 bg-slate-800">
                    <Database className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                    <span className="text-sm font-semibold text-white capitalize tracking-wide">{db}</span>
                    <span className="ml-auto text-xs text-slate-400 font-medium">{totalItems} items</span>
                  </div>

                  {/* Tree nodes */}
                  <div className="bg-white px-2 py-2">
                    {roots.map((node) => (
                      <TreeNodeView
                        key={node.fullPath}
                        node={node}
                        depth={0}
                        selectedId={selectedItem?.id ?? null}
                        onSelect={handleSelect}
                        defaultExpanded={true}
                      />
                    ))}
                  </div>
                </div>
              )
            })
          )}
        </div>
      </div>

      {/* Detail panel */}
      {selectedItem && (
        <ItemDetail item={selectedItem} onClose={() => setSelectedItem(null)} />
      )}
    </div>
  )
}
