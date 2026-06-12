"use client";

import { useState, useMemo, useCallback } from "react";
import { Layers, ChevronLeft, ChevronRight, FileArchive } from "lucide-react";
import TabInfo from "@/components/TabInfo";
import MergeUploadPanel from "@/components/MergeUploadPanel";
import ItemTree from "@/components/ItemTree";
import type { ParsedPackage } from "@/lib/types";
import { mergePackages } from "@/lib/merger";

interface PackageEntry {
  pkg: ParsedPackage;
  name: string;
}

const PER_PAGE = 2;

export default function PackageMergePage() {
  const [packages, setPackages] = useState<PackageEntry[]>([]);
  const [page, setPage] = useState(0);

  const onAdd = useCallback((pkg: ParsedPackage, name: string) => {
    setPackages((prev) => {
      const next = [...prev, { pkg, name }];
      // jump to last page so the new package is visible
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

  const mergeResult = useMemo(() => {
    if (packages.length === 0) return null;
    return mergePackages(
      packages.map((p) => p.pkg),
      packages.map((p) => p.name),
    );
  }, [packages]);

  const onExport = useCallback(async () => {
    if (!mergeResult) return;
    const { exportToExcel } = await import("@/lib/exporter");
    exportToExcel(mergeResult.merged);
  }, [mergeResult]);

  const conflictCount = mergeResult?.conflicts.length ?? 0;
  const totalPages = Math.max(1, Math.ceil(packages.length / PER_PAGE));
  const pagePackages = packages.slice(
    page * PER_PAGE,
    page * PER_PAGE + PER_PAGE,
  );

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
            conflictCount={conflictCount}
            onExport={onExport}
          />
        </aside>

        {/* Main */}
        <main className="flex-1 min-w-0 overflow-hidden flex flex-col bg-slate-50">
          {packages.length === 0 ? (
            <EmptyState />
          ) : (
            <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
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
                      />
                    );
                  })}
                </div>

                {/* Prev / Next */}
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
                {/* Filler if only 1 package on last page */}
                {pagePackages.length === 1 && (
                  <div className="flex-1 flex items-center justify-center bg-slate-50 text-slate-300">
                    <div className="text-center">
                      <FileArchive
                        className="h-10 w-10 mx-auto mb-2 opacity-30"
                        strokeWidth={1}
                      />
                      <p className="text-sm text-slate-400">
                        Add another package
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

function PackageChip({
  name,
  count,
  index,
}: {
  name: string;
  count: number;
  index: number;
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
      {index < 2 && (
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
