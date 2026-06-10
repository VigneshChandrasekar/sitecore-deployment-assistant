import type { SitecoreItem } from "./types";

export interface TreeNode {
  name: string;
  fullPath: string;
  item: SitecoreItem | null; // null = virtual path node (not in package)
  children: TreeNode[];
}

export function buildDatabaseTrees(
  items: SitecoreItem[],
): Map<string, TreeNode[]> {
  const byDb = new Map<string, SitecoreItem[]>();
  for (const item of items) {
    const arr = byDb.get(item.database) ?? [];
    arr.push(item);
    byDb.set(item.database, arr);
  }

  const result = new Map<string, TreeNode[]>();

  for (const [db, dbItems] of byDb) {
    const byPath = new Map<string, SitecoreItem>();
    for (const item of dbItems) {
      if (item.path) byPath.set(item.path, item);
    }

    const roots: TreeNode[] = [];

    for (const item of dbItems) {
      if (!item.path) continue;
      const segments = item.path.split("/").filter(Boolean);
      let currentChildren = roots;
      let pathSoFar = "";

      for (const seg of segments) {
        pathSoFar += "/" + seg;
        let node = currentChildren.find((n) => n.name === seg);
        if (!node) {
          node = {
            name: seg,
            fullPath: pathSoFar,
            item: byPath.get(pathSoFar) ?? null,
            children: [],
          };
          currentChildren.push(node);
        }
        currentChildren = node.children;
      }
    }

    result.set(db, roots);
  }

  return result;
}
