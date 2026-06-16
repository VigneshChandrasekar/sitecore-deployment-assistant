"use client";

import { useState } from "react";
import type { LogAnalysis } from "@/lib/logTypes";
import { X, Copy, Check } from "lucide-react";

interface Props {
  analysis: LogAnalysis;
  filteredCount: number;
  onClose: () => void;
}

function buildPrompt(analysis: LogAnalysis, filteredCount: number): string {
  const {
    levelBreakdown,
    exceptionGroups,
    categoryBreakdown,
    spikes,
    hotThreads,
    alertTriggers,
    earliestEntry,
    latestEntry,
    files,
  } = analysis;

  const fmt = (d: Date | null) => (d ? d.toISOString() : "—");
  const fmtNum = (n: number | undefined) => (n ?? 0).toLocaleString();

  const lines: string[] = [];

  lines.push("# Sitecore Log Analysis — Please Help Investigate");
  lines.push("");
  lines.push("## Overview");
  lines.push(
    `- Files: ${files.map((f) => f.fileName.split(/[\\/]/).pop()).join(", ")}`,
  );
  lines.push(`- Time range: ${fmt(earliestEntry)} → ${fmt(latestEntry)}`);
  lines.push(
    `- Total entries: ${fmtNum(analysis.allEntries.length)} (filtered view: ${fmtNum(filteredCount)})`,
  );
  lines.push("");

  lines.push("## Level Breakdown");
  for (const [level, count] of Object.entries(levelBreakdown)) {
    lines.push(`- ${level}: ${fmtNum(count)}`);
  }
  lines.push("");

  lines.push("## Category Breakdown");
  for (const [cat, count] of Object.entries(categoryBreakdown)) {
    lines.push(`- ${cat}: ${fmtNum(count as number)}`);
  }
  lines.push("");

  if (exceptionGroups.length > 0) {
    lines.push("## Top Exceptions (by frequency)");
    for (const eg of exceptionGroups.slice(0, 10)) {
      lines.push(`- **${eg.exceptionType}** × ${eg.count}`);
      if (eg.representativeEntry.stackTrace.length > 0) {
        lines.push(
          `  Stack (top): ${eg.representativeEntry.stackTrace.slice(0, 3).join(" | ")}`,
        );
      }
      lines.push(
        `  Sample message: ${eg.representativeEntry.message.slice(0, 200)}`,
      );
    }
    lines.push("");
  }

  if (spikes.length > 0) {
    lines.push("## Error Spikes");
    for (const s of spikes) {
      lines.push(
        `- ${fmt(s.start)}: ${s.errorCount} errors${s.dominantException ? ` (dominant: ${s.dominantException})` : ""}`,
      );
    }
    lines.push("");
  }

  if (hotThreads.length > 0) {
    lines.push("## Hot Threads (most errors)");
    for (const { thread, errorCount } of hotThreads.slice(0, 5)) {
      lines.push(`- Thread "${thread}": ${errorCount} errors`);
    }
    lines.push("");
  }

  if (alertTriggers.length > 0) {
    lines.push("## Alert Triggers");
    for (const t of alertTriggers) {
      lines.push(
        `- "${t.rule.label}": ${t.count} events in ${t.rule.windowMinutes}min at ${fmt(t.windowStart)}`,
      );
    }
    lines.push("");
  }

  lines.push("## Sample Error/Fatal Messages");
  const samples = analysis.allEntries
    .filter((e) => e.level === "ERROR" || e.level === "FATAL")
    .slice(0, 15);
  for (const e of samples) {
    lines.push(
      `- [${fmt(e.timestamp)}] ${e.level} ${e.exceptionType ? `(${e.exceptionType}) ` : ""}${e.message.slice(0, 250)}`,
    );
  }
  lines.push("");

  lines.push("## Request");
  lines.push("Please analyse the above Sitecore log data and:");
  lines.push("1. Identify the most likely root cause(s) of the errors");
  lines.push(
    "2. Explain what each major exception type means in a Sitecore context",
  );
  lines.push("3. Suggest concrete remediation steps");
  lines.push(
    "4. Flag anything that looks like a critical or cascading failure",
  );

  return lines.join("\n");
}

export default function ClaudePromptModal({
  analysis,
  filteredCount,
  onClose,
}: Props) {
  const [copied, setCopied] = useState(false);
  const prompt = buildPrompt(analysis, filteredCount);

  async function handleCopy() {
    await navigator.clipboard.writeText(prompt);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-xl shadow-2xl w-[680px] max-h-[80vh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200">
          <div>
            <h2 className="text-[14px] font-semibold text-slate-800">
              Ask Claude
            </h2>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Copy this prompt and paste it into claude.ai for AI-powered log
              analysis
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 overflow-auto p-4">
          <pre className="text-[11px] text-slate-700 font-mono whitespace-pre-wrap bg-slate-50 rounded-lg p-4 border border-slate-200 leading-relaxed">
            {prompt}
          </pre>
        </div>

        <div className="flex items-center justify-between px-5 py-3 border-t border-slate-200">
          <p className="text-[11px] text-slate-400">
            {prompt.length.toLocaleString()} characters · Copy and paste into{" "}
            <span className="text-violet-600 font-medium">claude.ai</span>
          </p>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="px-4 py-1.5 text-[12px] text-slate-600 hover:bg-slate-100 rounded"
            >
              Close
            </button>
            <button
              onClick={handleCopy}
              className="flex items-center gap-1.5 px-4 py-1.5 text-[12px] bg-violet-600 text-white rounded hover:bg-violet-700 transition-colors"
            >
              {copied ? (
                <Check className="h-3.5 w-3.5" />
              ) : (
                <Copy className="h-3.5 w-3.5" />
              )}
              {copied ? "Copied!" : "Copy prompt"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
