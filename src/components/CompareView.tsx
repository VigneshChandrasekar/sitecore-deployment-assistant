"use client";

import { useState, useMemo, useCallback } from "react";
import TabInfo from "./TabInfo";
import {
  UploadCloud,
  FileArchive,
  Plus,
  Minus,
  RefreshCw,
  Minus as MinusIcon,
  ChevronRight,
  ChevronDown,
  Search,
  X,
  ArrowRight,
  AlertTriangle,
} from "lucide-react";
import type { ParsedPackage } from "@/lib/types";
import {
  diffPackages,
  type PackageDiff,
  type DiffItem,
  type DiffStatus,
} from "@/lib/differ";

// ── Upload card ───────────────────────────────────────────────────────────────

function UploadCard({
  label,
  pkg,
  loading,
  onFile,
}: {
  label: string;
  pkg: ParsedPackage | null;
  loading: boolean;
  onFile: (f: File) => void;
}) {
  const [drag, setDrag] = useState(false);

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDrag(false);
    const f = e.dataTransfer.files[0];
    if (f) onFile(f);
  };

  return (
    <label
      onDragOver={(e) => {
        e.preventDefault();
        setDrag(true);
      }}
      onDragLeave={() => setDrag(false)}
      onDrop={onDrop}
      className={`flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed p-4 cursor-pointer transition-all
        ${drag ? "border-blue-400 bg-blue-50" : pkg ? "border-slate-300 bg-slate-50" : "border-slate-200 hover:border-slate-300 hover:bg-slate-50"}
        ${loading ? "pointer-events-none opacity-60" : ""}`}
    >
      <input
        type="file"
        accept=".zip"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onFile(f);
        }}
      />
      <div
        className={`text-[10px] font-bold uppercase tracking-widest mb-1 ${pkg ? "text-blue-600" : "text-slate-400"}`}
      >
        {label}
      </div>
      {loading ? (
        <div className="h-5 w-5 animate-spin rounded-full border-2 border-slate-200 border-t-blue-500" />
      ) : pkg ? (
        <div className="text-center">
          <div className="flex items-center gap-1.5 justify-center">
            <FileArchive className="h-4 w-4 text-blue-500" />
            <span className="text-xs font-semibold text-slate-700 truncate max-w-[160px]">
              {pkg.metadata.name || "Package"}
            </span>
          </div>
          <p className="text-[10px] text-slate-400 mt-0.5">
            {pkg.items.length} items · v{pkg.metadata.version || "—"}
          </p>
          <p className="text-[10px] text-blue-500 mt-1">Click to replace</p>
        </div>
      ) : (
        <div className="text-center">
          <UploadCloud className="h-6 w-6 text-slate-300 mx-auto mb-1" />
          <p className="text-xs font-medium text-slate-600">Drop .zip here</p>
          <p className="text-[10px] text-slate-400">or click to browse</p>
        </div>
      )}
    </label>
  );
}

// ── Stat chip ─────────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<
  DiffStatus,
  { label: string; bg: string; text: string; dot: string }
> = {
  added: {
    label: "Added",
    bg: "bg-emerald-50",
    text: "text-emerald-700",
    dot: "bg-emerald-500",
  },
  removed: {
    label: "Removed",
    bg: "bg-red-50",
    text: "text-red-700",
    dot: "bg-red-500",
  },
  modified: {
    label: "Modified",
    bg: "bg-amber-50",
    text: "text-amber-700",
    dot: "bg-amber-500",
  },
  unchanged: {
    label: "Unchanged",
    bg: "bg-slate-100",
    text: "text-slate-500",
    dot: "bg-slate-300",
  },
};

function StatusChip({
  status,
  count,
  active,
  onClick,
}: {
  status: DiffStatus;
  count: number;
  active: boolean;
  onClick: () => void;
}) {
  const cfg = STATUS_CONFIG[status];
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all border
        ${active ? `${cfg.bg} ${cfg.text} border-transparent ring-2 ring-offset-1 ${cfg.dot.replace("bg-", "ring-")}` : "bg-white text-slate-500 border-slate-200 hover:border-slate-300"}`}
    >
      <span
        className={`w-1.5 h-1.5 rounded-full ${active ? cfg.dot : "bg-slate-300"}`}
      />
      {cfg.label}
      <span
        className={`ml-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-bold ${active ? "bg-white/60" : "bg-slate-100"}`}
      >
        {count}
      </span>
    </button>
  );
}

// ── Diff row ──────────────────────────────────────────────────────────────────

function DiffRow({ diff, depth }: { diff: DiffItem; depth: number }) {
  const [open, setOpen] = useState(false);
  const item = diff.itemB ?? diff.itemA!;
  const cfg = STATUS_CONFIG[diff.status];

  const symbol = { added: "+", removed: "−", modified: "~", unchanged: "·" }[
    diff.status
  ];

  return (
    <div>
      <div
        onClick={() => diff.changes.length > 0 && setOpen((v) => !v)}
        className={`group flex items-center gap-2 py-1.5 pr-3 rounded-md transition-colors
          ${diff.changes.length > 0 ? "cursor-pointer" : ""}
          ${diff.status === "unchanged" ? "hover:bg-slate-50 opacity-60" : "hover:bg-slate-50"}`}
        style={{ paddingLeft: `${8 + depth * 16}px` }}
      >
        {/* Expand chevron */}
        <span className="w-4 shrink-0 flex items-center justify-center">
          {diff.changes.length > 0 ? (
            open ? (
              <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
            ) : (
              <ChevronRight className="h-3.5 w-3.5 text-slate-400" />
            )
          ) : null}
        </span>

        {/* Status symbol */}
        <span
          className={`w-5 h-5 flex items-center justify-center rounded text-[11px] font-bold shrink-0 ${cfg.bg} ${cfg.text}`}
        >
          {symbol}
        </span>

        {/* Item name */}
        <span
          className={`text-sm flex-1 truncate font-medium ${diff.status === "removed" ? "line-through text-slate-400" : "text-slate-800"}`}
        >
          {item.name}
        </span>

        {/* Change count for modified */}
        {diff.status === "modified" && (
          <span className="text-[10px] text-amber-600 font-semibold bg-amber-50 px-1.5 py-0.5 rounded shrink-0">
            {diff.changes.length} change{diff.changes.length !== 1 ? "s" : ""}
          </span>
        )}

        {/* Item type */}
        <span className="text-[10px] text-slate-400 shrink-0 hidden group-hover:inline">
          {item.itemType}
        </span>
      </div>

      {/* Field changes */}
      {open && diff.changes.length > 0 && (
        <div
          style={{ paddingLeft: `${8 + depth * 16 + 36}px` }}
          className="mb-1 space-y-1"
        >
          {diff.changes.map((change, i) => (
            <div
              key={i}
              className="rounded-lg border border-slate-100 bg-white overflow-hidden text-xs"
            >
              <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-50 border-b border-slate-100">
                <span className="font-semibold text-slate-700">
                  {change.key}
                </span>
                {change.type && change.type !== "System" && (
                  <span className="text-[10px] text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">
                    {change.type}
                  </span>
                )}
              </div>
              <div className="px-3 py-2 flex flex-col gap-1.5">
                {change.oldValue && (
                  <div className="flex items-start gap-2">
                    <span className="text-red-500 font-bold w-3 shrink-0 mt-0.5">
                      −
                    </span>
                    <span className="font-mono text-red-700 bg-red-50 rounded px-1.5 py-0.5 break-all leading-relaxed flex-1">
                      {change.oldValue || (
                        <em className="not-italic text-slate-400">empty</em>
                      )}
                    </span>
                  </div>
                )}
                {change.newValue && (
                  <div className="flex items-start gap-2">
                    <span className="text-emerald-600 font-bold w-3 shrink-0 mt-0.5">
                      +
                    </span>
                    <span className="font-mono text-emerald-700 bg-emerald-50 rounded px-1.5 py-0.5 break-all leading-relaxed flex-1">
                      {change.newValue || (
                        <em className="not-italic text-slate-400">empty</em>
                      )}
                    </span>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Diff tree ─────────────────────────────────────────────────────────────────

interface TreeNode {
  segment: string;
  fullPath: string;
  diffs: DiffItem[];
  children: TreeNode[];
}

function buildDiffTree(items: DiffItem[]): Map<string, TreeNode[]> {
  const dbMap = new Map<string, TreeNode[]>();

  for (const diff of items) {
    const item = diff.itemB ?? diff.itemA!;
    const db = item.database;
    if (!dbMap.has(db)) dbMap.set(db, []);
    const roots = dbMap.get(db)!;

    const segments = item.path.split("/").filter(Boolean);
    let currentList = roots;
    let pathSoFar = "";

    for (let i = 0; i < segments.length; i++) {
      const seg = segments[i];
      pathSoFar += "/" + seg;
      let node = currentList.find((n) => n.segment === seg);
      if (!node) {
        node = { segment: seg, fullPath: pathSoFar, diffs: [], children: [] };
        currentList.push(node);
      }
      if (i === segments.length - 1) node.diffs.push(diff);
      currentList = node.children;
    }
  }

  return dbMap;
}

function getChildren(node: TreeNode): TreeNode[] {
  return node.children;
}

function DiffTreeNode({ node, depth }: { node: TreeNode; depth: number }) {
  const children = getChildren(node);
  const hasChildren = children.length > 0;
  const [open, setOpen] = useState(true);

  const statusOf = (n: TreeNode): DiffStatus | "mixed" => {
    const all: DiffStatus[] = [];
    const collect = (x: TreeNode) => {
      x.diffs.forEach((d) => all.push(d.status));
      getChildren(x).forEach(collect);
    };
    collect(n);
    const set = new Set(all);
    if (set.size === 1) return all[0];
    if (set.has("added") || set.has("removed") || set.has("modified"))
      return "mixed";
    return "unchanged";
  };

  const folderStatus = statusOf(node);
  const folderColor =
    folderStatus === "added"
      ? "text-emerald-600"
      : folderStatus === "removed"
        ? "text-red-500"
        : folderStatus === "modified" || folderStatus === "mixed"
          ? "text-amber-600"
          : "text-slate-400";

  return (
    <div>
      {/* Folder row (if it's just a path segment with no item of its own) */}
      {node.diffs.length === 0 && (
        <div
          onClick={() => hasChildren && setOpen((v) => !v)}
          className="flex items-center gap-1.5 py-1 pr-3 rounded-md hover:bg-slate-50 cursor-pointer"
          style={{ paddingLeft: `${8 + depth * 16}px` }}
        >
          <span className="w-4 flex items-center justify-center shrink-0">
            {hasChildren ? (
              open ? (
                <ChevronDown className="h-3.5 w-3.5 text-slate-300" />
              ) : (
                <ChevronRight className="h-3.5 w-3.5 text-slate-300" />
              )
            ) : null}
          </span>
          <span className={`text-xs ${folderColor} font-medium`}>
            {node.segment}
          </span>
        </div>
      )}

      {/* Item diffs at this node */}
      {node.diffs.map((d) => (
        <DiffRow key={d.id} diff={d} depth={depth} />
      ))}

      {/* Children */}
      {open && hasChildren && (
        <div className="relative">
          <div
            className="absolute top-0 bottom-0 w-px bg-slate-100"
            style={{ left: `${8 + depth * 16 + 10}px` }}
          />
          {children.map((child) => (
            <DiffTreeNode key={child.fullPath} node={child} depth={depth + 1} />
          ))}
        </div>
      )}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

const DB_ORDER = ["master", "core", "web"];

export default function CompareView() {
  const [pkgA, setPkgA] = useState<ParsedPackage | null>(null);
  const [pkgB, setPkgB] = useState<ParsedPackage | null>(null);
  const [loadingA, setLoadingA] = useState(false);
  const [loadingB, setLoadingB] = useState(false);
  const [search, setSearch] = useState("");
  const [activeFilters, setActiveFilters] = useState<Set<DiffStatus>>(
    new Set(["added", "removed", "modified", "unchanged"]),
  );

  const load = useCallback(
    async (
      file: File,
      setLoading: (v: boolean) => void,
      setPkg: (p: ParsedPackage) => void,
    ) => {
      setLoading(true);
      try {
        const { parsePackage } = await import("@/lib/parser");
        const buf = await file.arrayBuffer();
        setPkg(await parsePackage(buf));
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  const diff = useMemo<PackageDiff | null>(() => {
    if (!pkgA || !pkgB) return null;
    return diffPackages(pkgA.items, pkgB.items);
  }, [pkgA, pkgB]);

  const filtered = useMemo(() => {
    if (!diff) return [];
    let items = diff.items.filter((d) => activeFilters.has(d.status));
    if (search.trim()) {
      const q = search.toLowerCase();
      items = items.filter((d) => {
        const item = d.itemB ?? d.itemA!;
        return (
          item.name.toLowerCase().includes(q) ||
          item.path.toLowerCase().includes(q)
        );
      });
    }
    return items;
  }, [diff, activeFilters, search]);

  const diffTree = useMemo(() => buildDiffTree(filtered), [filtered]);

  const sortedDbs = useMemo(() => {
    const dbs = Array.from(diffTree.keys());
    return [
      ...DB_ORDER.filter((d) => dbs.includes(d)),
      ...dbs.filter((d) => !DB_ORDER.includes(d)),
    ];
  }, [diffTree]);

  const toggleFilter = (s: DiffStatus) => {
    setActiveFilters((prev) => {
      const next = new Set(prev);
      next.has(s) ? next.delete(s) : next.add(s);
      return next;
    });
  };

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      <TabInfo
        title="Package Compare"
        what="Diff two Sitecore packages side-by-side to see exactly what changed between versions."
        how="Parses both ZIPs and matches items by ID across packages, flagging each as Added, Removed, Modified, or Unchanged. Drill into any item to see which fields changed and how."
        helps="Gives QA and release managers a clear change log before promoting a package to the next environment. Replaces manual diffing or guesswork when a developer says 'only X changed'."
        avoids="Unintentional regressions, missing items, or field value overwrites that slip through because nobody compared the new package against the previous one."
      />
      <div className="flex flex-1 overflow-hidden">
        {/* Left panel */}
        <aside className="w-[300px] shrink-0 min-h-0 bg-white border-r border-slate-200 overflow-y-auto">
          <div className="flex flex-col gap-0">
            {/* Upload cards */}
            <div className="p-4 border-b border-slate-100 space-y-3">
              <UploadCard
                label="Package A  (baseline)"
                pkg={pkgA}
                loading={loadingA}
                onFile={(f) => load(f, setLoadingA, setPkgA)}
              />

              <div className="flex items-center justify-center">
                <div className="flex-1 h-px bg-slate-100" />
                <ArrowRight className="h-4 w-4 text-slate-300 mx-2" />
                <div className="flex-1 h-px bg-slate-100" />
              </div>

              <UploadCard
                label="Package B  (new version)"
                pkg={pkgB}
                loading={loadingB}
                onFile={(f) => load(f, setLoadingB, setPkgB)}
              />
            </div>

            {/* Diff stats */}
            {diff && (
              <div className="px-4 py-3 border-b border-slate-100">
                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2">
                  Diff Summary
                </p>
                <div className="grid grid-cols-2 gap-1.5">
                  {(
                    [
                      "added",
                      "removed",
                      "modified",
                      "unchanged",
                    ] as DiffStatus[]
                  ).map((s) => {
                    const cfg = STATUS_CONFIG[s];
                    const count = diff.stats[s];
                    return (
                      <div
                        key={s}
                        className={`rounded-lg px-2.5 py-2 ${cfg.bg}`}
                      >
                        <p
                          className={`text-lg font-bold leading-none ${cfg.text}`}
                        >
                          {count}
                        </p>
                        <p
                          className={`text-[10px] mt-0.5 font-medium ${cfg.text} opacity-80`}
                        >
                          {cfg.label}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Filter chips */}
            {diff && (
              <div className="px-4 py-3 border-b border-slate-100">
                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2">
                  Show
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {(
                    [
                      "added",
                      "removed",
                      "modified",
                      "unchanged",
                    ] as DiffStatus[]
                  ).map((s) => (
                    <StatusChip
                      key={s}
                      status={s}
                      count={diff.stats[s]}
                      active={activeFilters.has(s)}
                      onClick={() => toggleFilter(s)}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Risk callout */}
            {diff &&
              diff.stats.added + diff.stats.removed + diff.stats.modified >
                0 && (
                <div className="mx-4 mt-3 flex items-start gap-2 rounded-lg bg-amber-50 border border-amber-200 px-3 py-2.5 text-xs text-amber-800">
                  <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0 text-amber-500" />
                  <span>
                    <strong>
                      {diff.stats.added +
                        diff.stats.removed +
                        diff.stats.modified}
                    </strong>{" "}
                    items changed between these packages.
                  </span>
                </div>
              )}
          </div>
        </aside>

        {/* Right panel */}
        <main className="flex-1 min-w-0 overflow-hidden flex flex-col bg-slate-50">
          {!pkgA || !pkgB ? (
            <div className="flex flex-col items-center justify-center h-full gap-3">
              <div className="flex items-center gap-3">
                <div
                  className={`flex items-center justify-center w-12 h-12 rounded-xl border-2 border-dashed ${pkgA ? "border-blue-300 bg-blue-50" : "border-slate-200"}`}
                >
                  {pkgA ? (
                    <FileArchive className="h-5 w-5 text-blue-500" />
                  ) : (
                    <Plus className="h-5 w-5 text-slate-300" />
                  )}
                </div>
                <ArrowRight className="h-5 w-5 text-slate-300" />
                <div
                  className={`flex items-center justify-center w-12 h-12 rounded-xl border-2 border-dashed ${pkgB ? "border-blue-300 bg-blue-50" : "border-slate-200"}`}
                >
                  {pkgB ? (
                    <FileArchive className="h-5 w-5 text-blue-500" />
                  ) : (
                    <Plus className="h-5 w-5 text-slate-300" />
                  )}
                </div>
              </div>
              <p className="text-sm text-slate-400">
                Upload both packages to see the diff
              </p>
            </div>
          ) : (
            <>
              {/* Search */}
              <div className="shrink-0 px-4 py-3 border-b border-slate-200 bg-white">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400 pointer-events-none" />
                  <input
                    type="text"
                    placeholder="Filter by name or path…"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 bg-slate-50 pl-9 pr-8 py-2 text-sm text-slate-800 placeholder-slate-400
                    focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-400 focus:bg-white transition-colors"
                  />
                  {search && (
                    <button
                      onClick={() => setSearch("")}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              </div>

              {/* Diff tree */}
              <div className="flex-1 overflow-y-auto px-3 py-3 space-y-3">
                {sortedDbs.length === 0 ? (
                  <p className="text-sm text-slate-400 text-center mt-10">
                    No items match your filter.
                  </p>
                ) : (
                  sortedDbs.map((db) => {
                    const nodes = diffTree.get(db) ?? [];
                    return (
                      <div
                        key={db}
                        className="rounded-xl border border-slate-200 overflow-hidden shadow-sm"
                      >
                        <div className="flex items-center gap-2.5 px-4 py-2.5 bg-slate-800">
                          <span className="text-sm font-semibold text-white capitalize">
                            {db}
                          </span>
                          <span className="ml-auto text-xs text-slate-400">
                            {
                              filtered.filter(
                                (d) => (d.itemB ?? d.itemA)?.database === db,
                              ).length
                            }{" "}
                            items
                          </span>
                        </div>
                        <div className="bg-white px-2 py-2">
                          {nodes.map((node) => (
                            <DiffTreeNode
                              key={node.fullPath}
                              node={node}
                              depth={0}
                            />
                          ))}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </>
          )}
        </main>
      </div>
    </div>
  );
}
