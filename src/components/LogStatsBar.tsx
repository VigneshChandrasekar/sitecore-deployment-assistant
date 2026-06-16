"use client";

import type { LogAnalysis } from "@/lib/logTypes";
import { AlertTriangle, XCircle, Layers, Zap, Filter } from "lucide-react";

interface Props {
  analysis: LogAnalysis;
  filteredCount: number;
}

function fmt(n: number | undefined) {
  return (n ?? 0).toLocaleString();
}

function fmtTime(d: Date | null) {
  if (!d) return "—";
  return d.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

export default function LogStatsBar({ analysis, filteredCount }: Props) {
  const errors =
    (analysis.levelBreakdown["ERROR"] ?? 0) +
    (analysis.levelBreakdown["FATAL"] ?? 0);
  const warnings = analysis.levelBreakdown["WARN"] ?? 0;
  const uniqueExceptions = analysis.exceptionGroups.length;

  const peak = analysis.peakBucket;
  const peakTotal = peak ? peak.error + peak.warn : 0;
  const peakLabel = peak
    ? `${peakTotal} events @ ${fmtTime(peak.start)}`
    : "None";

  const stats = [
    {
      icon: XCircle,
      label: "Errors / Fatals",
      value: fmt(errors),
      accent: errors > 0 ? "text-red-600" : "text-slate-500",
      bg: errors > 0 ? "bg-red-50" : "bg-white",
    },
    {
      icon: AlertTriangle,
      label: "Warnings",
      value: fmt(warnings),
      accent: warnings > 0 ? "text-amber-600" : "text-slate-500",
      bg: warnings > 0 ? "bg-amber-50" : "bg-white",
    },
    {
      icon: Layers,
      label: "Unique exceptions",
      value: fmt(uniqueExceptions),
      accent: uniqueExceptions > 0 ? "text-orange-600" : "text-slate-500",
      bg: "bg-white",
    },
    {
      icon: Zap,
      label: "Peak activity",
      value: peakLabel,
      accent: peak ? "text-purple-600" : "text-slate-400",
      bg: peak ? "bg-purple-50" : "bg-white",
    },
    {
      icon: Filter,
      label: "Visible entries",
      value: fmt(filteredCount),
      accent: "text-blue-600",
      bg: "bg-blue-50",
    },
  ];

  return (
    <div className="shrink-0 grid grid-cols-5 gap-px bg-slate-200 border-b border-slate-200">
      {stats.map(({ icon: Icon, label, value, accent, bg }) => (
        <div
          key={label}
          className={`${bg} px-4 py-2.5 flex items-center gap-2.5`}
        >
          <Icon className={`h-4 w-4 shrink-0 ${accent}`} strokeWidth={2} />
          <div className="min-w-0">
            <p className="text-[12px] text-slate-400 leading-none">{label}</p>
            <p
              className={`text-[14px] font-semibold leading-tight mt-0.5 truncate ${accent}`}
            >
              {value}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}
