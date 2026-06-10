"use client";

import { useState, useMemo, useEffect } from "react";
import {
  ClipboardList,
  ChevronDown,
  ChevronRight,
  Download,
  GitMerge,
  RefreshCw,
  Plus,
  X,
  Copy,
  Check,
} from "lucide-react";
import type {
  PublishInstruction,
  PublishAction,
} from "@/lib/publishCandidateExporter";
import { ACTION_LABEL } from "@/lib/publishCandidateExporter";

// ── Types ─────────────────────────────────────────────────────────────────────

interface Props {
  instructions: PublishInstruction[];
  onExport: () => Promise<void>;
  exporting: boolean;
  sourceLabel?: string;
  targetLabel?: string;
  onClose: () => void;
}

// ── Section meta ──────────────────────────────────────────────────────────────

const SECTION_META: Record<
  PublishAction,
  {
    label: string;
    description: string;
    badge: string;
    headerBg: string;
    rowHover: string;
    icon: React.ElementType;
  }
> = {
  subitems: {
    label: "Publish with Subitems",
    description:
      "Parent is new and has new children — one publish covers the whole subtree",
    badge: "bg-blue-100 text-blue-700 border-blue-200",
    headerBg: "bg-blue-50 border-blue-200",
    rowHover: "hover:bg-blue-50",
    icon: GitMerge,
  },
  "single-new": {
    label: "Single Item Publish — New",
    description: "New item with no new children — publish this item only",
    badge: "bg-emerald-100 text-emerald-700 border-emerald-200",
    headerBg: "bg-emerald-50 border-emerald-200",
    rowHover: "hover:bg-emerald-50",
    icon: Plus,
  },
  "single-modified": {
    label: "Single Item Publish — Modified",
    description: "Existing item with changed fields — republish this item only",
    badge: "bg-amber-100 text-amber-700 border-amber-200",
    headerBg: "bg-amber-50 border-amber-200",
    rowHover: "hover:bg-amber-50",
    icon: RefreshCw,
  },
};

const ACTION_ORDER: PublishAction[] = [
  "subitems",
  "single-new",
  "single-modified",
];

// ── Clipboard text builder ────────────────────────────────────────────────────

function buildClipboardText(instructions: PublishInstruction[]): string {
  const lines: string[] = [];

  const sections: {
    heading: string;
    filter: (i: PublishInstruction) => boolean;
  }[] = [
    {
      heading: "-- Publish with Subitems",
      filter: (i) => i.action === "subitems",
    },
    {
      heading: "-- Single Item Publish (New)",
      filter: (i) => i.action === "single-new",
    },
    {
      heading: "-- Single Item Publish (Modified)",
      filter: (i) => i.action === "single-modified",
    },
  ];

  for (const { heading, filter } of sections) {
    const group = instructions.filter(filter);
    if (group.length === 0) continue;
    lines.push(heading);
    for (const instr of group) {
      lines.push(`${ACTION_LABEL[instr.action]}  |  ${instr.path}`);
    }
    lines.push("");
  }

  return lines.join("\n").trimEnd();
}

// ── Row ───────────────────────────────────────────────────────────────────────

function InstructionRow({
  instr,
  index,
  meta,
}: {
  instr: PublishInstruction;
  index: number;
  meta: (typeof SECTION_META)[PublishAction];
}) {
  const [open, setOpen] = useState(false);
  const Icon = meta.icon;

  return (
    <div
      className={`border-b border-slate-100 last:border-0 transition-colors ${meta.rowHover}`}
    >
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center gap-3 px-4 py-2.5 text-left"
      >
        <span className="text-[11px] text-slate-300 font-mono w-6 shrink-0 text-right">
          {index}.
        </span>
        <Icon className={`h-3.5 w-3.5 shrink-0 ${meta.badge.split(" ")[1]}`} />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-slate-800 truncate">
            {instr.name}
          </p>
          <p className="text-[11px] text-slate-400 font-mono truncate">
            {instr.path}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {instr.coveredCount > 0 && (
            <span className="text-[11px] text-blue-600 font-medium">
              +{instr.coveredCount} children
            </span>
          )}
          {instr.fieldCount > 0 && (
            <span className="text-[11px] text-amber-600 font-medium">
              {instr.fieldCount} field{instr.fieldCount !== 1 ? "s" : ""}
            </span>
          )}
          <span className="text-[11px] text-slate-400 max-w-[100px] truncate hidden sm:block">
            {instr.templateName}
          </span>
          {open ? (
            <ChevronDown className="h-3.5 w-3.5 text-slate-300" />
          ) : (
            <ChevronRight className="h-3.5 w-3.5 text-slate-300" />
          )}
        </div>
      </button>

      {open && (
        <div className="px-4 pb-3 ml-9">
          <div className="bg-slate-50 rounded-lg border border-slate-200 px-3 py-2 space-y-1.5 text-[11px]">
            <Row
              label="Action"
              value={
                <span
                  className={`px-2 py-0.5 rounded-full font-bold border ${meta.badge}`}
                >
                  {ACTION_LABEL[instr.action]}
                </span>
              }
            />
            <Row
              label="Path"
              value={
                <span className="font-mono text-slate-600 break-all">
                  {instr.path}
                </span>
              }
            />
            <Row label="Template" value={instr.templateName || "—"} />
            <Row label="Notes" value={instr.reason} />
          </div>
        </div>
      )}
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2">
      <span className="font-semibold text-slate-500 w-16 shrink-0">
        {label}
      </span>
      <span className="text-slate-600">{value}</span>
    </div>
  );
}

// ── Section ───────────────────────────────────────────────────────────────────

function Section({
  action,
  instructions,
  startIndex,
}: {
  action: PublishAction;
  instructions: PublishInstruction[];
  startIndex: number;
}) {
  const [open, setOpen] = useState(true);
  const meta = SECTION_META[action];
  const Icon = meta.icon;
  if (instructions.length === 0) return null;

  return (
    <div className={`rounded-xl border overflow-hidden ${meta.headerBg}`}>
      <button
        onClick={() => setOpen((o) => !o)}
        className={`w-full flex items-center gap-3 px-4 py-3 text-left hover:brightness-95 transition-colors ${meta.headerBg}`}
      >
        {open ? (
          <ChevronDown className="h-4 w-4 shrink-0 text-slate-400" />
        ) : (
          <ChevronRight className="h-4 w-4 shrink-0 text-slate-400" />
        )}
        <Icon className={`h-4 w-4 shrink-0 ${meta.badge.split(" ")[1]}`} />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-slate-700">{meta.label}</p>
          <p className="text-[11px] text-slate-500 mt-0.5">
            {meta.description}
          </p>
        </div>
        <span
          className={`px-2.5 py-1 rounded-full text-xs font-bold border ${meta.badge}`}
        >
          {instructions.length}
        </span>
      </button>

      {open && (
        <div className="bg-white border-t border-slate-200">
          {instructions.map((instr, i) => (
            <InstructionRow
              key={instr.path}
              instr={instr}
              index={startIndex + i}
              meta={meta}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ── Modal ─────────────────────────────────────────────────────────────────────

export default function PublishCandidatesPanel({
  instructions,
  onExport,
  exporting,
  sourceLabel,
  targetLabel,
  onClose,
}: Props) {
  const [copied, setCopied] = useState(false);

  // Close on Escape
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const groups = useMemo(() => {
    const map = new Map<PublishAction, PublishInstruction[]>();
    for (const action of ACTION_ORDER) map.set(action, []);
    for (const instr of instructions) map.get(instr.action)!.push(instr);
    return map;
  }, [instructions]);

  const sub = groups.get("subitems")!;
  const singleNew = groups.get("single-new")!;
  const modified = groups.get("single-modified")!;
  const totalCovered = sub.reduce((n, i) => n + i.coveredCount, 0);

  const handleCopy = async () => {
    const text = buildClipboardText(instructions);
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    /* Backdrop */
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      {/* Modal card */}
      <div className="flex flex-col bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[85vh] overflow-hidden">
        {/* Header */}
        <div className="shrink-0 flex items-center gap-3 px-5 py-4 border-b border-slate-200 bg-slate-50">
          <ClipboardList className="h-5 w-5 text-emerald-600 shrink-0" />
          <div className="flex-1 min-w-0">
            <h2 className="text-sm font-bold text-slate-800">
              Publish Candidate List
            </h2>
            {sourceLabel && targetLabel && (
              <p className="text-xs text-slate-500 mt-0.5">
                <strong className="text-slate-700">{sourceLabel}</strong>
                <span className="mx-1.5 text-slate-300">→</span>
                <strong className="text-slate-700">{targetLabel}</strong>
              </p>
            )}
          </div>
          {/* Action buttons */}
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={handleCopy}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium transition-all
                ${
                  copied
                    ? "bg-emerald-600 text-white border-emerald-600"
                    : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                }`}
            >
              {copied ? (
                <Check className="h-3.5 w-3.5" />
              ) : (
                <Copy className="h-3.5 w-3.5" />
              )}
              {copied ? "Copied!" : "Copy to Clipboard"}
            </button>
            <button
              onClick={onExport}
              disabled={exporting}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold disabled:opacity-40 transition-colors"
            >
              <Download className="h-3.5 w-3.5" />
              {exporting ? "Exporting…" : "Export Excel"}
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Summary chips */}
        <div className="shrink-0 flex items-center gap-2 px-5 py-3 border-b border-slate-100 flex-wrap bg-white">
          <span className="px-2.5 py-1 rounded-full text-[11px] font-bold border bg-blue-100 text-blue-700 border-blue-200">
            {sub.length} Publish with Subitems
          </span>
          <span className="px-2.5 py-1 rounded-full text-[11px] font-bold border bg-emerald-100 text-emerald-700 border-emerald-200">
            {singleNew.length} Single New
          </span>
          <span className="px-2.5 py-1 rounded-full text-[11px] font-bold border bg-amber-100 text-amber-700 border-amber-200">
            {modified.length} Modified
          </span>
          {totalCovered > 0 && (
            <span className="text-[11px] text-slate-400 ml-1">
              · {totalCovered} child items auto-covered by subitems publish
            </span>
          )}
          <span className="ml-auto text-[11px] font-semibold text-slate-500">
            {instructions.length} total publish actions
          </span>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {instructions.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
              <ClipboardList className="h-8 w-8 text-slate-200" />
              <p className="text-sm text-slate-400">
                No publish candidates found.
              </p>
            </div>
          ) : (
            <>
              <Section action="subitems" instructions={sub} startIndex={1} />
              <Section
                action="single-new"
                instructions={singleNew}
                startIndex={sub.length + 1}
              />
              <Section
                action="single-modified"
                instructions={modified}
                startIndex={sub.length + singleNew.length + 1}
              />
            </>
          )}
        </div>
      </div>
    </div>
  );
}
