import type { AnalysisResult, RiskCategory, RiskLevel } from "./analyzer";
import { CATEGORY_LABELS } from "./analyzer";
import type { ParsedSnapshot } from "./snapshot";

// Dynamically imported to avoid SSR issues
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type JsPDF = any;

const LEVEL_COLORS: Record<RiskLevel, [number, number, number]> = {
  critical: [220, 38, 38], // red-600
  warning: [217, 119, 6], // amber-600
  info: [37, 99, 235], // blue-600
  ok: [5, 150, 105], // emerald-600
};

const LEVEL_BG: Record<RiskLevel, [number, number, number]> = {
  critical: [254, 226, 226], // red-100
  warning: [254, 243, 199], // amber-100
  info: [219, 234, 254], // blue-100
  ok: [209, 250, 229], // emerald-100
};

const SLATE_900: [number, number, number] = [15, 23, 42];
const SLATE_700: [number, number, number] = [51, 65, 85];
const SLATE_500: [number, number, number] = [100, 116, 139];
const SLATE_200: [number, number, number] = [226, 232, 240];
const WHITE: [number, number, number] = [255, 255, 255];

function levelLabel(level: RiskLevel): string {
  return { critical: "Critical", warning: "Warning", info: "Info", ok: "OK" }[
    level
  ];
}

export async function exportAnalysisPdf(
  result: AnalysisResult,
  snapshot: ParsedSnapshot | null,
  packageNames: string[],
): Promise<void> {
  const { default: JsPDFClass } = await import("jspdf");
  const { default: autoTable } = await import("jspdf-autotable");

  const doc: JsPDF = new JsPDFClass({
    orientation: "landscape",
    unit: "mm",
    format: "a4",
  });
  const W = doc.internal.pageSize.getWidth(); // 297
  const margin = 14;

  // ── Helper: set fill + text color ────────────────────────────────────────────
  function setFill(rgb: [number, number, number]) {
    doc.setFillColor(...rgb);
  }
  function setTextColor(rgb: [number, number, number]) {
    doc.setTextColor(...rgb);
  }
  function setDrawColor(rgb: [number, number, number]) {
    doc.setDrawColor(...rgb);
  }

  // ── PAGE 1: Cover / Summary ──────────────────────────────────────────────────

  // Header bar
  setFill(SLATE_900);
  doc.rect(0, 0, W, 22, "F");
  setTextColor(WHITE);
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.text("Risk Analysis Report", margin, 14);

  // Export date top-right
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.text(`Generated: ${new Date().toLocaleString()}`, W - margin, 14, {
    align: "right",
  });

  // Meta row
  let y = 30;
  setTextColor(SLATE_700);
  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");

  const env = snapshot?.meta.environment ?? "—";
  const snapDate = snapshot?.meta.exportedAt
    ? new Date(snapshot.meta.exportedAt).toLocaleString()
    : "—";
  const pkgList = packageNames.join(", ") || "—";

  doc.text("Environment:", margin, y);
  doc.setFont("helvetica", "normal");
  doc.text(env, margin + 28, y);

  doc.setFont("helvetica", "bold");
  doc.text("Snapshot:", margin + 70, y);
  doc.setFont("helvetica", "normal");
  doc.text(snapDate, margin + 90, y);

  y += 6;
  doc.setFont("helvetica", "bold");
  doc.text("Packages:", margin, y);
  doc.setFont("helvetica", "normal");
  doc.text(doc.splitTextToSize(pkgList, W - margin * 2 - 28), margin + 28, y);

  // ── Category breakdown table ──────────────────────────────────────────────────
  y += 14;
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  setTextColor(SLATE_700);
  doc.text("Findings by Category", margin, y);
  y += 4;

  const categories = Object.keys(CATEGORY_LABELS) as RiskCategory[];
  const catRows = categories
    .filter((c) => result.categoryStats[c] > 0)
    .map((c) => [CATEGORY_LABELS[c], String(result.categoryStats[c])]);

  autoTable(doc, {
    startY: y,
    margin: { left: margin, right: margin },
    head: [["Category", "Count"]],
    body: catRows,
    styles: { fontSize: 8, cellPadding: 3, font: "helvetica" },
    headStyles: { fillColor: SLATE_900, textColor: WHITE, fontStyle: "bold" },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    columnStyles: {
      0: { cellWidth: 80 },
      1: { cellWidth: 20, halign: "center" },
    },
    tableWidth: 104,
  });

  // ── Summary note ──────────────────────────────────────────────────────────────
  const afterCat = (doc as any).lastAutoTable.finalY + 8;
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  setTextColor(SLATE_500);
  doc.text(
    `${result.totalPackageItems} package items analysed against ${result.totalSnapshotItems} snapshot items.  Total findings: ${result.findings.length}.`,
    margin,
    afterCat,
  );

  // ── PAGE 2+: Findings table ───────────────────────────────────────────────────
  doc.addPage();

  // Page header
  setFill(SLATE_900);
  doc.rect(0, 0, W, 16, "F");
  setTextColor(WHITE);
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.text("Findings Detail", margin, 11);

  const rows = result.findings.map((f, idx) => [
    String(idx + 1),
    levelLabel(f.level),
    f.category === "parent-missing"
      ? "Parent Missing"
      : f.category === "template-missing"
        ? "Template Missing"
        : f.category === "delete-risk"
          ? "Delete Risk"
          : f.category === "overwrite-exists"
            ? "Overwrite"
            : f.category === "skip-exists"
              ? "Skip"
              : f.category === "new-item"
                ? "New Item"
                : "Safe",
    f.packageItem.name,
    f.packageItem.path,
    f.packageItem.deployMode,
    f.message,
    f.packageName,
  ]);

  autoTable(doc, {
    startY: 22,
    margin: { left: margin, right: margin },
    head: [
      ["#", "Level", "Type", "Item Name", "Path", "Mode", "Message", "Package"],
    ],
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
    alternateRowStyles: { fillColor: [248, 250, 252] },
    columnStyles: {
      0: { cellWidth: 8, halign: "center" },
      1: { cellWidth: 18 },
      2: { cellWidth: 28 },
      3: { cellWidth: 30 },
      4: { cellWidth: 70 },
      5: { cellWidth: 22 },
      6: { cellWidth: 55 },
      7: { cellWidth: 40 },
    },
    // Color the Level cell per risk level
    didParseCell(data) {
      if (data.section === "body" && data.column.index === 1) {
        const level = result.findings[data.row.index]?.level;
        if (level) {
          data.cell.styles.fillColor = LEVEL_BG[level];
          data.cell.styles.textColor = LEVEL_COLORS[level];
          data.cell.styles.fontStyle = "bold";
        }
      }
    },
    // Page number footer
    didDrawPage(data) {
      const pageCount = doc.internal.getNumberOfPages();
      doc.setFontSize(7);
      setTextColor(SLATE_500);
      doc.setFont("helvetica", "normal");
      doc.text(
        `Page ${data.pageNumber} of ${pageCount}  •  Sitecore Deployment Assistant`,
        W / 2,
        doc.internal.pageSize.getHeight() - 6,
        { align: "center" },
      );
    },
  });

  // Save
  const env2 = snapshot?.meta.environment ?? "report";
  const date = new Date().toISOString().slice(0, 10);
  doc.save(`sitecore-risk-analysis.${env2}.${date}.pdf`);
}
