"use client";

import { useState, useCallback, useMemo, useRef } from "react";
import TabInfo from "./TabInfo";
import {
  FileJson,
  Package,
  AlertTriangle,
  AlertCircle,
  Folder,
  FolderOpen,
  Info,
  CheckCircle,
  ChevronDown,
  ChevronRight,
  Shield,
  Plus,
  X,
  ChevronLeft,
  List,
  GitBranch,
  FileDown,
  ClipboardList,
} from "lucide-react";
import { parsePackage } from "@/lib/parser";
import { parseSnapshot, type ParsedSnapshot } from "@/lib/snapshot";
import { buildPublishInstructionsFromAnalysis } from "@/lib/publishCandidateExporter";
import PublishCandidatesPanel from "./PublishCandidatesPanel";
import {
  analyzeDeployment,
  CATEGORY_LABELS,
  type Finding,
  type RiskLevel,
  type RiskCategory,
  type AnalysisResult, // RiskLevel used by LEVEL_META/LEVELS
} from "@/lib/analyzer";
import type { ParsedPackage, SitecoreItem } from "@/lib/types";
import DeployBadge from "./DeployBadge";

const PAGE_SIZE = 50;

// ─── Level meta ───────────────────────────────────────────────────────────────

const LEVEL_META: Record<
  RiskLevel,
  {
    label: string;
    color: string;
    dot: string;
    bar: string;
    rowBg: string;
    Icon: React.ElementType;
  }
> = {
  critical: {
    label: "Critical",
    color: "text-red-700 bg-red-100",
    dot: "bg-red-500",
    bar: "bg-red-500",
    rowBg: "bg-red-50 border-red-200",
    Icon: AlertCircle,
  },
  warning: {
    label: "Warning",
    color: "text-amber-700 bg-amber-100",
    dot: "bg-amber-500",
    bar: "bg-amber-400",
    rowBg: "bg-amber-50 border-amber-200",
    Icon: AlertTriangle,
  },
  info: {
    label: "Info",
    color: "text-blue-700 bg-blue-100",
    dot: "bg-blue-500",
    bar: "bg-blue-400",
    rowBg: "bg-blue-50 border-blue-200",
    Icon: Info,
  },
  ok: {
    label: "OK",
    color: "text-emerald-700 bg-emerald-100",
    dot: "bg-emerald-500",
    bar: "bg-emerald-400",
    rowBg: "bg-emerald-50 border-emerald-200",
    Icon: CheckCircle,
  },
};

const LEVEL_ORDER: RiskLevel[] = ["critical", "warning", "info", "ok"];
const LEVELS: RiskLevel[] = ["critical", "ok"];
const CATEGORIES = Object.keys(CATEGORY_LABELS) as RiskCategory[];

function worstLevel(levels: RiskLevel[]): RiskLevel {
  for (const l of LEVEL_ORDER) {
    if (levels.includes(l)) return l;
  }
  return "ok";
}

// ─── Finding tree builder ─────────────────────────────────────────────────────

interface FindingTreeNode {
  name: string;
  fullPath: string;
  finding: Finding | null; // null = virtual folder node
  children: FindingTreeNode[];
  worstLevel: RiskLevel; // aggregated from self + descendants
  totalFindings: number;
}

function buildFindingTree(findings: Finding[]): FindingTreeNode[] {
  const findingByPath = new Map<string, Finding>();
  for (const f of findings) {
    findingByPath.set(f.packageItem.path, f);
  }

  const roots: FindingTreeNode[] = [];

  for (const f of findings) {
    const segments = f.packageItem.path.split("/").filter(Boolean);
    let children = roots;
    let pathSoFar = "";

    for (const seg of segments) {
      pathSoFar += "/" + seg;
      let node = children.find((n) => n.name === seg);
      if (!node) {
        const nodeFinding = findingByPath.get(pathSoFar) ?? null;
        node = {
          name: seg,
          fullPath: pathSoFar,
          finding: nodeFinding,
          children: [],
          worstLevel: "ok",
          totalFindings: 0,
        };
        children.push(node);
      }
      children = node.children;
    }
  }

  // Compute aggregated worst level + count bottom-up
  function aggregate(node: FindingTreeNode): void {
    for (const child of node.children) aggregate(child);
    const levels: RiskLevel[] = [];
    if (node.finding) {
      levels.push(node.finding.level);
      node.totalFindings = 1;
    }
    for (const child of node.children) {
      levels.push(child.worstLevel);
      node.totalFindings += child.totalFindings;
    }
    node.worstLevel = worstLevel(levels.length ? levels : ["ok"]);
  }

  for (const root of roots) aggregate(root);
  return roots;
}

// ─── Small shared components ──────────────────────────────────────────────────

function RiskBadge({ level }: { level: RiskLevel }) {
  const { label, color, Icon } = LEVEL_META[level];
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold ${color}`}
    >
      <Icon className="h-3 w-3" />
      {label}
    </span>
  );
}

function RiskDot({ level }: { level: RiskLevel }) {
  return (
    <span
      className={`inline-block w-2 h-2 rounded-full shrink-0 ${LEVEL_META[level].dot}`}
    />
  );
}

function StatCard({ level, count }: { level: RiskLevel; count: number }) {
  const { label, Icon } = LEVEL_META[level];
  const bg: Record<RiskLevel, string> = {
    critical: "bg-red-50 border-red-200",
    warning: "bg-amber-50 border-amber-200",
    info: "bg-blue-50 border-blue-200",
    ok: "bg-emerald-50 border-emerald-200",
  };
  const text: Record<RiskLevel, string> = {
    critical: "text-red-700",
    warning: "text-amber-700",
    info: "text-blue-700",
    ok: "text-emerald-700",
  };
  return (
    <div
      className={`flex flex-col items-center gap-1 rounded-xl border p-4 ${bg[level]}`}
    >
      <Icon className={`h-5 w-5 ${text[level]}`} />
      <span className={`text-2xl font-bold ${text[level]}`}>{count}</span>
      <span className={`text-xs font-medium ${text[level]}`}>{label}</span>
    </div>
  );
}

function Chip({
  label,
  count,
  active,
  onClick,
}: {
  label: string;
  count: number;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors
        ${active ? "bg-slate-800 text-white border-slate-800" : "text-slate-500 bg-white border-slate-200 hover:border-slate-400 hover:text-slate-700"}`}
    >
      {label}
      <span
        className={`rounded-full px-1.5 py-0.5 text-[10px] ${active ? "bg-white/20 text-white" : "bg-slate-100 text-slate-500"}`}
      >
        {count}
      </span>
    </button>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-1.5">
      <span className="text-slate-400 shrink-0">{label}:</span>
      <span className="text-slate-700 font-mono truncate">{value || "—"}</span>
    </div>
  );
}

// ─── Finding detail panel (shared by both views) ──────────────────────────────

function FindingDetail({ finding }: { finding: Finding }) {
  const { packageItem: item, snapshotItem, detail } = finding;
  return (
    <div className="space-y-3">
      <p className="text-xs text-slate-600">{detail}</p>
      <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-[11px]">
        <Row label="Item ID" value={item.id} />
        <Row
          label="Template"
          value={`${item.templateName} (${item.templateId})`}
        />
        <Row label="Parent ID" value={item.parentId} />
        <Row label="Database" value={item.database} />
        <Row label="Deploy Mode" value={item.deployMode} />
        <Row label="Item Type" value={item.itemType} />
      </div>
      {snapshotItem && (
        <div className="rounded-lg border border-slate-200 bg-white p-3">
          <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-2">
            Snapshot match
          </p>
          <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-[11px]">
            <Row label="Version" value={String(snapshotItem.version)} />
            <Row label="Updated" value={snapshotItem.updated} />
            <Row label="Updated By" value={snapshotItem.updatedBy} />
            <Row label="Revision" value={snapshotItem.revision} />
            <Row label="Path" value={snapshotItem.path} />
          </div>
        </div>
      )}
      {item.fields.length > 0 && (
        <div className="rounded-lg border border-slate-200 bg-white overflow-hidden">
          <div className="px-3 py-2 bg-slate-50 border-b border-slate-100">
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">
              Package fields ({item.fields.length})
            </span>
          </div>
          <div className="divide-y divide-slate-100 max-h-40 overflow-y-auto">
            {item.fields.map((f) => (
              <div key={f.tfid} className="flex gap-3 px-3 py-1.5">
                <span className="text-[11px] font-medium text-slate-600 w-40 shrink-0 truncate">
                  {f.key}
                </span>
                <span className="text-[11px] text-slate-400 font-mono truncate">
                  {f.value || "—"}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── List view row ────────────────────────────────────────────────────────────

function FindingRow({ finding }: { finding: Finding }) {
  const [open, setOpen] = useState(false);
  const { packageItem: item, level, message, packageName } = finding;
  const { bar, rowBg, Icon } = LEVEL_META[level];
  return (
    <div className={`rounded-lg border overflow-hidden ${rowBg}`}>
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-0 text-left transition-colors hover:brightness-95"
      >
        {/* Colored left bar */}
        <span className={`w-1 self-stretch shrink-0 ${bar}`} />
        <span className="flex items-center gap-3 px-3 py-2.5 flex-1 min-w-0">
          {open ? (
            <ChevronDown className="h-3.5 w-3.5 text-slate-400 shrink-0" />
          ) : (
            <ChevronRight className="h-3.5 w-3.5 text-slate-400 shrink-0" />
          )}
          <Icon
            className={`h-4 w-4 shrink-0 ${LEVEL_META[level].color.split(" ")[0]}`}
          />
          <span className="flex-1 min-w-0">
            <span className="text-xs font-semibold text-slate-800 truncate block">
              {item.name}
            </span>
            <span className="text-[11px] text-slate-500 truncate block font-mono">
              {item.path}
            </span>
          </span>
          <div className="flex items-center gap-2 shrink-0">
            {packageName && (
              <span className="text-[10px] font-medium text-slate-400 bg-white/60 rounded px-1.5 py-0.5 max-w-[140px] truncate">
                {packageName}
              </span>
            )}
            <DeployBadge mode={item.deployMode} />
            <span className="text-[11px] text-slate-600 font-medium max-w-[200px] truncate">
              {message}
            </span>
          </div>
        </span>
      </button>
      {open && (
        <div className="border-t border-white/50 bg-white/50 px-4 py-3">
          <FindingDetail finding={finding} />
        </div>
      )}
    </div>
  );
}

// ─── Tree view ────────────────────────────────────────────────────────────────

function TreeNodeView({
  node,
  depth = 0,
}: {
  node: FindingTreeNode;
  depth?: number;
}) {
  const hasChildren = node.children.length > 0;
  const isFolder = node.finding === null;
  const [open, setOpen] = useState(depth < 2);
  const [detailOpen, setDetailOpen] = useState(false);

  const indent = depth * 16;

  return (
    <div>
      {/* Node row */}
      <div
        className={`group flex items-center gap-0 rounded-lg cursor-pointer overflow-hidden transition-colors
          ${
            node.finding
              ? `${LEVEL_META[node.finding.level].rowBg} border ${detailOpen ? "brightness-95" : "hover:brightness-95"}`
              : "hover:bg-slate-100"
          }`}
        style={{ marginLeft: `${indent}px` }}
        onClick={() => {
          if (hasChildren) setOpen((o) => !o);
          if (node.finding) setDetailOpen((o) => !o);
        }}
      >
        {/* Colored left bar for item nodes */}
        {node.finding && (
          <span
            className={`w-1 self-stretch shrink-0 ${LEVEL_META[node.finding.level].bar}`}
          />
        )}

        <span className="flex items-center gap-2 px-2 py-1.5 flex-1 min-w-0">
          {/* Expand/collapse toggle */}
          <span className="shrink-0 w-4 flex items-center justify-center">
            {hasChildren ? (
              open ? (
                <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
              ) : (
                <ChevronRight className="h-3.5 w-3.5 text-slate-400" />
              )
            ) : (
              <span className="w-3.5" />
            )}
          </span>

          {/* Icon */}
          {isFolder ? (
            open ? (
              <FolderOpen className="h-4 w-4 text-amber-400 shrink-0" />
            ) : (
              <Folder className="h-4 w-4 text-amber-400 shrink-0" />
            )
          ) : (
            (() => {
              const { Icon } = LEVEL_META[node.finding!.level];
              return (
                <Icon
                  className={`h-4 w-4 shrink-0 ${LEVEL_META[node.finding!.level].color.split(" ")[0]}`}
                />
              );
            })()
          )}

          {/* Name */}
          <span
            className={`text-xs flex-1 min-w-0 truncate ${isFolder ? "font-medium text-slate-600" : "font-semibold text-slate-800"}`}
          >
            {node.name}
          </span>

          {/* Right side */}
          <div className="flex items-center gap-1.5 shrink-0">
            {isFolder && node.totalFindings > 0 && (
              <span
                className={`text-[10px] font-semibold rounded px-1.5 py-0.5 ${LEVEL_META[node.worstLevel].color}`}
              >
                {node.totalFindings}
              </span>
            )}
            {node.finding && (
              <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1.5">
                <DeployBadge mode={node.finding.packageItem.deployMode} />
                <span className="text-[11px] text-slate-600 font-medium max-w-[180px] truncate">
                  {node.finding.message}
                </span>
              </div>
            )}
          </div>
        </span>
      </div>

      {/* Expanded detail for item nodes */}
      {node.finding && detailOpen && (
        <div
          className="mx-2 mb-1 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3"
          style={{ marginLeft: `${indent + 28}px` }}
        >
          <div className="flex items-center gap-2 mb-3">
            <RiskBadge level={node.finding.level} />
            <span className="text-xs font-semibold text-slate-700">
              {node.finding.message}
            </span>
            {node.finding.packageName && (
              <span className="text-[10px] font-medium text-slate-400 bg-slate-200 rounded px-1.5 py-0.5 ml-auto truncate max-w-[160px]">
                {node.finding.packageName}
              </span>
            )}
          </div>
          <FindingDetail finding={node.finding} />
        </div>
      )}

      {/* Children */}
      {open &&
        hasChildren &&
        node.children.map((child) => (
          <TreeNodeView key={child.fullPath} node={child} depth={depth + 1} />
        ))}
    </div>
  );
}

function FindingTree({ findings }: { findings: Finding[] }) {
  const roots = useMemo(() => buildFindingTree(findings), [findings]);
  if (roots.length === 0) {
    return (
      <div className="text-center py-12 text-slate-400 text-sm">
        No findings match the current filters.
      </div>
    );
  }
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-2">
      {roots.map((node) => (
        <TreeNodeView key={node.fullPath} node={node} depth={0} />
      ))}
    </div>
  );
}

// ─── Pagination bar ───────────────────────────────────────────────────────────

function Pagination({
  page,
  total,
  pageSize,
  onChange,
}: {
  page: number;
  total: number;
  pageSize: number;
  onChange: (p: number) => void;
}) {
  const pages = Math.ceil(total / pageSize);
  if (pages <= 1) return null;
  const start = (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, total);
  const nums: (number | "…")[] = [];
  for (let i = 1; i <= pages; i++) {
    if (i === 1 || i === pages || (i >= page - 1 && i <= page + 1))
      nums.push(i);
    else if (nums[nums.length - 1] !== "…") nums.push("…");
  }
  return (
    <div className="flex items-center justify-between px-1 pt-2">
      <span className="text-xs text-slate-400">
        {start}–{end} of {total}
      </span>
      <div className="flex items-center gap-1">
        <button
          onClick={() => onChange(page - 1)}
          disabled={page === 1}
          className="p-1.5 rounded hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
          <ChevronLeft className="h-3.5 w-3.5 text-slate-500" />
        </button>
        {nums.map((n, i) =>
          n === "…" ? (
            <span key={`ellipsis-${i}`} className="px-1.5 text-slate-400 text-xs">
              …
            </span>
          ) : (
            <button
              key={`page-${n}`}
              onClick={() => onChange(n as number)}
              className={`w-7 h-7 rounded text-xs font-medium transition-colors ${n === page ? "bg-slate-800 text-white" : "hover:bg-slate-100 text-slate-600"}`}
            >
              {n}
            </button>
          ),
        )}
        <button
          onClick={() => onChange(page + 1)}
          disabled={page === Math.ceil(total / pageSize)}
          className="p-1.5 rounded hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
          <ChevronRight className="h-3.5 w-3.5 text-slate-500" />
        </button>
      </div>
    </div>
  );
}

// ─── Upload bar components ────────────────────────────────────────────────────

function SnapshotSlot({
  loaded,
  name,
  meta,
  onLoad,
  onClear,
}: {
  loaded: boolean;
  name: string;
  meta: { environment: string; totalItems: number; exportedAt: string } | null;
  onLoad: (text: string, name: string) => void;
  onClear: () => void;
}) {
  const [dragging, setDragging] = useState(false);
  const handle = useCallback(
    (file: File) => {
      file.text().then((t) => onLoad(t, file.name));
    },
    [onLoad],
  );

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const f = e.dataTransfer.files[0];
    if (f) handle(f);
  };
  const handleClick = () => {
    if (loaded) {
      onClear();
      return;
    }
    const inp = document.createElement("input");
    inp.type = "file";
    inp.accept = ".json";
    inp.onchange = (e) => {
      const f = (e.target as HTMLInputElement).files?.[0];
      if (f) handle(f);
    };
    inp.click();
  };

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
      onClick={handleClick}
      title={
        loaded ? "Click to remove snapshot" : "Click or drop a .json snapshot"
      }
      className={`flex items-center gap-2.5 px-3 h-10 rounded-lg border cursor-pointer transition-all shrink-0 max-w-[240px]
        ${
          loaded
            ? "border-emerald-300 bg-emerald-50 hover:bg-emerald-100"
            : dragging
              ? "border-blue-400 bg-blue-50 border-dashed"
              : "border-dashed border-slate-300 bg-slate-50 hover:border-slate-400 hover:bg-white"
        }`}
    >
      {loaded ? (
        <>
          <CheckCircle className="h-4 w-4 text-emerald-500 shrink-0" />
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-semibold text-emerald-700 truncate leading-tight">
              {name}
            </p>
            {meta && (
              <p className="text-[10px] text-emerald-500 leading-tight">
                {meta.environment} · {meta.totalItems.toLocaleString()} items
              </p>
            )}
          </div>
          <X className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
        </>
      ) : (
        <>
          <FileJson className="h-4 w-4 text-slate-400 shrink-0" />
          <div className="min-w-0">
            <p className="text-[11px] font-semibold text-slate-500 whitespace-nowrap">
              Target Snapshot
            </p>
            <p className="text-[10px] text-slate-400 whitespace-nowrap">
              Drop or click — .json
            </p>
          </div>
        </>
      )}
    </div>
  );
}

interface LoadedPackage {
  id: number;
  name: string;
  pkg: ParsedPackage;
}

function PackageChip({
  pkg: p,
  onRemove,
}: {
  pkg: LoadedPackage;
  onRemove: () => void;
}) {
  return (
    <div className="flex items-center gap-1.5 px-2.5 h-8 rounded-lg border border-emerald-200 bg-emerald-50 shrink-0 max-w-[180px] group">
      <CheckCircle className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
      <div className="min-w-0 flex-1">
        <p className="text-[11px] font-semibold text-emerald-700 truncate leading-none">
          {p.name}
        </p>
        <p className="text-[10px] text-emerald-500 leading-none mt-0.5">
          {p.pkg.items.length.toLocaleString()} items
        </p>
      </div>
      <button
        onClick={(e) => {
          e.stopPropagation();
          onRemove();
        }}
        className="shrink-0 p-0.5 rounded text-emerald-400 hover:text-red-500 hover:bg-red-50 transition-colors"
      >
        <X className="h-3 w-3" />
      </button>
    </div>
  );
}

function PackageDropZone({
  loadingId,
  onAdd,
}: {
  loadingId: number | null;
  onAdd: (f: File) => void;
}) {
  const [dragging, setDragging] = useState(false);
  const trigger = () => {
    const inp = document.createElement("input");
    inp.type = "file";
    inp.accept = ".zip";
    inp.multiple = true;
    inp.onchange = (e) => {
      const fs = (e.target as HTMLInputElement).files;
      if (fs) Array.from(fs).forEach((f) => onAdd(f));
    };
    inp.click();
  };
  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        Array.from(e.dataTransfer.files).forEach((f) => onAdd(f));
      }}
      onClick={trigger}
      className={`flex items-center gap-1.5 px-2.5 h-8 rounded-lg border-2 border-dashed cursor-pointer transition-colors shrink-0
        ${dragging ? "border-blue-400 bg-blue-50 text-blue-600" : "border-slate-300 text-slate-400 hover:border-slate-400 hover:bg-slate-50 hover:text-slate-600"}`}
    >
      {loadingId !== null ? (
        <>
          <div className="h-3.5 w-3.5 rounded-full border-2 border-current border-t-transparent animate-spin shrink-0" />
          <span className="text-[11px] font-medium whitespace-nowrap">
            Parsing…
          </span>
        </>
      ) : (
        <>
          <Plus className="h-3.5 w-3.5 shrink-0" />
          <span className="text-[11px] font-medium whitespace-nowrap">
            Add package
          </span>
        </>
      )}
    </div>
  );
}

// ─── Main view ────────────────────────────────────────────────────────────────

export default function AnalyzeView() {
  const [snapshot, setSnapshot] = useState<ParsedSnapshot | null>(null);
  const [snapshotName, setSnapshotName] = useState("");
  const [packages, setPackages] = useState<LoadedPackage[]>([]);
  const [loadingId, setLoadingId] = useState<number | null>(null);
  const nextIdRef = useRef(1);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [viewMode, setViewMode] = useState<"tree" | "list">("tree");
  const [exportingPdf, setExportingPdf] = useState(false);
  const [exportingCandidates, setExportingCandidates] = useState(false);
  const [showCandidates, setShowCandidates] = useState(false);

  // Filters — empty set means "no filter active, show all"
  const [activeCategories, setActiveCategories] = useState<Set<RiskCategory>>(
    new Set(),
  );
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  const loadSnapshot = useCallback((text: string, name: string) => {
    setSnapshot(parseSnapshot(text));
    setSnapshotName(name);
    setResult(null);
  }, []);

  const addPackage = useCallback(
    async (file: File) => {
      const id = nextIdRef.current++;
      setLoadingId(id);
      try {
        const parsed = await parsePackage(await file.arrayBuffer());
        setPackages((prev) => [...prev, { id, name: file.name, pkg: parsed }]);
        setResult(null);
      } finally {
        setLoadingId(null);
      }
    },
    [],
  );

  const removePackage = useCallback((id: number) => {
    setPackages((prev) => prev.filter((p) => p.id !== id));
    setResult(null);
  }, []);

  const runAnalysis = () => {
    if (!snapshot || packages.length === 0) return;
    setAnalyzing(true);
    // defer one tick so the spinner renders before heavy computation
    setTimeout(() => {
      try {
        const allItems: (SitecoreItem & { _packageName: string })[] =
          packages.flatMap((p) =>
            p.pkg.items.map((item) => ({ ...item, _packageName: p.name })),
          );
        setResult(analyzeDeployment(allItems, snapshot.items));
        setActiveCategories(new Set());
        setSearch("");
        setPage(1);
      } finally {
        setAnalyzing(false);
      }
    }, 10);
  };

  const exportPdf = async () => {
    if (!result) return;
    setExportingPdf(true);
    try {
      const { exportAnalysisPdf } = await import("@/lib/pdfExporter");
      await exportAnalysisPdf(
        result,
        snapshot,
        packages.map((p) => p.name),
      );
    } finally {
      setExportingPdf(false);
    }
  };

  const exportCandidates = async () => {
    if (!result) return;
    setExportingCandidates(true);
    try {
      const { exportPublishCandidatesFromAnalysis } =
        await import("@/lib/publishCandidateExporter");
      await exportPublishCandidatesFromAnalysis(
        result,
        packages.map((p) => p.name),
      );
    } finally {
      setExportingCandidates(false);
    }
  };

  const toggleCategory = (cat: RiskCategory) => {
    setActiveCategories((prev) =>
      prev.has(cat) && prev.size === 1 ? new Set() : new Set([cat]),
    );
    setPage(1);
  };

  const filtered = useMemo(() => {
    if (!result) return [];
    const q = search.toLowerCase();
    return result.findings.filter(
      (f) =>
        (activeCategories.size === 0 || activeCategories.has(f.category)) &&
        (!q ||
          f.packageItem.name.toLowerCase().includes(q) ||
          f.packageItem.path.toLowerCase().includes(q) ||
          f.packageName.toLowerCase().includes(q) ||
          f.message.toLowerCase().includes(q)),
    );
  }, [result, activeCategories, search]);

  const paginated = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return filtered.slice(start, start + PAGE_SIZE);
  }, [filtered, page]);

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <TabInfo
        title="Risk Analyzer"
        what="Load a snapshot of your target environment and one or more packages to get a risk report before deploying."
        how="Compares every item in the package(s) against the live snapshot — checking parent existence, template availability, deploy modes, and cross-package dependencies — then classifies each finding as Critical, Warning, or OK."
        helps="Catches deployment failures before they happen. Gives release managers a defensible, exportable report to sign off on instead of deploying blind and hoping for the best."
        avoids="Broken item hierarchies (parent missing), layout errors (template missing), silent overwrites of production content, and cascading failures caused by deploying incomplete package sets."
      />

      {/* ── Upload bar (fixed height, horizontal) ── */}
      <div className="shrink-0 border-b border-slate-200 bg-white px-4 py-0 h-14 flex items-center gap-3">
        {/* Snapshot slot */}
        <SnapshotSlot
          loaded={!!snapshot}
          name={snapshotName}
          meta={snapshot?.meta ?? null}
          onLoad={loadSnapshot}
          onClear={() => {
            setSnapshot(null);
            setSnapshotName("");
            setResult(null);
          }}
        />

        {/* Divider */}
        <div className="h-7 w-px bg-slate-200 shrink-0" />

        {/* Package chips — scrollable */}
        <div className="flex-1 flex items-center gap-2 overflow-x-auto min-w-0 scrollbar-thin py-1">
          {packages.map((p) => (
            <PackageChip
              key={p.id}
              pkg={p}
              onRemove={() => removePackage(p.id)}
            />
          ))}
          <PackageDropZone loadingId={loadingId} onAdd={addPackage} />
        </div>

        {/* Divider */}
        <div className="h-7 w-px bg-slate-200 shrink-0" />

        {/* Run button */}
        <button
          onClick={runAnalysis}
          disabled={
            !snapshot ||
            packages.length === 0 ||
            loadingId !== null ||
            analyzing
          }
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-900 text-white text-sm font-semibold shrink-0
            disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-700 transition-colors"
        >
          {analyzing ? (
            <>
              <div className="h-4 w-4 rounded-full border-2 border-white/40 border-t-white animate-spin" />
              Analysing…
            </>
          ) : (
            <>
              <Shield className="h-4 w-4" />
              Run Risk Analysis
            </>
          )}
        </button>
      </div>

      {/* ── Result status strip (shown when analysis done) ── */}
      {result && (
        <div className="shrink-0 flex items-center gap-3 px-4 py-2 bg-white border-b border-slate-200 flex-wrap">
          {/* Stat badges */}
          <CheckCircle className="h-4 w-4 text-emerald-500 shrink-0" />
          <span className="text-xs font-semibold text-slate-700">
            Analysis complete
          </span>
          <div className="h-4 w-px bg-slate-200" />
          {LEVEL_ORDER.filter((l) => l !== "ok" || result.stats.ok > 0).map(
            (l) =>
              result.stats[l] > 0 && (
                <span
                  key={l}
                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold border
                ${
                  l === "critical"
                    ? "bg-red-50 text-red-700 border-red-200"
                    : l === "warning"
                      ? "bg-amber-50 text-amber-700 border-amber-200"
                      : l === "info"
                        ? "bg-blue-50 text-blue-700 border-blue-200"
                        : "bg-emerald-50 text-emerald-700 border-emerald-200"
                }`}
                >
                  {result.stats[l]} {LEVEL_META[l].label}
                </span>
              ),
          )}
          <span className="text-[11px] text-slate-400">
            · {result.totalPackageItems.toLocaleString()} items across{" "}
            {packages.length} package{packages.length !== 1 ? "s" : ""}
          </span>
          {snapshot?.meta.environment && (
            <span className="text-[11px] text-slate-400">
              · Target:{" "}
              <strong className="text-slate-600">
                {snapshot.meta.environment}
              </strong>
            </span>
          )}

          {/* Spacer + action buttons */}
          <div className="ml-auto flex items-center gap-2 shrink-0">
            <button
              onClick={() => setShowCandidates((v) => !v)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors
                ${showCandidates ? "bg-emerald-600 text-white border-emerald-600" : "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"}`}
            >
              <ClipboardList className="h-3.5 w-3.5" />
              Publish Candidates
            </button>
            <button
              onClick={exportPdf}
              disabled={exportingPdf}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-xs font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-40 transition-colors"
            >
              <FileDown className="h-3.5 w-3.5" />
              {exportingPdf ? "Exporting…" : "Export PDF"}
            </button>
            <div className="flex items-center gap-0.5 bg-slate-100 rounded-lg p-0.5">
              <button
                onClick={() => setViewMode("tree")}
                className={`flex items-center gap-1 px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors
                  ${viewMode === "tree" ? "bg-white text-slate-800 shadow-sm" : "text-slate-400 hover:text-slate-600"}`}
              >
                <GitBranch className="h-3.5 w-3.5" />
                Tree
              </button>
              <button
                onClick={() => setViewMode("list")}
                className={`flex items-center gap-1 px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors
                  ${viewMode === "list" ? "bg-white text-slate-800 shadow-sm" : "text-slate-400 hover:text-slate-600"}`}
              >
                <List className="h-3.5 w-3.5" />
                List
              </button>
            </div>
          </div>
        </div>
      )}

      {analyzing ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-4">
          <div className="h-10 w-10 rounded-full border-4 border-slate-200 border-t-slate-700 animate-spin" />
          <p className="text-sm font-medium text-slate-500">
            Running risk analysis…
          </p>
          <p className="text-xs text-slate-400">
            {packages
              .reduce((n, p) => n + p.pkg.items.length, 0)
              .toLocaleString()}{" "}
            items being checked against snapshot
          </p>
        </div>
      ) : result ? (
        <div className="flex-1 overflow-hidden">
          <div className="h-full overflow-y-auto p-4 space-y-4">
            {/* ── Filters ── */}
            <div className="bg-white border border-slate-200 rounded-xl p-3 space-y-2.5">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide w-16 shrink-0">
                  Type
                </span>
                {CATEGORIES.map((cat) => (
                  <Chip
                    key={cat}
                    label={CATEGORY_LABELS[cat]}
                    count={result.categoryStats[cat]}
                    active={activeCategories.has(cat)}
                    onClick={() => toggleCategory(cat)}
                  />
                ))}
              </div>
              <div className="flex items-center gap-2 pt-0.5">
                <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide w-16 shrink-0">
                  Search
                </span>
                <input
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setPage(1);
                  }}
                  placeholder="Filter by name, path, package or message…"
                  className="flex-1 text-xs border border-slate-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-slate-400"
                />
                {search && (
                  <button
                    onClick={() => {
                      setSearch("");
                      setPage(1);
                    }}
                    className="text-xs text-slate-400 hover:text-slate-600"
                  >
                    Clear
                  </button>
                )}
              </div>
            </div>

            {/* Results count */}
            <div className="px-1">
              <span className="text-xs text-slate-400">
                {filtered.length === result.findings.length
                  ? `${filtered.length} findings`
                  : `${filtered.length} of ${result.findings.length} findings`}
              </span>
            </div>

            {/* ── Tree or List ── */}
            {viewMode === "tree" ? (
              <FindingTree findings={filtered} />
            ) : (
              <>
                <div className="space-y-1.5">
                  {paginated.length === 0 ? (
                    <div className="text-center py-12 text-slate-400 text-sm">
                      No findings match the current filters.
                    </div>
                  ) : (
                    paginated.map((f) => (
                      <FindingRow
                        key={`${f.packageItem.path}::${f.category}`}
                        finding={f}
                      />
                    ))
                  )}
                </div>
                <Pagination
                  page={page}
                  total={filtered.length}
                  pageSize={PAGE_SIZE}
                  onChange={(p) => {
                    setPage(p);
                  }}
                />
              </>
            )}
          </div>

          {/* Publish candidates modal */}
          {showCandidates && (
            <PublishCandidatesPanel
              instructions={buildPublishInstructionsFromAnalysis(result)}
              onExport={exportCandidates}
              exporting={exportingCandidates}
              onClose={() => setShowCandidates(false)}
            />
          )}
        </div>
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center gap-3">
          <Shield className="h-12 w-12 text-slate-200" />
          <p className="text-sm font-medium text-slate-500">
            Load a snapshot and one or more packages, then click Run Risk
            Analysis
          </p>
          <p className="text-xs text-slate-400">
            Checks parent existence, template availability, deploy mode
            conflicts, and more.
          </p>
        </div>
      )}
    </div>
  );
}
