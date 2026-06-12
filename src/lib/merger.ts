import type { ParsedPackage, SitecoreItem } from "./types";

export interface ConflictItem {
  id: string;
  name: string;
  path: string;
  database: string;
  sources: string[]; // package names that contain this item
}

export interface MergeResult {
  merged: ParsedPackage;
  conflicts: ConflictItem[];
}

export function mergePackages(
  pkgs: ParsedPackage[],
  names: string[],
): MergeResult {
  // Track which packages each item ID appears in
  const idSources = new Map<string, number[]>(); // id → package indices

  for (let i = 0; i < pkgs.length; i++) {
    for (const item of pkgs[i].items) {
      const key = `${item.database}::${item.id}`;
      const arr = idSources.get(key) ?? [];
      arr.push(i);
      idSources.set(key, arr);
    }
  }

  // Last-write-wins: build merged item map (later packages overwrite earlier)
  const itemMap = new Map<string, SitecoreItem>();
  for (const pkg of pkgs) {
    for (const item of pkg.items) {
      itemMap.set(`${item.database}::${item.id}`, item);
    }
  }

  const conflicts: ConflictItem[] = [];
  for (const [key, indices] of idSources) {
    if (indices.length > 1) {
      const item = itemMap.get(key)!;
      conflicts.push({
        id: item.id,
        name: item.name,
        path: item.path,
        database: item.database,
        sources: indices.map((i) => names[i]),
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

  return { merged, conflicts };
}
