import JSZip from "jszip";
import type { ParsedPackage, SitecoreItem } from "./types";

/**
 * Reconstruct a Sitecore-compatible .zip package from a ParsedPackage.
 *
 * Structure:
 *   sc_name.txt / sc_version.txt / sc_author.txt / sc_publisher.txt / sc_comment.txt
 *   installer.xml          — deploy modes per item
 *   items/{db}/{path}/{GUID}/{lang}/{version}/xml  — one XML file per item
 */
export async function exportPackageZip(
  pkg: ParsedPackage,
  filename = "merged-package.zip",
): Promise<void> {
  const zip = new JSZip();

  // ── Metadata files ────────────────────────────────────────────────────────
  zip.file("sc_name.txt", pkg.metadata.name || "Merged Package");
  zip.file("sc_version.txt", pkg.metadata.version || "1.0");
  zip.file("sc_author.txt", pkg.metadata.author || "");
  zip.file("sc_publisher.txt", pkg.metadata.publisher || "");
  zip.file("sc_comment.txt", pkg.metadata.comment || "");
  zip.file("sc_readme.txt", pkg.metadata.readme || "");

  // ── installer.xml — deploy modes ─────────────────────────────────────────
  const entries = pkg.items
    .filter((i) => i.deployMode !== "Undefined")
    .map((i) => {
      const id = normaliseId(i.id);
      return `  <entry itemid="{${id.toUpperCase()}}" behavior="${i.deployMode}"/>`;
    })
    .join("\n");

  zip.file(
    "installer.xml",
    `<?xml version="1.0" encoding="utf-8"?>\n<installer>\n  <entries>\n${entries}\n  </entries>\n</installer>`,
  );

  // ── Item XML files ────────────────────────────────────────────────────────
  for (const item of pkg.items) {
    const xmlContent = buildItemXml(item);
    const zipPath = buildItemZipPath(item);
    zip.file(zipPath, xmlContent);
  }

  // ── Trigger download ──────────────────────────────────────────────────────
  const blob = await zip.generateAsync({
    type: "blob",
    compression: "DEFLATE",
    compressionOptions: { level: 6 },
  });

  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function normaliseId(id: string): string {
  return id.replace(/[{}]/g, "").toLowerCase();
}

/**
 * Build the zip path for an item:
 * items/{database}/{path segments}/{GUID}/{language}/{version}/xml
 */
function buildItemZipPath(item: SitecoreItem): string {
  const db = item.database || "master";
  // Strip leading slash, use path segments
  const pathSegments = item.path.replace(/^\//, "").split("/").filter(Boolean);
  const guid = normaliseId(item.id).toUpperCase();
  const lang = item.language || "en";
  const ver = item.version ?? 1;
  return `items/${db}/${pathSegments.join("/")}/${guid}/${lang}/${ver}/xml`;
}

/**
 * Serialize a SitecoreItem back to the XML format Sitecore packages use.
 */
function buildItemXml(item: SitecoreItem): string {
  const attrs = [
    `id="${formatGuid(item.id)}"`,
    `name="${escapeXml(item.name)}"`,
    item.key ? `key="${escapeXml(item.key)}"` : "",
    `path="${escapeXml(item.path)}"`,
    item.templateName ? `template="${escapeXml(item.templateName)}"` : "",
    item.templateId ? `tid="${formatGuid(item.templateId)}"` : "",
    item.parentId ? `parentid="${formatGuid(item.parentId)}"` : "",
    item.sortOrder ? `sortorder="${escapeXml(item.sortOrder)}"` : "",
    `language="${escapeXml(item.language || "en")}"`,
    `version="${item.version ?? 1}"`,
  ]
    .filter(Boolean)
    .join(" ");

  if (item.fields.length === 0) {
    return `<?xml version="1.0" encoding="utf-8"?>\n<item ${attrs}>\n  <fields/>\n</item>`;
  }

  const fieldLines = item.fields
    .map((f) => {
      const fAttrs = [
        f.tfid ? `tfid="${formatGuid(f.tfid)}"` : "",
        f.key ? `key="${escapeXml(f.key)}"` : "",
        f.type ? `type="${escapeXml(f.type)}"` : "",
      ]
        .filter(Boolean)
        .join(" ");

      const content = f.value
        ? `\n      <content><![CDATA[${f.value}]]></content>\n    `
        : "";
      return `    <field ${fAttrs}>${content}</field>`;
    })
    .join("\n");

  return `<?xml version="1.0" encoding="utf-8"?>\n<item ${attrs}>\n  <fields>\n${fieldLines}\n  </fields>\n</item>`;
}

/** Ensure a GUID is in {XXXXXXXX-XXXX-XXXX-XXXX-XXXXXXXXXXXX} format. */
function formatGuid(raw: string): string {
  const clean = raw.replace(/[{}]/g, "").toUpperCase();
  // Already has dashes in right positions — wrap in braces
  if (
    /^[0-9A-F]{8}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{12}$/i.test(
      clean,
    )
  ) {
    return `{${clean}}`;
  }
  return raw.startsWith("{") ? raw : `{${raw}}`;
}

function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}
