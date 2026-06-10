import type { DriftResult, DriftStatus, DriftItem } from "./driftAnalyzer";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type JsPDF = any;

// ── Colours ───────────────────────────────────────────────────────────────────

const SLATE_900: [number, number, number] = [15, 23, 42];
const SLATE_800: [number, number, number] = [30, 41, 59];
const SLATE_700: [number, number, number] = [51, 65, 85];
const SLATE_500: [number, number, number] = [100, 116, 139];
const SLATE_100: [number, number, number] = [241, 245, 249];
const WHITE: [number, number, number] = [255, 255, 255];

const STATUS_COLORS: Record<DriftStatus, [number, number, number]> = {
  "source-only": [37, 99, 235],
  "target-only": [100, 116, 139],
  modified: [217, 119, 6],
  identical: [5, 150, 105],
};
const STATUS_BG: Record<DriftStatus, [number, number, number]> = {
  "source-only": [219, 234, 254],
  "target-only": [241, 245, 249],
  modified: [254, 243, 199],
  identical: [209, 250, 229],
};

const MASTER_WEB_LABELS: Record<DriftStatus, string> = {
  "source-only": "Unpublished",
  "target-only": "Not in Master",
  modified: "Out of Sync",
  identical: "In Sync",
};
const ENV_LABELS: Record<DriftStatus, string> = {
  "source-only": "New Item",
  "target-only": "Not in Source",
  modified: "Will Overwrite",
  identical: "No Change",
};

// ── Section helpers (mirrors DriftView grouping) ───────────────────────────────

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

// Derive a group label from a DriftItem for PDF grouping
// Template-related items → use the template root path's last segment
// Others → use templateName
function getGroupKey(item: DriftItem): string {
  const tl = item.templateName.toLowerCase();
  if (
    tl === "template" ||
    tl === "template section" ||
    tl === "template field" ||
    item.name === "__Standard Values"
  ) {
    // Walk up to template root (parent for section, grandparent for field)
    const parts = item.path.split("/").filter(Boolean);
    if (tl === "template field" && parts.length > 2)
      return "/" + parts.slice(0, -2).join("/");
    if (
      (tl === "template section" || item.name === "__Standard Values") &&
      parts.length > 1
    )
      return "/" + parts.slice(0, -1).join("/");
    return item.path;
  }
  return item.templateName || "Unknown";
}

function getGroupLabel(key: string): string {
  // If key looks like a path, take the last segment
  if (key.startsWith("/")) return key.split("/").filter(Boolean).pop() ?? key;
  return key;
}

interface PdfGroup {
  key: string;
  label: string;
  items: DriftItem[];
}

interface PdfSection {
  label: string;
  groups: PdfGroup[];
  counts: Record<DriftStatus, number>;
}

function buildSections(items: DriftItem[]): PdfSection[] {
  // section → group → items
  const sectionMap = new Map<string, Map<string, DriftItem[]>>();

  for (const item of items) {
    const section = getSectionFromPath(item.path);
    const groupKey = getGroupKey(item);

    if (!sectionMap.has(section)) sectionMap.set(section, new Map());
    const gmap = sectionMap.get(section)!;
    if (!gmap.has(groupKey)) gmap.set(groupKey, []);
    gmap.get(groupKey)!.push(item);
  }

  const sections: PdfSection[] = [];
  for (const [sLabel, gmap] of sectionMap) {
    const groups: PdfGroup[] = [];
    for (const [key, gitems] of gmap) {
      groups.push({
        key,
        label: getGroupLabel(key),
        items: gitems.sort((a, b) => a.path.localeCompare(b.path)),
      });
    }
    groups.sort((a, b) => a.label.localeCompare(b.label));

    const counts: Record<DriftStatus, number> = {
      "source-only": 0,
      "target-only": 0,
      modified: 0,
      identical: 0,
    };
    for (const g of groups) for (const i of g.items) counts[i.status]++;

    sections.push({ label: sLabel, groups, counts });
  }

  sections.sort((a, b) => {
    const ai = SECTION_ORDER.indexOf(a.label);
    const bi = SECTION_ORDER.indexOf(b.label);
    if (ai === -1 && bi === -1) return a.label.localeCompare(b.label);
    if (ai === -1) return 1;
    if (bi === -1) return -1;
    return ai - bi;
  });

  return sections;
}

// ── PDF export ────────────────────────────────────────────────────────────────

export async function exportDriftPdf(result: DriftResult): Promise<void> {
  const { default: JsPDFClass } = await import("jspdf");
  const { default: autoTable } = await import("jspdf-autotable");

  const doc: JsPDF = new JsPDFClass({
    orientation: "landscape",
    unit: "mm",
    format: "a4",
  });
  const W = doc.internal.pageSize.getWidth();
  const margin = 14;
  const isMW = result.mode === "master-web";
  const labelFn = (s: DriftStatus) =>
    isMW ? MASTER_WEB_LABELS[s] : ENV_LABELS[s];

  // ── Page 1: header ─────────────────────────────────────────────────────────
  doc.setFillColor(...SLATE_900);
  doc.rect(0, 0, W, 22, "F");
  doc.setTextColor(...WHITE);
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.text(
    isMW ? "Master vs Web Sync Report" : "Environment Sync Report",
    margin,
    14,
  );
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.text(`Generated: ${new Date().toLocaleString()}`, W - margin, 14, {
    align: "right",
  });

  // ── Meta ───────────────────────────────────────────────────────────────────
  let y = 30;
  doc.setFontSize(9);
  doc.setTextColor(...SLATE_700);
  doc.setFont("helvetica", "bold");
  doc.text(isMW ? "Source (Master):" : "Source:", margin, y);
  doc.setFont("helvetica", "normal");
  doc.text(result.sourceLabel, margin + 42, y);
  doc.setFont("helvetica", "bold");
  doc.text(isMW ? "Target (Web):" : "Target:", margin + 110, y);
  doc.setFont("helvetica", "normal");
  doc.text(result.targetLabel, margin + 152, y);

  y += 6;
  doc.setFont("helvetica", "bold");
  doc.text("Total items compared:", margin, y);
  doc.setFont("helvetica", "normal");
  doc.text(result.items.length.toLocaleString(), margin + 42, y);

  // ── Status summary table ───────────────────────────────────────────────────
  y += 12;
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...SLATE_700);
  doc.text("Status Summary", margin, y);
  y += 4;

  const statuses: DriftStatus[] = [
    "source-only",
    "modified",
    "target-only",
    "identical",
  ];
  autoTable(doc, {
    startY: y,
    margin: { left: margin, right: margin },
    head: [["Status", "Count"]],
    body: statuses.map((s) => [labelFn(s), String(result.stats[s])]),
    styles: { fontSize: 8, cellPadding: 3, font: "helvetica" },
    headStyles: { fillColor: SLATE_900, textColor: WHITE, fontStyle: "bold" },
    columnStyles: {
      0: { cellWidth: 60 },
      1: { cellWidth: 20, halign: "center" },
    },
    tableWidth: 84,
    didParseCell(data) {
      if (data.section === "body") {
        const s = statuses[data.row.index];
        if (s) {
          data.cell.styles.fillColor = STATUS_BG[s];
          data.cell.styles.textColor = STATUS_COLORS[s];
          if (data.column.index === 0) data.cell.styles.fontStyle = "bold";
        }
      }
    },
  });

  // ── Section summary table ──────────────────────────────────────────────────
  const nonIdentical = result.items.filter((i) => i.status !== "identical");
  const sections = buildSections(nonIdentical);

  if (sections.length > 0) {
    autoTable(doc, {
      startY: y,
      margin: { left: margin + 100, right: margin },
      head: [["Section", "New", "Overwrite", "Not in Src", "Total"]],
      body: sections.map((s) => [
        s.label,
        String(s.counts["source-only"] || "—"),
        String(s.counts["modified"] || "—"),
        String(s.counts["target-only"] || "—"),
        String(s.groups.reduce((n, g) => n + g.items.length, 0)),
      ]),
      styles: { fontSize: 8, cellPadding: 3, font: "helvetica" },
      headStyles: { fillColor: SLATE_800, textColor: WHITE, fontStyle: "bold" },
      alternateRowStyles: { fillColor: SLATE_100 },
      columnStyles: {
        0: { cellWidth: 48, fontStyle: "bold" },
        1: { cellWidth: 18, halign: "center" },
        2: { cellWidth: 22, halign: "center" },
        3: { cellWidth: 22, halign: "center" },
        4: { cellWidth: 18, halign: "center", fontStyle: "bold" },
      },
      tableWidth: 130,
    });
  }

  // ── Detail pages ───────────────────────────────────────────────────────────
  if (nonIdentical.length === 0) {
    doc.save(fileName(result, isMW));
    return;
  }

  // Row type markers — stored in hidden last column, used in didParseCell
  const ROW_SECTION = "S";
  const ROW_GROUP = "G";
  const ROW_ITEM = "I";

  type RowMeta = typeof ROW_SECTION | typeof ROW_GROUP | typeof ROW_ITEM;
  const rows: string[][] = [];
  const rowMeta: RowMeta[] = [];

  let itemIdx = 0;
  for (const section of sections) {
    // Section header row — col 0 will span all 6 via didParseCell colSpan
    rows.push([section.label, "", "", "", "", ""]);
    rowMeta.push(ROW_SECTION);

    let groupNum = 0;
    for (const group of section.groups) {
      groupNum++;
      const totalInGroup = group.items.length;
      const badge = (
        ["source-only", "modified", "target-only"] as DriftStatus[]
      )
        .filter((s) => group.items.some((i) => i.status === s))
        .map(
          (s) =>
            `${group.items.filter((i) => i.status === s).length} ${labelFn(s)}`,
        )
        .join("   ·   ");

      // Col layout: [num+name (spans 3)] [badge (spans 2)] [count]
      rows.push([
        `${groupNum}.  ${group.label}`,
        "",
        "",
        badge,
        "",
        `${totalInGroup} item${totalInGroup !== 1 ? "s" : ""}`,
      ]);
      rowMeta.push(ROW_GROUP);

      for (const item of group.items) {
        itemIdx++;
        rows.push([
          String(itemIdx),
          labelFn(item.status),
          item.name,
          item.path,
          item.templateName || "—",
          item.fieldDiffs.length > 0
            ? `${item.fieldDiffs.length} field${item.fieldDiffs.length !== 1 ? "s" : ""}: ${item.fieldDiffs
                .slice(0, 3)
                .map((f) => f.field)
                .join(", ")}${item.fieldDiffs.length > 3 ? "…" : ""}`
            : "—",
        ]);
        rowMeta.push(ROW_ITEM);
      }
    }
  }

  doc.addPage();
  doc.setFillColor(...SLATE_900);
  doc.rect(0, 0, W, 16, "F");
  doc.setTextColor(...WHITE);
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.text("Drift Details", margin, 11);
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.text(
    `${nonIdentical.length.toLocaleString()} items across ${sections.length} section${sections.length !== 1 ? "s" : ""}`,
    W - margin,
    11,
    { align: "right" },
  );

  autoTable(doc, {
    startY: 22,
    margin: { left: margin, right: margin },
    head: [["#", "Status", "Item Name", "Path", "Template", "Changed Fields"]],
    body: rows,
    styles: {
      fontSize: 7,
      cellPadding: 2.5,
      overflow: "linebreak",
      font: "helvetica",
    },
    headStyles: {
      fillColor: SLATE_900,
      textColor: WHITE,
      fontStyle: "bold",
      fontSize: 7,
    },
    columnStyles: {
      0: { cellWidth: 14, halign: "center", overflow: "hidden" },
      1: { cellWidth: 30 },
      2: { cellWidth: 35 },
      3: { cellWidth: 85 },
      4: { cellWidth: 33 },
      5: { cellWidth: 59 },
    },
    didParseCell(data) {
      if (data.section !== "body") return;
      const meta = rowMeta[data.row.index];
      const col = data.column.index;

      if (meta === ROW_SECTION) {
        // Span all 6 columns on col 0; hide the rest
        if (col === 0) {
          data.cell.colSpan = 6;
          data.cell.styles.fillColor = SLATE_800;
          data.cell.styles.textColor = WHITE;
          data.cell.styles.fontStyle = "bold";
          data.cell.styles.fontSize = 9;
          data.cell.styles.cellPadding = {
            top: 5,
            bottom: 5,
            left: 6,
            right: 6,
          };
        }
      } else if (meta === ROW_GROUP) {
        // Col 0 spans cols 0-2 (name), col 3 spans 3-4 (badge), col 5 = count
        data.cell.styles.fillColor = SLATE_100;
        data.cell.styles.cellPadding = { top: 3, bottom: 3, left: 5, right: 5 };
        data.cell.styles.fontSize = 7;

        if (col === 0) {
          data.cell.colSpan = 3;
          data.cell.styles.textColor = SLATE_700;
          data.cell.styles.fontStyle = "bold";
        } else if (col === 3) {
          data.cell.colSpan = 2;
          data.cell.styles.textColor = SLATE_500;
          data.cell.styles.fontStyle = "normal";
        } else if (col === 5) {
          data.cell.styles.textColor = SLATE_700;
          data.cell.styles.fontStyle = "bold";
          data.cell.styles.halign = "right";
        }
      } else {
        // Normal item row — colour the Status cell
        if (col === 1) {
          const cellText = String(data.cell.raw);
          const matchedStatus = (
            [
              "source-only",
              "modified",
              "target-only",
              "identical",
            ] as DriftStatus[]
          ).find((s) => labelFn(s) === cellText);
          if (matchedStatus) {
            data.cell.styles.fillColor = STATUS_BG[matchedStatus];
            data.cell.styles.textColor = STATUS_COLORS[matchedStatus];
            data.cell.styles.fontStyle = "bold";
          }
        }
      }
    },
    didDrawPage(data) {
      const pageCount = doc.internal.getNumberOfPages();
      doc.setFontSize(7);
      doc.setTextColor(...SLATE_500);
      doc.setFont("helvetica", "normal");
      doc.text(
        `Page ${data.pageNumber} of ${pageCount}  •  Sitecore Deployment Assistant`,
        W / 2,
        doc.internal.pageSize.getHeight() - 6,
        { align: "center" },
      );
    },
  });

  doc.save(fileName(result, isMW));
}

function fileName(result: DriftResult, isMW: boolean): string {
  const env = isMW
    ? "master-web"
    : `${result.sourceLabel}-vs-${result.targetLabel}`.replace(/\s+/g, "-");
  const date = new Date().toISOString().slice(0, 10);
  return `sitecore-drift.${env}.${date}.pdf`;
}
