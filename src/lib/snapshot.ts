export interface SnapshotItem {
  id: string;
  name: string;
  path: string;
  templateId: string;
  templateName: string;
  parentId: string;
  language: string;
  version: number;
  created: string;
  createdBy: string;
  updated: string;
  updatedBy: string;
  revision: string;
  fields: Record<string, string>;
}

export interface SnapshotMeta {
  schemaVersion: string;
  exportedAt: string;
  environment: string;
  database: string;
  snapshotPaths: string[];
  totalItems: number;
  durationMs: number;
}

export interface ParsedSnapshot {
  meta: SnapshotMeta;
  items: SnapshotItem[];
  errors: string[];
}

export function parseSnapshot(json: string): ParsedSnapshot {
  const errors: string[] = [];

  let raw: Record<string, unknown>;
  try {
    raw = JSON.parse(json);
  } catch {
    return {
      meta: blankMeta(),
      items: [],
      errors: ["Invalid JSON — could not parse snapshot file."],
    };
  }

  if (!raw._environment || !Array.isArray(raw.items)) {
    errors.push(
      "File does not look like a Sitecore snapshot (missing _environment or items array).",
    );
    return { meta: blankMeta(), items: [], errors };
  }

  const config = (raw.exportConfig ?? {}) as Record<string, unknown>;
  const summary = (raw.summary ?? {}) as Record<string, unknown>;

  const meta: SnapshotMeta = {
    schemaVersion: String(raw._schemaVersion ?? "1.0"),
    exportedAt: String(raw._exportedAt ?? ""),
    environment: String(raw._environment ?? ""),
    database: String(config.database ?? "master"),
    snapshotPaths: Array.isArray(config.snapshotPaths)
      ? (config.snapshotPaths as string[])
      : [],
    totalItems: Number(summary.totalItems ?? 0),
    durationMs: Number(summary.durationMs ?? 0),
  };

  const items: SnapshotItem[] = (raw.items as unknown[]).map((r) => {
    const row = r as Record<string, unknown>;
    return {
      id: String(row.id ?? ""),
      name: String(row.name ?? ""),
      path: String(row.path ?? ""),
      templateId: String(row.templateId ?? ""),
      templateName: String(row.templateName ?? ""),
      parentId: String(row.parentId ?? ""),
      language: String(row.language ?? "en"),
      version: Number(row.version ?? 1),
      created: String(row.created ?? ""),
      createdBy: String(row.createdBy ?? ""),
      updated: String(row.updated ?? ""),
      updatedBy: String(row.updatedBy ?? ""),
      revision: String(row.revision ?? ""),
      fields:
        row.fields && typeof row.fields === "object"
          ? (row.fields as Record<string, string>)
          : {},
    };
  });

  if (Array.isArray(raw.errors)) {
    for (const e of raw.errors as unknown[]) {
      const err = e as Record<string, unknown>;
      errors.push(`${err.itemPath ?? "unknown"}: ${err.error ?? ""}`);
    }
  }

  return { meta, items, errors };
}

function blankMeta(): SnapshotMeta {
  return {
    schemaVersion: "",
    exportedAt: "",
    environment: "",
    database: "",
    snapshotPaths: [],
    totalItems: 0,
    durationMs: 0,
  };
}
