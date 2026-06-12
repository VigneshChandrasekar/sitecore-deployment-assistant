"use client";

import { useState, useMemo, useCallback } from "react";
import TabInfo from "./TabInfo";
import CompareGuideModal from "./CompareGuideModal";
import {
  UploadCloud,
  FileArchive,
  Plus,
  ChevronRight,
  ChevronDown,
  Search,
  X,
  ArrowRight,
  Database,
  Download,
} from "lucide-react";
import type { ParsedPackage } from "@/lib/types";
import {
  diffPackages,
  type PackageDiff,
  type DiffItem,
  type DiffStatus,
} from "@/lib/differ";
import { diffRenderings, isRenderingsField, type RenderingChange } from "@/lib/renderingsDiff";

// ── Status config ─────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<DiffStatus, { label: string; bg: string; text: string; darkBg: string; darkText: string; darkNum: string; dot: string }> = {
  added:     { label: "Added",     bg: "bg-emerald-50",  text: "text-emerald-700", darkBg: "bg-slate-800 border border-emerald-500/40", darkText: "text-emerald-300", darkNum: "text-emerald-300", dot: "bg-emerald-500"  },
  removed:   { label: "Removed",   bg: "bg-red-50",      text: "text-red-700",     darkBg: "bg-slate-800 border border-red-500/40",     darkText: "text-red-300",     darkNum: "text-red-300",     dot: "bg-red-500"      },
  modified:  { label: "Modified",  bg: "bg-amber-50",    text: "text-amber-700",   darkBg: "bg-slate-800 border border-amber-500/40",   darkText: "text-amber-300",   darkNum: "text-amber-300",   dot: "bg-amber-500"    },
  unchanged: { label: "Unchanged", bg: "bg-slate-100",   text: "text-slate-500",   darkBg: "bg-slate-800 border border-slate-600",      darkText: "text-slate-400",   darkNum: "text-slate-300",   dot: "bg-slate-500"    },
};

// ── Tree types ─────────────────────────────────────────────────────────────────

interface TreeNode {
  segment: string;
  fullPath: string;
  diffs: DiffItem[];
  children: TreeNode[];
}

// ── Upload card (dark sidebar) ─────────────────────────────────────────────────

function UploadCard({ label, pkg, loading, onFile, side }: {
  label: string; pkg: ParsedPackage | null; loading: boolean; onFile: (f: File) => void; side: 'A' | 'B';
}) {
  const [drag, setDrag] = useState(false);
  const accent = side === 'A' ? 'border-l-blue-500' : 'border-l-emerald-500';

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault(); setDrag(false);
    const f = e.dataTransfer.files[0]; if (f) onFile(f);
  };

  return (
    <label
      onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
      onDragLeave={() => setDrag(false)}
      onDrop={onDrop}
      className={`flex flex-col items-center justify-center gap-1.5 rounded-lg border border-dashed border-l-2 p-4 cursor-pointer transition-all ${accent}
        ${drag ? "border-red-500 bg-red-500/10" : pkg ? "border-slate-600 bg-slate-800/60" : "border-slate-700 hover:border-slate-500"}
        ${loading ? "pointer-events-none opacity-60" : ""}`}
    >
      <input type="file" accept=".zip" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); }} />
      <div className={`text-[11px] font-semibold ${pkg ? "text-slate-400" : "text-slate-500"}`}>{label}</div>
      {loading ? (
        <div className="h-4 w-4 animate-spin rounded-full border-2 border-slate-700 border-t-slate-400" />
      ) : pkg ? (
        <div className="text-center">
          <div className="flex items-center gap-1.5 justify-center">
            <FileArchive className="h-3.5 w-3.5 text-red-400" />
            <span className="text-xs font-semibold text-white truncate max-w-[140px]">{pkg.metadata.name || "Package"}</span>
          </div>
          <p className="text-[10px] text-slate-500 mt-0.5">{pkg.items.length} items · v{pkg.metadata.version || "—"}</p>
          <p className="text-[10px] text-slate-600 mt-0.5">Click to replace</p>
        </div>
      ) : (
        <div className="text-center">
          <UploadCloud className="h-5 w-5 text-slate-600 mx-auto mb-0.5" />
          <p className="text-[11px] font-medium text-white">Drop .zip here</p>
          <p className="text-[10px] text-slate-600">or click to browse</p>
        </div>
      )}
    </label>
  );
}

// ── Sidebar section wrapper ────────────────────────────────────────────────────

function Section({ label, children, defaultOpen = true }: { label: string; children: React.ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border-b border-slate-800">
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-slate-800/50 transition-colors group"
      >
        <p className="text-[11px] font-semibold text-slate-400 group-hover:text-slate-300">{label}</p>
        <ChevronDown className={`h-3.5 w-3.5 text-slate-500 group-hover:text-slate-300 transition-transform ${open ? '' : '-rotate-90'}`} />
      </button>
      {open && <div className="px-4 pb-4">{children}</div>}
    </div>
  );
}

// ── Diff stat card ─────────────────────────────────────────────────────────────

function StatCard({ status, count }: { status: DiffStatus; count: number }) {
  const cfg = STATUS_CONFIG[status];
  return (
    <div className={`rounded-lg px-2.5 py-2.5 ${cfg.darkBg}`}>
      <p className={`text-2xl font-bold leading-none tabular-nums ${cfg.darkNum}`}>{count}</p>
      <p className={`text-[11px] mt-1 font-medium ${cfg.darkText} opacity-70`}>{cfg.label}</p>
    </div>
  );
}

// ── Unified tree ───────────────────────────────────────────────────────────────

function buildUnifiedTree(diffs: DiffItem[]): Map<string, TreeNode[]> {
  const dbMap = new Map<string, TreeNode[]>();
  for (const diff of diffs) {
    // Canonical path: prefer B (new version), fall back to A (baseline)
    const item = diff.itemB ?? diff.itemA;
    if (!item) continue;
    const db = item.database;
    if (!dbMap.has(db)) dbMap.set(db, []);
    const roots = dbMap.get(db)!;
    const segments = item.path.split('/').filter(Boolean);
    let currentList = roots;
    let pathSoFar = '';
    for (let i = 0; i < segments.length; i++) {
      const seg = segments[i];
      pathSoFar += '/' + seg;
      let node = currentList.find(n => n.segment === seg);
      if (!node) { node = { segment: seg, fullPath: pathSoFar, diffs: [], children: [] }; currentList.push(node); }
      if (i === segments.length - 1) node.diffs.push(diff);
      currentList = node.children;
    }
  }
  return dbMap;
}

// ── Renderings field diff ──────────────────────────────────────────────────────

function RenderingRow({ c }: { c: RenderingChange }) {
  const e = c.entry;
  const old = c.oldEntry;

  const bg      = c.status === 'added'   ? 'bg-emerald-50 border-emerald-200'
                : c.status === 'removed' ? 'bg-red-50 border-red-200'
                :                          'bg-amber-50 border-amber-200';
  const sign    = c.status === 'added' ? '+' : c.status === 'removed' ? '−' : '~';
  const signCls = c.status === 'added'   ? 'text-emerald-600'
                : c.status === 'removed' ? 'text-red-500'
                :                          'text-amber-600';
  const labelCls = c.status === 'modified' ? 'text-slate-500' : 'text-slate-400';

  return (
    <div className={`flex items-start gap-2 rounded-md border px-2.5 py-2 text-xs ${bg}`}>
      <span className={`font-bold shrink-0 w-3 mt-0.5 ${signCls}`}>{sign}</span>
      <div className="min-w-0 flex-1 space-y-1.5">

        {/* Placeholder */}
        {e.placeholder && (
          <div className="flex items-baseline gap-2">
            <span className={`text-[10px] font-semibold uppercase tracking-wide shrink-0 w-20 ${labelCls}`}>Placeholder</span>
            <span className="font-mono text-[11px] font-medium text-slate-800 bg-white/80 border border-slate-200 px-1.5 py-px rounded break-all">
              {e.placeholder}
            </span>
          </div>
        )}

        {/* Component ID */}
        {e.componentId && (
          <div className="flex items-baseline gap-2">
            <span className={`text-[10px] font-semibold uppercase tracking-wide shrink-0 w-20 ${labelCls}`}>Component</span>
            <span className="font-mono text-[11px] text-slate-600 break-all">{e.componentId}</span>
          </div>
        )}

        {/* Datasource */}
        {e.datasource && (
          <div className="flex items-baseline gap-2">
            <span className={`text-[10px] font-semibold uppercase tracking-wide shrink-0 w-20 ${labelCls}`}>Datasource</span>
            <span className="font-mono text-[11px] text-slate-600 break-all">{e.datasource}</span>
          </div>
        )}

        {/* Parameters */}
        {e.params && (
          <div className="flex items-baseline gap-2">
            <span className={`text-[10px] font-semibold uppercase tracking-wide shrink-0 w-20 ${labelCls}`}>Params</span>
            <span className="font-mono text-[11px] text-slate-600 break-all">{e.params}</span>
          </div>
        )}

        {/* Modified — show field-level diffs */}
        {c.status === 'modified' && old && (
          <div className="space-y-1.5 pt-1 border-t border-amber-200 mt-1">
            {old.placeholder !== e.placeholder && (
              <div className="flex items-baseline gap-2">
                <span className="text-[10px] font-semibold uppercase tracking-wide shrink-0 w-20 text-slate-500">Placeholder</span>
                <div className="space-y-0.5">
                  <div className="font-mono text-[11px] text-red-600 line-through">{old.placeholder || '—'}</div>
                  <div className="font-mono text-[11px] text-emerald-700">{e.placeholder || '—'}</div>
                </div>
              </div>
            )}
            {old.datasource !== e.datasource && (
              <div className="flex items-baseline gap-2">
                <span className="text-[10px] font-semibold uppercase tracking-wide shrink-0 w-20 text-slate-500">Datasource</span>
                <div className="space-y-0.5">
                  <div className="font-mono text-[11px] text-red-600 line-through">{old.datasource || '—'}</div>
                  <div className="font-mono text-[11px] text-emerald-700">{e.datasource || '—'}</div>
                </div>
              </div>
            )}
            {old.params !== e.params && (
              <div className="flex items-baseline gap-2">
                <span className="text-[10px] font-semibold uppercase tracking-wide shrink-0 w-20 text-slate-500">Params</span>
                <div className="space-y-0.5">
                  {old.params && <div className="font-mono text-[11px] text-red-600 line-through break-all">{old.params}</div>}
                  {e.params   && <div className="font-mono text-[11px] text-emerald-700 break-all">{e.params}</div>}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function RenderingsDiffCard({ oldXml, newXml }: { oldXml?: string; newXml?: string }) {
  const result = useMemo(
    () => diffRenderings(oldXml ?? '', newXml ?? ''),
    [oldXml, newXml]
  );

  const { changes, added, removed, modified, unchanged } = result;
  const visible = changes.filter(c => c.status !== 'unchanged');
  const baselineTotal = unchanged + removed + modified;
  const newTotal      = unchanged + added  + modified;

  if (added + removed + modified === 0) {
    return (
      <p className="px-3 py-2 text-xs text-slate-400 italic">
        {unchanged} component{unchanged !== 1 ? 's' : ''} — no structural changes detected
      </p>
    );
  }

  return (
    <div className="px-3 py-2 space-y-2">
      {/* Context: baseline → new totals */}
      <div className="flex items-center gap-2 text-[10px] text-slate-500">
        <span className="bg-blue-50 border border-blue-200 text-blue-600 px-1.5 py-0.5 rounded font-semibold">
          Baseline: {baselineTotal} component{baselineTotal !== 1 ? 's' : ''}
        </span>
        <span className="text-slate-300">→</span>
        <span className="bg-emerald-50 border border-emerald-200 text-emerald-600 px-1.5 py-0.5 rounded font-semibold">
          New: {newTotal} component{newTotal !== 1 ? 's' : ''}
        </span>
      </div>
      {/* Change chips */}
      <div className="flex items-center gap-1.5 flex-wrap">
        {added    > 0 && <span className="text-[10px] font-semibold bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded">+{added} added</span>}
        {removed  > 0 && <span className="text-[10px] font-semibold bg-red-100 text-red-700 px-1.5 py-0.5 rounded">−{removed} removed</span>}
        {modified > 0 && <span className="text-[10px] font-semibold bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded">~{modified} modified</span>}
        {unchanged > 0 && <span className="text-[10px] text-slate-400">{unchanged} unchanged</span>}
      </div>
      {/* Per-component rows */}
      <div className="space-y-1">
        {visible.map(c => <RenderingRow key={`${c.uid}-${c.status}`} c={c} />)}
      </div>
    </div>
  );
}

// Sitecore system fields that change on every save — not meaningful for deployment diffs.
const IGNORED_FIELDS = new Set([
  '__revision', '__updated', '__updated by',
  '__created', '__created by',
]);

function visibleChanges(changes: DiffItem['changes']) {
  return changes.filter(c => !IGNORED_FIELDS.has(c.key.toLowerCase()));
}

function FieldChangeCard({ change }: { change: DiffItem['changes'][number] }) {
  const [open, setOpen] = useState(true);
  const isRenderings = isRenderingsField(change.key);

  return (
    <div className="rounded-lg border border-slate-100 bg-white overflow-hidden text-xs shadow-sm">
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center gap-2 px-3 py-1.5 bg-slate-50 border-b border-slate-100 hover:bg-slate-100 transition-colors text-left"
      >
        <span className="font-semibold text-slate-700">{change.key}</span>
        {change.type && change.type !== 'System' && (
          <span className="text-[10px] text-slate-400 bg-white border border-slate-200 px-1.5 py-px rounded">{change.type}</span>
        )}
        {isRenderings && (
          <span className="text-[10px] text-blue-500 bg-blue-50 border border-blue-200 px-1.5 py-px rounded">component diff</span>
        )}
        <ChevronDown className={`ml-auto h-3 w-3 text-slate-400 shrink-0 transition-transform ${open ? '' : '-rotate-90'}`} />
      </button>

      {open && (isRenderings ? (
        <RenderingsDiffCard oldXml={change.oldValue} newXml={change.newValue} />
      ) : (
        <div className="px-3 py-2 space-y-1.5">
          {change.oldValue !== undefined && (
            <div className="flex items-start gap-2">
              <span className="text-red-500 font-bold w-3 shrink-0 mt-0.5">−</span>
              <span className="font-mono text-red-700 bg-red-50 rounded px-1.5 py-0.5 break-all leading-relaxed flex-1">
                {change.oldValue || <em className="not-italic text-slate-400">empty</em>}
              </span>
            </div>
          )}
          {change.newValue !== undefined && (
            <div className="flex items-start gap-2">
              <span className="text-emerald-600 font-bold w-3 shrink-0 mt-0.5">+</span>
              <span className="font-mono text-emerald-700 bg-emerald-50 rounded px-1.5 py-0.5 break-all leading-relaxed flex-1">
                {change.newValue || <em className="not-italic text-slate-400">empty</em>}
              </span>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// Each row renders both the Baseline (A) and New Version (B) cell side-by-side.
// Ghost cells (where the item doesn't exist on that side) render dimmed with a colored badge.
function UnifiedItemRow({ diff, depth }: { diff: DiffItem; depth: number }) {
  const [open, setOpen] = useState(false);
  const changes = visibleChanges(diff.changes);
  const canExpand = diff.status === 'modified' && changes.length > 0;

  const isGhostA = diff.status === 'added';    // not in baseline
  const isGhostB = diff.status === 'removed';  // not in new version
  const itemA = (diff.itemA ?? diff.itemB)!;
  const itemB = (diff.itemB ?? diff.itemA)!;

  const pl = `${8 + depth * 16}px`;

  const rowBgA = isGhostA      ? ''
               : diff.status === 'removed'  ? 'bg-red-50/50'
               : diff.status === 'modified' ? 'bg-amber-50/50'
               : '';
  const rowBgB = isGhostB      ? ''
               : diff.status === 'added'    ? 'bg-emerald-50/50'
               : diff.status === 'modified' ? 'bg-amber-50/50'
               : '';

  return (
    <div>
      {/* Main row: two cells divided by a hairline */}
      <div
        onClick={() => canExpand && setOpen(v => !v)}
        className={`group flex items-stretch ${canExpand ? 'cursor-pointer' : ''}`}
      >
        {/* ── Baseline cell (A) ── */}
        <div
          style={{ paddingLeft: pl }}
          className={`flex-1 min-w-0 flex items-center gap-2 py-[3px] pr-2 transition-colors ${rowBgA} ${isGhostA ? 'opacity-40' : ''} ${canExpand && !isGhostA ? 'hover:bg-amber-50' : ''}`}
        >
          <span className="w-4 shrink-0 flex items-center justify-center">
            {canExpand && !isGhostA && (open
              ? <ChevronDown  className="h-3.5 w-3.5 text-amber-500" />
              : <ChevronRight className="h-3.5 w-3.5 text-amber-400" />
            )}
          </span>
          <span className={`flex-1 text-[12px] font-medium truncate ${diff.status === 'removed' ? 'line-through text-slate-400' : isGhostA ? 'text-slate-400' : 'text-slate-800'}`}>
            {itemA.name}
          </span>
          {isGhostA ? (
            /* Item only in new version — badge on baseline side uses emerald (B's color) */
            <span className="shrink-0 text-[9px] font-semibold bg-emerald-50 text-emerald-600 border border-emerald-200 rounded px-1 py-px">In new</span>
          ) : diff.status === 'removed' ? (
            <span className="shrink-0 text-[10px] font-semibold px-1.5 py-0.5 rounded bg-red-100 text-red-700">Removed</span>
          ) : diff.status === 'modified' && changes.length > 0 ? (
            <span className="shrink-0 text-[10px] font-semibold px-1.5 py-0.5 rounded bg-amber-100 text-amber-700">
              {changes.length} field{changes.length !== 1 ? 's' : ''}
            </span>
          ) : null}
        </div>

        {/* Hairline divider */}
        <div className="w-px bg-slate-100 shrink-0 self-stretch" />

        {/* ── New Version cell (B) ── */}
        <div
          style={{ paddingLeft: pl }}
          className={`flex-1 min-w-0 flex items-center gap-2 py-[3px] pr-3 transition-colors ${rowBgB} ${isGhostB ? 'opacity-40' : ''} ${canExpand && !isGhostB ? 'hover:bg-amber-50' : ''}`}
        >
          <span className="w-4 shrink-0" />
          <span className={`flex-1 text-[12px] font-medium truncate ${isGhostB ? 'text-slate-400' : 'text-slate-800'}`}>
            {itemB.name}
          </span>
          {isGhostB ? (
            /* Item only in baseline — badge on new version side uses blue (A's color) */
            <span className="shrink-0 text-[9px] font-semibold bg-blue-50 text-blue-600 border border-blue-200 rounded px-1 py-px">In baseline</span>
          ) : diff.status === 'added' ? (
            <span className="shrink-0 text-[10px] font-semibold px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700">Added</span>
          ) : diff.status === 'modified' && changes.length > 0 ? (
            <span className="shrink-0 text-[10px] font-semibold px-1.5 py-0.5 rounded bg-amber-100 text-amber-700">
              {changes.length} field{changes.length !== 1 ? 's' : ''}
            </span>
          ) : null}
        </div>
      </div>

      {/* Field changes — individually collapsible cards */}
      {open && changes.length > 0 && (
        <div style={{ paddingLeft: `${8 + depth * 16 + 20}px`, paddingRight: '16px' }} className="pb-2 pt-1 space-y-1.5">
          {changes.map((change, i) => (
            <FieldChangeCard key={i} change={change} />
          ))}
        </div>
      )}
    </div>
  );
}

function UnifiedTreeNode({ node, depth }: { node: TreeNode; depth: number }) {
  const [open, setOpen] = useState(true);
  const hasChildren = node.children.length > 0;
  const pl = `${8 + depth * 16}px`;

  return (
    <div>
      {/* Virtual folder row — path segment with no direct items */}
      {node.diffs.length === 0 && (
        <div
          onClick={() => hasChildren && setOpen(v => !v)}
          className={`flex items-stretch ${hasChildren ? 'cursor-pointer' : ''} group`}
        >
          <div style={{ paddingLeft: pl }} className="flex-1 flex items-center gap-1.5 py-[3px] pr-2 hover:bg-slate-50 transition-colors">
            <span className="w-4 shrink-0 flex items-center justify-center">
              {hasChildren && (open
                ? <ChevronDown  className="h-3.5 w-3.5 text-slate-300" />
                : <ChevronRight className="h-3.5 w-3.5 text-slate-300" />
              )}
            </span>
            <span className="text-[12px] text-slate-500 font-medium">{node.segment}</span>
          </div>
          <div className="w-px bg-slate-100 shrink-0 self-stretch" />
          <div style={{ paddingLeft: pl }} className="flex-1 flex items-center gap-1.5 py-[3px] pr-3 hover:bg-slate-50 transition-colors">
            <span className="w-4 shrink-0" />
            <span className="text-[12px] text-slate-500 font-medium">{node.segment}</span>
          </div>
        </div>
      )}

      {/* Item rows */}
      {node.diffs.map(d => <UnifiedItemRow key={d.id} diff={d} depth={depth} />)}

      {/* Children */}
      {open && hasChildren && (
        <div className="relative">
          <div
            className="absolute top-0 bottom-0 w-px bg-slate-100"
            style={{ left: `${8 + depth * 16 + 10}px` }}
          />
          {node.children.map(child => (
            <UnifiedTreeNode key={child.fullPath} node={child} depth={depth + 1} />
          ))}
        </div>
      )}
    </div>
  );
}

// Single scrollable view with sticky column headers — guarantees perfect vertical alignment
function UnifiedDiffView({ diffs, pkgAName, pkgBName, tree, sortedDbs }: {
  diffs: DiffItem[];
  pkgAName: string;
  pkgBName: string;
  tree: Map<string, TreeNode[]>;
  sortedDbs: string[];
}) {
  const aCount = diffs.filter(d => d.status !== 'added').length;
  const bCount = diffs.filter(d => d.status !== 'removed').length;

  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
      {/* Column headers */}
      <div className="shrink-0 flex border-b border-slate-200 bg-white shadow-sm">
        <div className="flex-1 min-w-0 px-4 py-2.5 border-l-2 border-l-blue-200 bg-slate-50">
          <p className="text-xs font-bold text-slate-700">Baseline</p>
          <p className="text-[11px] text-slate-400 mt-0.5 truncate">{pkgAName || '—'} · {aCount} items</p>
        </div>
        <div className="w-px bg-slate-200 shrink-0" />
        <div className="flex-1 min-w-0 px-4 py-2.5 border-l-2 border-l-emerald-200 bg-slate-50">
          <p className="text-xs font-bold text-slate-700">New version</p>
          <p className="text-[11px] text-slate-400 mt-0.5 truncate">{pkgBName || '—'} · {bCount} items</p>
        </div>
      </div>

      {/* Legend */}
      <div className="shrink-0 flex items-center gap-5 px-4 py-1.5 bg-white border-b border-slate-100 text-[10px] text-slate-400">
        <span className="flex items-center gap-1.5">
          <span className="inline-block opacity-50 px-1.5 py-px rounded bg-emerald-50 text-emerald-600 text-[9px] font-semibold border border-emerald-200">In new</span>
          exists only in new version
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block opacity-50 px-1.5 py-px rounded bg-blue-50 text-blue-600 text-[9px] font-semibold border border-blue-200">In baseline</span>
          exists only in baseline
        </span>
      </div>

      {/* Unified scrollable tree */}
      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-3">
        {sortedDbs.length === 0 ? (
          <p className="text-sm text-slate-400 text-center mt-10">Nothing to show.</p>
        ) : sortedDbs.map(db => {
          const nodes = tree.get(db) ?? [];
          const dbChangedCount = diffs.filter(d => (d.itemB ?? d.itemA)?.database === db && d.status !== 'unchanged').length;
          return (
            <div key={db} className="rounded-xl border border-slate-200 overflow-hidden shadow-sm">
              {/* DB header spans full width */}
              <div className="flex items-center gap-2.5 px-4 py-2.5 bg-slate-800 border-b border-slate-700">
                <Database className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                <span className="text-sm font-semibold text-white capitalize">{db}</span>
                {dbChangedCount > 0 && (
                  <span className="ml-auto text-[10px] text-slate-400 tabular-nums">{dbChangedCount} changed</span>
                )}
              </div>
              <div className="bg-white">
                {nodes.map(node => <UnifiedTreeNode key={node.fullPath} node={node} depth={0} />)}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Main ───────────────────────────────────────────────────────────────────────

const DB_ORDER = ["master", "core", "web"];

export default function CompareView() {
  const [pkgA, setPkgA] = useState<ParsedPackage | null>(null);
  const [pkgB, setPkgB] = useState<ParsedPackage | null>(null);
  const [loadingA, setLoadingA] = useState(false);
  const [loadingB, setLoadingB] = useState(false);
  const [search, setSearch] = useState("");
  const [guideOpen, setGuideOpen] = useState(false);

  const load = useCallback(async (file: File, setLoading: (v: boolean) => void, setPkg: (p: ParsedPackage) => void) => {
    setLoading(true);
    try { const { parsePackage } = await import("@/lib/parser"); const buf = await file.arrayBuffer(); setPkg(await parsePackage(buf)); }
    finally { setLoading(false); }
  }, []);

  const diff = useMemo<PackageDiff | null>(() => {
    if (!pkgA || !pkgB) return null;
    return diffPackages(pkgA.items, pkgB.items);
  }, [pkgA, pkgB]);

  const filtered = useMemo(() => {
    if (!diff) return [];
    let items = diff.items;
    if (search.trim()) {
      const q = search.toLowerCase();
      items = items.filter(d => { const item = d.itemB ?? d.itemA!; return item.name.toLowerCase().includes(q) || item.path.toLowerCase().includes(q); });
    }
    return items;
  }, [diff, search]);

  const unifiedTree = useMemo(() => buildUnifiedTree(filtered), [filtered]);

  const sortedDbs = useMemo(() => {
    const dbs = Array.from(unifiedTree.keys());
    return [...DB_ORDER.filter(d => dbs.includes(d)), ...dbs.filter(d => !DB_ORDER.includes(d))];
  }, [unifiedTree]);

  return (
    <div className="flex flex-col flex-1 min-h-0 overflow-hidden gap-y-1.5">

      <TabInfo
        title="Package Compare"
        what="Diff two Sitecore packages side-by-side to see exactly what changed between versions — items added, removed, modified, or unchanged."
        onGuide={() => setGuideOpen(true)}
      />

      <div className="flex flex-1 overflow-hidden min-h-0">

        {/* Sidebar */}
        <aside className="w-[320px] shrink-0 min-h-0 bg-slate-900 border-r border-slate-800 overflow-y-auto">
          <div className="flex flex-col gap-0">

            <div className="p-4 border-b border-slate-800 space-y-2.5">
              <UploadCard label="Package A — Baseline" pkg={pkgA} loading={loadingA} onFile={f => load(f, setLoadingA, setPkgA)} side="A" />
              <div className="flex items-center justify-center gap-2">
                <div className="flex-1 h-px bg-slate-800" />
                <ArrowRight className="h-3.5 w-3.5 text-slate-600" />
                <div className="flex-1 h-px bg-slate-800" />
              </div>
              <UploadCard label="Package B — New Version" pkg={pkgB} loading={loadingB} onFile={f => load(f, setLoadingB, setPkgB)} side="B" />
            </div>

            {diff && (
              <Section label="Actions">
                <button
                  onClick={async () => {
                    const { exportDiffToExcel } = await import("@/lib/exporter");
                    exportDiffToExcel(diff);
                  }}
                  className="w-full flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium border bg-transparent text-slate-300 border-slate-600 hover:bg-white hover:text-slate-800 hover:border-white transition-colors"
                >
                  <Download className="h-3.5 w-3.5" />
                  Export Diff
                </button>
              </Section>
            )}

            {diff && (
              <Section label="Summary">
                <div className="grid grid-cols-2 gap-2">
                  {(["added", "removed", "modified", "unchanged"] as DiffStatus[]).map(s => (
                    <StatCard key={s} status={s} count={diff.stats[s]} />
                  ))}
                </div>
              </Section>
            )}

          </div>
        </aside>

        {/* Main */}
        <main className="flex-1 min-w-0 overflow-hidden flex flex-col bg-slate-50">
          {!pkgA || !pkgB ? (
            <div className="flex flex-col items-center justify-center flex-1 gap-5">
              <div className="flex items-center gap-4">
                <div className={`flex items-center justify-center w-16 h-16 rounded-2xl border-2 border-dashed ${pkgA ? "border-red-300 bg-red-50" : "border-slate-200 bg-white"}`}>
                  {pkgA ? <FileArchive className="h-7 w-7 text-red-400" /> : <Plus className="h-7 w-7 text-slate-300" />}
                </div>
                <ArrowRight className="h-5 w-5 text-slate-300" />
                <div className={`flex items-center justify-center w-16 h-16 rounded-2xl border-2 border-dashed ${pkgB ? "border-red-300 bg-red-50" : "border-slate-200 bg-white"}`}>
                  {pkgB ? <FileArchive className="h-7 w-7 text-red-400" /> : <Plus className="h-7 w-7 text-slate-300" />}
                </div>
              </div>
              <div className="text-center">
                <p className="text-base font-semibold text-slate-600">Upload both packages</p>
                <p className="text-sm text-slate-400 mt-1">Drop Package A and Package B in the sidebar to see the diff</p>
              </div>
            </div>
          ) : (
            <>
              {/* Search bar */}
              <div className="shrink-0 flex items-center gap-3 px-5 py-2.5 border-b border-slate-200 bg-white">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400 pointer-events-none" />
                  <input
                    type="text"
                    placeholder="Filter by name or path…"
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 bg-slate-50 pl-9 pr-8 py-1.5 text-sm text-slate-800 placeholder-slate-400
                      focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-400 focus:bg-white transition-colors"
                  />
                  {search && (
                    <button onClick={() => setSearch("")} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              </div>

              <UnifiedDiffView
                diffs={filtered}
                pkgAName={pkgA?.metadata.name ?? ''}
                pkgBName={pkgB?.metadata.name ?? ''}
                tree={unifiedTree}
                sortedDbs={sortedDbs}
              />
            </>
          )}
        </main>
      </div>

      {guideOpen && <CompareGuideModal onClose={() => setGuideOpen(false)} />}
    </div>
  );
}
