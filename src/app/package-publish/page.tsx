"use client";

import { useState, useMemo, useCallback } from "react";
import {
  SendToBack,
  GitMerge,
  Plus,
  RefreshCw,
  ChevronDown,
  ChevronRight as ChevronRightIcon,
} from "lucide-react";
import TabInfo from "@/components/TabInfo";
import PublishUploadPanel from "@/components/PublishUploadPanel";
import type { ParsedPackage } from "@/lib/types";
import type { PublishInstruction } from "@/lib/publishScriptGenerator";
import { buildPublishInstructionsFromItems } from "@/lib/publishCandidateExporter";

interface PackageEntry {
  pkg: ParsedPackage;
  name: string;
}

export default function PackagePublishPage() {
  const [packages, setPackages] = useState<PackageEntry[]>([]);
  const [languages, setLanguages] = useState<string[]>(["en"]);

  const onAdd = useCallback((pkg: ParsedPackage, name: string) => {
    setPackages((prev) => [...prev, { pkg, name }]);
  }, []);

  const onRemove = useCallback((index: number) => {
    setPackages((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const allItems = useMemo(() => {
    const seen = new Set<string>();
    return packages
      .flatMap((p) => p.pkg.items)
      .filter((i) => {
        if (i.database === "core") return false;
        const key = `${i.database}::${i.path}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
  }, [packages]);

  const instructions = useMemo(
    () =>
      allItems.length > 0 ? buildPublishInstructionsFromItems(allItems) : [],
    [allItems],
  );

  const onGenerateScript = useCallback(async () => {
    if (allItems.length === 0) return;
    const { downloadPublishScript } =
      await import("@/lib/publishScriptGenerator");
    downloadPublishScript(
      allItems,
      packages.map((p) => p.name),
      languages,
    );
  }, [allItems, packages, languages]);

  const subitems = instructions.filter((i) => i.action === "subitems").length;
  const singleNew = instructions.filter(
    (i) => i.action === "single-new",
  ).length;
  const modified = instructions.filter(
    (i) => i.action === "single-modified",
  ).length;

  return (
    <div className="flex flex-col flex-1 min-h-0 overflow-hidden gap-y-1.5">
      <TabInfo
        title="Publish Packages"
        what="Upload one or more Sitecore .zip packages and generate a PowerShell publish script to run inside SPE after deployment."
      />

      <div className="flex flex-1 overflow-hidden min-h-0">
        {/* Sidebar */}
        <aside className="w-[320px] shrink-0 min-h-0 bg-slate-900 border-r border-slate-800 overflow-y-auto">
          <PublishUploadPanel
            packages={packages}
            onAdd={onAdd}
            onRemove={onRemove}
            languages={languages}
            onLanguagesChange={setLanguages}
            onGenerateScript={onGenerateScript}
          />
        </aside>

        {/* Main — Publish Plan only */}
        <main className="flex-1 min-w-0 overflow-hidden flex flex-col bg-slate-50">
          {packages.length === 0 ? (
            <EmptyState />
          ) : (
            <PublishPlanPanel
              instructions={instructions}
              subitems={subitems}
              singleNew={singleNew}
              modified={modified}
            />
          )}
        </main>
      </div>
    </div>
  );
}

// ── Publish Plan panel ────────────────────────────────────────────────────────

function PublishPlanPanel({
  instructions,
  subitems,
  singleNew,
  modified,
}: {
  instructions: PublishInstruction[];
  subitems: number;
  singleNew: number;
  modified: number;
}) {
  if (instructions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center flex-1 gap-4">
        <div className="flex items-center justify-center w-16 h-16 rounded-2xl bg-slate-50 border border-slate-200">
          <SendToBack className="h-7 w-7 text-slate-300" strokeWidth={1.5} />
        </div>
        <p className="text-sm text-slate-400">No publish candidates found.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
      {/* Summary bar */}
      <div className="shrink-0 flex items-center gap-2.5 px-5 py-2.5 bg-white border-b border-slate-200 flex-wrap">
        <span className="text-[11px] font-semibold text-slate-500">
          {instructions.length} publish actions:
        </span>
        {subitems > 0 && (
          <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold border bg-blue-100 text-blue-700 border-blue-200">
            {subitems} with subitems
          </span>
        )}
        {singleNew > 0 && (
          <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold border bg-emerald-100 text-emerald-700 border-emerald-200">
            {singleNew} single new
          </span>
        )}
        {modified > 0 && (
          <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold border bg-amber-100 text-amber-700 border-amber-200">
            {modified} modified
          </span>
        )}
      </div>

      {/* Instruction list */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        <PublishSection
          action="subitems"
          label="Publish with Subitems"
          description="Parent is new and has new children — one publish covers the whole subtree"
          badge="bg-blue-100 text-blue-700 border-blue-200"
          headerBg="bg-blue-50 border-blue-200"
          icon={GitMerge}
          instructions={instructions.filter((i) => i.action === "subitems")}
          startIndex={1}
        />
        <PublishSection
          action="single-new"
          label="Single Item Publish — New"
          description="New item with no new children — publish this item only"
          badge="bg-emerald-100 text-emerald-700 border-emerald-200"
          headerBg="bg-emerald-50 border-emerald-200"
          icon={Plus}
          instructions={instructions.filter((i) => i.action === "single-new")}
          startIndex={subitems + 1}
        />
        <PublishSection
          action="single-modified"
          label="Single Item Publish — Modified"
          description="Existing item — republish to push changes to web"
          badge="bg-amber-100 text-amber-700 border-amber-200"
          headerBg="bg-amber-50 border-amber-200"
          icon={RefreshCw}
          instructions={instructions.filter(
            (i) => i.action === "single-modified",
          )}
          startIndex={subitems + singleNew + 1}
        />
      </div>
    </div>
  );
}

function PublishSection({
  label,
  description,
  badge,
  headerBg,
  icon: Icon,
  instructions,
  startIndex,
}: {
  action: string;
  label: string;
  description: string;
  badge: string;
  headerBg: string;
  icon: React.ElementType;
  instructions: PublishInstruction[];
  startIndex: number;
}) {
  const [open, setOpen] = useState(true);
  if (instructions.length === 0) return null;

  return (
    <div className={`rounded-xl border overflow-hidden ${headerBg}`}>
      <button
        onClick={() => setOpen((o) => !o)}
        className={`w-full flex items-center gap-3 px-4 py-3 text-left hover:brightness-95 transition-colors ${headerBg}`}
      >
        {open ? (
          <ChevronDown className="h-4 w-4 shrink-0 text-slate-400" />
        ) : (
          <ChevronRightIcon className="h-4 w-4 shrink-0 text-slate-400" />
        )}
        <Icon className={`h-4 w-4 shrink-0 ${badge.split(" ")[1]}`} />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-slate-700">{label}</p>
          <p className="text-[11px] text-slate-500 mt-0.5">{description}</p>
        </div>
        <span
          className={`px-2.5 py-1 rounded-full text-xs font-bold border ${badge}`}
        >
          {instructions.length}
        </span>
      </button>

      {open && (
        <div className="bg-white border-t border-slate-200 divide-y divide-slate-100">
          {instructions.map((instr, i) => (
            <PublishRow
              key={`${i}-${instr.path}`}
              instr={instr}
              index={startIndex + i}
              badge={badge}
              icon={Icon}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function PublishRow({
  instr,
  index,
  badge,
  icon: Icon,
}: {
  instr: PublishInstruction;
  index: number;
  badge: string;
  icon: React.ElementType;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="transition-colors hover:bg-slate-50">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center gap-3 px-4 py-2.5 text-left"
      >
        <span className="text-[11px] text-slate-300 font-mono w-6 shrink-0 text-right">
          {index}.
        </span>
        <Icon className={`h-3.5 w-3.5 shrink-0 ${badge.split(" ")[1]}`} />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-slate-800 truncate">
            {instr.name}
          </p>
          <p className="text-[11px] text-slate-400 font-mono truncate">
            {instr.path}
          </p>
        </div>
        {instr.coveredCount > 0 && (
          <span className="text-[11px] text-blue-600 font-medium shrink-0">
            +{instr.coveredCount} children
          </span>
        )}
        {open ? (
          <ChevronDown className="h-3.5 w-3.5 text-slate-300 shrink-0" />
        ) : (
          <ChevronRightIcon className="h-3.5 w-3.5 text-slate-300 shrink-0" />
        )}
      </button>
      {open && (
        <div className="px-4 pb-3 ml-9">
          <div className="bg-slate-50 rounded-lg border border-slate-200 px-3 py-2 space-y-1.5 text-[11px]">
            <RowDetail
              label="Path"
              value={
                <span className="font-mono text-slate-600 break-all">
                  {instr.path}
                </span>
              }
            />
            {instr.templateName && (
              <RowDetail label="Template" value={instr.templateName} />
            )}
            <RowDetail label="Notes" value={instr.reason} />
          </div>
        </div>
      )}
    </div>
  );
}

function RowDetail({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-2">
      <span className="font-semibold text-slate-500 w-16 shrink-0">
        {label}
      </span>
      <span className="text-slate-600">{value}</span>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center flex-1 gap-5">
      <div className="flex items-center justify-center w-20 h-20 rounded-3xl bg-white border border-slate-200 shadow-md">
        <SendToBack className="h-9 w-9 text-slate-300" strokeWidth={1.5} />
      </div>
      <div className="text-center">
        <p className="text-base font-semibold text-slate-600">
          No packages loaded
        </p>
        <p className="text-sm text-slate-400 mt-1">
          Upload one or more Sitecore .zip packages using the sidebar
        </p>
      </div>
    </div>
  );
}
