"use client";

import {
  useState,
  useCallback,
  useMemo,
  useDeferredValue,
  useRef,
} from "react";
import TabInfo from "./TabInfo";
import {
  GitMerge,
  GitBranch,
  Database,
  Upload,
  X,
  ChevronDown,
  ChevronRight,
  AlertTriangle,
  Plus,
  Minus,
  RefreshCw,
  CheckCircle,
  Search,
  FileDown,
  Folder,
  FolderOpen,
  Check,
  List,
  Eye,
  EyeOff,
  ClipboardList,
} from "lucide-react";
import { parseSnapshot, type ParsedSnapshot } from "@/lib/snapshot";
import {
  buildDriftTree,
  type DriftResult,
  type DriftItem,
  type DriftStatus,
  type DriftMode,
  type DriftTreeNode,
} from "@/lib/driftAnalyzer";
import { buildPublishInstructions } from "@/lib/publishCandidateExporter";
import PublishCandidatesPanel from "./PublishCandidatesPanel";

// ── Constants ─────────────────────────────────────────────────────────────────

const PAGE_SIZE = 25;
const TREE_MAX = 500;

const STATUS_META: Record<
  DriftStatus,
  {
    label: string;
    icon: React.ElementType;
    color: string;
    bar: string;
    rowBg: string;
    badge: string;
  }
> = {
  "source-only": {
    label: "New Item",
    icon: Plus,
    color: "text-blue-700 bg-blue-100",
    bar: "bg-blue-400",
    rowBg: "bg-blue-50 border-blue-200",
    badge: "bg-blue-100 text-blue-700 border-blue-200",
  },
  "target-only": {
    label: "Not in Source",
    icon: Minus,
    color: "text-slate-500 bg-slate-100",
    bar: "bg-slate-300",
    rowBg: "bg-slate-50 border-slate-200",
    badge: "bg-slate-100 text-slate-500 border-slate-200",
  },
  modified: {
    label: "Will Overwrite",
    icon: RefreshCw,
    color: "text-amber-700 bg-amber-100",
    bar: "bg-amber-400",
    rowBg: "bg-amber-50 border-amber-200",
    badge: "bg-amber-100 text-amber-700 border-amber-200",
  },
  identical: {
    label: "No Change",
    icon: CheckCircle,
    color: "text-emerald-700 bg-emerald-100",
    bar: "bg-emerald-400",
    rowBg: "bg-emerald-50 border-emerald-200",
    badge: "bg-emerald-100 text-emerald-700 border-emerald-200",
  },
};

const MASTER_WEB_LABELS: Record<DriftStatus, string> = {
  "source-only": "Unpublished", // in master, not yet on web — will be published
  "target-only": "Not in Master", // on web but not in master — not our concern
  modified: "Out of Sync", // differs — republish needed
  identical: "In Sync",
};

// ── Snapshot drop zone ────────────────────────────────────────────────────────

function SnapshotDropZone({
  label,
  snapshot,
  onLoad,
  onClear,
}: {
  label: string;
  snapshot: ParsedSnapshot | null;
  onLoad: (snap: ParsedSnapshot) => void;
  onClear: () => void;
}) {
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handle = useCallback(
    async (file: File) => {
      setError(null);
      try {
        onLoad(parseSnapshot(await file.text()));
      } catch (e) {
        setError(`Failed to parse: ${e}`);
      }
    },
    [onLoad],
  );

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const f = e.dataTransfer.files[0];
    if (f) handle(f);
  };
  const onPick = () => {
    const inp = document.createElement("input");
    inp.type = "file";
    inp.accept = ".json";
    inp.onchange = (e) => {
      const f = (e.target as HTMLInputElement).files?.[0];
      if (f) handle(f);
    };
    inp.click();
  };

  if (snapshot)
    return (
      <div className="flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3">
        <Check className="h-4 w-4 text-emerald-600 shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-slate-800 truncate">
            {label}
          </p>
          <p className="text-xs text-slate-500">
            {snapshot.meta.environment} ·{" "}
            {snapshot.items.length.toLocaleString()} items
            {snapshot.meta.exportedAt
              ? ` · ${new Date(snapshot.meta.exportedAt).toLocaleDateString()}`
              : ""}
          </p>
        </div>
        <button
          onClick={onClear}
          className="text-slate-300 hover:text-red-500 transition-colors shrink-0"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    );

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={onDrop}
      onClick={onPick}
      className={`flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-4 py-5 cursor-pointer transition-colors
        ${dragging ? "border-slate-400 bg-slate-50" : "border-slate-200 hover:border-slate-300 hover:bg-slate-50"}`}
    >
      <Upload className="h-5 w-5 text-slate-300" />
      <div className="text-center">
        <p className="text-sm font-medium text-slate-600">{label}</p>
        <p className="text-xs text-slate-400 mt-0.5">
          Drop or click to load .json snapshot
        </p>
      </div>
      {error && <p className="text-xs text-red-600 text-center">{error}</p>}
    </div>
  );
}

// ── Field diff table ──────────────────────────────────────────────────────────

function FieldDiffTable({
  item,
  mode,
  sourceLabel,
  targetLabel,
}: {
  item: DriftItem;
  mode: DriftMode;
  sourceLabel: string;
  targetLabel: string;
}) {
  const srcL = mode === "master-web" ? "Master" : sourceLabel;
  const tgtL = mode === "master-web" ? "Web" : targetLabel;
  if (item.fieldDiffs.length === 0)
    return (
      <p className="text-xs text-slate-400 italic">No field differences.</p>
    );
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs border-collapse">
        <thead>
          <tr className="bg-slate-100">
            <th className="text-left px-3 py-1.5 text-slate-600 font-semibold w-1/4">
              Field
            </th>
            <th className="text-left px-3 py-1.5 text-blue-700 font-semibold w-[37.5%]">
              {srcL}
            </th>
            <th className="text-left px-3 py-1.5 text-amber-700 font-semibold w-[37.5%]">
              {tgtL}
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {item.fieldDiffs.map((d) => (
            <tr key={d.field} className="hover:bg-slate-50">
              <td className="px-3 py-1.5 font-mono text-slate-600">
                {d.field}
              </td>
              <td className="px-3 py-1.5 font-mono text-slate-700 break-all">
                {d.sourceValue ? (
                  <span className="bg-blue-50 px-1 rounded">
                    {d.sourceValue.slice(0, 200)}
                    {d.sourceValue.length > 200 ? "…" : ""}
                  </span>
                ) : (
                  <span className="text-slate-300 italic">empty</span>
                )}
              </td>
              <td className="px-3 py-1.5 font-mono text-slate-700 break-all">
                {d.targetValue ? (
                  <span className="bg-amber-50 px-1 rounded">
                    {d.targetValue.slice(0, 200)}
                    {d.targetValue.length > 200 ? "…" : ""}
                  </span>
                ) : (
                  <span className="text-slate-300 italic">empty</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Drift item row (shared by list + tree) ────────────────────────────────────

function DriftRow({
  item,
  mode,
  sourceLabel,
  targetLabel,
}: {
  item: DriftItem;
  mode: DriftMode;
  sourceLabel: string;
  targetLabel: string;
}) {
  const [open, setOpen] = useState(false);
  const meta = STATUS_META[item.status];
  const label =
    mode === "master-web" ? MASTER_WEB_LABELS[item.status] : meta.label;
  const Icon = meta.icon;
  return (
    <div className={`rounded-lg border overflow-hidden ${meta.rowBg}`}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center gap-3 px-3 py-2.5 text-left hover:brightness-95 transition-all"
      >
        <div className={`w-1 self-stretch rounded-full shrink-0 ${meta.bar}`} />
        <Icon className={`h-3.5 w-3.5 shrink-0 ${meta.color.split(" ")[0]}`} />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-slate-800 truncate">
            {item.name}
          </p>
          <p className="text-[11px] text-slate-500 font-mono truncate">
            {item.path}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {item.fieldDiffs.length > 0 && (
            <span className="text-[11px] text-amber-600 font-medium">
              {item.fieldDiffs.length} field
              {item.fieldDiffs.length !== 1 ? "s" : ""}
            </span>
          )}
          <span
            className={`px-2 py-0.5 rounded-full text-[11px] font-semibold border ${meta.badge}`}
          >
            {label}
          </span>
          <span className="text-xs text-slate-400 hidden sm:block truncate max-w-[120px]">
            {item.templateName || "—"}
          </span>
          {open ? (
            <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
          ) : (
            <ChevronRight className="h-3.5 w-3.5 text-slate-400" />
          )}
        </div>
      </button>
      {open && (
        <div className="px-4 pb-3 pt-1 border-t border-slate-200 bg-white bg-opacity-60">
          <FieldDiffTable
            item={item}
            mode={mode}
            sourceLabel={sourceLabel}
            targetLabel={targetLabel}
          />
        </div>
      )}
    </div>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────

// Sitecore uses lowercase 's'/'f': "Template section" / "Template field"
// Accept both casings defensively
const TEMPLATE_TYPES = new Set([
  "Template",
  "Template Section",
  "Template section",
  "Template Field",
  "Template field",
]);

function isTemplateRelated(item: DriftItem) {
  return (
    TEMPLATE_TYPES.has(item.templateName) || item.name === "__Standard Values"
  );
}

// Normalise templateName for comparisons
function tn(item: DriftItem) {
  return item.templateName.toLowerCase();
}

interface TemplateChild {
  item: DriftItem;
  depth: number; // 1 = standard values / section, 2 = field
  sectionIndex?: number; // which section this field belongs to (for numbering)
  fieldIndex?: number;
  sectionName?: string;
}

interface ItemGroup {
  key: string;
  label: string;
  isTemplate: boolean;
  rootItem: DriftItem | null; // the Template item itself (may not be in drift)
  children: TemplateChild[]; // structured children for template groups
  flatItems: DriftItem[]; // for non-template groups
}

function groupItems(items: DriftItem[]): ItemGroup[] {
  // ── Build template path map ───────────────────────────────────────────────
  // Key = template root path, Value = the Template drift item (or null if filtered out)
  const templatePathMap = new Map<string, DriftItem | null>();

  // 1. Explicit Template items in the list
  for (const item of items) {
    if (tn(item) === "template") templatePathMap.set(item.path, item);
  }

  // 2. Infer from Template Sections / __Standard Values → parent is the template
  for (const item of items) {
    if (tn(item) === "template section" || item.name === "__Standard Values") {
      const parts = item.path.split("/").filter(Boolean);
      if (parts.length > 1) {
        const tPath = "/" + parts.slice(0, -1).join("/");
        if (!templatePathMap.has(tPath)) templatePathMap.set(tPath, null);
      }
    }
  }

  // 3. Infer from Template Fields → grandparent is the template
  for (const item of items) {
    if (tn(item) === "template field") {
      const parts = item.path.split("/").filter(Boolean);
      if (parts.length > 2) {
        const tPath = "/" + parts.slice(0, -2).join("/");
        if (!templatePathMap.has(tPath)) templatePathMap.set(tPath, null);
      }
    }
  }

  const templateGroups = new Map<
    string,
    { root: DriftItem | null; children: DriftItem[] }
  >();

  for (const item of items) {
    if (!isTemplateRelated(item)) continue;

    if (tn(item) === "template") {
      const g = templateGroups.get(item.path) ?? { root: null, children: [] };
      g.root = item;
      templateGroups.set(item.path, g);
      continue;
    }

    // Find closest ancestor that is a known template root path
    const parts = item.path.split("/").filter(Boolean);
    let assigned = false;
    for (let i = parts.length - 1; i >= 1; i--) {
      const candidate = "/" + parts.slice(0, i).join("/");
      if (templatePathMap.has(candidate)) {
        const g = templateGroups.get(candidate) ?? {
          root: templatePathMap.get(candidate) ?? null,
          children: [],
        };
        g.children.push(item);
        templateGroups.set(candidate, g);
        assigned = true;
        break;
      }
    }
    if (!assigned) {
      // Orphan — group under its own path so nothing is lost
      const g = templateGroups.get(item.path + "__orphan") ?? {
        root: null,
        children: [],
      };
      g.children.push(item);
      templateGroups.set(item.path + "__orphan", g);
    }
  }

  // ── Non-template groups ───────────────────────────────────────────────────
  const otherMap = new Map<string, DriftItem[]>();
  for (const item of items) {
    if (isTemplateRelated(item)) continue;
    const key = item.templateName || "Unknown";
    const arr = otherMap.get(key) ?? [];
    arr.push(item);
    otherMap.set(key, arr);
  }

  // ── Build result ──────────────────────────────────────────────────────────
  const groups: ItemGroup[] = [];

  for (const [tPath, { root, children }] of templateGroups) {
    const label =
      root?.name ?? tPath.replace("__orphan", "").split("/").pop() ?? tPath;

    // Structure children: standard values → sections → fields under sections
    const standardValues = children.filter(
      (c) => c.name === "__Standard Values",
    );
    const sections = children
      .filter((c) => tn(c) === "template section")
      .sort((a, b) => a.path.localeCompare(b.path));
    const fields = children.filter((c) => tn(c) === "template field");

    const structured: TemplateChild[] = [];
    if (root) structured.push({ item: root, depth: 0 });
    standardValues.forEach((sv) => structured.push({ item: sv, depth: 1 }));
    sections.forEach((sec, si) => {
      structured.push({ item: sec, depth: 1, sectionIndex: si + 1 });
      const sectionFields = fields
        .filter((f) => f.path.startsWith(sec.path + "/"))
        .sort((a, b) => a.path.localeCompare(b.path));
      sectionFields.forEach((f, fi) =>
        structured.push({
          item: f,
          depth: 2,
          sectionIndex: si + 1,
          fieldIndex: fi + 1,
          sectionName: sec.name,
        }),
      );
    });
    // Fields not under any section
    const orphanFields = fields.filter(
      (f) => !sections.some((s) => f.path.startsWith(s.path + "/")),
    );
    orphanFields.forEach((f) => structured.push({ item: f, depth: 1 }));

    groups.push({
      key: tPath,
      label,
      isTemplate: true,
      rootItem: root,
      children: structured,
      flatItems: [],
    });
  }

  for (const [key, flatItems] of otherMap) {
    groups.push({
      key,
      label: key,
      isTemplate: false,
      rootItem: null,
      children: [],
      flatItems: flatItems.sort((a, b) => a.name.localeCompare(b.name)),
    });
  }

  return groups.sort((a, b) => a.label.localeCompare(b.label));
}

// ── Section helpers ───────────────────────────────────────────────────────────

const SECTION_ORDER = [
  "Templates",
  "Content",
  "Renderings",
  "Placeholder Settings",
  "Layout",
  "Media Library",
  "System",
  "Forms",
];

function getSectionFromPath(path: string): string {
  const parts = path.split("/").filter(Boolean);
  if (parts.length < 2) return "Other";
  const second = parts[1];
  const sl = second.toLowerCase();
  if (sl === "templates") return "Templates";
  if (sl === "content") return "Content";
  if (sl === "layout") {
    if (parts.length >= 3) {
      const third = parts[2].toLowerCase();
      if (third === "renderings") return "Renderings";
      if (third === "placeholder settings") return "Placeholder Settings";
    }
    return "Layout";
  }
  if (sl === "media library") return "Media Library";
  if (sl === "system") return "System";
  if (sl === "forms") return "Forms";
  return second.charAt(0).toUpperCase() + second.slice(1);
}

interface SectionGroup {
  key: string;
  label: string;
  groups: ItemGroup[];
  totalItems: number;
  statusCounts: Partial<Record<DriftStatus, number>>;
}

function sectionize(groups: ItemGroup[]): SectionGroup[] {
  const map = new Map<string, ItemGroup[]>();

  for (const g of groups) {
    const path = g.isTemplate
      ? g.key.replace("__orphan", "")
      : (g.flatItems[0]?.path ?? "");
    const section = path ? getSectionFromPath(path) : "Other";
    const arr = map.get(section) ?? [];
    arr.push(g);
    map.set(section, arr);
  }

  const result: SectionGroup[] = [];
  for (const [label, sectionGroups] of map) {
    const statusCounts: Partial<Record<DriftStatus, number>> = {};
    let totalItems = 0;
    for (const g of sectionGroups) {
      const items = g.isTemplate ? g.children.map((c) => c.item) : g.flatItems;
      totalItems += items.length;
      for (const item of items)
        statusCounts[item.status] = (statusCounts[item.status] ?? 0) + 1;
    }
    result.push({
      key: label,
      label,
      groups: sectionGroups,
      totalItems,
      statusCounts,
    });
  }

  result.sort((a, b) => {
    const ai = SECTION_ORDER.indexOf(a.label);
    const bi = SECTION_ORDER.indexOf(b.label);
    if (ai === -1 && bi === -1) return a.label.localeCompare(b.label);
    if (ai === -1) return 1;
    if (bi === -1) return -1;
    return ai - bi;
  });

  return result;
}

// ── Pagination bar ────────────────────────────────────────────────────────────

function PaginationBar({
  page,
  totalPages,
  total,
  pageSize,
  setPage,
}: {
  page: number;
  totalPages: number;
  total: number;
  pageSize: number;
  setPage: (p: number) => void;
}) {
  return (
    <div className="flex items-center justify-between px-1">
      <span className="text-xs text-slate-400">
        {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, total)} of{" "}
        {total.toLocaleString()}
      </span>
      <div className="flex items-center gap-1">
        <button
          onClick={() => setPage(Math.max(1, page - 1))}
          disabled={page === 1}
          className="px-2 py-1 rounded text-xs border border-slate-200 hover:bg-slate-50 disabled:opacity-40"
        >
          ‹
        </button>
        {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
          const p =
            totalPages <= 7
              ? i + 1
              : page <= 4
                ? i + 1
                : page >= totalPages - 3
                  ? totalPages - 6 + i
                  : page - 3 + i;
          return (
            <button
              key={p}
              onClick={() => setPage(p)}
              className={`px-2 py-1 rounded text-xs border transition-colors ${p === page ? "bg-slate-900 text-white border-slate-900" : "border-slate-200 hover:bg-slate-50"}`}
            >
              {p}
            </button>
          );
        })}
        <button
          onClick={() => setPage(Math.min(totalPages, page + 1))}
          disabled={page === totalPages}
          className="px-2 py-1 rounded text-xs border border-slate-200 hover:bg-slate-50 disabled:opacity-40"
        >
          ›
        </button>
      </div>
    </div>
  );
}

// ── Group row ─────────────────────────────────────────────────────────────────

const DEPTH_INDENT = [0, 20, 40]; // px per depth level

function SubLabel({ child }: { child: DriftItem }) {
  const t = child.templateName.toLowerCase();
  if (child.name === "__Standard Values")
    return (
      <span className="text-[10px] text-slate-400 font-medium ml-1">
        Standard Values
      </span>
    );
  if (t === "template section")
    return (
      <span className="text-[10px] text-slate-400 font-medium ml-1">
        Section
      </span>
    );
  if (t === "template field")
    return (
      <span className="text-[10px] text-slate-400 font-medium ml-1">Field</span>
    );
  return null;
}

function GroupRow({
  group,
  index,
  mode,
  sourceLabel,
  targetLabel,
}: {
  group: ItemGroup;
  index: number;
  mode: DriftMode;
  sourceLabel: string;
  targetLabel: string;
}) {
  const [open, setOpen] = useState(false);

  const allItems = group.isTemplate
    ? group.children.map((c) => c.item)
    : group.flatItems;

  const counts = allItems.reduce(
    (acc, item) => {
      acc[item.status] = (acc[item.status] ?? 0) + 1;
      return acc;
    },
    {} as Partial<Record<DriftStatus, number>>,
  );

  const STATUSES: DriftStatus[] = [
    "source-only",
    "modified",
    "target-only",
    "identical",
  ];
  const totalItems = allItems.length;

  return (
    <div className="rounded-xl border border-slate-200 overflow-hidden bg-white">
      {/* Group header */}
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center gap-3 px-4 py-2.5 bg-slate-50 hover:bg-slate-100 transition-colors text-left"
      >
        {open ? (
          <ChevronDown className="h-3.5 w-3.5 text-slate-400 shrink-0" />
        ) : (
          <ChevronRight className="h-3.5 w-3.5 text-slate-400 shrink-0" />
        )}
        <span className="flex items-center justify-center w-5 h-5 rounded-full bg-slate-700 text-white text-[10px] font-bold shrink-0">
          {index}
        </span>
        <span className="flex-1 text-sm font-semibold text-slate-700 truncate">
          {group.label}
        </span>
        <div className="flex items-center gap-1.5 shrink-0">
          {STATUSES.filter((s) => counts[s]).map((s) => (
            <span
              key={s}
              className={`px-2 py-0.5 rounded-full text-[11px] font-bold border ${STATUS_META[s].badge}`}
            >
              {counts[s]}
            </span>
          ))}
          <span className="text-xs text-slate-400 ml-1">
            {totalItems} item{totalItems !== 1 ? "s" : ""}
          </span>
        </div>
      </button>

      {/* Template-structured children */}
      {open && group.isTemplate && group.children.length > 0 && (
        <div className="divide-y divide-slate-100">
          {group.children.map((child, ci) => {
            const indent = DEPTH_INDENT[child.depth] ?? 0;
            const num =
              child.depth === 0
                ? null
                : child.depth === 1
                  ? ci // sequential among depth-1 items
                  : (child.fieldIndex ?? ci);
            return (
              <div
                key={child.item.id + child.item.status + ci}
                className="flex items-start gap-2 px-3 py-1.5"
                style={{ paddingLeft: 12 + indent }}
              >
                {/* Numbering */}
                {child.depth > 0 && (
                  <span className="text-[10px] text-slate-300 font-mono w-5 shrink-0 pt-2.5 text-right">
                    {num}.
                  </span>
                )}
                <div className="flex-1 min-w-0">
                  <DriftRow
                    item={child.item}
                    mode={mode}
                    sourceLabel={sourceLabel}
                    targetLabel={targetLabel}
                  />
                </div>
                <SubLabel child={child.item} />
              </div>
            );
          })}
        </div>
      )}

      {/* Non-template flat items */}
      {open && !group.isTemplate && (
        <div className="divide-y divide-slate-100">
          {group.flatItems.map((item, i) => (
            <div
              key={item.id + item.status}
              className="flex items-start gap-2 px-3 py-1.5"
            >
              <span className="text-[10px] text-slate-300 font-mono w-5 shrink-0 pt-2.5 text-right">
                {i + 1}.
              </span>
              <div className="flex-1 min-w-0">
                <DriftRow
                  item={item}
                  mode={mode}
                  sourceLabel={sourceLabel}
                  targetLabel={targetLabel}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Section block ─────────────────────────────────────────────────────────────

const SECTION_ICONS: Record<string, React.ElementType> = {
  Templates: Folder,
  Content: FolderOpen,
  Renderings: GitBranch,
  "Placeholder Settings": GitMerge,
};

function SectionBlock({
  section,
  index,
  mode,
  sourceLabel,
  targetLabel,
}: {
  section: SectionGroup;
  index: number;
  mode: DriftMode;
  sourceLabel: string;
  targetLabel: string;
}) {
  const [open, setOpen] = useState(true);
  const STATUSES: DriftStatus[] = [
    "source-only",
    "modified",
    "target-only",
    "identical",
  ];
  const Icon = SECTION_ICONS[section.label] ?? Folder;

  return (
    <div className="rounded-xl border border-slate-300 overflow-hidden shadow-sm">
      {/* Section header */}
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center gap-3 px-4 py-3 bg-slate-800 hover:bg-slate-700 text-white transition-colors text-left"
      >
        {open ? (
          <ChevronDown className="h-4 w-4 shrink-0 text-slate-400" />
        ) : (
          <ChevronRight className="h-4 w-4 shrink-0 text-slate-400" />
        )}
        <span className="flex items-center justify-center w-6 h-6 rounded-full bg-slate-600 text-white text-[10px] font-bold shrink-0">
          {index}
        </span>
        <Icon className="h-4 w-4 shrink-0 text-slate-300" />
        <span className="flex-1 text-sm font-bold text-white truncate">
          {section.label}
        </span>
        <div className="flex items-center gap-1.5 shrink-0">
          {STATUSES.filter((s) => section.statusCounts[s]).map((s) => (
            <span
              key={s}
              className={`px-2 py-0.5 rounded-full text-[11px] font-bold border ${STATUS_META[s].badge}`}
            >
              {section.statusCounts[s]}
            </span>
          ))}
          <span className="text-xs text-slate-400 ml-2">
            {section.groups.length} group
            {section.groups.length !== 1 ? "s" : ""}
          </span>
        </div>
      </button>

      {/* Groups */}
      {open && (
        <div className="p-3 space-y-2 bg-slate-50">
          {section.groups.map((group, gi) => (
            <GroupRow
              key={group.key}
              group={group}
              index={gi + 1}
              mode={mode}
              sourceLabel={sourceLabel}
              targetLabel={targetLabel}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ── Sectioned list ────────────────────────────────────────────────────────────

function SectionedList({
  items,
  mode,
  sourceLabel,
  targetLabel,
}: {
  items: DriftItem[];
  mode: DriftMode;
  sourceLabel: string;
  targetLabel: string;
}) {
  const groups = useMemo(() => groupItems(items), [items]);
  const sections = useMemo(() => sectionize(groups), [groups]);

  if (items.length === 0)
    return (
      <div className="text-center py-12 text-slate-400 text-sm">
        No items match the current filters.
      </div>
    );

  return (
    <div className="space-y-3">
      {sections.map((section, i) => (
        <SectionBlock
          key={section.key}
          section={section}
          index={i + 1}
          mode={mode}
          sourceLabel={sourceLabel}
          targetLabel={targetLabel}
        />
      ))}
    </div>
  );
}

// ── Tree view ─────────────────────────────────────────────────────────────────

const TREE_STATUS_RANK: DriftStatus[] = [
  "source-only",
  "target-only",
  "modified",
  "identical",
];

function TreeBadge({ counts }: { counts: Record<DriftStatus, number> }) {
  return (
    <span className="flex items-center gap-1">
      {TREE_STATUS_RANK.filter((s) => s !== "identical" && counts[s] > 0).map(
        (s) => (
          <span
            key={s}
            className={`px-1.5 py-0.5 rounded text-[10px] font-bold border ${STATUS_META[s].badge}`}
          >
            {counts[s]}
          </span>
        ),
      )}
      {counts["identical"] > 0 && (
        <span className="px-1.5 py-0.5 rounded text-[10px] font-bold border bg-emerald-50 text-emerald-600 border-emerald-200">
          {counts["identical"]}
        </span>
      )}
    </span>
  );
}

function TreeNodeView({
  node,
  mode,
  sourceLabel,
  targetLabel,
  depth,
}: {
  node: DriftTreeNode;
  mode: DriftMode;
  sourceLabel: string;
  targetLabel: string;
  depth: number;
}) {
  const hasLeaf = node.driftItem !== null;
  const hasChildren = node.children.length > 0;
  const isFolder = !hasLeaf && hasChildren;
  const [open, setOpen] = useState(
    depth < 2 && node.worstStatus !== "identical" && node.worstStatus !== null,
  );
  const indent = depth * 16;

  return (
    <div>
      {isFolder && (
        <button
          onClick={() => setOpen((o) => !o)}
          style={{ paddingLeft: indent + 8 }}
          className="w-full flex items-center gap-2 py-1.5 pr-3 text-left hover:bg-slate-50 rounded-lg transition-colors"
        >
          {open ? (
            <FolderOpen className="h-3.5 w-3.5 text-amber-400 shrink-0" />
          ) : (
            <Folder className="h-3.5 w-3.5 text-amber-400 shrink-0" />
          )}
          <span className="flex-1 text-sm font-medium text-slate-600 truncate">
            {node.segment}
          </span>
          <TreeBadge counts={node.counts} />
          {open ? (
            <ChevronDown className="h-3 w-3 text-slate-300" />
          ) : (
            <ChevronRight className="h-3 w-3 text-slate-300" />
          )}
        </button>
      )}
      {hasLeaf && node.driftItem && (
        <div style={{ paddingLeft: indent }}>
          <DriftRow
            item={node.driftItem}
            mode={mode}
            sourceLabel={sourceLabel}
            targetLabel={targetLabel}
          />
        </div>
      )}
      {hasChildren && (isFolder ? open : true) && (
        <div>
          {node.children.map((child) => (
            <TreeNodeView
              key={child.fullPath}
              node={child}
              mode={mode}
              sourceLabel={sourceLabel}
              targetLabel={targetLabel}
              depth={depth + 1}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function DriftTree({
  items,
  mode,
  sourceLabel,
  targetLabel,
}: {
  items: DriftItem[];
  mode: DriftMode;
  sourceLabel: string;
  targetLabel: string;
}) {
  const capped = items.length > TREE_MAX ? items.slice(0, TREE_MAX) : items;
  const roots = useMemo(() => buildDriftTree(capped), [capped]);

  if (items.length === 0)
    return (
      <div className="text-center py-12 text-slate-400 text-sm">
        No items match the current filters.
      </div>
    );

  return (
    <div className="space-y-2">
      {items.length > TREE_MAX && (
        <div className="flex items-center gap-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
          Tree is showing the first {TREE_MAX} of{" "}
          {items.length.toLocaleString()} items. Switch to List view to paginate
          all results.
        </div>
      )}
      <div className="bg-white border border-slate-200 rounded-xl p-2 space-y-0.5">
        {roots.map((node) => (
          <TreeNodeView
            key={node.fullPath}
            node={node}
            mode={mode}
            sourceLabel={sourceLabel}
            targetLabel={targetLabel}
            depth={0}
          />
        ))}
      </div>
    </div>
  );
}

// ── Stat chip ─────────────────────────────────────────────────────────────────

function StatChip({
  status,
  count,
  active,
  onClick,
  mode,
}: {
  status: DriftStatus;
  count: number;
  active: boolean;
  onClick: () => void;
  mode: DriftMode;
}) {
  const meta = STATUS_META[status];
  const label = mode === "master-web" ? MASTER_WEB_LABELS[status] : meta.label;
  const Icon = meta.icon;
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-sm font-semibold transition-all
        ${active ? `${meta.color} border-current shadow-sm` : "bg-white text-slate-500 border-slate-200 hover:border-slate-300"}`}
    >
      <Icon className="h-3.5 w-3.5 shrink-0" />
      <span>{label}</span>
      <span
        className={`ml-1 px-1.5 py-0.5 rounded-full text-xs font-bold ${active ? "bg-white bg-opacity-60" : "bg-slate-100"}`}
      >
        {count.toLocaleString()}
      </span>
    </button>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function DriftView() {
  const [mode, setMode] = useState<DriftMode>("env");

  const [snapA, setSnapA] = useState<ParsedSnapshot | null>(null);
  const [snapB, setSnapB] = useState<ParsedSnapshot | null>(null);
  const [snapMaster, setSnapMaster] = useState<ParsedSnapshot | null>(null);
  const [snapWeb, setSnapWeb] = useState<ParsedSnapshot | null>(null);

  const [result, setResult] = useState<DriftResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingMsg, setLoadingMsg] = useState("");
  const [viewMode, setViewMode] = useState<"list" | "tree">("list");
  const [activeStatuses, setActiveStatuses] = useState<Set<DriftStatus>>(
    new Set(["source-only", "target-only", "modified"]),
  );
  const [showIdentical, setShowIdentical] = useState(false);
  const [searchRaw, setSearchRaw] = useState("");
  const [exportingPdf, setExportingPdf] = useState(false);
  const [exportingCandidates, setExportingCandidates] = useState(false);
  const [showCandidates, setShowCandidates] = useState(false);

  const search = useDeferredValue(searchRaw);
  const workerRef = useRef<Worker | null>(null);

  const canRun =
    mode === "env"
      ? snapA !== null && snapB !== null
      : snapMaster !== null && snapWeb !== null;

  const runDrift = () => {
    if (!canRun) return;

    // Terminate any previous worker
    workerRef.current?.terminate();

    setLoading(true);
    setLoadingMsg("Starting analysis…");
    setResult(null);

    const worker = new Worker("/driftWorker.js");
    workerRef.current = worker;

    worker.onmessage = (e) => {
      setResult(e.data as DriftResult);
      setLoading(false);
      setLoadingMsg("");
      // Default: show only what matters for deployment decision
      setActiveStatuses(new Set(["source-only", "modified"]));
      setShowIdentical(false);
      worker.terminate();
    };

    worker.onerror = (err) => {
      console.error("Drift worker error:", err);
      setLoadingMsg("Analysis failed — check console");
      setLoading(false);
      worker.terminate();
    };

    if (mode === "env" && snapA && snapB) {
      setLoadingMsg(
        `Comparing ${snapA.items.length.toLocaleString()} vs ${snapB.items.length.toLocaleString()} items…`,
      );
      worker.postMessage({
        sourceItems: snapA.items,
        targetItems: snapB.items,
        sourceLabel: snapA.meta.environment || "Source",
        targetLabel: snapB.meta.environment || "Target",
        mode: "env",
      });
    } else if (mode === "master-web" && snapMaster && snapWeb) {
      setLoadingMsg(
        `Comparing ${snapMaster.items.length.toLocaleString()} master vs ${snapWeb.items.length.toLocaleString()} web items…`,
      );
      worker.postMessage({
        sourceItems: snapMaster.items,
        targetItems: snapWeb.items,
        sourceLabel: "Master",
        targetLabel: "Web",
        mode: "master-web",
      });
    }
  };

  const toggleStatus = (s: DriftStatus) => {
    setActiveStatuses((prev) => {
      const next = new Set<DriftStatus>();
      if (!prev.has(s)) next.add(s);
      return next;
    });
  };

  const filtered = useMemo(() => {
    if (!result) return [];
    let items = result.items;
    if (!showIdentical) items = items.filter((i) => i.status !== "identical");
    if (activeStatuses.size > 0)
      items = items.filter((i) => activeStatuses.has(i.status));
    if (search.trim()) {
      const q = search.toLowerCase();
      items = items.filter(
        (i) =>
          i.name.toLowerCase().includes(q) ||
          i.path.toLowerCase().includes(q) ||
          i.templateName.toLowerCase().includes(q),
      );
    }
    return items;
  }, [result, activeStatuses, showIdentical, search]);

  const exportPdf = async () => {
    if (!result) return;
    setExportingPdf(true);
    try {
      const { exportDriftPdf } = await import("@/lib/driftPdfExporter");
      await exportDriftPdf(result);
    } finally {
      setExportingPdf(false);
    }
  };

  const exportCandidates = async () => {
    if (!result) return;
    setExportingCandidates(true);
    try {
      const { exportPublishCandidatesFromDrift } =
        await import("@/lib/publishCandidateExporter");
      await exportPublishCandidatesFromDrift(result);
    } finally {
      setExportingCandidates(false);
    }
  };

  const STATUSES: DriftStatus[] = [
    "source-only",
    "target-only",
    "modified",
    "identical",
  ];

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <TabInfo
        title="Environment Sync"
        what="Detect differences between two environments or between master and web database to find what's out of sync."
        how="Loads two snapshots and matches every item by ID — flagging items that exist in one environment but not the other, and items that exist in both but have different field values. Runs in a background thread to keep the UI responsive."
        helps="Instantly answers 'what is on DEV that isn't on PROD yet?' and 'what has been edited in master but never published to web?' — questions that normally require guesswork or manual comparison."
        avoids="Deploying to an environment that already has conflicting changes, publishing incomplete work, and silent content drift that builds up over weeks of parallel development."
      />

      <div className="flex-1 flex flex-col overflow-hidden relative">
        {/* ── Full-page loading overlay ── */}
        {loading && (
          <div className="absolute inset-0 z-10 bg-white bg-opacity-80 backdrop-blur-sm flex flex-col items-center justify-center gap-4">
            <div className="flex items-center justify-center w-16 h-16 rounded-2xl bg-white border border-slate-200 shadow-lg">
              <RefreshCw className="h-8 w-8 text-slate-600 animate-spin" />
            </div>
            <div className="text-center space-y-1">
              <p className="text-sm font-semibold text-slate-700">
                Analysing drift…
              </p>
              <p className="text-xs text-slate-500">{loadingMsg}</p>
              <p className="text-xs text-slate-400 mt-1">
                Running in background · UI stays responsive
              </p>
            </div>
          </div>
        )}

        {/* ── Upload panel ── */}
        <div className="shrink-0 border-b border-slate-200 bg-white p-4 space-y-4 overflow-y-auto">
          {/* Mode selector */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                setMode("env");
                setResult(null);
              }}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-semibold border transition-colors
                ${mode === "env" ? "bg-slate-900 text-white border-slate-900" : "bg-white text-slate-600 border-slate-200 hover:border-slate-400"}`}
            >
              <GitMerge className="h-4 w-4" />
              Environment Sync
            </button>
            <button
              onClick={() => {
                setMode("master-web");
                setResult(null);
              }}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-semibold border transition-colors
                ${mode === "master-web" ? "bg-slate-900 text-white border-slate-900" : "bg-white text-slate-600 border-slate-200 hover:border-slate-400"}`}
            >
              <Database className="h-4 w-4" />
              Master vs Web
            </button>
          </div>

          {/* Upload zones */}
          {mode === "env" ? (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-500">
                  Source environment (e.g. DEV)
                </label>
                <SnapshotDropZone
                  label="Source Snapshot"
                  snapshot={snapA}
                  onLoad={(s) => {
                    setSnapA(s);
                    setResult(null);
                  }}
                  onClear={() => {
                    setSnapA(null);
                    setResult(null);
                  }}
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-500">
                  Target environment (e.g. UAT / PROD)
                </label>
                <SnapshotDropZone
                  label="Target Snapshot"
                  snapshot={snapB}
                  onLoad={(s) => {
                    setSnapB(s);
                    setResult(null);
                  }}
                  onClear={() => {
                    setSnapB(null);
                    setResult(null);
                  }}
                />
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-500">
                  Master database snapshot
                </label>
                <SnapshotDropZone
                  label="Master Snapshot"
                  snapshot={snapMaster}
                  onLoad={(s) => {
                    setSnapMaster(s);
                    setResult(null);
                  }}
                  onClear={() => {
                    setSnapMaster(null);
                    setResult(null);
                  }}
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-500">
                  Web database snapshot
                </label>
                <SnapshotDropZone
                  label="Web Snapshot"
                  snapshot={snapWeb}
                  onLoad={(s) => {
                    setSnapWeb(s);
                    setResult(null);
                  }}
                  onClear={() => {
                    setSnapWeb(null);
                    setResult(null);
                  }}
                />
              </div>
            </div>
          )}

          {mode === "master-web" && (
            <div className="flex items-start gap-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
              <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
              Run the snapshot script twice — once with{" "}
              <code className="font-mono bg-amber-100 px-1 rounded mx-1">
                $Database = &quot;master&quot;
              </code>{" "}
              and once with{" "}
              <code className="font-mono bg-amber-100 px-1 rounded mx-1">
                $Database = &quot;web&quot;
              </code>{" "}
              — then load both files here.
            </div>
          )}

          <button
            onClick={runDrift}
            disabled={!canRun || loading}
            className="flex items-center gap-2 px-5 py-2 rounded-lg bg-slate-900 text-white text-sm font-semibold hover:bg-slate-700 disabled:opacity-40 transition-colors"
          >
            {loading ? (
              <RefreshCw className="h-4 w-4 animate-spin" />
            ) : (
              <GitBranch className="h-4 w-4" />
            )}
            {loading
              ? "Analysing…"
              : mode === "env"
                ? "Detect Drift"
                : "Compare Master vs Web"}
          </button>
        </div>

        {/* ── Results ── */}
        {result && !loading && (
          <div className="flex-1 overflow-hidden">
            <div className="h-full overflow-y-auto p-4 space-y-3">
              {/* Stat chips */}
              <div className="flex items-center gap-2 flex-wrap">
                {STATUSES.map((s) => (
                  <StatChip
                    key={s}
                    status={s}
                    count={result.stats[s]}
                    active={activeStatuses.has(s)}
                    onClick={() => toggleStatus(s)}
                    mode={result.mode}
                  />
                ))}
                <button
                  onClick={() => setShowIdentical((v) => !v)}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-xl border text-sm font-medium transition-all ml-auto
                    ${showIdentical ? "bg-slate-800 text-white border-slate-800" : "bg-white text-slate-500 border-slate-200 hover:border-slate-300"}`}
                >
                  {showIdentical ? (
                    <EyeOff className="h-3.5 w-3.5" />
                  ) : (
                    <Eye className="h-3.5 w-3.5" />
                  )}
                  {showIdentical ? "Hide unchanged" : "Show all items"}
                </button>
              </div>

              {/* Meta + export */}
              <div className="flex items-center gap-3 text-xs text-slate-400 bg-white border border-slate-200 rounded-lg px-4 py-2.5 flex-wrap">
                <span>
                  <strong className="text-slate-600">
                    {result.sourceLabel}
                  </strong>
                  <span className="mx-2 text-slate-300">→</span>
                  <strong className="text-slate-600">
                    {result.targetLabel}
                  </strong>
                </span>
                <span className="text-slate-200">|</span>
                <span>
                  <strong className="text-slate-600">
                    {result.items.length.toLocaleString()}
                  </strong>{" "}
                  total ·{" "}
                  <strong className="text-slate-600">
                    {filtered.length.toLocaleString()}
                  </strong>{" "}
                  shown
                </span>
                {result.mode === "master-web" &&
                  result.stats["source-only"] > 0 && (
                    <>
                      <span className="text-slate-200">|</span>
                      <span className="text-amber-600 font-medium">
                        {result.stats["source-only"].toLocaleString()}{" "}
                        unpublished
                      </span>
                    </>
                  )}
                <div className="ml-auto flex items-center gap-2">
                  <div className="flex items-center gap-0.5 bg-slate-100 rounded-lg p-0.5">
                    <button
                      onClick={() => setViewMode("list")}
                      className={`flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium transition-colors ${viewMode === "list" ? "bg-white text-slate-800 shadow-sm" : "text-slate-400 hover:text-slate-600"}`}
                    >
                      <List className="h-3.5 w-3.5" />
                      List
                    </button>
                    <button
                      onClick={() => setViewMode("tree")}
                      className={`flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium transition-colors ${viewMode === "tree" ? "bg-white text-slate-800 shadow-sm" : "text-slate-400 hover:text-slate-600"}`}
                    >
                      <GitBranch className="h-3.5 w-3.5" />
                      Tree
                    </button>
                  </div>
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
                </div>
              </div>

              {/* Search */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                <input
                  value={searchRaw}
                  onChange={(e) => setSearchRaw(e.target.value)}
                  placeholder="Filter by name, path or template…"
                  className="w-full pl-9 pr-4 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-400 bg-white"
                />
              </div>

              {viewMode === "list" ? (
                <SectionedList
                  items={filtered}
                  mode={result.mode}
                  sourceLabel={result.sourceLabel}
                  targetLabel={result.targetLabel}
                />
              ) : (
                <DriftTree
                  items={filtered}
                  mode={result.mode}
                  sourceLabel={result.sourceLabel}
                  targetLabel={result.targetLabel}
                />
              )}
            </div>

            {/* Publish candidates modal */}
            {showCandidates && (
              <PublishCandidatesPanel
                instructions={buildPublishInstructions(result)}
                onExport={exportCandidates}
                exporting={exportingCandidates}
                sourceLabel={result.sourceLabel}
                targetLabel={result.targetLabel}
                onClose={() => setShowCandidates(false)}
              />
            )}
          </div>
        )}

        {/* ── Empty state ── */}
        {!result && !loading && (
          <div className="flex-1 flex flex-col items-center justify-center gap-3 text-center p-8">
            <div className="flex items-center justify-center w-14 h-14 rounded-2xl bg-white border border-slate-200 shadow-sm">
              <GitMerge className="h-7 w-7 text-slate-300" strokeWidth={1.5} />
            </div>
            <div>
              <p className="text-sm font-medium text-slate-500">
                {mode === "env"
                  ? "Load two environment snapshots to detect drift"
                  : "Load master and web snapshots to compare"}
              </p>
              <p className="text-xs text-slate-400 mt-1">
                {mode === "env"
                  ? "e.g. DEV vs UAT, UAT vs PROD — see exactly what is missing or different"
                  : "Find items edited in master that have not been published to the web database"}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
