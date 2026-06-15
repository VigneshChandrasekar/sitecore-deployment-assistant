import type { SitecoreItem } from "./types";
import { buildPublishInstructionsFromItems } from "./publishCandidateExporter";

export type { PublishInstruction } from "./publishCandidateExporter";

// ── Path category detection ───────────────────────────────────────────────────

type PathCategory =
  | "FOUNDATION TEMPLATES"
  | "FEATURE TEMPLATES"
  | "PROJECT TEMPLATES"
  | "RENDERINGS"
  | "SYSTEM"
  | "GLOBAL CONTENT"
  | "SITE COMPONENTS"
  | "SETTINGS"
  | "PAGES"
  | "OTHERS";

const CATEGORY_ORDER: PathCategory[] = [
  "FOUNDATION TEMPLATES",
  "FEATURE TEMPLATES",
  "PROJECT TEMPLATES",
  "RENDERINGS",
  "SYSTEM",
  "GLOBAL CONTENT",
  "SITE COMPONENTS",
  "SETTINGS",
  "PAGES",
  "OTHERS",
];

function getCategory(path: string): PathCategory {
  const p = path.toLowerCase();

  if (p.startsWith("/sitecore/templates/")) {
    if (p.includes("/foundation/")) return "FOUNDATION TEMPLATES";
    if (p.includes("/feature/")) return "FEATURE TEMPLATES";
    if (p.includes("/project/")) return "PROJECT TEMPLATES";
    return "OTHERS";
  }

  // Branches — same grouping as templates
  if (p.startsWith("/sitecore/branches/")) {
    if (p.includes("/foundation/")) return "FOUNDATION TEMPLATES";
    if (p.includes("/feature/")) return "FEATURE TEMPLATES";
    if (p.includes("/project/")) return "PROJECT TEMPLATES";
    return "OTHERS";
  }

  if (p.startsWith("/sitecore/layout/")) return "RENDERINGS";

  if (p.startsWith("/sitecore/system/")) return "SYSTEM";

  if (p.startsWith("/sitecore/content/")) {
    if (p.includes("/globalcontent/") || p.includes("/global content/"))
      return "GLOBAL CONTENT";
    if (p.includes("/site components/")) return "SITE COMPONENTS";
    if (p.includes("/settings/")) return "SETTINGS";
    if (p.includes("/home/")) return "PAGES";
    return "GLOBAL CONTENT"; // other content defaults to global content bucket
  }

  return "OTHERS";
}

// ── Script generation ─────────────────────────────────────────────────────────

export function generatePublishScript(
  items: SitecoreItem[],
  packageNames: string[],
  languages: string[] = ["en"],
): string {
  const instructions = buildPublishInstructionsFromItems(items);
  const today = new Date().toISOString().slice(0, 10);

  const withSubitems = [
    ...new Set(
      instructions.filter((i) => i.action === "subitems").map((i) => i.path),
    ),
  ];

  const singleItems = [
    ...new Set(
      instructions
        .filter(
          (i) => i.action === "single-new" || i.action === "single-modified",
        )
        .map((i) => i.path),
    ),
  ];

  // Group paths by category
  function groupByCategory(paths: string[]): Map<PathCategory, string[]> {
    const map = new Map<PathCategory, string[]>();
    for (const cat of CATEGORY_ORDER) map.set(cat, []);
    for (const path of paths) {
      map.get(getCategory(path))!.push(path);
    }
    return map;
  }

  const subGroups = groupByCategory(withSubitems);
  const singleGroups = groupByCategory(singleItems);

  const langStr = languages.map((l) => `"${l}"`).join(", ");
  const orderComment =
    "Foundation → Feature → Project → Renderings →\n#         Global Content → Site Components → Settings →\n#         Pages → Others";

  const L: string[] = [];

  // ── Header ────────────────────────────────────────────────────────────────
  L.push("# ============================================================");
  L.push("# Sitecore Bulk Publishing Script");
  L.push("# Target: web | Languages: " + languages.join(", "));
  L.push("# ============================================================");
  L.push("");
  L.push('$publishTarget = "web"');
  L.push("$languages     = @(" + langStr + ")");
  L.push("");

  // ── $publishWithSubitems array ────────────────────────────────────────────
  L.push("# ============================================================");
  L.push("# Items to PUBLISH WITH SUBITEMS");
  L.push("# ============================================================");
  L.push("$publishWithSubitems = @(");
  L.push("");

  for (const cat of CATEGORY_ORDER) {
    const paths = subGroups.get(cat)!;
    if (paths.length === 0) continue;
    L.push("    # ----------------------------------------------------------");
    L.push("    # " + cat);
    L.push("    # ----------------------------------------------------------");
    for (const path of paths) {
      // Escape backtick-dollar for PowerShell ($name in branch paths)
      const escaped = path.replace(/\$(?=[a-zA-Z])/g, "`$");
      L.push('    "' + escaped + '",');
    }
    L.push("");
  }

  // Remove trailing comma from last path
  for (let i = L.length - 1; i >= 0; i--) {
    if (L[i].trimEnd().endsWith('",')) {
      L[i] = L[i].replace(/",\s*$/, '"');
      break;
    }
  }

  if (withSubitems.length === 0) {
    L.push("    # (none)");
    L.push("");
  }

  L.push(")");
  L.push("");

  // ── $publishSingleItem array ──────────────────────────────────────────────
  L.push("# ============================================================");
  L.push("# Items to PUBLISH AS SINGLE ITEM (no subitems)");
  L.push("# ============================================================");
  L.push("$publishSingleItem = @(");

  if (singleItems.length === 0) {
    L.push(
      "    # (empty — all items consolidated into publishWithSubitems above)",
    );
  } else {
    L.push("");
    for (const cat of CATEGORY_ORDER) {
      const paths = singleGroups.get(cat)!;
      if (paths.length === 0) continue;
      L.push(
        "    # ----------------------------------------------------------",
      );
      L.push("    # " + cat);
      L.push(
        "    # ----------------------------------------------------------",
      );
      for (const path of paths) {
        const escaped = path.replace(/\$(?=[a-zA-Z])/g, "`$");
        L.push('    "' + escaped + '",');
      }
      L.push("");
    }
    // Remove trailing comma
    for (let i = L.length - 1; i >= 0; i--) {
      if (L[i].trimEnd().endsWith('",')) {
        L[i] = L[i].replace(/",\s*$/, '"');
        break;
      }
    }
  }

  L.push(")");
  L.push("");

  // ── Helper function ────────────────────────────────────────────────────────
  L.push("# ============================================================");
  L.push("# Helper: publish one item in every configured language");
  L.push("# ============================================================");
  L.push("function Publish-ForAllLanguages {");
  L.push("    param(");
  L.push("        [Sitecore.Data.Items.Item]$Item,");
  L.push("        [string]$Target,");
  L.push("        [bool]$WithSubitems");
  L.push("    )");
  L.push("    foreach ($lang in $languages) {");
  L.push(
    '        $langItem = Get-Item -Path "master:$($Item.Paths.FullPath)" -Language $lang -ErrorAction SilentlyContinue',
  );
  L.push("        if (-not $langItem) {");
  L.push(
    '            Write-Host "  ⚠️  Not found in [$lang]: $($Item.Paths.FullPath)" -ForegroundColor DarkGray',
  );
  L.push("            continue");
  L.push("        }");
  L.push("        if ($WithSubitems) {");
  L.push(
    "            Publish-Item -Item $langItem -Target $Target -PublishMode Smart -Language $lang -Recurse",
  );
  L.push("        } else {");
  L.push(
    "            Publish-Item -Item $langItem -Target $Target -PublishMode Smart -Language $lang",
  );
  L.push("        }");
  L.push(
    "        Write-Host \"  ✅ Published [$lang]$(if ($WithSubitems){' +subitems'}): $($Item.Paths.FullPath)\" -ForegroundColor Green",
  );
  L.push("    }");
  L.push("}");
  L.push("");

  // ── Section 1 ─────────────────────────────────────────────────────────────
  L.push("# ============================================================");
  L.push(
    "# SECTION 1 — Publish with Subitems ($($publishWithSubitems.Count) paths)",
  );
  L.push("# ============================================================");
  L.push('Write-Host ""');
  L.push(
    'Write-Host "=============================================" -ForegroundColor Cyan',
  );
  L.push(
    'Write-Host "📦 SECTION 1: Publish with Subitems ($($publishWithSubitems.Count) paths)" -ForegroundColor Cyan',
  );
  L.push('Write-Host "============================================="');
  L.push("");
  L.push("$subSucc = 0; $subFail = 0");
  L.push("");
  L.push("foreach ($path in $publishWithSubitems) {");
  L.push(
    '    $item = Get-Item -Path "master:$path" -Language "en" -ErrorAction SilentlyContinue',
  );
  L.push("    if (-not $item) {");
  L.push('        Write-Warning "❌ Not found: $path"');
  L.push("        $subFail++");
  L.push("        continue");
  L.push("    }");
  L.push("    try {");
  L.push(
    "        Publish-ForAllLanguages -Item $item -Target $publishTarget -WithSubitems $true",
  );
  L.push("        $subSucc++");
  L.push("    } catch {");
  L.push("        Write-Warning \"❌ Error publishing '$path': $_\"");
  L.push("        $subFail++");
  L.push("    }");
  L.push("}");
  L.push("");

  // ── Section 2 ─────────────────────────────────────────────────────────────
  L.push("# ============================================================");
  L.push(
    "# SECTION 2 — Single Item Publish ($($publishSingleItem.Count) paths)",
  );
  L.push("# ============================================================");
  L.push('Write-Host ""');
  L.push(
    'Write-Host "=============================================" -ForegroundColor Cyan',
  );
  L.push(
    'Write-Host "📄 SECTION 2: Single Item Publish ($($publishSingleItem.Count) paths)" -ForegroundColor Cyan',
  );
  L.push('Write-Host "============================================="');
  L.push("");
  L.push("$singleSucc = 0; $singleFail = 0");
  L.push("");
  L.push("foreach ($path in $publishSingleItem) {");
  L.push(
    '    $item = Get-Item -Path "master:$path" -Language "en" -ErrorAction SilentlyContinue',
  );
  L.push("    if (-not $item) {");
  L.push('        Write-Warning "❌ Not found: $path"');
  L.push("        $singleFail++");
  L.push("        continue");
  L.push("    }");
  L.push("    try {");
  L.push(
    "        Publish-ForAllLanguages -Item $item -Target $publishTarget -WithSubitems $false",
  );
  L.push("        $singleSucc++");
  L.push("    } catch {");
  L.push("        Write-Warning \"❌ Error publishing '$path': $_\"");
  L.push("        $singleFail++");
  L.push("    }");
  L.push("}");
  L.push("");

  // ── Summary ───────────────────────────────────────────────────────────────
  L.push("# ============================================================");
  L.push("# SUMMARY");
  L.push("# ============================================================");
  L.push('Write-Host ""');
  L.push(
    'Write-Host "=============================================" -ForegroundColor Magenta',
  );
  L.push('Write-Host "📊 FINAL SUMMARY" -ForegroundColor Magenta');
  L.push('Write-Host "============================================="');
  L.push(
    'Write-Host "  Publish with Subitems  — ✅ $subSucc succeeded  ❌ $subFail failed" -ForegroundColor $(if ($subFail   -gt 0){"Yellow"}else{"Green"})',
  );
  L.push(
    'Write-Host "  Single Item Publish    — ✅ $singleSucc succeeded  ❌ $singleFail failed" -ForegroundColor $(if ($singleFail -gt 0){"Yellow"}else{"Green"})',
  );
  L.push(
    'Write-Host "  Total items attempted  — $($publishWithSubitems.Count + $publishSingleItem.Count)"',
  );
  L.push('Write-Host "============================================="');
  L.push('Write-Host "✅ Publishing complete." -ForegroundColor Green');
  L.push("");

  return L.join("\n");
}

export function downloadPublishScript(
  items: SitecoreItem[],
  packageNames: string[],
  languages: string[] = ["en"],
): void {
  const script = generatePublishScript(items, packageNames, languages);
  const ts = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const filename = `Publish-Script-${ts}.ps1`;

  const blob = new Blob([script], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
