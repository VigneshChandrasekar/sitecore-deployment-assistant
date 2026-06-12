// Parses Sitecore layout/renderings XML and diffs component instances by uid.

export interface RenderingEntry {
  uid: string;
  componentId: string; // s:id
  placeholder: string; // s:ph
  datasource: string; // s:ds
  params: string; // s:par
}

export type RenderingStatus = "added" | "removed" | "modified" | "unchanged";

export interface RenderingChange {
  uid: string;
  status: RenderingStatus;
  entry: RenderingEntry; // new entry (or old entry for removed)
  oldEntry?: RenderingEntry; // only set for modified
}

export interface RenderingsDiff {
  changes: RenderingChange[];
  added: number;
  removed: number;
  modified: number;
  unchanged: number;
}

function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function attr(attrs: string, name: string): string {
  const m = new RegExp(`(?:^|\\s)${name}="([^"]*)"`, "i").exec(attrs);
  return m ? decodeEntities(m[1]) : "";
}

function normaliseId(val: string): string {
  return val.replace(/[{}]/g, "").toLowerCase();
}

export function extractRenderingEntries(xml: string): RenderingEntry[] {
  if (!xml?.trim()) return [];
  const entries: RenderingEntry[] = [];
  // Match opening tags of <r> elements that carry a uid attribute (rendering instances)
  const pattern = /<r\s([^>]*?uid="[^"]*"[^>]*?)(?:\s*\/>|>)/g;
  let m: RegExpExecArray | null;
  while ((m = pattern.exec(xml)) !== null) {
    const a = m[1];
    const uid = normaliseId(attr(a, "uid"));
    if (!uid) continue;
    entries.push({
      uid,
      componentId: attr(a, "s:id"),
      placeholder: attr(a, "s:ph"),
      datasource: attr(a, "s:ds"),
      params: attr(a, "s:par"),
    });
  }
  return entries;
}

export function diffRenderings(oldXml: string, newXml: string): RenderingsDiff {
  const oldEntries = extractRenderingEntries(oldXml);
  const newEntries = extractRenderingEntries(newXml);

  const oldMap = new Map(oldEntries.map((e) => [e.uid, e]));
  const newMap = new Map(newEntries.map((e) => [e.uid, e]));

  const changes: RenderingChange[] = [];

  for (const entry of newEntries) {
    const old = oldMap.get(entry.uid);
    if (!old) {
      changes.push({ uid: entry.uid, status: "added", entry });
    } else {
      const changed =
        old.componentId !== entry.componentId ||
        old.placeholder !== entry.placeholder ||
        old.datasource !== entry.datasource ||
        old.params !== entry.params;
      changes.push({
        uid: entry.uid,
        status: changed ? "modified" : "unchanged",
        entry,
        oldEntry: old,
      });
    }
  }

  for (const entry of oldEntries) {
    if (!newMap.has(entry.uid)) {
      changes.push({ uid: entry.uid, status: "removed", entry });
    }
  }

  return {
    changes,
    added: changes.filter((c) => c.status === "added").length,
    removed: changes.filter((c) => c.status === "removed").length,
    modified: changes.filter((c) => c.status === "modified").length,
    unchanged: changes.filter((c) => c.status === "unchanged").length,
  };
}

export function isRenderingsField(fieldName: string): boolean {
  return /rendering/i.test(fieldName);
}
