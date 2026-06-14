"use client";

import { useState, useMemo, useCallback } from "react";
import {
  Layers,
  ChevronLeft,
  ChevronRight,
  AlertTriangle,
  GitMerge,
  ChevronDown,
} from "lucide-react";
import TabInfo from "@/components/TabInfo";
import MergeUploadPanel from "@/components/MergeUploadPanel";
import ItemTree from "@/components/ItemTree";
import RepackageModal from "@/components/RepackageModal";
import type { ParsedPackage } from "@/lib/types";
import {
  mergePackages,
  sortItemsByFolderOrder,
  type ConflictItem,
} from "@/lib/merger";

interface PackageEntry {
  pkg: ParsedPackage;
  name: string;
}

const PER_PAGE = 2;
type MainTab = "packages" | "conflicts" | "merged";

export default function PackageMergePage() {
  const [packages, setPackages] = useState<PackageEntry[]>([]);
  const [page, setPage] = useState(0);
  const [activeTab, setActiveTab] = useState<MainTab>("packages");

  const onAdd = useCallback((pkg: ParsedPackage, name: string) => {
    setPackages((prev) => {
      const next = [...prev, { pkg, name }];
      setPage(Math.floor((next.length - 1) / PER_PAGE));
      return next;
    });
  }, []);

  const onRemove = useCallback((index: number) => {
    setPackages((prev) => {
      const next = prev.filter((_, i) => i !== index);
      const maxPage = Math.max(0, Math.ceil(next.length / PER_PAGE) - 1);
      setPage((p) => Math.min(p, maxPage));
      return next;
    });
  }, []);

  const onReorder = useCallback((from: number, to: number) => {
    setPackages((prev) => {
      const next = [...prev];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      return next;
    });
  }, []);

  const [folderOrder, setFolderOrder] = useState<Map<string, string[]>>(
    new Map(),
  );
  const [showRepackageModal, setShowRepackageModal] = useState(false);

  const handleFolderReorder = useCallback(
    (parentPath: string, orderedNames: string[]) => {
      setFolderOrder((prev) => {
        const next = new Map(prev);
        next.set(parentPath, orderedNames);
        return next;
      });
    },
    [],
  );

  const mergeResult = useMemo(() => {
    if (packages.length === 0) return null;
    return mergePackages(
      packages.map((p) => p.pkg),
      packages.map((p) => p.name),
    );
  }, [packages]);

  const mergedPkgForScript = useMemo(() => {
    if (!mergeResult) return null;
    const sortedItems = sortItemsByFolderOrder(
      mergeResult.merged.items,
      folderOrder,
    );
    return { ...mergeResult.merged, items: sortedItems };
  }, [mergeResult, folderOrder]);

  const onGenerateScript = useCallback(() => {
    if (!mergedPkgForScript) return;
    setShowRepackageModal(true);
  }, [mergedPkgForScript]);

  const conflictCount = mergeResult?.conflicts.length ?? 0;
  const totalPages = Math.max(1, Math.ceil(packages.length / PER_PAGE));
  const pagePackages = packages.slice(
    page * PER_PAGE,
    page * PER_PAGE + PER_PAGE,
  );

  const tabs: { id: MainTab; label: string; count?: number }[] = [
    { id: "packages", label: "Packages", count: packages.length },
    { id: "conflicts", label: "Conflicts", count: conflictCount },
    { id: "merged", label: "Merged Result" },
  ];

  return (
    <div className="flex flex-col flex-1 min-h-0 overflow-hidden gap-y-1.5">
      <TabInfo
        title="Package Merge"
        what="Upload multiple Sitecore .zip packages and browse them side by side. Combine into one merged result when ready."
      />

      <div className="flex flex-1 overflow-hidden min-h-0">
        {/* Sidebar */}
        <aside className="w-[320px] shrink-0 min-h-0 bg-slate-900 border-r border-slate-800 overflow-y-auto">
          <MergeUploadPanel
            packages={packages}
            onAdd={onAdd}
            onRemove={onRemove}
            onReorder={onReorder}
            conflictCount={conflictCount}
            onExport={onGenerateScript}
          />
        </aside>

        {/* Main */}
        <main className="flex-1 min-w-0 overflow-hidden flex flex-col bg-slate-50">
          {packages.length === 0 ? (
            <EmptyState />
          ) : (
            <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
              {/* Tab bar */}
              <div className="shrink-0 flex items-stretch border-b border-slate-200 bg-white px-4 gap-1">
                {tabs.map((tab) => {
                  const active = activeTab === tab.id;
                  const isConflicts = tab.id === "conflicts";
                  return (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id)}
                      className={`flex items-center gap-1.5 px-3 py-2.5 text-[13px] font-medium border-b-2 transition-colors whitespace-nowrap
                        ${
                          active
                            ? "border-slate-800 text-slate-900"
                            : "border-transparent text-slate-400 hover:text-slate-700 hover:border-slate-300"
                        }`}
                    >
                      {tab.label}
                      {tab.count !== undefined && tab.count > 0 && (
                        <span
                          className={`text-[10px] font-bold px-1.5 py-px rounded-full tabular-nums
                            ${
                              isConflicts
                                ? "bg-amber-100 text-amber-700"
                                : active
                                  ? "bg-slate-900 text-white"
                                  : "bg-slate-100 text-slate-500"
                            }`}
                        >
                          {tab.count}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Tab content */}
              {activeTab === "packages" && (
                <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
                  {/* Install order hint */}
                  <div className="shrink-0 flex items-center gap-2 px-4 py-2 bg-blue-50 border-b border-blue-100 text-[11px] text-blue-700">
                    <span className="font-semibold">Install order:</span>
                    <span>
                      Foundation → Feature → Project → Content. Drag cards in
                      the sidebar to reorder.
                    </span>
                  </div>
                  {/* Carousel header */}
                  <div className="shrink-0 flex items-center justify-between px-4 py-2.5 border-b border-slate-200 bg-white gap-3">
                    <div className="flex items-center gap-2 min-w-0">
                      {pagePackages.map((entry, i) => {
                        const globalIndex = page * PER_PAGE + i;
                        return (
                          <PackageChip
                            key={globalIndex}
                            name={entry.name}
                            count={entry.pkg.items.length}
                            index={globalIndex + 1}
                            showVs={i < pagePackages.length - 1}
                          />
                        );
                      })}
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <span className="text-[11px] text-slate-400 tabular-nums">
                        {page + 1} / {totalPages}
                      </span>
                      <button
                        onClick={() => setPage((p) => p - 1)}
                        disabled={page === 0}
                        className="flex items-center justify-center w-7 h-7 rounded-md border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                      >
                        <ChevronLeft className="h-4 w-4 text-slate-600" />
                      </button>
                      <button
                        onClick={() => setPage((p) => p + 1)}
                        disabled={page >= totalPages - 1}
                        className="flex items-center justify-center w-7 h-7 rounded-md border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                      >
                        <ChevronRight className="h-4 w-4 text-slate-600" />
                      </button>
                    </div>
                  </div>

                  {/* Split panels */}
                  <div className="flex flex-1 min-h-0 overflow-hidden divide-x divide-slate-200">
                    {pagePackages.map((entry, i) => (
                      <div
                        key={page * PER_PAGE + i}
                        className="flex-1 min-w-0 overflow-hidden flex flex-col"
                      >
                        <ItemTree pkg={entry.pkg} />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {activeTab === "conflicts" && (
                <ConflictsPanel
                  conflicts={mergeResult?.conflicts ?? []}
                  packageNames={packages.map((p) => p.name)}
                />
              )}

              {activeTab === "merged" && mergeResult && (
                <div className="flex flex-1 min-h-0 overflow-hidden flex-col">
                  {folderOrder.size > 0 && (
                    <div className="shrink-0 flex items-center gap-2 px-4 py-1.5 bg-blue-50 border-b border-blue-100 text-[11px] text-blue-700">
                      <span className="font-semibold">
                        Custom install order active.
                      </span>
                      <span>
                        Drag folders in the tree to adjust. Export respects this
                        order.
                      </span>
                      <button
                        onClick={() => setFolderOrder(new Map())}
                        className="ml-auto text-[10px] text-blue-500 hover:text-blue-700 underline underline-offset-2"
                      >
                        Reset
                      </button>
                    </div>
                  )}
                  <ItemTree
                    pkg={mergeResult.merged}
                    folderOrder={folderOrder}
                    onFolderReorder={handleFolderReorder}
                  />
                </div>
              )}
            </div>
          )}
        </main>
      </div>

      {showRepackageModal && mergedPkgForScript && (
        <RepackageModal
          pkg={mergedPkgForScript}
          onClose={() => setShowRepackageModal(false)}
        />
      )}
    </div>
  );
}

// ── Conflicts panel ───────────────────────────────────────────────────────────

const CONFLICT_COLORS = [
  { pill: "bg-blue-100 text-blue-700 border-blue-200", dot: "bg-blue-500" },
  {
    pill: "bg-violet-100 text-violet-700 border-violet-200",
    dot: "bg-violet-500",
  },
  {
    pill: "bg-emerald-100 text-emerald-700 border-emerald-200",
    dot: "bg-emerald-500",
  },
  {
    pill: "bg-orange-100 text-orange-700 border-orange-200",
    dot: "bg-orange-500",
  },
  { pill: "bg-pink-100 text-pink-700 border-pink-200", dot: "bg-pink-500" },
];

function parentName(path: string): string {
  const parts = path.split("/").filter(Boolean);
  return parts.length >= 2 ? parts[parts.length - 2] : "";
}

function ConflictRow({
  conflict,
  packageNames,
  allSameDb,
}: {
  conflict: ConflictItem;
  packageNames: string[];
  allSameDb: boolean;
}) {
  const [open, setOpen] = useState(false);

  // Build field-level diff: collect all field keys across all versions
  const allFieldKeys = useMemo(() => {
    const keys = new Set<string>();
    for (const item of conflict.sourceItems) {
      for (const f of item.fields) {
        if (f.key) keys.add(f.key);
      }
    }
    return Array.from(keys).sort();
  }, [conflict.sourceItems]);

  const diffFields = useMemo(() => {
    return allFieldKeys.filter((key) => {
      const vals = conflict.sourceItems.map(
        (item) => item.fields.find((f) => f.key === key)?.value ?? "",
      );
      return vals.some((v) => v !== vals[0]);
    });
  }, [allFieldKeys, conflict.sourceItems]);

  const sameFields = useMemo(() => {
    return allFieldKeys.filter((key) => !diffFields.includes(key));
  }, [allFieldKeys, diffFields]);

  const parent = parentName(conflict.path);

  return (
    <>
      <tr
        onClick={() => setOpen((o) => !o)}
        className="hover:bg-slate-50 transition-colors cursor-pointer select-none"
      >
        <td className="px-5 py-3">
          <div className="flex items-center gap-1.5">
            <ChevronDown
              className={`h-3 w-3 text-slate-400 shrink-0 transition-transform ${open ? "" : "-rotate-90"}`}
            />
            <div className="min-w-0">
              <p className="font-semibold text-slate-800">{conflict.name}</p>
              <p className="font-mono text-[10px] text-slate-400 mt-0.5 truncate max-w-md">
                {parent && (
                  <span className="text-slate-500 not-italic">{parent} / </span>
                )}
                {conflict.path.split("/").pop()}
              </p>
            </div>
          </div>
        </td>
        {!allSameDb && (
          <td className="px-4 py-3">
            <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-100 text-slate-600 capitalize">
              {conflict.database}
            </span>
          </td>
        )}
        <td className="px-4 py-3">
          <div className="flex items-center gap-1.5">
            {conflict.sources.map((pkgIdx, si) => {
              const color = CONFLICT_COLORS[pkgIdx % CONFLICT_COLORS.length];
              return (
                <span
                  key={si}
                  title={packageNames[pkgIdx]}
                  className={`w-5 h-5 rounded-full ${color.dot} text-white flex items-center justify-center text-[9px] font-bold shrink-0`}
                >
                  {pkgIdx + 1}
                </span>
              );
            })}
          </div>
        </td>
        <td className="px-4 py-3 text-[10px] text-slate-400">
          {diffFields.length > 0 ? (
            <span className="text-amber-600 font-semibold">
              {diffFields.length} field{diffFields.length !== 1 ? "s" : ""}{" "}
              differ
            </span>
          ) : (
            <span className="text-slate-400">deploy mode only</span>
          )}
        </td>
      </tr>

      {open && (
        <tr className="bg-slate-50">
          <td colSpan={allSameDb ? 3 : 4} className="px-5 pb-4 pt-1">
            {/* Column headers */}
            <div className="flex gap-2 mb-2 pl-5">
              {conflict.sources.map((pkgIdx, si) => {
                const color = CONFLICT_COLORS[pkgIdx % CONFLICT_COLORS.length];
                return (
                  <div
                    key={si}
                    className={`flex-1 flex items-center gap-1.5 px-2 py-1 rounded-lg border ${color.pill} text-[11px] font-semibold`}
                  >
                    <span
                      className={`w-4 h-4 rounded-full ${color.dot} text-white flex items-center justify-center text-[8px] font-bold shrink-0`}
                    >
                      {pkgIdx + 1}
                    </span>
                    <span className="truncate">{packageNames[pkgIdx]}</span>
                    {si === conflict.sources.length - 1 && (
                      <span className="ml-auto text-[9px] font-bold uppercase tracking-wider opacity-60">
                        wins
                      </span>
                    )}
                  </div>
                );
              })}
            </div>

            {diffFields.length === 0 ? (
              <p className="pl-5 text-[11px] text-slate-400 italic">
                Field values are identical — only deploy mode or metadata may
                differ.
              </p>
            ) : (
              <div className="rounded-lg border border-slate-200 overflow-hidden">
                <table className="w-full text-[11px]">
                  <tbody>
                    {diffFields.map((key) => (
                      <tr
                        key={key}
                        className="border-b border-slate-100 last:border-0 bg-amber-50/60"
                      >
                        <td className="px-3 py-2 font-semibold text-slate-600 w-40 shrink-0 align-top border-r border-slate-200">
                          {key}
                        </td>
                        {conflict.sourceItems.map((item, vi) => {
                          const val =
                            item.fields.find((f) => f.key === key)?.value ?? "";
                          const isWinner =
                            vi === conflict.sourceItems.length - 1;
                          return (
                            <td
                              key={vi}
                              className={`px-3 py-2 align-top font-mono break-all border-r border-slate-100 last:border-0
                                ${isWinner ? "bg-amber-50 text-amber-900" : "text-slate-500"}`}
                            >
                              {val || (
                                <span className="italic text-slate-300">
                                  empty
                                </span>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                    {sameFields.length > 0 && (
                      <tr className="bg-slate-50">
                        <td
                          colSpan={1 + conflict.sourceItems.length}
                          className="px-3 py-1.5 text-[10px] text-slate-400"
                        >
                          {sameFields.length} field
                          {sameFields.length !== 1 ? "s" : ""} identical across
                          all packages
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </td>
        </tr>
      )}
    </>
  );
}

function ConflictsPanel({
  conflicts,
  packageNames,
}: {
  conflicts: ConflictItem[];
  packageNames: string[];
}) {
  if (conflicts.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center flex-1 gap-4">
        <div className="flex items-center justify-center w-16 h-16 rounded-2xl bg-emerald-50 border border-emerald-200">
          <GitMerge className="h-7 w-7 text-emerald-500" strokeWidth={1.5} />
        </div>
        <div className="text-center">
          <p className="text-sm font-semibold text-slate-700">No conflicts</p>
          <p className="text-xs text-slate-400 mt-1">
            All items are unique across the uploaded packages.
          </p>
        </div>
      </div>
    );
  }

  const allSameDb = conflicts.every(
    (c) => c.database === conflicts[0].database,
  );

  return (
    <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
      {/* Header */}
      <div className="shrink-0 flex items-center gap-3 px-5 py-3 bg-amber-50 border-b border-amber-200">
        <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0" />
        <p className="text-xs text-amber-700">
          <strong className="font-semibold">
            {conflicts.length} item{conflicts.length !== 1 ? "s" : ""}
          </strong>{" "}
          appear in multiple packages. The{" "}
          <strong className="font-semibold">last</strong> package listed wins on
          merge.
        </p>
      </div>

      {/* Legend */}
      <div className="shrink-0 flex items-center gap-2.5 px-5 py-2 border-b border-slate-200 bg-white">
        <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest">
          Legend:
        </span>
        {packageNames.map((name, i) => {
          const c = CONFLICT_COLORS[i % CONFLICT_COLORS.length];
          return (
            <span
              key={i}
              title={name}
              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold border ${c.pill}`}
            >
              <span
                className={`w-3.5 h-3.5 rounded-full ${c.dot} text-white flex items-center justify-center text-[8px] font-bold shrink-0`}
              >
                {i + 1}
              </span>
              <span className="truncate max-w-[140px]">{name}</span>
            </span>
          );
        })}
      </div>

      {/* Conflict list */}
      <div className="flex-1 overflow-y-auto">
        <table className="w-full text-[12px]">
          <thead className="sticky top-0 z-10 bg-slate-50 border-b border-slate-200">
            <tr>
              <th className="px-5 py-2 text-left font-semibold text-slate-500 uppercase tracking-widest text-[10px]">
                Item
              </th>
              {!allSameDb && (
                <th className="px-4 py-2 text-left font-semibold text-slate-500 uppercase tracking-widest text-[10px] w-24">
                  Database
                </th>
              )}
              <th className="px-4 py-2 text-left font-semibold text-slate-500 uppercase tracking-widest text-[10px] w-28">
                In packages
              </th>
              <th className="px-4 py-2 text-left font-semibold text-slate-500 uppercase tracking-widest text-[10px] w-36">
                Diff
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 bg-white">
            {conflicts.map((c, i) => (
              <ConflictRow
                key={i}
                conflict={c}
                packageNames={packageNames}
                allSameDb={allSameDb}
              />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function PackageChip({
  name,
  count,
  index,
  showVs,
}: {
  name: string;
  count: number;
  index: number;
  showVs: boolean;
}) {
  return (
    <div className="flex items-center gap-2 min-w-0">
      <span className="flex items-center justify-center w-5 h-5 rounded-full bg-slate-900 text-white text-[10px] font-bold shrink-0">
        {index}
      </span>
      <div className="min-w-0">
        <p className="text-[13px] font-semibold text-slate-800 truncate leading-tight">
          {name}
        </p>
        <p className="text-[11px] text-slate-400 leading-tight">
          {count} items
        </p>
      </div>
      {showVs && (
        <span className="text-slate-300 text-xs shrink-0 mx-1">vs</span>
      )}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center flex-1 gap-5">
      <div className="flex items-center justify-center w-20 h-20 rounded-3xl bg-white border border-slate-200 shadow-md">
        <Layers className="h-9 w-9 text-slate-300" strokeWidth={1.5} />
      </div>
      <div className="text-center">
        <p className="text-base font-semibold text-slate-600">
          No packages loaded
        </p>
        <p className="text-sm text-slate-400 mt-1">
          Upload two or more .zip Sitecore packages using the sidebar
        </p>
      </div>
    </div>
  );
}
