"use client";

import type { LogAnalysis, LogCategory } from "@/lib/logTypes";

interface Props {
  analysis: LogAnalysis;
  onThreadFilter: (thread: string) => void;
}

const CATEGORY_LABELS: Record<LogCategory, string> = {
  publishing: "Publishing",
  search: "Search / Index",
  jobs: "Jobs",
  cache: "Cache",
  security: "Security",
  pipelines: "Pipelines",
  media: "Media",
  xa: "SXA",
  xconnect: "xConnect",
  sync: "Sync",
  general: "General",
};

function fmtTime(d: Date | null) {
  if (!d) return "—";
  return d.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function Section({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mb-4">
      <div className="text-[10px] font-semibold uppercase tracking-widest text-slate-400 mb-2">
        {label}
      </div>
      {children}
    </div>
  );
}

export default function LogDetailPanel({ analysis, onThreadFilter }: Props) {
  const topExceptions = analysis.exceptionGroups.slice(0, 6);
  const catEntries = (
    Object.entries(analysis.categoryBreakdown) as [LogCategory, number][]
  ).sort((a, b) => b[1] - a[1]);
  const total = catEntries.reduce((s, [, n]) => s + n, 0);
  const hotThreads = analysis.hotThreads.slice(0, 5);
  const triggers = analysis.alertTriggers;

  return (
    <div className="w-56 shrink-0 flex flex-col bg-white border-l border-slate-200 overflow-y-auto px-3 py-3 text-[11px]">
      <Section label="Top Exceptions">
        {topExceptions.length === 0 ? (
          <p className="text-slate-400 text-[11px]">None found</p>
        ) : (
          topExceptions.map((eg) => (
            <div
              key={eg.key}
              className="mb-2 border border-slate-100 rounded p-2"
            >
              <div
                className="text-orange-600 font-medium truncate"
                title={eg.exceptionType}
              >
                {eg.exceptionType}
              </div>
              <div className="flex items-center justify-between text-slate-400 mt-0.5">
                <span>{eg.count}× occurrences</span>
                <span className="text-[9px]">{fmtTime(eg.lastSeen)}</span>
              </div>
            </div>
          ))
        )}
      </Section>

      <Section label="Category Breakdown">
        {catEntries.map(([cat, count]) => {
          const pct = total === 0 ? 0 : Math.round((count / total) * 100);
          return (
            <div key={cat} className="mb-1.5">
              <div className="flex justify-between text-slate-600 mb-0.5">
                <span>{CATEGORY_LABELS[cat] ?? cat}</span>
                <span className="text-slate-400 tabular-nums">{count}</span>
              </div>
              <div className="h-1.5 rounded-full bg-slate-100">
                <div
                  className="h-full rounded-full bg-blue-400"
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
          );
        })}
      </Section>

      {hotThreads.length > 0 && (
        <Section label="Hot Threads">
          {hotThreads.map(({ thread, errorCount }) => (
            <button
              key={thread}
              onClick={() => onThreadFilter(thread)}
              className="w-full flex items-center justify-between mb-1 px-2 py-1 rounded hover:bg-slate-50 text-left"
            >
              <span className="text-slate-600 truncate text-[10px]">
                {thread}
              </span>
              <span className="shrink-0 ml-1 text-red-500 font-semibold tabular-nums">
                {errorCount}×
              </span>
            </button>
          ))}
        </Section>
      )}

      {triggers.length > 0 && (
        <Section label="Alert Triggers">
          {triggers.map((t, i) => (
            <div
              key={i}
              className="mb-2 rounded bg-red-50 border border-red-200 p-2"
            >
              <div className="text-red-700 font-medium">{t.rule.label}</div>
              <div className="text-red-500 mt-0.5">
                {t.count} events in {t.rule.windowMinutes}min @{" "}
                {fmtTime(t.windowStart)}
              </div>
            </div>
          ))}
        </Section>
      )}

      <Section label="Time Range">
        <div className="flex flex-col gap-1 text-slate-500">
          <div>
            <span className="text-slate-400">From: </span>
            {fmtTime(analysis.earliestEntry)}
          </div>
          <div>
            <span className="text-slate-400">To: </span>
            {fmtTime(analysis.latestEntry)}
          </div>
        </div>
      </Section>
    </div>
  );
}
