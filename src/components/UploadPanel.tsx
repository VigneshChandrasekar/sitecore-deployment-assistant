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
    <div className="flex flex-col gap-0">
      {/* Upload zone */}
      <div className="p-4 border-b border-slate-100">
        <label
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={onDrop}
          className={`flex flex-col items-center justify-center gap-2.5 rounded-lg border-2 border-dashed p-6 cursor-pointer transition-all
            ${dragOver ? "border-blue-400 bg-blue-50" : "border-slate-200 hover:border-slate-300 hover:bg-slate-50"}
            ${loading ? "pointer-events-none opacity-60" : ""}`}
        >
          <input
            type="file"
            accept=".zip"
            className="hidden"
            onChange={onChange}
          />
          {loading ? (
            <div className="flex flex-col items-center gap-2 text-slate-500">
              <div className="h-7 w-7 animate-spin rounded-full border-2 border-slate-200 border-t-blue-500" />
              <span className="text-xs font-medium">Parsing package…</span>
            </div>
          ) : pkg ? (
            <div className="flex items-center gap-2 text-center">
              <FileArchive className="h-5 w-5 text-blue-500 shrink-0" />
              <div className="text-left">
                <p className="text-xs font-semibold text-slate-700">
                  Replace package
                </p>
                <p className="text-[11px] text-slate-400">
                  Drop file or click to browse
                </p>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2 text-center">
              <UploadCloud className="h-9 w-9 text-slate-300" />
              <div>
                <p className="text-sm font-semibold text-slate-700">
                  Drop a Sitecore package
                </p>
                <p className="text-xs text-slate-400 mt-0.5">
                  or click to browse — .zip only
                </p>
              </div>
            </div>
          )}
        </label>
      </div>

      {error && (
        <div className="mx-4 mt-3 flex items-start gap-2 rounded-md bg-red-50 border border-red-200 px-3 py-2 text-xs text-red-700">
          <AlertCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
          {error}
        </div>
      )}

      {pkg && !loading && (
        <>
          {/* Package info */}
          <Section label="Package">
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
          <Section label="Summary">
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

          {/* Risk callout */}
          {riskCount > 0 && (
            <div className="mx-4 mb-1 flex items-start gap-2 rounded-lg bg-amber-50 border border-amber-200 px-3 py-2.5 text-xs text-amber-800">
              <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0 text-amber-500" />
              <span>
                <strong>{riskCount}</strong> item{riskCount !== 1 ? "s" : ""}{" "}
                with Delete or Overwrite — review before deploying.
              </span>
            </div>
          )}

          {/* Deploy modes */}
          <DeployBreakdown pkg={pkg} />

          {/* Item types */}
          <TypeBreakdown pkg={pkg} />

          {/* Physical files */}
          {pkg.files.length > 0 && (
            <Section label={`Physical Files (${pkg.files.length})`}>
              <ul className="space-y-0.5 max-h-40 overflow-y-auto">
                {pkg.files.map((f) => (
                  <li
                    key={f.path}
                    title={f.path}
                    className="text-[11px] font-mono text-slate-500 truncate py-0.5 px-1 rounded hover:bg-slate-50"
                  >
                    {f.path}
                  </li>
                ))}
              </ul>
            </Section>
          )}

          {/* Parse warnings */}
          {pkg.errors.length > 0 && (
            <Section label="Warnings">
              {pkg.errors.map((e, i) => (
                <p key={i} className="text-[11px] text-red-600 leading-relaxed">
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
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="px-4 py-3 border-b border-slate-100">
      <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2">
        {label}
      </p>
      {children}
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
      <span className="mt-0.5 text-slate-400 shrink-0">{icon}</span>
      <div className="min-w-0 flex-1">
        <span className="text-[10px] text-slate-400">{label}</span>
        <p className="text-xs font-medium text-slate-800 break-words leading-tight">
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
      className={`rounded-lg px-3 py-2 text-center ${danger ? "bg-red-50 border border-red-100" : "bg-slate-50 border border-slate-100"}`}
    >
      <p
        className={`text-lg font-bold leading-none ${danger ? "text-red-600" : "text-slate-800"}`}
      >
        {value}
      </p>
      <p
        className={`text-[10px] mt-0.5 ${danger ? "text-red-500" : "text-slate-400"}`}
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

  return (
    <Section label="Deploy Modes">
      <div className="space-y-1.5">
        {active.map((m) => (
          <div key={m} className="flex items-center justify-between">
            <DeployBadge mode={m} />
            <span className="text-xs font-semibold text-slate-600">
              {counts[m]}
            </span>
          </div>
        ))}
      </div>
    </Section>
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
    <Section label="Item Types">
      <div className="space-y-1.5">
        {sorted.map(([type, count]) => (
          <div key={type} className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <TypeDot type={type} />
              <span className="text-xs text-slate-700">{type}</span>
            </div>
            <span className="text-xs font-semibold text-slate-500">
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
    Template: "bg-violet-500",
    "Template Field": "bg-violet-300",
    "Template Section": "bg-purple-400",
    Rendering: "bg-blue-500",
    Layout: "bg-sky-500",
    Placeholder: "bg-cyan-500",
    Media: "bg-emerald-500",
    Setting: "bg-amber-500",
    Content: "bg-slate-400",
    Unknown: "bg-slate-300",
  };
  return (
    <span
      className={`w-2 h-2 rounded-full shrink-0 ${colors[type] ?? "bg-slate-300"}`}
    />
  );
}
