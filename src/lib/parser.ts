import JSZip from "jszip";
import { XMLParser } from "fast-xml-parser";
import type {
  ParsedPackage,
  PackageMetadata,
  SitecoreItem,
  ItemField,
  PackageFile,
  DeployMode,
  ItemType,
  Database,
} from "./types";

const xmlParser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  allowBooleanAttributes: true,
  parseAttributeValue: false,
  trimValues: true,
  textNodeName: "#text",
});

// ── ZIP helpers ───────────────────────────────────────────────────────────────

/** Find a file in the ZIP by exact path or any path ending with the suffix. */
function findFile(zip: JSZip, ...suffixes: string[]): JSZip.JSZipObject | null {
  for (const suffix of suffixes) {
    const direct = zip.file(suffix);
    if (direct) return direct;

    // Search for any path that ends with this suffix (handles nested prefix folders)
    let found: JSZip.JSZipObject | null = null;
    zip.forEach((path, file) => {
      if (
        !found &&
        !file.dir &&
        (path === suffix || path.endsWith("/" + suffix))
      ) {
        found = file;
      }
    });
    if (found) return found;
  }
  return null;
}

async function readText(zip: JSZip, ...suffixes: string[]): Promise<string> {
  const file = findFile(zip, ...suffixes);
  return file ? (await file.async("string")).trim() : "";
}

/** Collect all file paths matching a predicate. */
function allPaths(zip: JSZip, predicate: (path: string) => boolean): string[] {
  const results: string[] = [];
  zip.forEach((path, file) => {
    if (!file.dir && predicate(path)) results.push(path);
  });
  return results;
}

/**
 * Sitecore packages sometimes nest content inside a second ZIP file
 * (e.g. installer/package.zip). Unwrap one level if found.
 */
async function resolveZip(zip: JSZip): Promise<JSZip> {
  // Look for an inner .zip that contains items/ or installer/
  let innerBuffer: ArrayBuffer | null = null;
  zip.forEach((path, file) => {
    if (!innerBuffer && path.endsWith(".zip") && !file.dir) {
      // Only unwrap if it looks like a package (not a media asset)
      if (path.includes("installer") || path.includes("package")) {
        // tag it for async load below
        innerBuffer = null; // placeholder
      }
    }
  });

  // Check for known inner zip locations
  const candidates = allPaths(zip, (p) => p.endsWith(".zip"));
  for (const candidate of candidates) {
    try {
      const buf = await zip.file(candidate)!.async("arraybuffer");
      const inner = await JSZip.loadAsync(buf);
      // Validate it looks like a Sitecore package
      let hasItems = false;
      inner.forEach((p) => {
        if (p.includes("items/") || p.includes("/items/")) hasItems = true;
      });
      if (hasItems) return inner;
    } catch {
      // not a valid zip, skip
    }
  }

  return zip;
}

// ── Metadata ──────────────────────────────────────────────────────────────────

async function parseMetadata(zip: JSZip): Promise<PackageMetadata> {
  const name = await readText(zip, "sc_name.txt");
  const version = await readText(zip, "sc_version.txt");
  const author = await readText(zip, "sc_author.txt");
  const publisher = await readText(zip, "sc_publisher.txt");
  const comment = await readText(zip, "sc_comment.txt");
  const readme = await readText(zip, "sc_readme.txt");

  if (name) return { name, version, author, publisher, comment, readme };

  // Fall back to package.xml
  const xml = await readText(zip, "package.xml");
  if (xml) {
    try {
      const parsed = xmlParser.parse(xml);
      const pkg = parsed?.package ?? parsed;
      const meta = pkg?.metadata ?? pkg;
      return {
        name: meta?.name ?? "",
        version: meta?.version ?? "",
        author: meta?.author ?? "",
        publisher: meta?.publisher ?? "",
        comment: pkg?.comment ?? "",
        readme: pkg?.readme ?? "",
      };
    } catch {
      /* ignore */
    }
  }

  return {
    name: "",
    version: "",
    author: "",
    publisher: "",
    comment: "",
    readme: "",
  };
}

// ── Deploy modes ──────────────────────────────────────────────────────────────

function normaliseMode(raw: string | undefined): DeployMode {
  if (!raw) return "Undefined";
  switch (raw.toLowerCase()) {
    case "overwrite":
    case "overwriteorskip":
      return "Overwrite";
    case "merge":
    case "mergeorskip":
    case "mergeorappend":
      return "Merge";
    case "skip":
    case "skiporskip":
      return "Skip";
    case "delete":
    case "deletefull":
      return "Delete";
    default:
      return "Undefined";
  }
}

async function parseInstallerModes(
  zip: JSZip,
): Promise<Map<string, DeployMode>> {
  const modes = new Map<string, DeployMode>();

  // 1. installer.xml (classic format)
  const installerXml = await readText(zip, "installer.xml");
  if (installerXml) {
    try {
      const parsed = xmlParser.parse(installerXml);
      const entries =
        parsed?.installer?.entries?.entry ?? parsed?.entries?.entry ?? [];
      const arr = Array.isArray(entries) ? entries : [entries];
      for (const e of arr) {
        const id = (e["@_itemid"] ?? e["@_id"] ?? "")
          .replace(/[{}]/g, "")
          .toLowerCase();
        const behavior = e["@_behavior"] ?? e["@_action"] ?? "";
        if (id) modes.set(id, normaliseMode(behavior));
      }
    } catch {
      /* ignore */
    }
  }

  // 2. properties/{path}/{GUID}/... files — each is an XML with install behavior
  const propPaths = allPaths(zip, (p) => {
    const inProps =
      p.startsWith("properties/items/") || p.includes("/properties/items/");
    if (!inProps) return false;
    const filename = p.split("/").pop() ?? "";
    return (
      filename === "xml" || filename.endsWith(".xml") || /^\d+$/.test(filename)
    );
  });

  await Promise.all(
    propPaths.map(async (p) => {
      try {
        const content = await zip.file(p)!.async("string");

        // Properties files are key=value lines, e.g.:
        //   database=master
        //   id_InstallMode=Overwrite
        //   id_VersionMergeMode=Clear
        const kv: Record<string, string> = {};
        for (const line of content.split(/\r?\n/)) {
          const eq = line.indexOf("=");
          if (eq !== -1)
            kv[line.slice(0, eq).trim().toLowerCase()] = line
              .slice(eq + 1)
              .trim();
        }

        const installMode = kv["id_installmode"] ?? kv["installmode"] ?? "";
        if (!installMode) return;

        // Extract GUID from path — same structure as item paths but under properties/items/
        const adjusted = p.replace(/^properties\//, "");
        const { id } = parseZipItemPath(adjusted);
        if (id) modes.set(id, normaliseMode(installMode));
      } catch {
        /* ignore */
      }
    }),
  );

  return modes;
}

// ── Item type ─────────────────────────────────────────────────────────────────

function inferItemType(itemPath: string, templateName: string): ItemType {
  const p = itemPath.toLowerCase();
  const t = templateName.toLowerCase();

  if (t === "template") return "Template";
  if (t === "template field") return "Template Field";
  if (t === "template section") return "Template Section";
  if (p.startsWith("/sitecore/templates")) {
    if (t.includes("field")) return "Template Field";
    if (t.includes("section")) return "Template Section";
    return "Template";
  }
  if (
    p.startsWith("/sitecore/layout/renderings") ||
    p.startsWith("/sitecore/rendering")
  )
    return "Rendering";
  if (t.includes("placeholder") || p.includes("/placeholder settings"))
    return "Placeholder";
  if (p.startsWith("/sitecore/layout")) return "Layout";
  if (p.startsWith("/sitecore/media library")) return "Media";
  if (p.startsWith("/sitecore/system")) return "Setting";
  if (p.startsWith("/sitecore/content") || p.startsWith("/sitecore/home"))
    return "Content";
  return "Unknown";
}

// ── Item XML parsing ──────────────────────────────────────────────────────────

/**
 * Item zip paths look like:
 *   [prefix/]items/{database}/{path...}/{guid}/{version}.xml
 * Extract the database from the segment after "items/".
 */
function extractDatabaseFromPath(zipPath: string): Database {
  // Normalise slashes, find "items/" segment
  const normalised = zipPath.replace(/\\/g, "/");
  const idx = normalised.search(/(^|\/)items\//);
  if (idx === -1) return "unknown";
  const after = normalised.slice(idx).replace(/^\//, ""); // "items/master/..."
  const parts = after.split("/");
  return parts.length > 1 ? parts[1].toLowerCase() : "unknown";
}

/**
 * Parse item identity from zip path.
 * Format: items/{db}/{path...}/{GUID}/{lang}/{version}/xml
 * Returns { itemPath, id, language, version }
 */
function parseZipItemPath(zipPath: string): {
  itemPath: string;
  id: string;
  language: string;
  version: number;
} {
  const normalised = zipPath.replace(/\\/g, "/");
  const idx = normalised.search(/(^|\/)items\//);
  const empty = { itemPath: "", id: "", language: "en", version: 1 };
  if (idx === -1) return empty;

  const after = normalised.slice(idx).replace(/^\//, ""); // "items/db/path.../GUID/lang/ver/xml"
  const parts = after.split("/");
  // parts[0]=items, [1]=db, [2..n-5]=path, [n-4]=GUID, [n-3]=lang, [n-2]=version, [n-1]=xml
  // Minimum: items/db/{GUID}/lang/ver/xml = 6 parts
  if (parts.length < 6) return empty;

  const tail = parts.slice(parts.length - 4); // [GUID, lang, version, xml]
  const guidRaw = tail[0];
  const language = tail[1];
  const version = parseInt(tail[2], 10) || 1;

  const pathSegments = parts.slice(2, parts.length - 4);
  const itemPath = "/" + pathSegments.join("/");
  return { itemPath, id: guidRaw, language, version };
}

function parseFields(item: Record<string, unknown>): ItemField[] {
  try {
    const fieldsNode = item?.fields as Record<string, unknown> | undefined;
    if (!fieldsNode) return [];
    const raw = fieldsNode.field;
    const arr: unknown[] = Array.isArray(raw) ? raw : raw != null ? [raw] : [];
    return arr.map((f) => {
      const field = f as Record<string, unknown>;
      return {
        tfid: String(field["@_tfid"] ?? ""),
        key: String(field["@_key"] ?? ""),
        type: String(field["@_type"] ?? ""),
        value: String(
          typeof field.content === "object" && field.content !== null
            ? ((field.content as Record<string, unknown>)["#text"] ?? "")
            : (field.content ?? ""),
        ),
      };
    });
  } catch {
    return [];
  }
}

async function parseItemFile(
  zip: JSZip,
  zipPath: string,
  modes: Map<string, DeployMode>,
): Promise<SitecoreItem | null> {
  try {
    const fromPath = parseZipItemPath(zipPath);
    const database: Database = extractDatabaseFromPath(zipPath);

    const xmlContent = await zip.file(zipPath)!.async("string");
    const parsed = xmlParser.parse(xmlContent);
    const item = parsed?.item ?? (parsed as Record<string, unknown>);

    // Preserve raw values — no normalisation
    const id: string = String(item["@_id"] ?? fromPath.id);
    const name: string = String(
      item["@_name"] ??
        item["@_key"] ??
        fromPath.itemPath.split("/").pop() ??
        "",
    );
    const key: string = String(item["@_key"] ?? "");
    const path: string = String(item["@_path"] ?? fromPath.itemPath);
    // In this format: @_template = template name, @_tid = template ID
    const templateName: string = String(
      item["@_template"] ?? item["@_templatename"] ?? "",
    );
    const templateId: string = String(
      item["@_tid"] ?? item["@_templateid"] ?? "",
    );
    const parentId: string = String(item["@_parentid"] ?? "");
    const sortOrder: string = String(item["@_sortorder"] ?? "");
    const language: string = String(item["@_language"] ?? fromPath.language);
    const version: number =
      parseInt(String(item["@_version"] ?? fromPath.version), 10) || 1;
    const fields = parseFields(item);

    if (!id && !name) return null;

    // For mode lookup use the bare GUID (no braces, lowercase) as key
    const idKey = id.replace(/[{}]/g, "").toLowerCase();

    return {
      id,
      name,
      key,
      path,
      database,
      templateId,
      templateName,
      parentId,
      sortOrder,
      deployMode: modes.get(idKey) ?? modes.get(fromPath.id.replace(/[{}]/g, "").toLowerCase()) ?? "Undefined",
      itemType: inferItemType(path, templateName),
      language,
      version,
      fields,
      rawXml: xmlContent,
    };
  } catch {
    return null;
  }
}

// ── Physical files ────────────────────────────────────────────────────────────

function parseFiles(zip: JSZip): PackageFile[] {
  const files: PackageFile[] = [];
  const seen = new Set<string>();

  zip.forEach((relativePath, file) => {
    if (file.dir) return;
    const p = relativePath.toLowerCase();
    // Exclude Sitecore package internals — only keep physical deployment files
    if (
      p.includes("/items/") ||
      p.startsWith("items/") ||
      p.includes("/metadata/") ||
      p.startsWith("metadata/") ||
      p.includes("/installer/") ||
      p.startsWith("installer/") ||
      p.includes("/properties/") ||
      p.startsWith("properties/")
    )
      return;

    if (!seen.has(relativePath)) {
      seen.add(relativePath);
      // Approximate size from compressed size
      const obj = file as JSZip.JSZipObject & {
        _data?: { compressedSize?: number; uncompressedSize?: number };
      };
      const size = obj._data?.uncompressedSize ?? 0;
      files.push({ path: relativePath, size });
    }
  });

  return files;
}

// ── Main entry ────────────────────────────────────────────────────────────────

export async function parsePackage(
  buffer: ArrayBuffer,
): Promise<ParsedPackage> {
  const errors: string[] = [];
  let zip: JSZip;

  try {
    zip = await JSZip.loadAsync(buffer);
  } catch (e) {
    return {
      metadata: {
        name: "",
        version: "",
        author: "",
        publisher: "",
        comment: "",
        readme: "",
      },
      items: [],
      files: [],
      errors: [`Failed to open ZIP: ${e}`],
    };
  }

  // Unwrap zip-in-zip if needed
  zip = await resolveZip(zip);

  const metadata = await parseMetadata(zip);
  const modes = await parseInstallerModes(zip);

  // Item files: items/{db}/{path}/{GUID}/{lang}/{version}/xml
  // The filename is literally "xml" (no extension)
  const itemPaths = allPaths(zip, (p) => {
    const inItems = p.includes("/items/") || p.startsWith("items/");
    if (!inItems) return false;
    const filename = p.split("/").pop() ?? "";
    return (
      filename === "xml" || filename.endsWith(".xml") || /^\d+$/.test(filename)
    );
  });

  if (itemPaths.length === 0) {
    // Surface raw paths for debugging — helps diagnose unexpected ZIP layouts
    const allZipPaths: string[] = [];
    zip.forEach((p) => allZipPaths.push(p));
    errors.push(
      `No item files found. ZIP contains: ${allZipPaths.slice(0, 20).join(", ")}`,
    );
  }

  const itemResults = await Promise.all(
    itemPaths.map((p) => parseItemFile(zip, p, modes)),
  );

  // Deduplicate by bare GUID + language — keep highest version
  const seen = new Map<string, SitecoreItem>();
  for (const item of itemResults) {
    if (!item) continue;
    const dedupeKey = `${item.id.replace(/[{}]/g, "").toLowerCase()}::${item.language}`;
    const existing = seen.get(dedupeKey);
    if (!existing || item.version > existing.version) seen.set(dedupeKey, item);
  }

  const files = parseFiles(zip);

  return {
    metadata,
    items: Array.from(seen.values()),
    files,
    errors,
  };
}
