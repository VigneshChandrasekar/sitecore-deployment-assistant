@AGENTS.md

# Sitecore Deployment Assistant

A Next.js 16 (App Router) pre-deployment toolkit for Sitecore CMS. It helps developers analyse `.zip` Sitecore packages before deploying, catch risks, compare packages, and detect environment drift.

## What the app does

Four main tools, each a route under `src/app/`:

| Route | Purpose |
|---|---|
| `/package-inspector` | Upload & browse a Sitecore `.zip` package — items, files, metadata, tree view |
| `/package-compare` | Diff two packages side-by-side to see what changed |
| `/environment-sync` | Upload two snapshots (e.g. DEV vs UAT) and detect drift between environments |
| `/risk-analyzer` | Upload a package + a snapshot JSON → runs `analyzeDeployment()` → shows risk findings |

`/setup-instructions` guides users through running the PowerShell snapshot script.

## Key files

| File | Role |
|---|---|
| `src/lib/types.ts` | Core domain types: `SitecoreItem`, `ParsedPackage`, `DeployMode`, `ItemType` |
| `src/lib/analyzer.ts` | Pure analysis logic — cross-references package items against snapshot, emits `Finding[]` with `RiskLevel` and `RiskCategory` |
| `src/lib/parser.ts` | Parses a Sitecore `.zip` package into `ParsedPackage` |
| `src/lib/snapshot.ts` | Types and loader for snapshot JSON (`SnapshotItem`) |
| `src/lib/differ.ts` | Package-to-package diff logic |
| `src/lib/driftAnalyzer.ts` | Snapshot-to-snapshot drift detection |
| `src/lib/exporter.ts` | Excel export (ExcelJS) |
| `src/lib/pdfExporter.ts` | PDF export (jsPDF + autotable) for risk analysis |
| `src/lib/driftPdfExporter.ts` | PDF export for drift/environment sync |
| `src/lib/publishCandidateExporter.ts` | Export publish candidates |
| `src/lib/tree.ts` | Builds item tree for `ItemTree` component |
| `scripts/Export-SitecoreSnapshot.ps1` | Run inside Sitecore PowerShell Extensions (SPE) to export a snapshot JSON from a live Sitecore instance |
| `public/Export-SitecoreSnapshot.ps1` | Copy served to the browser from `/setup-instructions` |
| `public/driftWorker.js` | Web Worker for drift analysis (keeps UI unblocked) |

## Risk levels and categories

Defined in `src/lib/analyzer.ts`:

- **RiskLevel**: `critical` | `warning` | `info` | `ok`
- **RiskCategory**: `parent-missing` | `template-missing` | `delete-risk` | `overwrite-exists` | `skip-exists` | `new-item` | `safe`

## Tech stack

- **Next.js 16** App Router — read `node_modules/next/dist/docs/` before writing any Next.js code
- **React 19**, **TypeScript 5**, **Tailwind CSS v4**
- **lucide-react** for icons
- **jszip** — reading `.zip` packages in the browser
- **fast-xml-parser** — parsing Sitecore XML inside packages
- **ExcelJS** — Excel export
- **jsPDF + jspdf-autotable** — PDF export

## Conventions

- All pages are React Server Components unless they need interactivity (`'use client'`)
- Components live in `src/components/`, lib utilities in `src/lib/`
- Keep analysis logic in `src/lib/` (pure functions, no React). Keep UI in `src/components/`
- Package parsing and analysis run entirely client-side (no backend / API routes)
- The snapshot JSON schema version is `"1.0"` (field `_schemaVersion`)
- Item IDs are normalised (strip `{}`, lowercase) before comparison — always use `normaliseId()` from `analyzer.ts` when comparing IDs

## Running locally

```powershell
npm run dev   # http://localhost:3000  → redirects to /package-inspector
npm run build
npm run lint
```
