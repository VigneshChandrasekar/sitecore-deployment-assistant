"use client";

import { useCallback, useRef } from "react";
import {
  UploadCloud,
  FileArchive,
  X,
  Plus,
  Download,
  Layers,
  AlertTriangle,
} from "lucide-react";
import type { ParsedPackage } from "@/lib/types";

interface PackageEntry {
  pkg: ParsedPackage;
  name: string;
}

interface Props {
  packages: PackageEntry[];
  onAdd: (pkg: ParsedPackage, name: string) => void;
  onRemove: (index: number) => void;
  conflictCount: number;
  onExport: () => void;
}

export default function MergeUploadPanel({
  packages,
  onAdd,
  onRemove,
  conflictCount,
  onExport,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);

  const process = useCallback(
    async (file: File) => {
      if (!file.name.endsWith(".zip")) return;
      const { parsePackage } = await import("@/lib/parser");
      const result = await parsePackage(await file.arrayBuffer());
      onAdd(result, file.name.replace(/\.zip$/i, ""));
    },
    [onAdd],
  );

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      Array.from(e.dataTransfer.files).forEach((f) => process(f));
    },
    [process],
  );

  const onChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    Array.from(e.target.files ?? []).forEach((f) => process(f));
    e.target.value = "";
  };

  const totalItems = packages.reduce((s, p) => s + p.pkg.items.length, 0);

  return (
    <div className="flex flex-col gap-0">
      {/* Package list */}
      <div className="p-4 border-b border-slate-800">
        <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-3">
          Packages
        </p>

        <div className="flex flex-col gap-2">
          {packages.map((entry, i) => (
            <div
              key={i}
              className="flex items-start gap-2.5 rounded-lg bg-slate-800 border border-slate-700 px-3 py-2.5"
            >
              <FileArchive className="h-4 w-4 text-red-400 shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-white truncate">
                  {entry.name}
                </p>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  {entry.pkg.items.length} items · {entry.pkg.files.length}{" "}
                  files
                </p>
              </div>
              <button
                onClick={() => onRemove(i)}
                className="shrink-0 p-0.5 rounded hover:bg-slate-700 text-slate-500 hover:text-white transition-colors"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}

          {/* Drop zone / Add button */}
          <label
            onDragOver={(e) => e.preventDefault()}
            onDrop={onDrop}
            className="flex items-center justify-center gap-2 rounded-lg border-2 border-dashed border-white/30 hover:border-white/60 hover:bg-slate-800/60 cursor-pointer transition-all p-3"
          >
            <input
              ref={inputRef}
              type="file"
              accept=".zip"
              multiple
              className="hidden"
              onChange={onChange}
            />
            {packages.length === 0 ? (
              <div className="text-center py-2">
                <UploadCloud className="h-6 w-6 text-slate-600 mx-auto mb-1" />
                <p className="text-xs font-medium text-white">
                  Drop Sitecore packages
                </p>
                <p className="text-[10px] text-slate-500">
                  or click to browse — .zip only
                </p>
              </div>
            ) : (
              <div className="flex items-center gap-1.5 py-0.5">
                <Plus className="h-3.5 w-3.5 text-slate-400" />
                <span className="text-xs font-medium text-white">
                  Add another package
                </span>
              </div>
            )}
          </label>
        </div>
      </div>

      {packages.length > 0 && (
        <>
          {/* Summary */}
          <div className="p-4 border-b border-slate-800">
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-2.5">
              Summary
            </p>
            <div className="grid grid-cols-2 gap-2">
              <StatCard label="Packages" value={packages.length} />
              <StatCard label="Items" value={totalItems} />
              <StatCard
                label="Conflicts"
                value={conflictCount}
                danger={conflictCount > 0}
              />
              <StatCard label="Unique" value={totalItems - conflictCount} />
            </div>
            {conflictCount > 0 && (
              <div className="mt-2.5 flex items-start gap-2 rounded-lg bg-amber-500/10 border border-amber-500/20 px-3 py-2 text-xs text-amber-400">
                <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                <span>
                  <strong className="text-amber-300">{conflictCount}</strong>{" "}
                  item{conflictCount !== 1 ? "s" : ""} appear in multiple
                  packages. Last package wins.
                </span>
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="p-4 border-b border-slate-800">
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-2.5">
              Actions
            </p>
            <div className="flex flex-col gap-2">
              <button
                onClick={onExport}
                className="w-full flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium border bg-red-600 text-white border-red-600 hover:bg-white hover:text-red-600 hover:border-red-600 transition-colors"
              >
                <Download className="h-3.5 w-3.5" />
                Export Merged
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function StatCard({
  label,
  value,
  danger,
}: {
  label: string;
  value: number;
  danger?: boolean;
}) {
  return (
    <div
      className={`rounded-xl px-3 py-3 text-center border ${danger ? "bg-red-500/15 border-red-500/30" : "bg-slate-800 border-slate-700"}`}
    >
      <p
        className={`text-2xl font-bold leading-none tabular-nums ${danger ? "text-red-400" : "text-white"}`}
      >
        {value}
      </p>
      <p
        className={`text-[10px] mt-1 font-medium uppercase tracking-wide ${danger ? "text-red-500" : "text-slate-500"}`}
      >
        {label}
      </p>
    </div>
  );
}
