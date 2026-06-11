import Link from 'next/link'
import { ArrowLeft, Package, Upload, Search, TreePine, Terminal, Download, Shield, Layers, AlertTriangle, CheckCircle, Info, ChevronRight } from 'lucide-react'

export default function PackageInspectorGuide() {
  return (
    <div className="flex-1 overflow-y-auto bg-white">
      <div className="max-w-4xl mx-auto px-8 py-10">

        {/* Back link */}
        <Link
          href="/package-inspector"
          className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-700 transition-colors mb-8 group"
        >
          <ArrowLeft className="h-3.5 w-3.5 group-hover:-translate-x-0.5 transition-transform" />
          Back to Package Inspector
        </Link>

        {/* Hero */}
        <div className="mb-10">
          <div className="flex items-center gap-3 mb-3">
            <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-slate-900 border border-slate-700">
              <Package className="h-5 w-5 text-white" />
            </div>
            <div>
              <p className="text-[11px] font-bold uppercase tracking-widest text-slate-400">Developer Guide</p>
              <h1 className="text-2xl font-bold text-slate-900 leading-tight">Package Inspector</h1>
            </div>
          </div>
          <p className="text-slate-500 text-sm leading-relaxed max-w-2xl">
            A full breakdown of every item, file, and deploy instruction inside a Sitecore <code className="font-mono text-xs bg-slate-100 px-1.5 py-0.5 rounded">.zip</code> package —
            before it ever touches a server. This guide covers what it does, how it works, and how to get the most out of it.
          </p>
        </div>

        {/* TOC */}
        <nav className="mb-12 rounded-xl border border-slate-200 bg-slate-50 px-6 py-5">
          <p className="text-[11px] font-bold uppercase tracking-widest text-slate-400 mb-3">On this page</p>
          <ol className="space-y-1.5">
            {[
              ['#what-is-it',        'What is Package Inspector?'],
              ['#how-to-use',        'How to use it — step by step'],
              ['#sidebar',           'Understanding the sidebar'],
              ['#item-tree',         'Navigating the item tree'],
              ['#deploy-modes',      'Deploy modes explained'],
              ['#item-types',        'Item types'],
              ['#repackage',         'Re-package Script'],
              ['#excel-export',      'Excel export'],
              ['#tips',              'Tips & best practices'],
            ].map(([href, label], i) => (
              <li key={href} className="flex items-center gap-2">
                <span className="w-5 h-5 flex items-center justify-center rounded-full bg-slate-200 text-[10px] font-bold text-slate-500 shrink-0">{i + 1}</span>
                <a href={href} className="text-sm text-slate-600 hover:text-slate-900 hover:underline transition-colors">{label}</a>
              </li>
            ))}
          </ol>
        </nav>

        {/* ── Section 1 ─────────────────────────────────────────── */}
        <Section id="what-is-it" icon={<Info className="h-4 w-4" />} title="What is Package Inspector?">
          <p>
            Sitecore packages are <code>.zip</code> files that bundle Sitecore content items, templates, renderings, layouts,
            and physical files together for deployment. Before a package is installed on an environment, it is
            extremely difficult to know exactly what it will do without opening it manually and reading raw XML.
          </p>
          <p>
            <strong>Package Inspector</strong> automates that process entirely in the browser. It unpacks the ZIP,
            parses every item XML file, reads the package manifest, and presents everything as a structured,
            searchable, filterable tree — no server required, no Sitecore access needed.
          </p>
          <Callout color="blue" icon={<Info className="h-4 w-4" />}>
            Everything runs <strong>client-side</strong>. Your package file never leaves your machine.
            No data is sent to any server.
          </Callout>
        </Section>

        {/* ── Section 2 ─────────────────────────────────────────── */}
        <Section id="how-to-use" icon={<Upload className="h-4 w-4" />} title="How to use it — step by step">
          <Steps>
            <Step n={1} title="Open Package Inspector">
              Navigate to <strong>Package Inspector</strong> in the top navigation bar. You will see an empty state with an upload zone in the left sidebar.
            </Step>
            <Step n={2} title="Upload your .zip package">
              Either <strong>drag and drop</strong> your Sitecore <code>.zip</code> package onto the upload zone, or click
              the zone to open a file browser. Only <code>.zip</code> Sitecore packages are supported.
            </Step>
            <Step n={3} title="Wait for parsing">
              A spinner appears while the package is being parsed in the browser. Parsing typically takes under a second
              for packages with hundreds of items. Very large packages (1000+ items) may take a few seconds.
            </Step>
            <Step n={4} title="Review the sidebar summary">
              Once parsed, the left sidebar shows: package metadata (name, version, author), a summary grid (item count,
              file count, at-risk count, database count), deploy mode breakdown with progress bars, and item type breakdown.
            </Step>
            <Step n={5} title="Explore the item tree">
              The main panel shows a tree grouped by database (Master, Core, Web). Expand nodes, click items to see
              their full detail including all Sitecore fields, template info, and deploy mode.
            </Step>
            <Step n={6} title="Filter to find specific items">
              Use the search bar above the tree to filter by item name, Sitecore path, or item ID. The tree collapses
              to show only matching items.
            </Step>
            <Step n={7} title="Act on what you find">
              Use <strong>Re-package Script</strong> to generate a PowerShell script that re-creates this package from
              live Sitecore data. Use <strong>Export Excel</strong> to get a full spreadsheet of every item.
            </Step>
          </Steps>
        </Section>

        {/* ── Section 3 ─────────────────────────────────────────── */}
        <Section id="sidebar" icon={<Layers className="h-4 w-4" />} title="Understanding the sidebar">
          <p>The dark left sidebar is your at-a-glance summary of the entire package.</p>

          <SubSection title="Package metadata">
            Shows the package name, version, author, and publisher as declared in the package manifest
            (<code>package.zip/package/package.xml</code>). If a field is blank it was not set when the package was created.
          </SubSection>

          <SubSection title="Summary grid">
            <table className="w-full text-sm border border-slate-200 rounded-lg overflow-hidden mt-2">
              <thead className="bg-slate-50">
                <tr>
                  <th className="text-left px-3 py-2 text-xs font-semibold text-slate-600">Stat</th>
                  <th className="text-left px-3 py-2 text-xs font-semibold text-slate-600">What it counts</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {[
                  ['Items',     'Total Sitecore content items (each language version counted separately)'],
                  ['Files',     'Physical files bundled in the package (DLLs, configs, assets)'],
                  ['At Risk',   'Items with Delete or Overwrite deploy mode — require careful review'],
                  ['Databases', 'Number of distinct Sitecore databases (master, core, web)'],
                ].map(([stat, desc]) => (
                  <tr key={stat} className="hover:bg-slate-50">
                    <td className="px-3 py-2 text-xs font-semibold text-slate-700 w-24">{stat}</td>
                    <td className="px-3 py-2 text-xs text-slate-600">{desc}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </SubSection>

          <Callout color="amber" icon={<AlertTriangle className="h-4 w-4" />}>
            If <strong>At Risk</strong> is greater than zero, the sidebar shows an amber warning banner.
            Review those items in the tree before deploying.
          </Callout>

          <SubSection title="Deploy modes breakdown">
            Each deploy mode is listed with a count and a proportional bar showing what percentage of the
            package it represents. This lets you see at a glance if the package is mostly overwrites, deletes, etc.
          </SubSection>

          <SubSection title="Item types breakdown">
            Lists every Sitecore item type found in the package (Template, Rendering, Layout, Content, etc.)
            with a count per type. Useful for understanding the composition of a package before deployment.
          </SubSection>
        </Section>

        {/* ── Section 4 ─────────────────────────────────────────── */}
        <Section id="item-tree" icon={<TreePine className="h-4 w-4" />} title="Navigating the item tree">
          <p>
            The item tree in the main panel organises every Sitecore item in the package by <strong>database</strong>,
            then by <strong>path hierarchy</strong> — exactly as they appear in the Sitecore content tree.
          </p>
          <SubSection title="Expanding and collapsing">
            Click the chevron (<ChevronRight className="inline h-3.5 w-3.5 text-slate-500" />) next to any node to expand it.
            Each node shows the item name, its item type badge, and its deploy mode badge.
            Click the chevron again to collapse.
          </SubSection>
          <SubSection title="Selecting an item">
            Click on any item row to open its detail panel on the right side. The detail view shows:
            the full Sitecore path, item ID, template name and ID, parent ID, database, deploy mode,
            all Sitecore field values, and any parse warnings for that item.
          </SubSection>
          <SubSection title="Searching and filtering">
            Type in the <strong>Filter</strong> box above the tree to search across all items simultaneously.
            The filter matches against item <strong>name</strong>, <strong>path</strong>, and <strong>ID</strong>.
            The tree updates instantly as you type — no submit needed.
            Clear the filter with the × button to restore the full tree.
          </SubSection>
          <Callout color="blue" icon={<Info className="h-4 w-4" />}>
            Item IDs are normalised (braces stripped, lowercased) before matching, so you can paste a raw
            Sitecore ID in any format and it will still match.
          </Callout>
        </Section>

        {/* ── Section 5 ─────────────────────────────────────────── */}
        <Section id="deploy-modes" icon={<Shield className="h-4 w-4" />} title="Deploy modes explained">
          <p>
            Every Sitecore item in a package carries an <strong>ItemMode</strong> (also called deploy mode) that tells
            the Sitecore installer what to do when the item already exists in the target environment.
            Understanding these is the most important part of reviewing a package before deployment.
          </p>
          <div className="space-y-3 mt-4">
            {[
              { mode: 'Delete',    color: 'bg-red-50 border-red-200',     badge: 'bg-red-100 text-red-700',     risk: 'Critical',  desc: 'Deletes the item and all its children from the target environment. This is irreversible without a backup. Always verify this is intentional.' },
              { mode: 'Overwrite', color: 'bg-amber-50 border-amber-200', badge: 'bg-amber-100 text-amber-700', risk: 'High',      desc: 'Replaces the target item completely, overwriting all fields in all languages. Any changes made directly on the target after the last package export will be lost.' },
              { mode: 'Merge',     color: 'bg-blue-50 border-blue-200',   badge: 'bg-blue-100 text-blue-700',   risk: 'Low',       desc: 'Merges field values from the package into the existing item. Fields present in the package overwrite; fields not in the package are left untouched. Safest for partial updates.' },
              { mode: 'Skip',      color: 'bg-emerald-50 border-emerald-200', badge: 'bg-emerald-100 text-emerald-700', risk: 'None', desc: 'If the item already exists, it is skipped entirely. Only installs the item if it does not yet exist. Safest for initial setup items.' },
              { mode: 'Undefined', color: 'bg-slate-50 border-slate-200', badge: 'bg-slate-100 text-slate-600', risk: 'Unknown',   desc: 'The package XML did not specify a mode. Sitecore\'s default behaviour applies, which is usually Merge. Worth verifying if you see this on critical items.' },
            ].map(({ mode, color, badge, risk, desc }) => (
              <div key={mode} className={`rounded-lg border p-4 ${color}`}>
                <div className="flex items-center gap-2 mb-1.5">
                  <span className={`text-xs font-bold px-2 py-0.5 rounded uppercase tracking-wide ${badge}`}>{mode}</span>
                  <span className="text-[11px] text-slate-500 font-medium">Risk: {risk}</span>
                </div>
                <p className="text-xs text-slate-700 leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </Section>

        {/* ── Section 6 ─────────────────────────────────────────── */}
        <Section id="item-types" icon={<Layers className="h-4 w-4" />} title="Item types">
          <p>
            Package Inspector classifies each item into a <strong>type</strong> based on its Sitecore template.
            This helps you quickly understand what a package contains without reading raw paths.
          </p>
          <table className="w-full text-sm border border-slate-200 rounded-lg overflow-hidden mt-4">
            <thead className="bg-slate-50">
              <tr>
                <th className="text-left px-3 py-2 text-xs font-semibold text-slate-600">Type</th>
                <th className="text-left px-3 py-2 text-xs font-semibold text-slate-600">What it means</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {[
                ['Template',          'A Sitecore data template definition — defines the fields an item can have'],
                ['Template Field',    'An individual field inside a template'],
                ['Template Section',  'A section grouping fields within a template'],
                ['Rendering',         'A component definition (view rendering, controller rendering, etc.)'],
                ['Layout',            'A Sitecore layout — the outermost page template assigned to items'],
                ['Placeholder',       'A placeholder settings item that controls allowed renderings'],
                ['Media',             'A media library item (image, document, video, etc.)'],
                ['Setting',           'A Sitecore settings or configuration item'],
                ['Content',           'A regular content item (page, data source, folder, etc.)'],
                ['Unknown',           'Could not be matched to a known Sitecore template — check manually'],
              ].map(([type, desc]) => (
                <tr key={type} className="hover:bg-slate-50">
                  <td className="px-3 py-2 text-xs font-semibold text-slate-700 w-36 whitespace-nowrap">{type}</td>
                  <td className="px-3 py-2 text-xs text-slate-600">{desc}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Section>

        {/* ── Section 7 ─────────────────────────────────────────── */}
        <Section id="repackage" icon={<Terminal className="h-4 w-4" />} title="Re-package Script">
          <p>
            The <strong>Re-package Script</strong> feature generates a PowerShell script that, when run inside
            <strong> Sitecore PowerShell Extensions (SPE)</strong>, recreates the same package from live Sitecore data.
            This is useful when you need to refresh a package with the latest content without going back to the
            original developer or build system.
          </p>

          <SubSection title="When to use it">
            <ul className="list-disc list-inside space-y-1 text-xs text-slate-600 leading-relaxed">
              <li>A package was built weeks ago and content has since changed on a source environment</li>
              <li>You want to exclude certain items from the package before deploying</li>
              <li>You need to re-create a package from a different environment (e.g. UAT instead of DEV)</li>
              <li>The original package file is missing or corrupted</li>
            </ul>
          </SubSection>

          <SubSection title="Exact vs Expand Roots mode">
            <div className="grid grid-cols-2 gap-3 mt-2">
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                <p className="text-xs font-bold text-slate-700 mb-1">Exact</p>
                <p className="text-xs text-slate-600 leading-relaxed">
                  The script lists every item path individually — exactly the same set as the original package.
                  Use this when you want a precise replica with no additional items.
                </p>
              </div>
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                <p className="text-xs font-bold text-slate-700 mb-1">Expand Roots</p>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Root items are fetched with <code className="font-mono text-[10px]">Get-ChildItem -Recurse</code>.
                  This picks up any <em>new children</em> added under those roots since the original package was built.
                  Use this for "everything under this folder" scenarios.
                </p>
              </div>
            </div>
          </SubSection>

          <SubSection title="Excluding items">
            When you click <strong>Re-package Script</strong>, a modal opens listing all items grouped by type
            (Single Items, Root + Children, Media Library). Uncheck any item or root to exclude it from the
            generated script. Unchecking a root automatically unchecks all its children.
            The footer shows how many items are included so you can confirm before downloading.
          </SubSection>

          <SubSection title="Running the script">
            <Steps>
              <Step n={1} title="Download the .ps1 file">Click Download Script to save it to your machine.</Step>
              <Step n={2} title="Open Sitecore PowerShell Extensions">Log into the Sitecore environment you want to package from. Navigate to <strong>Desktop → PowerShell Toolbox → PowerShell ISE</strong> or the SPE Script Runner.</Step>
              <Step n={3} title="Paste and run">Open the <code>.ps1</code> file, paste its contents into SPE, and click Run. The script collects the items, builds the package, and triggers a browser download of the new <code>.zip</code>.</Step>
            </Steps>
          </SubSection>

          <Callout color="amber" icon={<AlertTriangle className="h-4 w-4" />}>
            The script requires <strong>Sitecore PowerShell Extensions</strong> to be installed on the target
            Sitecore instance. It will not run as a plain PowerShell script outside of SPE.
          </Callout>
        </Section>

        {/* ── Section 8 ─────────────────────────────────────────── */}
        <Section id="excel-export" icon={<Download className="h-4 w-4" />} title="Excel export">
          <p>
            Click <strong>Export Excel</strong> in the toolbar to download a <code>.xlsx</code> spreadsheet containing
            every item in the package. The spreadsheet includes one row per item with the following columns:
          </p>
          <table className="w-full text-sm border border-slate-200 rounded-lg overflow-hidden mt-4">
            <thead className="bg-slate-50">
              <tr>
                <th className="text-left px-3 py-2 text-xs font-semibold text-slate-600">Column</th>
                <th className="text-left px-3 py-2 text-xs font-semibold text-slate-600">Description</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {[
                ['Name',         'Item display name'],
                ['Path',         'Full Sitecore path'],
                ['ID',           'Item GUID'],
                ['Database',     'master, core, or web'],
                ['Template',     'Name of the template the item is based on'],
                ['Template ID',  'GUID of the template'],
                ['Deploy Mode',  'Delete / Overwrite / Merge / Skip / Undefined'],
                ['Item Type',    'Classified type (Template, Rendering, Content, etc.)'],
              ].map(([col, desc]) => (
                <tr key={col} className="hover:bg-slate-50">
                  <td className="px-3 py-2 text-xs font-semibold text-slate-700 w-32 whitespace-nowrap">{col}</td>
                  <td className="px-3 py-2 text-xs text-slate-600">{desc}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-3 text-xs text-slate-500">
            The exported file is named after the package (e.g. <code className="font-mono text-[11px] bg-slate-100 px-1.5 py-0.5 rounded">MyPackage-1.0.xlsx</code>)
            and can be shared with project managers or stored alongside deployment records.
          </p>
        </Section>

        {/* ── Section 9 ─────────────────────────────────────────── */}
        <Section id="tips" icon={<CheckCircle className="h-4 w-4" />} title="Tips & best practices">
          <div className="space-y-3">
            {[
              {
                title: 'Always check At Risk before deploying',
                body:  'If the At Risk count is greater than zero, open every Delete and Overwrite item in the tree and confirm the action is intentional. A single accidental Delete can remove an entire Sitecore subtree.',
              },
              {
                title: 'Cross-reference with Risk Analyzer',
                body:  'After inspecting the package, upload it to the Risk Analyzer tool along with a snapshot of your target environment. This catches missing parents, missing templates, and other cross-environment problems that the package alone cannot reveal.',
              },
              {
                title: 'Watch for Undefined deploy modes',
                body:  'If a significant portion of items show Undefined, the package was likely built without explicit ItemMode declarations. Check with your development team what the intended behaviour is — Sitecore defaults vary by version.',
              },
              {
                title: 'Use Re-package Script to refresh stale packages',
                body:  'If a package was built more than a few days ago and content is actively changing, use Re-package Script to get a fresh copy from the source environment before deploying to production.',
              },
              {
                title: 'Export Excel for deployment records',
                body:  'Export to Excel and store the spreadsheet alongside your deployment notes. It provides a full audit trail of exactly what was in the package at deployment time.',
              },
              {
                title: 'Filter by item type before reviewing',
                body:  'If you are mainly concerned about schema changes, filter or sort by Template and Template Field. If you are concerned about UI changes, focus on Rendering and Layout types first.',
              },
            ].map(({ title, body }) => (
              <div key={title} className="rounded-lg border border-slate-200 bg-white p-4 flex gap-3">
                <CheckCircle className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs font-semibold text-slate-800 mb-0.5">{title}</p>
                  <p className="text-xs text-slate-600 leading-relaxed">{body}</p>
                </div>
              </div>
            ))}
          </div>
        </Section>

        {/* Footer */}
        <div className="mt-12 pt-8 border-t border-slate-100 flex items-center justify-between">
          <p className="text-xs text-slate-400">Sitecore Deployment Assistant — Package Inspector Guide</p>
          <Link
            href="/package-inspector"
            className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-600 hover:text-slate-900 border border-slate-700 hover:border-slate-300 bg-slate-800 hover:bg-white text-white hover:text-slate-900 px-3 py-1.5 rounded-md transition-all hover:-translate-y-0.5 hover:shadow-md"
          >
            <Package className="h-3.5 w-3.5" />
            Open Package Inspector
          </Link>
        </div>

      </div>
    </div>
  )
}

// ── Sub-components ────────────────────────────────────────────────────────────

function Section({ id, icon, title, children }: {
  id: string
  icon: React.ReactNode
  title: string
  children: React.ReactNode
}) {
  return (
    <section id={id} className="mb-12 scroll-mt-6">
      <div className="flex items-center gap-2.5 mb-4">
        <span className="flex items-center justify-center w-7 h-7 rounded-lg bg-slate-100 text-slate-600">{icon}</span>
        <h2 className="text-lg font-bold text-slate-900">{title}</h2>
      </div>
      <div className="space-y-3 text-sm text-slate-600 leading-relaxed">
        {children}
      </div>
    </section>
  )
}

function SubSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mt-4">
      <h3 className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-2">{title}</h3>
      <div className="text-sm text-slate-600 leading-relaxed space-y-2">{children}</div>
    </div>
  )
}

function Callout({ color, icon, children }: {
  color: 'blue' | 'amber' | 'red'
  icon: React.ReactNode
  children: React.ReactNode
}) {
  const styles = {
    blue:  'bg-blue-50 border-blue-200 text-blue-800',
    amber: 'bg-amber-50 border-amber-200 text-amber-800',
    red:   'bg-red-50 border-red-200 text-red-800',
  }[color]
  return (
    <div className={`flex gap-3 rounded-lg border px-4 py-3 text-xs leading-relaxed mt-3 ${styles}`}>
      <span className="shrink-0 mt-0.5">{icon}</span>
      <span>{children}</span>
    </div>
  )
}

function Steps({ children }: { children: React.ReactNode }) {
  return <ol className="space-y-3 mt-2">{children}</ol>
}

function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <li className="flex gap-3">
      <span className="flex items-center justify-center w-6 h-6 rounded-full bg-slate-900 text-white text-[11px] font-bold shrink-0 mt-0.5">{n}</span>
      <div>
        <p className="text-xs font-semibold text-slate-800 mb-0.5">{title}</p>
        <p className="text-xs text-slate-600 leading-relaxed">{children}</p>
      </div>
    </li>
  )
}
