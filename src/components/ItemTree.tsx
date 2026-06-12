"use client";

import { useState, useMemo, useCallback, useEffect } from "react";
import {
  ChevronRight,
  ChevronDown,
  Search,
  X,
  Database,
  LayoutTemplate,
  Component,
  Layout,
  Image,
  Settings,
  FileText,
  File,
  FolderOpen,
  Folder,
  Copy,
  Check,
  Crosshair,
} from "lucide-react";
import type { ParsedPackage, SitecoreItem, ItemType } from "@/lib/types";
import { buildDatabaseTrees, type TreeNode } from "@/lib/tree";
import DeployBadge from "./DeployBadge";

const DB_ORDER = ["master", "core", "web"];

// ── Type icon + color ─────────────────────────────────────────────────────────

const TYPE_META: Record<
  ItemType,
  { icon: React.ElementType; color: string; bg: string }
> = {
  Template: {
    icon: LayoutTemplate,
    color: "text-violet-600",
    bg: "bg-violet-50",
  },
  "Template Field": {
    icon: LayoutTemplate,
    color: "text-violet-400",
    bg: "bg-violet-50",
  },
  "Template Section": {
    icon: LayoutTemplate,
    color: "text-purple-500",
    bg: "bg-purple-50",
  },
  Rendering: { icon: Component, color: "text-blue-600", bg: "bg-blue-50" },
  Layout: { icon: Layout, color: "text-sky-600", bg: "bg-sky-50" },
  Placeholder: { icon: Layout, color: "text-cyan-600", bg: "bg-cyan-50" },
  Media: { icon: Image, color: "text-emerald-600", bg: "bg-emerald-50" },
  Setting: { icon: Settings, color: "text-amber-600", bg: "bg-amber-50" },
  Content: { icon: FileText, color: "text-slate-600", bg: "bg-slate-50" },
  Unknown: { icon: File, color: "text-slate-400", bg: "bg-slate-50" },
};

function ItemIcon({ type }: { type: ItemType }) {
  const meta = TYPE_META[type] ?? TYPE_META["Unknown"];
  const Icon = meta.icon;
  return (
    <span
      className={`inline-flex items-center justify-center w-5 h-5 rounded ${meta.bg} shrink-0`}
    >
      <Icon className={`h-3 w-3 ${meta.color}`} strokeWidth={2} />
    </span>
  );
}

// ── Copy button ───────────────────────────────────────────────────────────────

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };
  return (
    <button
      onClick={copy}
      title="Copy"
      className="p-0.5 rounded text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors shrink-0"
    >
      {copied ? (
        <Check className="h-3 w-3 text-emerald-500" />
      ) : (
        <Copy className="h-3 w-3" />
      )}
    </button>
  );
}

// ── Item detail panel ─────────────────────────────────────────────────────────

function ItemDetail({
  item,
  onClose,
}: {
  item: SitecoreItem;
  onClose: () => void;
}) {
  const [tab, setTab] = useState<"attrs" | "fields">("attrs");

  return (
    <div className="border-l border-slate-200 w-80 shrink-0 flex flex-col overflow-hidden bg-white">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-100">
        <ItemIcon type={item.itemType} />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-slate-800 truncate">
            {item.name}
          </p>
          <p className="text-[10px] text-slate-400 uppercase tracking-wide">
            {item.itemType}
          </p>
        </div>
        <button
          onClick={onClose}
          className="p-1 rounded hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-100 shrink-0">
        {(["attrs", "fields"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 px-3 py-2 text-xs font-semibold transition-colors
              ${
                tab === t
                  ? "text-slate-800 border-b-2 border-slate-800 -mb-px bg-white"
                  : "text-slate-400 hover:text-slate-600 hover:bg-slate-50"
              }`}
          >
            {t === "attrs"
              ? "Attributes"
              : `Fields${item.fields.length > 0 ? ` (${item.fields.length})` : ""}`}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto">
        {tab === "attrs" && (
          <div className="px-4 py-3">
            <dl className="space-y-2">
              <AttrRow label="ID" value={item.id} mono copyable />
              {item.key && (
                <AttrRow label="Key" value={item.key} mono copyable />
              )}
              <AttrRow label="Path" value={item.path} mono copyable />
              {item.templateName && (
                <AttrRow label="Template" value={item.templateName} />
              )}
              {item.templateId && (
                <AttrRow
                  label="Templ. ID"
                  value={item.templateId}
                  mono
                  copyable
                />
              )}
              {item.parentId && (
                <AttrRow
                  label="Parent ID"
                  value={item.parentId}
                  mono
                  copyable
                />
              )}
              {item.sortOrder && (
                <AttrRow label="Sort Order" value={item.sortOrder} />
              )}
              <AttrRow label="Language" value={item.language} />
              <AttrRow label="Version" value={String(item.version)} />
              <div className="flex gap-2 items-center pt-1">
                <dt className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide w-20 shrink-0">
                  Deploy
                </dt>
                <DeployBadge mode={item.deployMode} />
              </div>
            </dl>
          </div>
        )}

        {tab === "fields" && (
          <div className="px-4 py-3">
            {item.fields.length === 0 ? (
              <p className="text-xs text-slate-400 italic mt-2">
                No fields in this item.
              </p>
            ) : (
              <div className="space-y-3">
                {item.fields.map((f, i) => (
                  <div
                    key={f.tfid || i}
                    className="rounded-lg border border-slate-100 overflow-hidden"
                  >
                    <div className="flex items-center gap-2 px-2.5 py-1.5 bg-slate-50 border-b border-slate-100">
                      <span className="text-xs font-semibold text-slate-700 flex-1 truncate">
                        {f.key}
                      </span>
                      {f.type && (
                        <span className="text-[10px] text-slate-400 bg-white px-1.5 py-0.5 rounded border border-slate-200">
                          {f.type}
                        </span>
                      )}
                    </div>
                    <div className="px-2.5 py-1.5">
                      {f.value ? (
                        <p className="text-[11px] font-mono text-slate-600 break-all leading-relaxed">
                          {f.value}
                        </p>
                      ) : (
                        <p className="text-[11px] text-slate-300 italic">
                          empty
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function AttrRow({
  label,
  value,
  mono,
  copyable,
}: {
  label: string;
  value: string;
  mono?: boolean;
  copyable?: boolean;
}) {
  return (
    <div className="flex gap-2 items-start group">
      <dt className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide w-20 shrink-0 pt-0.5">
        {label}
      </dt>
      <div className="flex items-start gap-1 flex-1 min-w-0">
        <dd
          className={`text-[11px] break-all text-slate-700 leading-relaxed flex-1 ${mono ? "font-mono" : ""}`}
        >
          {value || "—"}
        </dd>
        {copyable && value && (
          <span className="opacity-0 group-hover:opacity-100 transition-opacity mt-0.5">
            <CopyButton text={value} />
          </span>
        )}
      </div>
    </div>
  );
}

// ── Tree helpers ──────────────────────────────────────────────────────────────

/** Collect fullPaths of every node that has children (can be toggled open). */
function collectExpandablePaths(nodes: TreeNode[]): string[] {
  const paths: string[] = [];
  for (const node of nodes) {
    if (node.children.length > 0) {
      paths.push(node.fullPath);
      paths.push(...collectExpandablePaths(node.children));
    }
  }
  return paths;
}

/** Collect fullPaths of root-level nodes (default open on load). */
function collectRootPaths(nodes: TreeNode[]): string[] {
  return nodes.map((n) => n.fullPath);
}

function countItems(node: TreeNode): number {
  let count = node.item ? 1 : 0;
  for (const child of node.children) count += countItems(child);
  return count;
}

function findNodeAtPath(
  roots: TreeNode[],
  targetPath: string,
): TreeNode | null {
  for (const node of roots) {
    if (node.fullPath === targetPath) return node;
    if (targetPath.startsWith(node.fullPath + "/")) {
      const found = findNodeAtPath(node.children, targetPath);
      if (found) return found;
    }
  }
  return null;
}

// ── Tree node ─────────────────────────────────────────────────────────────────

interface TreeNodeProps {
  node: TreeNode;
  depth: number;
  db: string;
  selectedId: string | null;
  expanded: Set<string>;
  onToggle: (path: string) => void;
  onSelect: (item: SitecoreItem) => void;
  onFocus: (db: string, path: string) => void;
}

function TreeNodeView({
  node,
  depth,
  db,
  selectedId,
  expanded,
  onToggle,
  onSelect,
  onFocus,
}: TreeNodeProps) {
  const open = expanded.has(node.fullPath);
  const hasChildren = node.children.length > 0;
  const isItem = node.item !== null;
  const isSelected = isItem && selectedId === node.item!.id;

  const indent = depth * 16;

  return (
    <div>
      <div
        role="button"
        onClick={() => {
          if (hasChildren) onToggle(node.fullPath);
          if (isItem) onSelect(node.item!);
        }}
        className={`group flex items-center gap-1.5 py-[3px] pr-3 rounded cursor-pointer select-none transition-all
          ${
            isSelected
              ? "bg-slate-900 text-slate-100 shadow-sm"
              : "hover:bg-slate-100/80 text-slate-800"
          }`}
        style={{ paddingLeft: `${8 + indent}px` }}
      >
        {/* Expand arrow */}
        <span className="w-4 h-4 flex items-center justify-center shrink-0">
          {hasChildren ? (
            open ? (
              <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
            ) : (
              <ChevronRight className="h-3.5 w-3.5 text-slate-400" />
            )
          ) : null}
        </span>

        {/* Icon */}
        {isItem ? (
          <ItemIcon type={node.item!.itemType} />
        ) : (
          <span className="w-5 h-5 flex items-center justify-center shrink-0">
            {open ? (
              <FolderOpen className="h-3.5 w-3.5 text-slate-400" />
            ) : (
              <Folder className="h-3.5 w-3.5 text-slate-400" />
            )}
          </span>
        )}

        {/* Name — items full weight, folders muted + smaller */}
        <span
          className={`truncate flex-1 ${
            isItem
              ? isSelected
                ? "text-sm font-semibold text-slate-100"
                : "text-sm font-medium text-slate-800"
              : isSelected
                ? "text-[13px] font-medium text-slate-300"
                : "text-[13px] font-medium text-slate-500"
          }`}
        >
          {node.name}
        </span>

        {/* Deploy badge */}
        {isItem && (
          <span
            className={`shrink-0 transition-opacity ${isSelected ? "opacity-100" : "opacity-0 group-hover:opacity-100"}`}
          >
            <DeployBadge
              mode={node.item!.deployMode}
              variant={isSelected ? "dark" : "light"}
            />
          </span>
        )}

        {/* Count badge — only when collapsed */}
        {!isItem &&
          hasChildren &&
          !open &&
          (() => {
            const n = countItems(node);
            return (
              <span
                className={`text-[10px] tabular-nums font-semibold px-1.5 py-px rounded-full shrink-0
              ${isSelected ? "bg-white/15 text-slate-300" : "bg-slate-100 text-slate-400"}`}
              >
                {n}
              </span>
            );
          })()}

        {/* Focus-drill button — appears on hover for folder nodes */}
        {!isItem && hasChildren && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onFocus(db, node.fullPath);
            }}
            title="Focus here"
            className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-slate-200 transition-opacity shrink-0"
          >
            <Crosshair className="h-3 w-3 text-slate-400" />
          </button>
        )}
      </div>

      {open && hasChildren && (
        <div className="relative">
          <div
            className="absolute top-0 bottom-0 w-px bg-slate-200"
            style={{ left: `${8 + indent + 10}px` }}
          />
          {node.children.map((child) => (
            <TreeNodeView
              key={child.fullPath}
              node={child}
              depth={depth + 1}
              db={db}
              selectedId={selectedId}
              expanded={expanded}
              onToggle={onToggle}
              onSelect={onSelect}
              onFocus={onFocus}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function ItemTree({ pkg }: { pkg: ParsedPackage }) {
  const [search, setSearch] = useState("");
  const [selectedItem, setSelectedItem] = useState<SitecoreItem | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [focusDb, setFocusDb] = useState<string | null>(null);
  const [focusPath, setFocusPath] = useState<string | null>(null);

  const dbTrees = useMemo(() => buildDatabaseTrees(pkg.items), [pkg.items]);

  // Reset on package change
  useEffect(() => {
    const allRoots: string[] = [];
    for (const roots of dbTrees.values()) {
      allRoots.push(...collectRootPaths(roots));
    }
    setExpanded(new Set(allRoots));
    setSelectedItem(null);
    setSearch("");
    setFocusDb(null);
    setFocusPath(null);
  }, [dbTrees]);

  const filtered = useMemo(() => {
    if (!search.trim()) return dbTrees;
    const q = search.toLowerCase();
    const matchingItems = pkg.items.filter(
      (i) =>
        i.name.toLowerCase().includes(q) ||
        i.path.toLowerCase().includes(q) ||
        i.id.toLowerCase().includes(q),
    );
    return buildDatabaseTrees(matchingItems);
  }, [dbTrees, pkg.items, search]);

  const sortedDbs = useMemo(() => {
    const dbs = Array.from(filtered.keys());
    return [
      ...DB_ORDER.filter((d) => dbs.includes(d)),
      ...dbs.filter((d) => !DB_ORDER.includes(d)),
    ];
  }, [filtered]);

  // When searching, auto-expand everything so results are visible
  useEffect(() => {
    if (!search.trim()) return;
    const allPaths: string[] = [];
    for (const roots of filtered.values()) {
      allPaths.push(...collectExpandablePaths(roots));
      allPaths.push(...collectRootPaths(roots));
    }
    setExpanded(new Set(allPaths));
  }, [search, filtered]);

  const handleToggle = useCallback((path: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(path) ? next.delete(path) : next.add(path);
      return next;
    });
  }, []);

  const handleSelect = useCallback((item: SitecoreItem) => {
    setSelectedItem((prev) => (prev?.id === item.id ? null : item));
  }, []);

  const handleFocus = useCallback((db: string, path: string) => {
    setFocusDb(db);
    setFocusPath(path);
    // auto-expand children of the focused node
    setExpanded((prev) => {
      const next = new Set(prev);
      next.add(path);
      return next;
    });
  }, []);

  const clearFocus = useCallback(() => {
    setFocusDb(null);
    setFocusPath(null);
  }, []);

  const expandAll = useCallback(() => {
    const allPaths: string[] = [];
    for (const roots of dbTrees.values()) {
      allPaths.push(...collectExpandablePaths(roots));
      allPaths.push(...collectRootPaths(roots));
    }
    setExpanded(new Set(allPaths));
  }, [dbTrees]);

  const collapseAll = useCallback(() => {
    setExpanded(new Set());
  }, []);

  if (pkg.items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3 text-slate-400">
        <Component className="h-10 w-10 text-slate-200" />
        <p className="text-sm">No items found in this package.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-1 overflow-hidden">
      {/* Tree panel */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Search + expand controls */}
        <div className="shrink-0 px-5 py-2.5 border-b border-slate-200 bg-white flex items-center gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400 pointer-events-none" />
            <input
              type="text"
              placeholder="Search package contents…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-white pl-9 pr-8 py-2 text-sm text-slate-800 placeholder-slate-400
                focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition-colors"
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

          {/* Expand / Collapse CTAs */}
          <div className="flex items-center gap-3 shrink-0">
            <button
              onClick={expandAll}
              className="text-[11px] font-medium text-slate-400 hover:text-slate-700 underline underline-offset-2 decoration-slate-300 hover:decoration-slate-500 transition-colors"
            >
              Expand all
            </button>
            <span className="text-slate-200 text-xs">|</span>
            <button
              onClick={collapseAll}
              className="text-[11px] font-medium text-slate-400 hover:text-slate-700 underline underline-offset-2 decoration-slate-300 hover:decoration-slate-500 transition-colors"
            >
              Collapse all
            </button>
          </div>
        </div>

        {/* Breadcrumb bar — shown when focused into a subtree */}
        {focusPath &&
          focusDb &&
          (() => {
            const segments = focusPath.split("/").filter(Boolean);
            return (
              <div className="shrink-0 flex items-center gap-1 px-4 py-1.5 bg-blue-50 border-b border-blue-100 text-[11px] overflow-x-auto">
                <button
                  onClick={clearFocus}
                  className="font-semibold text-blue-600 hover:text-blue-800 shrink-0 capitalize"
                >
                  {focusDb}
                </button>
                {segments.map((seg, i) => {
                  const path = "/" + segments.slice(0, i + 1).join("/");
                  const isLast = i === segments.length - 1;
                  return (
                    <span
                      key={path}
                      className="flex items-center gap-1 shrink-0"
                    >
                      <span className="text-blue-300">/</span>
                      {isLast ? (
                        <span className="font-semibold text-blue-800">
                          {seg}
                        </span>
                      ) : (
                        <button
                          onClick={() => handleFocus(focusDb, path)}
                          className="text-blue-600 hover:text-blue-800 hover:underline"
                        >
                          {seg}
                        </button>
                      )}
                    </span>
                  );
                })}
                <button
                  onClick={clearFocus}
                  className="ml-auto shrink-0 p-0.5 rounded hover:bg-blue-100 text-blue-400 hover:text-blue-600"
                  title="Clear focus"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            );
          })()}

        {/* Tree */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
          {sortedDbs.length === 0 ? (
            <p className="text-sm text-slate-400 text-center mt-10">
              No items match your filter.
            </p>
          ) : focusPath && focusDb ? (
            // Focused view — show only the focused subtree
            (() => {
              const dbRoots = filtered.get(focusDb) ?? [];
              const focused = findNodeAtPath(dbRoots, focusPath);
              const nodes = focused?.children ?? [];
              const count = focused ? countItems(focused) : 0;
              return (
                <div className="rounded-xl border border-slate-200 overflow-hidden shadow-sm">
                  <div className="flex items-center gap-2 px-3 py-2 bg-slate-50 border-b border-slate-100">
                    <Database className="h-3 w-3 text-slate-400 shrink-0" />
                    <span className="text-[11px] font-semibold text-slate-500 capitalize">
                      {focusDb}
                    </span>
                    <span className="text-[11px] text-slate-400 mx-1">/</span>
                    <span className="text-[11px] font-semibold text-slate-700 truncate">
                      {focusPath.split("/").filter(Boolean).pop()}
                    </span>
                    <span className="ml-auto text-[10px] font-medium tabular-nums text-slate-400 bg-slate-200 px-1.5 py-px rounded-full">
                      {count}
                    </span>
                  </div>
                  <div className="bg-white px-2 py-2 overflow-hidden">
                    {nodes.map((node) => (
                      <TreeNodeView
                        key={node.fullPath}
                        node={node}
                        depth={0}
                        db={focusDb}
                        selectedId={selectedItem?.id ?? null}
                        expanded={expanded}
                        onToggle={handleToggle}
                        onSelect={handleSelect}
                        onFocus={handleFocus}
                      />
                    ))}
                  </div>
                </div>
              );
            })()
          ) : (
            sortedDbs.map((db) => {
              const roots = filtered.get(db) ?? [];
              const totalItems = pkg.items.filter(
                (i) => i.database === db,
              ).length;

              return (
                <div
                  key={db}
                  className="rounded-xl border border-slate-200 overflow-hidden shadow-sm"
                >
                  {/* DB header */}
                  <div className="flex items-center gap-2 px-3 py-2 bg-slate-50 border-b border-slate-100">
                    <Database className="h-3 w-3 text-slate-400 shrink-0" />
                    <span className="text-[11px] font-semibold text-slate-500 capitalize">
                      {db}
                    </span>
                    <span className="ml-auto text-[10px] font-medium tabular-nums text-slate-400 bg-slate-200 px-1.5 py-px rounded-full">
                      {totalItems}
                    </span>
                  </div>

                  {/* Tree nodes */}
                  <div className="bg-white px-2 py-2 overflow-hidden">
                    {roots.map((node) => (
                      <TreeNodeView
                        key={node.fullPath}
                        node={node}
                        depth={0}
                        db={db}
                        selectedId={selectedItem?.id ?? null}
                        expanded={expanded}
                        onToggle={handleToggle}
                        onSelect={handleSelect}
                        onFocus={handleFocus}
                      />
                    ))}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Detail panel */}
      {selectedItem && (
        <ItemDetail item={selectedItem} onClose={() => setSelectedItem(null)} />
      )}
    </div>
  );
}
