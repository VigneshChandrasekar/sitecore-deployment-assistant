---
name: sitecore-deployment-assistant
description: >
  Development guide for the Sitecore Deployment Assistant — a Next.js 16 App Router + TypeScript + Tailwind CSS v4
  pre-deployment toolkit for Sitecore CMS. Use this skill whenever you are working on this project: adding a new
  feature or page, extending risk analysis logic, adding an export format, touching the PowerShell snapshot script,
  debugging package parsing, or running/verifying the app. If the task involves any file under src/, scripts/, or
  public/ in this project, use this skill.
---

# Sitecore Deployment Assistant — Dev Guide

## What this app is

A **client-side-only** Next.js 16 (App Router) toolkit that helps Sitecore developers analyse deployment packages
before pushing to an environment. No backend, no API routes — all processing happens in the browser.

### Four main tools (routes)

| Route | What it does |
|---|---|
| `/package-inspector` | Upload & browse a Sitecore `.zip` — items, files, metadata, tree view |
| `/package-compare` | Diff two packages side-by-side |
| `/environment-sync` | Upload two snapshot JSONs (DEV/UAT/PROD) and detect drift |
| `/risk-analyzer` | Upload a package + snapshot → `analyzeDeployment()` → risk findings |

`/setup-instructions` guides users through running the PowerShell snapshot script inside Sitecore SPE.

---

## Architecture at a glance

```
src/
  app/              Next.js App Router pages (one folder per route)
  components/       React UI components ('use client' where needed)
  lib/              Pure TypeScript business logic (no React imports)
    types.ts        Core domain types
    analyzer.ts     Risk analysis — the heart of the app
    parser.ts       .zip → ParsedPackage
    snapshot.ts     SnapshotItem type + loader
    differ.ts       Package-to-package diff
    driftAnalyzer.ts  Snapshot-to-snapshot drift
    exporter.ts     Excel export (ExcelJS)
    pdfExporter.ts  PDF export for risk analysis (jsPDF + autotable)
    driftPdfExporter.ts  PDF export for environment sync
    publishCandidateExporter.ts
    tree.ts         Builds item tree for ItemTree component
scripts/
  Export-SitecoreSnapshot.ps1   Run inside Sitecore SPE to export snapshot JSON
public/
  Export-SitecoreSnapshot.ps1   Served to browser from /setup-instructions
  driftWorker.js                Web Worker — keeps drift analysis off the main thread
```

**Rule of thumb**: keep analysis logic in `src/lib/` (pure functions, no React), UI in `src/components/`.

---

## Key domain types (`src/lib/types.ts`)

```ts
DeployMode   = "Overwrite" | "Merge" | "Skip" | "Delete" | "Undefined"
ItemType     = "Template" | "Template Field" | "Rendering" | "Layout" | ... | "Unknown"
SitecoreItem — id, name, path, database, templateId, templateName, parentId, deployMode, fields[]
ParsedPackage — metadata, items: SitecoreItem[], files: PackageFile[], errors: string[]
```

---

## Risk analyzer (`src/lib/analyzer.ts`)

`analyzeDeployment(packageItems, snapshotItems)` is a pure function — it returns `AnalysisResult`.

**RiskLevel**: `critical` | `warning` | `info` | `ok`

**RiskCategory** and when each fires:

| Category | Level | Condition |
|---|---|---|
| `delete-risk` | critical | DeployMode=Delete AND item exists in snapshot |
| `parent-missing` | critical | New item AND parent not in snapshot or package |
| `template-missing` | warning | New item AND template not in snapshot or package |
| `overwrite-exists` | warning | DeployMode=Overwrite AND item already exists |
| `new-item` | info | Item not in snapshot, all dependencies present |
| `skip-exists` | info | DeployMode=Skip AND item exists |
| `safe` | ok/info | Everything else |

**Always use `normaliseId()`** (strips `{}`, lowercases) when comparing item IDs — raw IDs from packages and snapshots use inconsistent casing and braces.

### Adding a new risk category

1. Add the literal to `RiskCategory` in `analyzer.ts`
2. Add a label to `CATEGORY_LABELS`
3. Add a `0` entry to `categoryStats` initialisation
4. Add the detection logic in the `for (const item of packageItems)` loop using the `add()` helper
5. Update `src/lib/pdfExporter.ts` if the new category should appear in PDF reports

---

## Adding a new page / feature

1. Create `src/app/<route-name>/page.tsx` — Server Component by default; add `'use client'` only if needed
2. Add it to the `MAIN_TABS` array in `src/components/AppNav.tsx` (href, label, sub, icon from lucide-react)
3. Create a companion view component in `src/components/<Name>View.tsx` for the actual UI
4. Add any pure logic to a new file in `src/lib/`

**Before writing any Next.js code**, check `node_modules/next/dist/docs/` — this project uses Next.js 16 which has
breaking changes from earlier versions.

---

## Adding a new export format

Exports live in `src/lib/`. Follow the pattern of `exporter.ts` (Excel) or `pdfExporter.ts` (PDF):
- Accept `Finding[]` or `AnalysisResult` as input
- Return/trigger a file download using a Blob URL
- Wire the download button up in the relevant `*View.tsx` component

---

## PowerShell snapshot script (`scripts/Export-SitecoreSnapshot.ps1`)

Runs inside **Sitecore PowerShell Extensions (SPE)** — not a standalone script. Uses SPE-injected APIs:
- `[Sitecore.Configuration.Factory]::GetDatabase(...)` — get DB handle
- `$item.Axes.GetDescendants()` — traverse item tree
- `Out-Download -Name $fileName` — trigger browser download from SPE Script Runner

**Schema version** emitted: `"_schemaVersion": "1.0"` — if you change the output shape, bump this and update
`src/lib/snapshot.ts` to handle both versions.

After editing the script, copy the updated file to `public/Export-SitecoreSnapshot.ps1` so the
`/setup-instructions` page serves the latest version.

---

## Snapshot JSON shape (`SnapshotItem`)

```ts
{
  id, name, path, templateId, templateName, parentId,
  language, version, created, createdBy, updated, updatedBy, revision,
  fields: Record<string, string>
}
```

The top-level JSON has `_schemaVersion`, `_exportedAt`, `_environment`, `exportConfig`, `summary`, `items[]`, `errors[]`.

---

## Tech stack reminders

- **Tailwind CSS v4** — config is in `postcss.config.mjs`, no `tailwind.config.js`
- **lucide-react v1.17** — import named icons directly: `import { Shield } from 'lucide-react'`
- **jszip** — reading `.zip` packages in the browser
- **fast-xml-parser** — parsing Sitecore XML inside packages
- **ExcelJS** — Excel export (not SheetJS for writing)
- **jsPDF + jspdf-autotable** — PDF export
- **Web Worker** (`public/driftWorker.js`) — drift analysis runs off-thread; communicate via `postMessage`

---

## Running & verifying the app

```powershell
npm run dev      # http://localhost:3000 → redirects to /package-inspector
npm run build    # production build check
npm run lint     # ESLint
```

When verifying a UI change, test the golden path in the browser — type checking alone doesn't confirm feature
correctness. The app is entirely client-side so there's no server to restart; hot reload handles changes.

---

## Common pitfalls

- **ID comparison**: never compare raw IDs — always call `normaliseId()` first
- **'use client' placement**: must be the very first line of the file if needed
- **Web Worker path**: `public/driftWorker.js` is served at `/driftWorker.js` — reference it as an absolute path
- **No API routes**: all file processing (zip parsing, XML parsing, analysis) happens in the browser; don't add
  server-side logic unless there's a compelling reason
- **Snapshot script is SPE-only**: don't try to run `Export-SitecoreSnapshot.ps1` with plain PowerShell — it
  requires Sitecore assemblies loaded by SPE
