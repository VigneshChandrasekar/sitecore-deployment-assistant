import type { ParsedPackage, SitecoreItem } from "./types";

export interface ConflictItem {
  id: string;
  name: string;
  path: string;
  database: string;
  /** indices into the packages array — parallel to sourceItems */
  sources: number[];
  /** the actual item from each source package, parallel to sources[] */
  sourceItems: SitecoreItem[];
}

export interface MergeResult {
  merged: ParsedPackage;
  conflicts: ConflictItem[];
  /** item key (db::id) → index of the winning (last) source package */
  sourceMap: Map<string, number>;
}

export function mergePackages(
  pkgs: ParsedPackage[],
  names: string[],
): MergeResult {
  // Track which packages each item ID appears in
  const idSources = new Map<string, number[]>(); // id → package indices

  for (let i = 0; i < pkgs.length; i++) {
    const seen = new Set<string>();
    for (const item of pkgs[i].items) {
      const key = `${item.database}::${item.id}`;
      if (seen.has(key)) continue; // same item in multiple languages — count this package only once
      seen.add(key);
      const arr = idSources.get(key) ?? [];
      arr.push(i);
      idSources.set(key, arr);
    }
  }

  // Last-write-wins: build merged item map (later packages overwrite earlier)
  // Also track which package index each item's winner came from
  const itemMap = new Map<string, SitecoreItem>();
  const sourceMap = new Map<string, number>(); // item key → winning package index

  for (let i = 0; i < pkgs.length; i++) {
    for (const item of pkgs[i].items) {
      const key = `${item.database}::${item.id}`;
      itemMap.set(key, item);
      sourceMap.set(key, i);
    }
  }

  // Build a per-key lookup: pkgIndex → first matching item in that package
  const keyItems = new Map<string, Map<number, SitecoreItem>>();
  for (let i = 0; i < pkgs.length; i++) {
    for (const item of pkgs[i].items) {
      const key = `${item.database}::${item.id}`;
      if (!keyItems.has(key)) keyItems.set(key, new Map());
      if (!keyItems.get(key)!.has(i)) keyItems.get(key)!.set(i, item);
    }
  }

  const conflicts: ConflictItem[] = [];
  for (const [key, indices] of idSources) {
    if (indices.length > 1) {
      const item = itemMap.get(key)!;
      const byPkg = keyItems.get(key)!;
      conflicts.push({
        id: item.id,
        name: item.name,
        path: item.path,
        database: item.database,
        sources: indices,
        sourceItems: indices.map((i) => byPkg.get(i)!),
      });
    }
  }

  // Merge files (deduplicate by path, last wins)
  const fileMap = new Map<string, { path: string; size: number }>();
  for (const pkg of pkgs) {
    for (const f of pkg.files) fileMap.set(f.path, f);
  }

  const merged: ParsedPackage = {
    metadata: {
      name: "Merged Package",
      version: "",
      author: "",
      publisher: "",
      comment: `Merged from: ${names.join(", ")}`,
      readme: "",
    },
    items: Array.from(itemMap.values()),
    files: Array.from(fileMap.values()),
    errors: pkgs.flatMap((p) => p.errors),
  };

  return { merged, conflicts, sourceMap };
}

/**
 * Sort merged items by user-defined folder order.
 * For each item path, walk its segments and check if the parent has a custom order.
 * Items whose ancestor folder was reordered get a numeric sort key; others keep natural order.
 */
export function sortItemsByFolderOrder(
  items: SitecoreItem[],
  folderOrder: Map<string, string[]>,
): SitecoreItem[] {
  if (folderOrder.size === 0) return items;

  function getSortKey(path: string): string {
    const segments = path.split("/").filter(Boolean);
    const parts: string[] = [];
    let parentPath = "";
    for (const seg of segments) {
      const order = folderOrder.get(parentPath);
      if (order) {
        const idx = order.indexOf(seg);
        parts.push(
          idx >= 0 ? String(idx).padStart(4, "0") : `zz_${seg.toLowerCase()}`,
        );
      } else {
        parts.push(seg.toLowerCase());
      }
      parentPath = `${parentPath}/${seg}`;
    }
    return parts.join("/");
  }

  return [...items].sort((a, b) => {
    const ka = getSortKey(a.path);
    const kb = getSortKey(b.path);
    return ka < kb ? -1 : ka > kb ? 1 : 0;
  });
}
