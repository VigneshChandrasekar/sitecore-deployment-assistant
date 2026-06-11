"use client";

import { useCallback, useState } from "react";
import {
  UploadCloud,
  FileArchive,
  AlertCircle,
  AlertTriangle,
  User,
  Tag,
  Hash,
} from "lucide-react";
import type { ParsedPackage, DeployMode } from "@/lib/types";
import DeployBadge from "./DeployBadge";

interface Props {
  onParsed: (pkg: ParsedPackage) => void;
  pkg: ParsedPackage | null;
  loading: boolean;
  setLoading: (v: boolean) => void;
}

const RISK_MODES: DeployMode[] = ["Delete", "Overwrite"];

const DEPLOY_BAR_COLOR: Record<DeployMode, string> = {
  Delete:    "bg-red-500",
  Overwrite: "bg-amber-500",
  Merge:     "bg-blue-500",
  Skip:      "bg-emerald-500",
  Undefined: "bg-slate-600",
};

export default function UploadPanel({
  onParsed,
  pkg,
  loading,
  setLoading,
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
        const buffer = await file.arrayBuffer();
        const result = await parsePackage(buffer);
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
    <div className="flex flex-col gap-0 h-full">
      {/* Upload zone */}
      <div className="p-4 border-b border-slate-800/80">
        <label
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={onDrop}
          className={`flex flex-col items-center justify-center gap-2.5 rounded-xl border-2 border-dashed cursor-pointer transition-all
            ${pkg ? "p-3" : "p-7"}
            ${dragOver
              ? "border-blue-500 bg-blue-500/5"
              : "border-slate-700 hover:border-slate-400 hover:bg-white/10 hover:shadow-md hover:-translate-y-0.5"}
            ${loading ? "pointer-events-none opacity-50" : ""}`}
        >
          <input type="file" accept=".zip" className="hidden" onChange={onChange} />
          {loading ? (
            <div className="flex items-center gap-2.5 text-slate-400">
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-slate-700 border-t-blue-500" />
              <span className="text-xs font-medium">Parsing package…</span>
            </div>
          ) : pkg ? (
            <div className="flex items-center gap-2">
              <FileArchive className="h-4 w-4 text-blue-400 shrink-0" />
              <div className="text-left">
                <p className="text-xs font-semibold text-slate-300">Replace package</p>
                <p className="text-[11px] text-slate-600">Drop or click to browse</p>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-3 text-center">
              <div className="flex items-center justify-center w-12 h-12 rounded-2xl bg-slate-800 ring-1 ring-slate-700">
                <UploadCloud className="h-6 w-6 text-slate-500" />
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-300">Drop a Sitecore package</p>
                <p className="text-xs text-slate-600 mt-0.5">or click to browse — .zip only</p>
              </div>
            </div>
          )}
        </label>
      </div>

      {error && (
        <div className="mx-4 mt-3 flex items-start gap-2 rounded-lg bg-red-900/20 border border-red-800/40 px-3 py-2.5 text-xs text-red-400">
          <AlertCircle className="h-3.5 w-3.5 mt-0.5 shrink-0 text-red-500" />
          {error}
        </div>
      )}

      {pkg && !loading && (
        <div className="flex-1 overflow-y-auto">
          {/* Package info */}
          <DarkSection label="Package">
            <DarkMetaRow icon={<Tag className="h-3 w-3" />}  label="Name"      value={pkg.metadata.name || "—"} />
            <DarkMetaRow icon={<Hash className="h-3 w-3" />} label="Version"   value={pkg.metadata.version || "—"} />
            <DarkMetaRow icon={<User className="h-3 w-3" />} label="Author"    value={pkg.metadata.author || "—"} />
            {pkg.metadata.publisher && (
              <DarkMetaRow icon={<User className="h-3 w-3" />} label="Publisher" value={pkg.metadata.publisher} />
            )}
          </DarkSection>

          {/* Stats */}
          <DarkSection label="Summary">
            <div className="grid grid-cols-2 gap-2">
              <StatCard label="Items"     value={pkg.items.length} />
              <StatCard label="Files"     value={pkg.files.length} />
              <StatCard label="At Risk"   value={riskCount} danger={riskCount > 0} />
              <StatCard label="Databases" value={new Set(pkg.items.map((i) => i.database)).size} />
            </div>
          </DarkSection>

          {/* Risk callout */}
          {riskCount > 0 && (
            <div className="mx-4 mb-1 flex items-start gap-2 rounded-lg bg-amber-500/10 border border-amber-500/20 px-3 py-2.5 text-xs text-amber-400">
              <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0 text-amber-500" />
              <span>
                <strong className="text-amber-300">{riskCount}</strong>{" "}
                item{riskCount !== 1 ? "s" : ""} with Delete or Overwrite — review before deploying.
              </span>
            </div>
          )}

          {/* Deploy modes */}
          <DeployBreakdown pkg={pkg} />

          {/* Item types */}
          <TypeBreakdown pkg={pkg} />

          {/* Physical files */}
          {pkg.files.length > 0 && (
            <DarkSection label={`Physical Files (${pkg.files.length})`}>
              <ul className="space-y-0.5 max-h-40 overflow-y-auto">
                {pkg.files.map((f) => (
                  <li
                    key={f.path}
                    title={f.path}
                    className="text-[11px] font-mono text-slate-500 truncate py-0.5 px-1 rounded hover:bg-slate-800 hover:text-slate-400 transition-colors"
                  >
                    {f.path}
                  </li>
                ))}
              </ul>
            </DarkSection>
          )}

          {/* Parse warnings */}
          {pkg.errors.length > 0 && (
            <DarkSection label="Warnings">
              {pkg.errors.map((e, i) => (
                <p key={i} className="text-[11px] text-red-400 leading-relaxed">{e}</p>
              ))}
            </DarkSection>
          )}
        </div>
      )}
    </div>
  );
}

function DarkSection({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="px-4 py-3 border-b border-slate-800/80">
      <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2.5">{label}</p>
      {children}
    </div>
  );
}

function DarkMetaRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-start gap-2 py-0.5">
      <span className="mt-0.5 text-slate-400 shrink-0">{icon}</span>
      <div className="min-w-0 flex-1">
        <span className="text-[10px] text-slate-400">{label}</span>
        <p className="text-xs font-medium text-slate-100 break-words leading-tight">{value}</p>
      </div>
    </div>
  );
}

function StatCard({ label, value, danger }: { label: string; value: number; danger?: boolean }) {
  return (
    <div
      className={`rounded-xl px-3 py-3 text-center border ${
        danger
          ? "bg-red-500/15 border-red-500/30"
          : "bg-slate-800 border-slate-700"
      }`}
    >
      <p className={`text-2xl font-bold leading-none tabular-nums ${danger ? "text-red-300" : "text-white"}`}>
        {value}
      </p>
      <p className={`text-[10px] mt-1 font-medium uppercase tracking-wide ${danger ? "text-red-400" : "text-slate-400"}`}>
        {label}
      </p>
    </div>
  );
}

function DeployBreakdown({ pkg }: { pkg: ParsedPackage }) {
  const modes: DeployMode[] = ["Delete", "Overwrite", "Merge", "Skip", "Undefined"];
  const counts = Object.fromEntries(
    modes.map((m) => [m, pkg.items.filter((i) => i.deployMode === m).length]),
  ) as Record<DeployMode, number>;

  const active = modes.filter((m) => counts[m] > 0);
  if (active.length === 0) return null;

  const total = pkg.items.length;

  return (
    <DarkSection label="Deploy Modes">
      <div className="space-y-2.5">
        {active.map((m) => (
          <div key={m}>
            <div className="flex items-center justify-between mb-1">
              <DeployBadge mode={m} variant="dark" />
              <span className="text-xs font-semibold tabular-nums text-slate-400">{counts[m]}</span>
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
    </DarkSection>
  );
}

function TypeBreakdown({ pkg }: { pkg: ParsedPackage }) {
  const typeCounts = new Map<string, number>();
  for (const item of pkg.items) {
    typeCounts.set(item.itemType, (typeCounts.get(item.itemType) ?? 0) + 1);
  }
  const sorted = Array.from(typeCounts.entries()).sort((a, b) => b[1] - a[1]);
  if (sorted.length === 0) return null;

  return (
    <DarkSection label="Item Types">
      <div className="space-y-1.5">
        {sorted.map(([type, count]) => (
          <div key={type} className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <TypeDot type={type} />
              <span className="text-xs text-slate-400">{type}</span>
            </div>
            <span className="text-xs font-semibold tabular-nums text-slate-300">{count}</span>
          </div>
        ))}
      </div>
    </DarkSection>
  );
}

function TypeDot({ type }: { type: string }) {
  const colors: Record<string, string> = {
    Template:          "bg-violet-500",
    "Template Field":  "bg-violet-400",
    "Template Section":"bg-purple-500",
    Rendering:         "bg-blue-500",
    Layout:            "bg-sky-500",
    Placeholder:       "bg-cyan-500",
    Media:             "bg-emerald-500",
    Setting:           "bg-amber-500",
    Content:           "bg-slate-500",
    Unknown:           "bg-slate-700",
  };
  return <span className={`w-2 h-2 rounded-full shrink-0 ${colors[type] ?? "bg-slate-700"}`} />;
}
