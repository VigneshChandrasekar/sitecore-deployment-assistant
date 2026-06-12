"use client";

import { useMemo, useState } from "react";
import {
  Link2,
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  CheckCircle2,
  X,
  Copy,
  Check,
} from "lucide-react";
import type { ParsedPackage } from "@/lib/types";
import type { MissingReference } from "@/lib/referenceChecker";

interface Props {
  pkg: ParsedPackage;
  result: { missing: MissingReference[]; checked: number };
  onClose: () => void;
}

export default function ReferenceReport({ pkg, result, onClose }: Props) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const grouped = useMemo(() => {
    const map = new Map<string, MissingReference[]>();
    for (const ref of result.missing) {
      const list = map.get(ref.sourceItemPath) ?? [];
      list.push(ref);
      map.set(ref.sourceItemPath, list);
    }
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [result.missing]);

  const toggle = (path: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(path) ? next.delete(path) : next.add(path);
      return next;
    });

  const totalMissing = result.missing.length;
  const totalItems = grouped.length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="relative w-[700px] max-h-[84vh] flex flex-col rounded-xl bg-white border border-slate-200 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 shrink-0">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-slate-100 border border-slate-200">
              <Link2 className="h-4 w-4 text-slate-600" />
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                Reference Check
              </p>
              <p className="text-sm font-semibold text-slate-900">
                Scanned <span className="text-slate-700">{result.checked}</span>{" "}
                field{result.checked !== 1 ? "s" : ""} across{" "}
                <span className="text-slate-700">{pkg.items.length}</span> items
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-md hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Summary banner */}
        {totalMissing === 0 ? (
          <div className="flex items-center gap-3 px-5 py-3.5 bg-emerald-50 border-b border-emerald-100 shrink-0">
            <CheckCircle2 className="h-5 w-5 text-emerald-500 shrink-0" />
            <div>
              <p className="text-sm font-semibold text-emerald-800">
                All references accounted for
              </p>
              <p className="text-xs text-emerald-600 mt-0.5">
                Every referenced item is included in this package.
              </p>
            </div>
          </div>
        ) : (
          <div className="px-5 py-3.5 bg-amber-50 border-b border-amber-100 shrink-0">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-amber-900">
                  {totalMissing} referenced item{totalMissing !== 1 ? "s" : ""}{" "}
                  not in this package
                  <span className="text-amber-600 font-normal ml-1.5">
                    · {totalItems} source item{totalItems !== 1 ? "s" : ""}{" "}
                    affected
                  </span>
                </p>
                <p className="text-xs text-amber-700 mt-1 leading-relaxed">
                  These items are referenced by fields in this package but are
                  not included. They may be intentionally excluded
                  (shared/global items) or accidentally missed.{" "}
                  <span className="font-semibold">
                    Developer must review and decide.
                  </span>
                </p>
              </div>
            </div>
          </div>
        )}

        {/* List */}
        {totalMissing > 0 && (
          <div className="flex-1 overflow-y-auto py-3 px-3 space-y-2">
            {grouped.map(([sourcePath, refs]) => {
              const isOpen = expanded.has(sourcePath);
              return (
                <div
                  key={sourcePath}
                  className="rounded-lg border border-slate-200 overflow-hidden"
                >
                  {/* Source item header */}
                  <div
                    onClick={() => toggle(sourcePath)}
                    className="w-full flex items-center gap-3 px-4 py-3 bg-slate-50 hover:bg-slate-100 text-left transition-colors cursor-pointer select-none"
                  >
                    {isOpen ? (
                      <ChevronDown className="h-4 w-4 text-slate-400 shrink-0" />
                    ) : (
                      <ChevronRight className="h-4 w-4 text-slate-400 shrink-0" />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-slate-800 truncate">
                        {refs[0].sourceItemName}
                      </p>
                      <div className="flex items-center gap-1 mt-0.5">
                        <p className="text-[11px] text-slate-400 font-mono truncate">
                          {sourcePath}
                        </p>
                        <CopyBtn text={sourcePath} />
                      </div>
                    </div>
                    <span className="shrink-0 flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-100 border border-amber-200 text-amber-700 text-[11px] font-semibold">
                      <AlertTriangle className="h-3 w-3" />
                      {refs.length} missing
                    </span>
                  </div>

                  {/* Missing ref rows */}
                  {isOpen && (
                    <div className="divide-y divide-slate-100">
                      {refs.map((ref, i) => (
                        <div
                          key={i}
                          className="flex items-center gap-3 px-4 py-3 bg-white"
                        >
                          <span className="shrink-0 text-[10px] font-bold text-slate-500 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded uppercase tracking-wide">
                            {ref.fieldType}
                          </span>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-semibold text-slate-700">
                              {ref.fieldKey}
                            </p>
                            <div className="flex items-center gap-1 mt-0.5">
                              <p className="text-[11px] font-mono text-slate-400">
                                {ref.referencedIdRaw}
                              </p>
                              <CopyBtn text={ref.referencedIdRaw} />
                            </div>
                          </div>
                          <span className="shrink-0 px-2 py-0.5 rounded-md bg-red-50 border border-red-200 text-red-600 text-[10px] font-semibold uppercase tracking-wide">
                            Not in package
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between px-5 py-3 border-t border-slate-200 bg-slate-50 rounded-b-xl shrink-0">
          <p className="text-[11px] text-slate-400 leading-relaxed max-w-md">
            Template items are excluded from this scan. Global Sitecore system
            items are usually safe to leave out.
          </p>
          <button
            onClick={onClose}
            className="shrink-0 px-3 py-1.5 rounded-md text-xs font-medium border bg-white text-slate-700 border-slate-300 hover:bg-slate-900 hover:text-white hover:border-slate-900 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

function CopyBtn({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        navigator.clipboard.writeText(text).then(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        });
      }}
      title="Copy"
      className="shrink-0 p-0.5 rounded text-slate-400 hover:text-slate-600 hover:bg-slate-200 transition-colors"
    >
      {copied ? (
        <Check className="h-3 w-3 text-emerald-500" />
      ) : (
        <Copy className="h-3 w-3" />
      )}
    </button>
  );
}
