"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import type { LogAnalysis } from "@/lib/logTypes";
import { analyzeLogFiles } from "@/lib/logAnalyzer";
import LogDropZone from "@/components/LogDropZone";
import LogStatsBar from "@/components/LogStatsBar";
import LogTimeline from "@/components/LogTimeline";
import LogList from "@/components/LogList";
import LogSidebar from "@/components/LogSidebar";
import ClaudePromptModal from "@/components/ClaudePromptModal";
import { Bot, X, Loader2 } from "lucide-react";

export default function LogAnalyzerPage() {
  const [analysis, setAnalysis] = useState<LogAnalysis | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingMsg, setLoadingMsg] = useState("");
  const [showClaudeModal, setShowClaudeModal] = useState(false);

  // Filters
  const [levelFilter, setLevelFilter] = useState<Set<string>>(new Set());
  const [categoryFilter, setCategoryFilter] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState("");
  const [timeRange, setTimeRange] = useState<{ start: Date; end: Date } | null>(
    null,
  );
  const [threadFilter, setThreadFilter] = useState<string | null>(null);
  const [startInput, setStartInput] = useState("");
  const [endInput, setEndInput] = useState("");

  const workerRef = useRef<Worker | null>(null);
  const pendingRef = useRef<Map<number, (result: unknown) => void>>(new Map());
  const idRef = useRef(0);

  useEffect(() => {
    return () => {
      workerRef.current?.terminate();
    };
  }, []);

  function getWorker(): Worker {
    if (!workerRef.current) {
      workerRef.current = new Worker("/logWorker.js");
      workerRef.current.onmessage = (e) => {
        const { id, type, result, error } = e.data;
        const resolve = pendingRef.current.get(id);
        if (resolve) {
          pendingRef.current.delete(id);
          resolve(type === "error" ? { error } : result);
        }
      };
    }
    return workerRef.current;
  }

  function parseInWorker(content: string, fileName: string): Promise<unknown> {
    return new Promise((resolve) => {
      const id = idRef.current++;
      pendingRef.current.set(id, resolve);
      getWorker().postMessage({ id, content, fileName });
    });
  }

  const handleFiles = useCallback(
    async (files: { name: string; content: string }[]) => {
      setLoading(true);
      setAnalysis(null);
      setTimeRange(null);
      setLevelFilter(new Set());
      setCategoryFilter(new Set());
      setSearchQuery("");
      setThreadFilter(null);

      try {
        const parsedFiles = [];
        for (let i = 0; i < files.length; i++) {
          setLoadingMsg(`Parsing ${files[i].name} (${i + 1}/${files.length})…`);
          const result = (await parseInWorker(
            files[i].content,
            files[i].name,
          )) as
            | {
                fileName: string;
                format: string;
                entries: { timestamp: string | null; [key: string]: unknown }[];
                parseErrors: string[];
                totalLines: number;
              }
            | { error: string };

          if ("error" in result) {
            console.error("Parse error", result.error);
          } else {
            const entries = result.entries.map((e) => ({
              ...e,
              timestamp: e.timestamp ? new Date(e.timestamp as string) : null,
            }));
            parsedFiles.push({ ...result, entries });
          }
        }

        setLoadingMsg("Analysing…");
        await new Promise((r) => setTimeout(r, 0));
        const result = analyzeLogFiles(
          parsedFiles as Parameters<typeof analyzeLogFiles>[0],
        );
        setAnalysis(result);
      } finally {
        setLoading(false);
        setLoadingMsg("");
      }
    },
    [],
  );

  function applyCustomRange(ref: Date | null) {
    if (!ref) return;
    const [sh, sm] = startInput.split(":").map(Number);
    const [eh, em] = endInput.split(":").map(Number);
    if (isNaN(sh) || isNaN(eh)) return;
    const start = new Date(ref);
    start.setHours(sh, sm, 0, 0);
    const end = new Date(ref);
    end.setHours(eh, em, 0, 0);
    if (end <= start) end.setDate(end.getDate() + 1);
    setTimeRange({ start, end });
  }

  function clearTimeRange() {
    setTimeRange(null);
    setStartInput("");
    setEndInput("");
  }

  const handleClear = () => {
    setAnalysis(null);
    setLevelFilter(new Set());
    setCategoryFilter(new Set());
    setSearchQuery("");
    setTimeRange(null);
    setStartInput("");
    setEndInput("");
    setThreadFilter(null);
  };

  const filteredEntries = analysis
    ? analysis.allEntries.filter((e) => {
        if (levelFilter.size > 0 && !levelFilter.has(e.level)) return false;
        if (categoryFilter.size > 0 && !categoryFilter.has(e.category))
          return false;
        if (threadFilter && e.thread !== threadFilter) return false;
        if (timeRange && e.timestamp) {
          if (e.timestamp < timeRange.start || e.timestamp > timeRange.end)
            return false;
        }
        if (searchQuery) {
          const q = searchQuery.toLowerCase();
          if (
            !e.message.toLowerCase().includes(q) &&
            !e.logger.toLowerCase().includes(q) &&
            !e.exceptionType?.toLowerCase().includes(q)
          )
            return false;
        }
        return true;
      })
    : [];

  return (
    <div className="flex-1 overflow-hidden flex flex-col">
      {/* Toolbar */}
      <div className="shrink-0 flex items-center gap-3 px-4 h-11 bg-white border-b border-slate-200">
        <span className="text-[14px] font-semibold text-slate-700">
          Log Analyzer
        </span>
        <div className="flex-1" />
        {analysis && (
          <>
            <span className="text-[12px] text-slate-400">
              {analysis.allEntries.length.toLocaleString()} entries ·{" "}
              {analysis.files.length} file
              {analysis.files.length !== 1 ? "s" : ""}
            </span>
            <button
              onClick={() => setShowClaudeModal(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded text-[13px] font-medium bg-violet-600 text-white hover:bg-violet-700 transition-colors"
            >
              <Bot className="h-4 w-4" />
              Ask AI
            </button>
            <button
              onClick={handleClear}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded text-[13px] font-medium bg-slate-100 text-slate-700 hover:bg-slate-200 transition-colors"
            >
              <X className="h-4 w-4" />
              Clear
            </button>
          </>
        )}
      </div>

      {/* Main content */}
      {loading ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-3 bg-slate-50">
          <Loader2 className="h-8 w-8 text-blue-500 animate-spin" />
          <p className="text-[14px] text-slate-500">
            {loadingMsg || "Processing…"}
          </p>
        </div>
      ) : !analysis ? (
        <div className="flex-1 overflow-auto bg-slate-50 p-8">
          <LogDropZone onFiles={handleFiles} />
        </div>
      ) : (
        <div className="flex-1 flex overflow-hidden">
          {/* Left sidebar */}
          <LogSidebar
            analysis={analysis}
            levelFilter={levelFilter}
            categoryFilter={categoryFilter}
            threadFilter={threadFilter}
            onLevelFilter={setLevelFilter}
            onCategoryFilter={setCategoryFilter}
            onThreadFilter={setThreadFilter}
            onClear={handleClear}
          />

          {/* Center — full width now, no right panel */}
          <div className="flex-1 flex flex-col overflow-hidden bg-slate-50">
            <LogStatsBar
              analysis={analysis}
              filteredCount={filteredEntries.length}
            />
            <LogTimeline
              timeline={analysis.timeline}
              spikes={analysis.spikes}
              bucketMs={analysis.bucketMs}
              timeRange={timeRange}
              onBarClick={(start, end) => {
                setTimeRange({ start, end });
                setStartInput(start.toTimeString().slice(0, 5));
                setEndInput(end.toTimeString().slice(0, 5));
              }}
            />
            <div className="shrink-0 bg-white border-b border-slate-200">
              {/* Row 1: Search left, time range controls right */}
              <div className="flex items-center gap-2 px-3 pt-2 pb-1">
                <input
                  type="text"
                  placeholder="Search messages, loggers, exceptions…"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="flex-1 px-3 py-1.5 text-[13px] rounded border border-slate-300 bg-slate-50 focus:outline-none focus:border-blue-400 focus:bg-white"
                />
                <span className="text-[12px] text-slate-400 shrink-0 tabular-nums">
                  {filteredEntries.length.toLocaleString()} /{" "}
                  {analysis.allEntries.length.toLocaleString()}
                </span>
                <span className="w-px h-5 bg-slate-200 shrink-0" />
                <button
                  onClick={clearTimeRange}
                  className={`px-2 py-1 rounded text-[12px] font-medium shrink-0 transition-colors ${!timeRange ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}
                >
                  All
                </button>
                <span className="text-[12px] text-slate-400 shrink-0">
                  From
                </span>
                <input
                  type="time"
                  value={startInput}
                  onChange={(e) => setStartInput(e.target.value)}
                  onKeyDown={(e) =>
                    e.key === "Enter" &&
                    applyCustomRange(analysis.earliestEntry)
                  }
                  className="px-2 py-1 text-[12px] rounded border border-slate-300 bg-white text-slate-700 focus:outline-none focus:border-blue-400 shrink-0"
                />
                <span className="text-[12px] text-slate-400 shrink-0">to</span>
                <input
                  type="time"
                  value={endInput}
                  onChange={(e) => setEndInput(e.target.value)}
                  onKeyDown={(e) =>
                    e.key === "Enter" &&
                    applyCustomRange(analysis.earliestEntry)
                  }
                  className="px-2 py-1 text-[12px] rounded border border-slate-300 bg-white text-slate-700 focus:outline-none focus:border-blue-400 shrink-0"
                />
                <button
                  onClick={() => applyCustomRange(analysis.earliestEntry)}
                  disabled={!startInput || !endInput}
                  className="px-2.5 py-1 rounded text-[12px] font-medium bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed shrink-0 transition-colors"
                >
                  Apply
                </button>
              </div>

              {/* Row 2: Filters right-aligned */}
              <div className="flex items-center justify-end gap-4 px-3 pb-2">
                <span className="text-[12px] font-semibold text-slate-500">
                  Filters
                </span>
                {(["FATAL", "ERROR", "WARN", "INFO", "DEBUG"] as const).map(
                  (lvl) => {
                    const count = analysis.levelBreakdown[lvl] ?? 0;
                    if (count === 0) return null;
                    const active = levelFilter.has(lvl);
                    const LABEL: Record<string, string> = {
                      FATAL: "Fatal",
                      ERROR: "Error",
                      WARN: "Warn",
                      INFO: "Info",
                      DEBUG: "Debug",
                    };
                    const checkColor: Record<string, string> = {
                      FATAL: "accent-red-700",
                      ERROR: "accent-red-500",
                      WARN: "accent-amber-500",
                      INFO: "accent-blue-500",
                      DEBUG: "accent-slate-400",
                    };
                    const labelColor: Record<string, string> = {
                      FATAL: active ? "text-red-700" : "text-slate-600",
                      ERROR: active ? "text-red-600" : "text-slate-600",
                      WARN: active ? "text-amber-700" : "text-slate-600",
                      INFO: active ? "text-blue-600" : "text-slate-600",
                      DEBUG: active ? "text-slate-600" : "text-slate-500",
                    };
                    return (
                      <label
                        key={lvl}
                        className="flex items-center gap-1.5 cursor-pointer select-none"
                      >
                        <input
                          type="checkbox"
                          checked={active}
                          onChange={() => {
                            const next = new Set(levelFilter);
                            if (next.has(lvl)) next.delete(lvl);
                            else next.add(lvl);
                            setLevelFilter(next);
                          }}
                          className={`w-4 h-4 rounded border-slate-300 ${checkColor[lvl]} cursor-pointer`}
                        />
                        <span
                          className={`text-[13px] font-medium ${labelColor[lvl]}`}
                        >
                          {LABEL[lvl]}
                        </span>
                        <span className="text-[12px] text-slate-400 tabular-nums">
                          {count.toLocaleString()}
                        </span>
                      </label>
                    );
                  },
                )}
                {(levelFilter.size > 0 ||
                  categoryFilter.size > 0 ||
                  searchQuery ||
                  timeRange ||
                  threadFilter) && (
                  <button
                    onClick={() => {
                      setLevelFilter(new Set());
                      setCategoryFilter(new Set());
                      setSearchQuery("");
                      clearTimeRange();
                      setThreadFilter(null);
                    }}
                    className="text-[11px] text-slate-400 hover:text-slate-600"
                  >
                    ✕ clear all
                  </button>
                )}
              </div>
            </div>
            <LogList
              entries={filteredEntries}
              onThreadSelect={setThreadFilter}
            />
          </div>
        </div>
      )}

      {showClaudeModal && analysis && (
        <ClaudePromptModal
          analysis={analysis}
          filteredCount={filteredEntries.length}
          onClose={() => setShowClaudeModal(false)}
        />
      )}
    </div>
  );
}
