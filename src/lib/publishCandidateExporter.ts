import type { DriftResult, DriftStatus, DriftItem } from "./driftAnalyzer";
import type { AnalysisResult } from "./analyzer";
import type { SitecoreItem } from "./types";

// ── Publish action types ──────────────────────────────────────────────────────

export type PublishAction = "subitems" | "single-new" | "single-modified";

export interface PublishInstruction {
  action: PublishAction;
  item: DriftItem | SitecoreItem;
  path: string;
  name: string;
  templateName: string;
  reason: string;
  coveredCount: number;
  fieldCount: number;
}

// ── Core algorithm ────────────────────────────────────────────────────────────

function buildInstructions(
  newItems: DriftItem[],
  modifiedItems: DriftItem[],
): PublishInstruction[] {
  const newPaths = new Set(newItems.map((i) => i.path));
  const covered = new Set<string>();
  const instructions: PublishInstruction[] = [];

  const sorted = [...newItems].sort((a, b) => a.path.localeCompare(b.path));

  for (const item of sorted) {
    if (covered.has(item.path)) continue;

    const parts = item.path.split("/").filter(Boolean);
    const parentPath = "/" + parts.slice(0, -1).join("/");
    if (newPaths.has(parentPath)) continue;

    const newDescendants = newItems.filter(
      (i) => i.path !== item.path && i.path.startsWith(item.path + "/"),
    );

    if (newDescendants.length > 0) {
      newDescendants.forEach((d) => covered.add(d.path));
      instructions.push({
        action: "subitems",
        item,
        path: item.path,
        name: item.name,
        templateName: item.templateName,
        reason: `New item — ${newDescendants.length} new child item${newDescendants.length !== 1 ? "s" : ""} covered`,
        coveredCount: newDescendants.length,
        fieldCount: 0,
      });
    } else {
      instructions.push({
        action: "single-new",
        item,
        path: item.path,
        name: item.name,
        templateName: item.templateName,
        reason: "New item, no new children",
        coveredCount: 0,
        fieldCount: 0,
      });
    }
  }

  for (const item of modifiedItems) {
    instructions.push({
      action: "single-modified",
      item,
      path: item.path,
      name: item.name,
      templateName: item.templateName,
      reason:
        item.fieldDiffs.length > 0
          ? `Modified — ${item.fieldDiffs.length} field${item.fieldDiffs.length !== 1 ? "s" : ""} changed: ${item.fieldDiffs
              .slice(0, 3)
              .map((f) => f.field)
              .join(", ")}${item.fieldDiffs.length > 3 ? "…" : ""}`
          : "Modified",
      coveredCount: 0,
      fieldCount: item.fieldDiffs.length,
    });
  }

  return instructions;
}

export function buildPublishInstructions(
  result: DriftResult,
): PublishInstruction[] {
  return buildInstructions(
    result.items.filter((i) => i.status === "source-only") as DriftItem[],
    result.items.filter((i) => i.status === "modified") as DriftItem[],
  );
}

export function buildPublishInstructionsFromItems(
  items: SitecoreItem[],
): PublishInstruction[] {
  const toFake = (item: SitecoreItem) => ({
    status: "source-only" as const,
    id: item.id,
    name: item.name,
    path: item.path,
    templateName: item.templateName ?? "",
    sourceItem: null,
    targetItem: null,
    fieldDiffs: [],
  });
  return buildInstructions(items.map(toFake), []);
}

export function buildPublishInstructionsFromAnalysis(
  result: AnalysisResult,
): PublishInstruction[] {
  const toFake = (item: SitecoreItem, status: DriftStatus): DriftItem => ({
    status,
    id: item.id,
    name: item.name,
    path: item.path,
    templateName: item.templateName,
    sourceItem: null,
    targetItem: null,
    fieldDiffs: [],
  });
  return buildInstructions(
    result.findings
      .filter((f) => f.category === "new-item")
      .map((f) => toFake(f.packageItem, "source-only")),
    result.findings
      .filter((f) => f.category === "overwrite-exists")
      .map((f) => toFake(f.packageItem, "modified")),
  );
}

export const ACTION_LABEL: Record<PublishAction, string> = {
  subitems: "Publish with Subitems",
  "single-new": "Single Item Publish",
  "single-modified": "Single Item Publish",
};

// ── Excel export (exceljs) ────────────────────────────────────────────────────

type RGB = { argb: string };

const COLORS = {
  headerBg: { argb: "FF0F172A" } as RGB, // slate-900
  sectionBg: { argb: "FF1E293B" } as RGB, // slate-800
  subitemsBg: { argb: "FFDBEAFE" } as RGB, // blue-100
  subitems: { argb: "FF1D4ED8" } as RGB, // blue-700
  singleNewBg: { argb: "FFD1FAE5" } as RGB, // emerald-100
  singleNew: { argb: "FF065F46" } as RGB, // emerald-800
  modifiedBg: { argb: "FFFEF3C7" } as RGB, // amber-100
  modified: { argb: "FF92400E" } as RGB, // amber-800
  white: { argb: "FFFFFFFF" } as RGB,
  lightGray: { argb: "FFF8FAFC" } as RGB, // slate-50
  sectionText: { argb: "FFCBD5E1" } as RGB, // slate-300
};

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

async function writeExcel(
  instructions: PublishInstruction[],
  meta: { title: string; subtitle: string },
  filename: string,
): Promise<void> {
  const ExcelJS = (await import("exceljs")).default;

  const wb = new ExcelJS.Workbook();
  wb.creator = "Sitecore Deployment Assistant";
  wb.created = new Date();

  const ws = wb.addWorksheet("Publish Candidates", {
    views: [{ state: "frozen", ySplit: 5 }],
  });

  // ── Column definitions ────────────────────────────────────────────────────
  ws.columns = [
    { key: "num", width: 6 },
    { key: "action", width: 28 },
    { key: "name", width: 32 },
    { key: "path", width: 70 },
    { key: "template", width: 22 },
    { key: "notes", width: 52 },
    { key: "covered", width: 14 },
  ];

  // ── Title rows ────────────────────────────────────────────────────────────
  const titleRow = ws.addRow([meta.title]);
  titleRow.getCell(1).font = { bold: true, size: 14, color: COLORS.headerBg };
  titleRow.getCell(1).alignment = { vertical: "middle" };
  titleRow.height = 24;
  ws.mergeCells(`A1:G1`);

  const subRow = ws.addRow([meta.subtitle]);
  subRow.getCell(1).font = { size: 9, color: { argb: "FF64748B" } };
  subRow.getCell(1).alignment = { vertical: "middle" };
  ws.mergeCells(`A2:G2`);

  const subitemsCount = instructions.filter(
    (i) => i.action === "subitems",
  ).length;
  const singleNewCount = instructions.filter(
    (i) => i.action === "single-new",
  ).length;
  const modifiedCount = instructions.filter(
    (i) => i.action === "single-modified",
  ).length;
  const totalCovered = instructions
    .filter((i) => i.action === "subitems")
    .reduce((n, i) => n + i.coveredCount, 0);

  const summaryRow = ws.addRow([
    `Publish with Subitems: ${subitemsCount} actions (covers ${totalCovered + subitemsCount} items)   ·   ` +
      `Single Item New: ${singleNewCount}   ·   ` +
      `Single Item Modified: ${modifiedCount}   ·   ` +
      `Total actions: ${instructions.length}`,
  ]);
  summaryRow.getCell(1).font = {
    size: 8,
    italic: true,
    color: { argb: "FF475569" },
  };
  summaryRow.getCell(1).alignment = { vertical: "middle" };
  ws.mergeCells(`A3:G3`);

  ws.addRow([]); // spacer

  // ── Column header row ─────────────────────────────────────────────────────
  const headerRow = ws.addRow([
    "#",
    "Publish Action",
    "Item Name",
    "Path",
    "Template",
    "Notes",
    "Children Covered",
  ]);
  headerRow.height = 20;
  headerRow.eachCell((cell) => {
    cell.font = { bold: true, color: COLORS.white, size: 9 };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: COLORS.headerBg };
    cell.alignment = { vertical: "middle", wrapText: false };
    cell.border = { bottom: { style: "thin", color: { argb: "FF334155" } } };
  });

  // ── Data rows ─────────────────────────────────────────────────────────────
  const sections: Array<{
    label: string;
    filter: (i: PublishInstruction) => boolean;
    bg: RGB;
    fg: RGB;
    secColor: RGB;
  }> = [
    {
      label: "PUBLISH WITH SUBITEMS",
      filter: (i) => i.action === "subitems",
      bg: COLORS.subitemsBg,
      fg: COLORS.subitems,
      secColor: { argb: "FF1E3A5F" },
    },
    {
      label: "SINGLE ITEM PUBLISH — NEW",
      filter: (i) => i.action === "single-new",
      bg: COLORS.singleNewBg,
      fg: COLORS.singleNew,
      secColor: { argb: "FF064E3B" },
    },
    {
      label: "SINGLE ITEM PUBLISH — MODIFIED",
      filter: (i) => i.action === "single-modified",
      bg: COLORS.modifiedBg,
      fg: COLORS.modified,
      secColor: { argb: "FF78350F" },
    },
  ];

  let rowNum = 0;
  let isAlt = false;

  for (const section of sections) {
    const group = instructions.filter(section.filter);
    if (group.length === 0) continue;

    // Section header
    const secRow = ws.addRow(["", section.label, "", "", "", "", ""]);
    ws.mergeCells(`B${secRow.number}:G${secRow.number}`);
    secRow.height = 18;
    secRow.eachCell((cell, col) => {
      cell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: COLORS.sectionBg,
      };
      cell.font = { bold: true, size: 8, color: COLORS.sectionText };
      cell.alignment = { vertical: "middle", indent: col === 2 ? 1 : 0 };
    });

    isAlt = false;
    for (const instr of group) {
      rowNum++;
      const dataRow = ws.addRow([
        rowNum,
        ACTION_LABEL[instr.action],
        instr.name,
        instr.path,
        instr.templateName || "—",
        instr.reason,
        instr.coveredCount > 0 ? instr.coveredCount : "—",
      ]);
      dataRow.height = 16;

      const rowBg = isAlt ? COLORS.lightGray : COLORS.white;
      dataRow.eachCell((cell, col) => {
        cell.fill = { type: "pattern", pattern: "solid", fgColor: rowBg };
        cell.font = { size: 8 };
        cell.alignment = { vertical: "middle", wrapText: false };
        cell.border = {
          bottom: { style: "hair", color: { argb: "FFE2E8F0" } },
        };
      });

      // Action cell — coloured pill effect via font colour
      const actionCell = dataRow.getCell(2);
      actionCell.font = { bold: true, size: 8, color: section.fg };
      actionCell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: section.bg,
      };

      // # cell — right-align
      dataRow.getCell(1).alignment = {
        horizontal: "center",
        vertical: "middle",
      };
      dataRow.getCell(1).font = { size: 8, color: { argb: "FF94A3B8" } };

      // Covered count — center
      dataRow.getCell(7).alignment = {
        horizontal: "center",
        vertical: "middle",
      };
      dataRow.getCell(7).font = { bold: true, size: 8, color: section.fg };

      isAlt = !isAlt;
    }
  }

  // ── Download ──────────────────────────────────────────────────────────────
  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// ── Public export functions ───────────────────────────────────────────────────

export async function exportPublishCandidatesFromDrift(
  result: DriftResult,
): Promise<void> {
  const instructions = buildPublishInstructions(result);
  const env =
    result.mode === "master-web"
      ? "master-web"
      : `${result.sourceLabel}-to-${result.targetLabel}`.replace(/\s+/g, "-");

  await writeExcel(
    instructions,
    {
      title: "Sitecore Publish Candidate List",
      subtitle: `Source: ${result.sourceLabel}  →  Target: ${result.targetLabel}   |   Generated: ${new Date().toLocaleString()}`,
    },
    `publish-candidates.${env}.${today()}.xlsx`,
  );
}

export async function exportPublishCandidatesFromAnalysis(
  result: AnalysisResult,
  packageNames: string[],
): Promise<void> {
  const instructions = buildPublishInstructionsFromAnalysis(result);

  await writeExcel(
    instructions,
    {
      title: "Sitecore Publish Candidate List",
      subtitle: `Packages: ${packageNames.join(", ")}   |   Generated: ${new Date().toLocaleString()}`,
    },
    `publish-candidates.package.${today()}.xlsx`,
  );
}
