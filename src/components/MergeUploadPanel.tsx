"use client";

import { useCallback, useRef, useState } from "react";
import {
  UploadCloud,
  FileArchive,
  X,
  Plus,
  Terminal,
  CheckCircle2,
  GripVertical,
  ChevronUp,
  ChevronDown,
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
  onReorder: (from: number, to: number) => void;
  conflictCount: number;
  onExport: () => void;
}

const ORDER_LABELS = ["Base", "Patch 1", "Patch 2", "Patch 3", "Patch 4"];
const ORDER_COLORS = [
  "bg-blue-500/20 text-blue-300 border-blue-500/30",
  "bg-violet-500/20 text-violet-300 border-violet-500/30",
  "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
  "bg-orange-500/20 text-orange-300 border-orange-500/30",
  "bg-pink-500/20 text-pink-300 border-pink-500/30",
];

export default function MergeUploadPanel({
  packages,
  onAdd,
  onRemove,
  onReorder,
  conflictCount,
  onExport,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const dragFrom = useRef<number | null>(null);
  const [dragOver, setDragOver] = useState<number | null>(null);

  const process = useCallback(
    async (file: File) => {
      if (!file.name.endsWith(".zip")) return;
      const { parsePackage } = await import("@/lib/parser");
      const result = await parsePackage(await file.arrayBuffer());
      onAdd(result, file.name.replace(/\.zip$/i, ""));
    },
    [onAdd],
  );

  const onFileDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      // Only handle file drops, not card reorder drops
      if (e.dataTransfer.files.length > 0) {
        Array.from(e.dataTransfer.files).forEach((f) => process(f));
      }
    },
    [process],
  );

  const onChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    Array.from(e.target.files ?? []).forEach((f) => process(f));
    e.target.value = "";
  };

  // ── Drag-and-drop reorder handlers ────────────────────────────────────────

  const handleDragStart = (e: React.DragEvent, index: number) => {
    dragFrom.current = index;
    e.dataTransfer.effectAllowed = "move";
    // Use empty image so the card itself shows as the ghost
    e.dataTransfer.setDragImage(e.currentTarget, 0, 0);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    if (dragFrom.current !== null && dragFrom.current !== index) {
      setDragOver(index);
    }
  };

  const handleDrop = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (dragFrom.current !== null && dragFrom.current !== index) {
      onReorder(dragFrom.current, index);
    }
    dragFrom.current = null;
    setDragOver(null);
  };

  const handleDragEnd = () => {
    dragFrom.current = null;
    setDragOver(null);
  };

  const totalItems = packages.reduce((s, p) => s + p.pkg.items.length, 0);
  const ready = packages.length >= 2 && conflictCount === 0;

  return (
    <div className="flex flex-col gap-0">
      {/* Package list */}
      <div className="p-4 border-b border-slate-800">
        <p className="text-[11px] font-semibold text-slate-400 mb-1">
          Packages
        </p>
        {packages.length >= 2 && (
          <p className="text-[10px] text-slate-500 mb-3 leading-snug">
            Install order: <span className="text-slate-300">top → bottom</span>.
            Use ↑ ↓ to move, or drag the grip.
          </p>
        )}
        {packages.length < 2 && <div className="mb-3" />}

        <div className="flex flex-col gap-2">
          {packages.map((entry, i) => (
            <div
              key={i}
              draggable
              onDragStart={(e) => handleDragStart(e, i)}
              onDragOver={(e) => handleDragOver(e, i)}
              onDrop={(e) => handleDrop(e, i)}
              onDragEnd={handleDragEnd}
              className={`flex items-stretch gap-0 rounded-lg border overflow-hidden transition-all select-none
                ${
                  dragOver === i
                    ? "bg-slate-700 border-blue-500/60 ring-1 ring-blue-500/40"
                    : "bg-slate-800 border-slate-700"
                }`}
            >
              {/* ↑ ↓ move buttons */}
              <div className="flex flex-col border-r border-slate-700 shrink-0">
                <button
                  onClick={() => onReorder(i, i - 1)}
                  disabled={i === 0}
                  title="Move up"
                  className="flex-1 flex items-center justify-center px-2 hover:bg-slate-700 disabled:opacity-20 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronUp className="h-3 w-3 text-slate-400" />
                </button>
                <div className="h-px bg-slate-700" />
                <button
                  onClick={() => onReorder(i, i + 1)}
                  disabled={i === packages.length - 1}
                  title="Move down"
                  className="flex-1 flex items-center justify-center px-2 hover:bg-slate-700 disabled:opacity-20 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronDown className="h-3 w-3 text-slate-400" />
                </button>
              </div>

              {/* Drag handle */}
              <div
                className="flex items-center px-1.5 cursor-grab active:cursor-grabbing text-slate-700 hover:text-slate-500 transition-colors"
                title="Drag to reorder"
              >
                <GripVertical className="h-3.5 w-3.5" />
              </div>

              {/* Card content */}
              <div className="flex items-start gap-2 px-2.5 py-2.5 flex-1 min-w-0">
                <FileArchive className="h-4 w-4 text-slate-400 shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 mb-0.5">
                    <span
                      className={`text-[9px] font-bold uppercase tracking-wider px-1.5 py-px rounded border ${ORDER_COLORS[i % ORDER_COLORS.length]}`}
                    >
                      {ORDER_LABELS[i] ?? `Patch ${i}`}
                    </span>
                  </div>
                  <p className="text-xs font-semibold text-white truncate">
                    {entry.name}
                  </p>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    {entry.pkg.items.length} items · {entry.pkg.files.length}{" "}
                    files
                  </p>
                </div>
              </div>

              {/* Remove */}
              <button
                onClick={() => onRemove(i)}
                onMouseDown={(e) => e.stopPropagation()}
                className="shrink-0 px-2 flex items-center hover:bg-slate-700 text-slate-500 hover:text-white transition-colors border-l border-slate-700"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}

          {/* Drop zone / Add button */}
          <label
            onDragOver={(e) => {
              // Only accept file drags, not card reorders
              if (e.dataTransfer.types.includes("Files")) e.preventDefault();
            }}
            onDrop={onFileDrop}
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
            <p className="text-[11px] font-semibold text-slate-400 mb-2.5">
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

            {packages.length >= 2 && conflictCount === 0 ? (
              <div className="mt-2.5 flex items-start gap-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20 px-3 py-2 text-xs text-emerald-400">
                <CheckCircle2 className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                <span>No conflicts — ready to export.</span>
              </div>
            ) : null}
          </div>

          {/* Actions */}
          <div className="p-4 border-b border-slate-800">
            <p className="text-[11px] font-semibold text-slate-400 mb-2.5">
              Actions
            </p>
            <div className="flex flex-col gap-2">
              <button
                onClick={onExport}
                className={`w-full flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium border transition-colors
                  ${
                    ready
                      ? "bg-blue-600 text-white border-blue-600 hover:bg-white hover:text-blue-600 hover:border-blue-600"
                      : "bg-blue-600/70 text-white border-blue-600/70 hover:bg-blue-600 hover:border-blue-600"
                  }`}
              >
                <Terminal className="h-3.5 w-3.5" />
                Generate Script
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
        className={`text-[10px] mt-1 font-medium ${danger ? "text-red-500" : "text-slate-500"}`}
      >
        {label}
      </p>
    </div>
  );
}
