'use client'

import { X, Package, Upload, Search, TreePine, Terminal, Download, Shield, Layers, AlertTriangle, CheckCircle, Info, ChevronRight } from 'lucide-react'

interface Props {
  onClose: () => void
}

export default function GuideModal({ onClose }: Props) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="relative w-[720px] max-h-[85vh] flex flex-col rounded-xl bg-white shadow-2xl border border-slate-200">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 shrink-0">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-slate-100 border border-slate-200">
              <Package className="h-4 w-4 text-slate-600" />
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Developer Guide</p>
              <p className="text-sm font-semibold text-slate-900">Package Inspector</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-md hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto px-8 py-6 space-y-10 text-sm text-slate-600 leading-relaxed">

          <Section id="what-is-it" icon={<Info className="h-4 w-4" />} title="What is Package Inspector?">
            <p>
              Sitecore packages are <code>.zip</code> files that bundle Sitecore content items, templates, renderings, layouts,
              and physical files together for deployment. Package Inspector automates unpacking in the browser — parsing every
              item XML file, reading the package manifest, and presenting everything as a structured, searchable tree.
            </p>
            <Callout color="blue" icon={<Info className="h-4 w-4" />}>
              Everything runs <strong>client-side</strong>. Your package file never leaves your machine.
            </Callout>
          </Section>

          <Section id="how-to-use" icon={<Upload className="h-4 w-4" />} title="How to use it">
            <Steps>
              <Step n={1} title="Upload your .zip package">Drag and drop or click the upload zone in the left sidebar.</Step>
              <Step n={2} title="Review the sidebar summary">Package metadata, item/file counts, deploy mode breakdown, and item type breakdown.</Step>
              <Step n={3} title="Explore the item tree">Tree grouped by database. Expand nodes and click items to see full field details.</Step>
              <Step n={4} title="Filter to find specific items">Search by name, path, or ID — tree updates instantly.</Step>
              <Step n={5} title="Act">Use <strong>Retake Package</strong> to generate a re-package PowerShell script, or <strong>Export</strong> for a full Excel spreadsheet.</Step>
            </Steps>
          </Section>

          <Section id="deploy-modes" icon={<Shield className="h-4 w-4" />} title="Deploy modes explained">
            <div className="space-y-3">
              {[
                { mode: 'Delete',    color: 'bg-red-50 border-red-200',         badge: 'bg-red-100 text-red-700',         risk: 'Critical', desc: 'Deletes the item and all its children. Irreversible without a backup.' },
                { mode: 'Overwrite', color: 'bg-amber-50 border-amber-200',     badge: 'bg-amber-100 text-amber-700',     risk: 'High',     desc: 'Replaces the target item completely — all fields overwritten in all languages.' },
                { mode: 'Merge',     color: 'bg-blue-50 border-blue-200',       badge: 'bg-blue-100 text-blue-700',       risk: 'Low',      desc: 'Merges fields from the package. Fields not in the package are left untouched.' },
                { mode: 'Skip',      color: 'bg-emerald-50 border-emerald-200', badge: 'bg-emerald-100 text-emerald-700', risk: 'None',     desc: 'Skipped if the item already exists. Only installs new items.' },
                { mode: 'Undefined', color: 'bg-slate-50 border-slate-200',     badge: 'bg-slate-100 text-slate-600',     risk: 'Unknown',  desc: "No mode specified. Sitecore's default behaviour applies (usually Merge)." },
              ].map(({ mode, color, badge, risk, desc }) => (
                <div key={mode} className={`rounded-lg border p-3 ${color}`}>
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`text-xs font-bold px-2 py-0.5 rounded uppercase tracking-wide ${badge}`}>{mode}</span>
                    <span className="text-[11px] text-slate-500">Risk: {risk}</span>
                  </div>
                  <p className="text-xs text-slate-700 leading-relaxed">{desc}</p>
                </div>
              ))}
            </div>
          </Section>

          <Section id="repackage" icon={<Terminal className="h-4 w-4" />} title="Retake Package">
            <p>
              Generates a PowerShell script that, when run inside <strong>Sitecore PowerShell Extensions (SPE)</strong>,
              recreates the same package from live Sitecore data. Choose between <strong>Exact</strong> (same item set)
              or <strong>Expand Roots</strong> (picks up new children added since the original build).
            </p>
            <Callout color="amber" icon={<AlertTriangle className="h-4 w-4" />}>
              Requires <strong>Sitecore PowerShell Extensions</strong> installed on the target instance.
            </Callout>
          </Section>

          <Section id="excel-export" icon={<Download className="h-4 w-4" />} title="Export">
            <p>
              Downloads a <code>.xlsx</code> spreadsheet with one row per item — Name, Path, ID, Database, Template,
              Template ID, Deploy Mode, and Item Type. Useful for deployment records and sign-off.
            </p>
          </Section>

          <Section id="tips" icon={<CheckCircle className="h-4 w-4" />} title="Tips & best practices">
            <div className="space-y-2">
              {[
                { title: 'Always check At Risk before deploying', body: 'Review every Delete and Overwrite item in the tree. A single accidental Delete can remove an entire Sitecore subtree.' },
                { title: 'Cross-reference with Risk Analyzer',   body: 'Upload the package + a target environment snapshot to the Risk Analyzer to catch missing parents and template gaps.' },
                { title: 'Use Retake Package for stale packages', body: 'If content has changed since the package was built, use Retake Package to get a fresh copy from the source environment.' },
                { title: 'Export for deployment records',        body: 'Store the Excel export alongside your deployment notes for a full audit trail of what was deployed.' },
              ].map(({ title, body }) => (
                <div key={title} className="rounded-lg border border-slate-200 bg-white p-3 flex gap-3">
                  <CheckCircle className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-xs font-semibold text-slate-800 mb-0.5">{title}</p>
                    <p className="text-xs text-slate-600 leading-relaxed">{body}</p>
                  </div>
                </div>
              ))}
            </div>
          </Section>

        </div>

        {/* Footer */}
        <div className="shrink-0 px-6 py-3 border-t border-slate-200 bg-slate-50 rounded-b-xl flex items-center justify-between">
          <p className="text-[11px] text-slate-400">Sitecore Deployment Assistant — Package Inspector Guide</p>
          <button
            onClick={onClose}
            className="px-3 py-1.5 rounded-md text-xs font-medium border bg-white text-slate-700 border-slate-300 hover:bg-slate-900 hover:text-white hover:border-slate-900 transition-colors"
          >
            Close
          </button>
        </div>

      </div>
    </div>
  )
}

function Section({ id, icon, title, children }: { id: string; icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <section id={id}>
      <div className="flex items-center gap-2.5 mb-3">
        <span className="flex items-center justify-center w-7 h-7 rounded-lg bg-slate-100 text-slate-600">{icon}</span>
        <h2 className="text-base font-bold text-slate-900">{title}</h2>
      </div>
      <div className="space-y-3">{children}</div>
    </section>
  )
}

function Callout({ color, icon, children }: { color: 'blue' | 'amber'; icon: React.ReactNode; children: React.ReactNode }) {
  const styles = { blue: 'bg-blue-50 border-blue-200 text-blue-800', amber: 'bg-amber-50 border-amber-200 text-amber-800' }[color]
  return (
    <div className={`flex gap-3 rounded-lg border px-4 py-3 text-xs leading-relaxed mt-2 ${styles}`}>
      <span className="shrink-0 mt-0.5">{icon}</span>
      <span>{children}</span>
    </div>
  )
}

function Steps({ children }: { children: React.ReactNode }) {
  return <ol className="space-y-2 mt-1">{children}</ol>
}

function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <li className="flex gap-3">
      <span className="flex items-center justify-center w-5 h-5 rounded-full bg-slate-900 text-white text-[10px] font-bold shrink-0 mt-0.5">{n}</span>
      <div>
        <p className="text-xs font-semibold text-slate-800 mb-0.5">{title}</p>
        <p className="text-xs text-slate-500 leading-relaxed">{children}</p>
      </div>
    </li>
  )
}
