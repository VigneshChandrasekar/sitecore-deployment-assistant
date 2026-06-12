"use client";

import { useCallback, useState } from "react";
import {
  UploadCloud,
  FileArchive,
  AlertCircle,
  AlertTriangle,
  Link2,
  Download,
  User,
  Tag,
  Hash,
  ChevronDown,
} from "lucide-react";
import type { ParsedPackage, DeployMode } from "@/lib/types";
import type { ReferenceCheckResult } from "@/lib/referenceChecker";
import DeployBadge from "./DeployBadge";
import RepackageScriptButton from "./RepackageScriptButton";

interface Props {
  onParsed: (pkg: ParsedPackage) => void;
  pkg: ParsedPackage | null;
  loading: boolean;
  setLoading: (v: boolean) => void;
  refResult?: ReferenceCheckResult | null;
  onRefReport?: () => void;
}

const RISK_MODES: DeployMode[] = ["Delete", "Overwrite"];

const DEPLOY_BAR_COLOR: Record<DeployMode, string> = {
  Delete: "bg-red-500",
  Overwrite: "bg-amber-400",
  Merge: "bg-blue-400",
  Skip: "bg-emerald-400",
  Undefined: "bg-slate-600",
};

export default function UploadPanel({
  onParsed,
  pkg,
  loading,
  setLoading,
  refResult,
  onRefReport,
}: Props) {
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const process = useCallback(
    async (file: File) => {
      if (!file.name.endsWith(".zip")) {
        setError("Please upload a .zip Sitecore package file.");
        return;
      }
      setError(null);
      setLoading(true);
      try {
        const { parsePackage } = await import("@/lib/parser");
        const result = await parsePackage(await file.arrayBuffer());
        onParsed(result);
      } catch (e) {
        setError(`Parse error: ${e}`);
      } finally {
        setLoading(false);
      }
    },
    [onParsed, setLoading],
  );

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const file = e.dataTransfer.files[0];
      if (file) process(file);
    },
    [process],
  );

  const onChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) process(file);
  };

  const riskCount = pkg
    ? pkg.items.filter((i) => RISK_MODES.includes(i.deployMode)).length
    : 0;

  return (
    <div className="flex flex-col gap-0">
      {/* Upload zone */}
      <div className="p-4 border-b-2 border-slate-700 bg-slate-950/40">
        <label
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={onDrop}
          className={`flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed cursor-pointer transition-all p-4
            ${dragOver ? "border-red-500 bg-red-500/10" : "border-slate-700 hover:border-slate-500 bg-slate-900/60"}
            ${loading ? "pointer-events-none opacity-50" : ""}`}
        >
          <input
            type="file"
            accept=".zip"
            className="hidden"
            onChange={onChange}
          />
          {loading ? (
            <div className="flex items-center gap-2 text-slate-400">
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-slate-700 border-t-slate-400" />
              <span className="text-xs font-medium">Parsing package…</span>
            </div>
          ) : pkg ? (
            <div className="flex items-center gap-2">
              <FileArchive className="h-4 w-4 text-red-400 shrink-0" />
              <div className="text-left">
                <p className="text-xs font-semibold text-white">
                  Replace package
                </p>
                <p className="text-[11px] text-slate-500">
                  Drop or click to browse
                </p>
              </div>
            </div>
          ) : (
            <div className="text-center">
              <UploadCloud className="h-6 w-6 text-slate-600 mx-auto mb-1" />
              <p className="text-xs font-medium text-slate-400">
                Drop a Sitecore package
              </p>
              <p className="text-[10px] text-slate-600">
                or click to browse — .zip only
              </p>
            </div>
          )}
        </label>
      </div>

      {error && (
        <div className="mx-4 mt-3 flex items-start gap-2 rounded-lg bg-red-900/30 border border-red-800/50 px-3 py-2.5 text-xs text-red-400">
          <AlertCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
          {error}
        </div>
      )}

      {pkg && !loading && (
        <>
          {/* Actions — first so always visible without scrolling */}
          <Section label="Actions">
            <div className="flex flex-col gap-2">
              {refResult && onRefReport && (
                <button
                  onClick={onRefReport}
                  className={`flex items-center gap-2 text-xs font-medium transition-colors group w-full
                    ${refResult.missing.length > 0 ? "text-amber-400 hover:text-amber-200" : "text-slate-400 hover:text-slate-200"}`}
                >
                  {refResult.missing.length > 0 ? (
                    <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                  ) : (
                    <Link2 className="h-3.5 w-3.5 shrink-0" />
                  )}
                  <span className="underline underline-offset-2 decoration-current/40 group-hover:decoration-current/70">
                    {refResult.missing.length > 0
                      ? `${refResult.missing.length} Missing Ref${refResult.missing.length !== 1 ? "s" : ""}`
                      : "References OK"}
                  </span>
                </button>
              )}

              <div className="flex flex-col gap-2 pt-1">
                <RepackageScriptButton pkg={pkg} />

                <button
                  onClick={async () => {
                    const { exportToExcel } = await import("@/lib/exporter");
                    exportToExcel(pkg);
                  }}
                  className="w-full flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium border bg-transparent text-slate-300 border-slate-600 hover:bg-white hover:text-slate-800 hover:border-white transition-colors"
                >
                  <Download className="h-3.5 w-3.5" />
                  Export
                </button>
              </div>
            </div>
          </Section>

          {/* Package info */}
          <Section label="Package" defaultOpen={false}>
            <MetaRow
              icon={<Tag className="h-3 w-3" />}
              label="Name"
              value={pkg.metadata.name || "—"}
            />
            <MetaRow
              icon={<Hash className="h-3 w-3" />}
              label="Version"
              value={pkg.metadata.version || "—"}
            />
            <MetaRow
              icon={<User className="h-3 w-3" />}
              label="Author"
              value={pkg.metadata.author || "—"}
            />
            {pkg.metadata.publisher && (
              <MetaRow
                icon={<User className="h-3 w-3" />}
                label="Publisher"
                value={pkg.metadata.publisher}
              />
            )}
          </Section>

          {/* Stats */}
          <Section label="Summary" defaultOpen={false}>
            <div className="grid grid-cols-2 gap-2">
              <StatCard label="Items" value={pkg.items.length} />
              <StatCard label="Files" value={pkg.files.length} />
              <StatCard
                label="At Risk"
                value={riskCount}
                danger={riskCount > 0}
              />
              <StatCard
                label="Databases"
                value={new Set(pkg.items.map((i) => i.database)).size}
              />
            </div>
          </Section>

          {riskCount > 0 && (
            <div className="mx-4 mb-1 flex items-start gap-2 rounded-lg bg-amber-500/10 border border-amber-500/20 px-3 py-2.5 text-xs text-amber-400">
              <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
              <span>
                <strong className="text-amber-300">{riskCount}</strong> item
                {riskCount !== 1 ? "s" : ""} with Delete or Overwrite.
              </span>
            </div>
          )}

          <DeployBreakdown pkg={pkg} />
          <TypeBreakdown pkg={pkg} />

          {pkg.files.length > 0 && (
            <Section
              label={`Physical Files (${pkg.files.length})`}
              defaultOpen={false}
            >
              <ul className="space-y-0.5 max-h-40 overflow-y-auto">
                {pkg.files.map((f) => (
                  <li
                    key={f.path}
                    title={f.path}
                    className="text-[11px] font-mono text-slate-500 truncate py-0.5 px-1 rounded hover:bg-slate-800 hover:text-slate-300 transition-colors"
                  >
                    {f.path}
                  </li>
                ))}
              </ul>
            </Section>
          )}

          {pkg.errors.length > 0 && (
            <Section label="Warnings" defaultOpen={false}>
              {pkg.errors.map((e, i) => (
                <p key={i} className="text-[11px] text-red-400 leading-relaxed">
                  {e}
                </p>
              ))}
            </Section>
          )}
        </>
      )}
    </div>
  );
}

function Section({
  label,
  children,
  defaultOpen = true,
}: {
  label: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border-b border-slate-800">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-slate-800/50 transition-colors group"
      >
        <p className="text-[11px] font-semibold text-slate-400 group-hover:text-slate-300">
          {label}
        </p>
        <ChevronDown
          className={`h-3.5 w-3.5 text-slate-500 group-hover:text-slate-300 transition-transform ${open ? "" : "-rotate-90"}`}
        />
      </button>
      {open && <div className="px-4 pb-4">{children}</div>}
    </div>
  );
}

function MetaRow({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-start gap-2 py-0.5">
      <span className="mt-0.5 text-slate-600 shrink-0">{icon}</span>
      <div className="min-w-0 flex-1">
        <span className="text-[10px] text-slate-500">{label}</span>
        <p className="text-xs font-medium text-white break-words leading-tight">
          {value}
        </p>
      </div>
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
      className={`rounded-xl px-3 py-3 text-center border ${
        danger
          ? "bg-red-500/15 border-red-500/30"
          : "bg-slate-800 border-slate-700"
      }`}
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

function DeployBreakdown({ pkg }: { pkg: ParsedPackage }) {
  const modes: DeployMode[] = [
    "Delete",
    "Overwrite",
    "Merge",
    "Skip",
    "Undefined",
  ];
  const counts = Object.fromEntries(
    modes.map((m) => [m, pkg.items.filter((i) => i.deployMode === m).length]),
  ) as Record<DeployMode, number>;
  const active = modes.filter((m) => counts[m] > 0);
  if (active.length === 0) return null;
  const total = pkg.items.length;
  return (
    <Section label="Deploy Modes" defaultOpen={false}>
      <div className="space-y-2.5">
        {active.map((m) => (
          <div key={m}>
            <div className="flex items-center justify-between mb-1">
              <DeployBadge mode={m} variant="dark" />
              <span className="text-xs font-semibold tabular-nums text-slate-500">
                {counts[m]}
              </span>
            </div>
            <div className="h-1 bg-slate-800 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${DEPLOY_BAR_COLOR[m]}`}
                style={{ width: `${Math.max(2, (counts[m] / total) * 100)}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </Section>
  );
}

function TypeBreakdown({ pkg }: { pkg: ParsedPackage }) {
  const typeCounts = new Map<string, number>();
  for (const item of pkg.items)
    typeCounts.set(item.itemType, (typeCounts.get(item.itemType) ?? 0) + 1);
  const sorted = Array.from(typeCounts.entries()).sort((a, b) => b[1] - a[1]);
  if (sorted.length === 0) return null;
  return (
    <Section label="Item Types" defaultOpen={false}>
      <div className="space-y-1.5">
        {sorted.map(([type, count]) => (
          <div key={type} className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <TypeDot type={type} />
              <span className="text-xs text-slate-300">{type}</span>
            </div>
            <span className="text-xs font-semibold tabular-nums text-white">
              {count}
            </span>
          </div>
        ))}
      </div>
    </Section>
  );
}

function TypeDot({ type }: { type: string }) {
  const colors: Record<string, string> = {
    Template: "bg-violet-400",
    "Template Field": "bg-violet-300",
    "Template Section": "bg-purple-400",
    Rendering: "bg-blue-400",
    Layout: "bg-sky-400",
    Placeholder: "bg-cyan-400",
    Media: "bg-emerald-400",
    Setting: "bg-amber-400",
    Content: "bg-slate-400",
    Unknown: "bg-slate-600",
  };
  return (
    <span
      className={`w-2 h-2 rounded-full shrink-0 ${colors[type] ?? "bg-slate-600"}`}
    />
  );
}
