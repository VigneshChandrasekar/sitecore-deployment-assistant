"use client";

import {
  X,
  GitCompare,
  Upload,
  Shield,
  CheckCircle,
  Info,
  AlertTriangle,
} from "lucide-react";

interface Props {
  onClose: () => void;
}

export default function CompareGuideModal({ onClose }: Props) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="relative w-[720px] max-h-[85vh] flex flex-col rounded-xl bg-white shadow-2xl border border-slate-200">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 shrink-0">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-slate-100 border border-slate-200">
              <GitCompare className="h-4 w-4 text-slate-600" />
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                Developer Guide
              </p>
              <p className="text-sm font-semibold text-slate-900">
                Package Compare
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-md hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-8 py-6 space-y-10 text-sm text-slate-600 leading-relaxed">
          <Section
            id="what"
            icon={<Info className="h-4 w-4" />}
            title="What is Package Compare?"
          >
            <p>
              Package Compare diffs two Sitecore <code>.zip</code> packages and
              shows exactly what changed between them — items added, removed,
              modified, or unchanged. It matches items by ID across both
              packages and presents the results in a split view:{" "}
              <strong>Baseline</strong> on the left,{" "}
              <strong>New Version</strong> on the right.
            </p>
            <Callout color="blue" icon={<Info className="h-4 w-4" />}>
              Everything runs <strong>client-side</strong>. Neither package
              leaves your machine.
            </Callout>
          </Section>

          <Section
            id="how"
            icon={<Upload className="h-4 w-4" />}
            title="How to use it"
          >
            <Steps>
              <Step n={1} title="Upload Package A — Baseline">
                The original or currently deployed package. Drop it onto the top
                upload zone in the sidebar.
              </Step>
              <Step n={2} title="Upload Package B — New Version">
                The updated package you want to compare against. Drop it onto
                the second upload zone.
              </Step>
              <Step n={3} title="Read the Summary">
                The sidebar shows a count of Added, Removed, Modified, and
                Unchanged items at a glance.
              </Step>
              <Step n={4} title="Review the split view">
                The main area splits into two panels. Baseline shows what was
                there; New Version shows what will be deployed. Each item is
                colour-coded by its status.
              </Step>
              <Step n={5} title="Filter by name or path">
                Use the search bar above the split view to narrow down to
                specific items.
              </Step>
            </Steps>
          </Section>

          <Section
            id="statuses"
            icon={<Shield className="h-4 w-4" />}
            title="Item statuses"
          >
            <div className="space-y-3">
              {[
                {
                  status: "Added",
                  color: "bg-emerald-50 border-emerald-200",
                  badge: "bg-emerald-100 text-emerald-700",
                  desc: "Only in Package B. This item will be created fresh on the target environment. Appears only in the New Version panel.",
                },
                {
                  status: "Removed",
                  color: "bg-red-50 border-red-200",
                  badge: "bg-red-100 text-red-700",
                  desc: "Only in Package A. This item was present in the baseline but is missing from the new version. Appears only in the Baseline panel with strikethrough.",
                },
                {
                  status: "Modified",
                  color: "bg-amber-50 border-amber-200",
                  badge: "bg-amber-100 text-amber-700",
                  desc: "Present in both packages but with different field values. The badge shows the number of changed fields. Appears in both panels.",
                },
                {
                  status: "Unchanged",
                  color: "bg-slate-50 border-slate-200",
                  badge: "bg-slate-100 text-slate-600",
                  desc: "Identical in both packages. Appears in both panels with no highlight. Safe to deploy.",
                },
              ].map(({ status, color, badge, desc }) => (
                <div key={status} className={`rounded-lg border p-3 ${color}`}>
                  <div className="flex items-center gap-2 mb-1">
                    <span
                      className={`text-xs font-bold px-2 py-0.5 rounded ${badge}`}
                    >
                      {status}
                    </span>
                  </div>
                  <p className="text-xs text-slate-700 leading-relaxed">
                    {desc}
                  </p>
                </div>
              ))}
            </div>
          </Section>

          <Section
            id="split-view"
            icon={<GitCompare className="h-4 w-4" />}
            title="Understanding the split view"
          >
            <p>
              The main panel is divided into two columns that mirror each other
              by database and path.
            </p>
            <div className="grid grid-cols-2 gap-3 mt-3">
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                <p className="text-xs font-bold text-slate-700 mb-1">
                  Baseline (Package A)
                </p>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Shows items as they exist in the original package. Removed
                  items appear with a red highlight and strikethrough. Modified
                  items are amber.
                </p>
              </div>
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                <p className="text-xs font-bold text-slate-700 mb-1">
                  New Version (Package B)
                </p>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Shows items as they will be after deployment. Added items
                  appear with a green highlight. Modified items are amber.
                </p>
              </div>
            </div>
            <Callout color="blue" icon={<Info className="h-4 w-4" />}>
              Items are matched by <strong>Sitecore item ID</strong>, not by
              name or path. A renamed item shows as Modified, not as a Remove +
              Add pair.
            </Callout>
          </Section>

          <Section
            id="tips"
            icon={<CheckCircle className="h-4 w-4" />}
            title="Tips & best practices"
          >
            <div className="space-y-2">
              {[
                {
                  title: "Compare against what is actually deployed",
                  body: "Use the package that was last deployed to the target environment as Package A, not just any older version. This gives you the true delta for that environment.",
                },
                {
                  title: "Investigate every Removed item",
                  body: "A Removed item means it was in the baseline but is not in the new package. If the target environment has that item, the new deployment will not touch it — but it is worth confirming this is intentional.",
                },
                {
                  title: "Check Modified item counts carefully",
                  body: 'A badge showing "Modified · 12" means 12 fields changed. Large field-change counts on content items often indicate accidental field resets or HTML editor changes that should be reviewed.',
                },
                {
                  title: "Use search to focus on high-risk areas",
                  body: 'Filter by path prefixes like "templates" or "renderings" to review schema changes first, then check content separately.',
                },
              ].map(({ title, body }) => (
                <div
                  key={title}
                  className="rounded-lg border border-slate-200 bg-white p-3 flex gap-3"
                >
                  <CheckCircle className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-xs font-semibold text-slate-800 mb-0.5">
                      {title}
                    </p>
                    <p className="text-xs text-slate-600 leading-relaxed">
                      {body}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </Section>
        </div>

        {/* Footer */}
        <div className="shrink-0 px-6 py-3 border-t border-slate-200 bg-slate-50 rounded-b-xl flex items-center justify-between">
          <p className="text-[11px] text-slate-400">
            Sitecore Deployment Assistant — Package Compare Guide
          </p>
          <button
            onClick={onClose}
            className="px-3 py-1.5 rounded-md text-xs font-medium border bg-white text-slate-700 border-slate-300 hover:bg-slate-900 hover:text-white hover:border-slate-900 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

function Section({
  id,
  icon,
  title,
  children,
}: {
  id: string;
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id}>
      <div className="flex items-center gap-2.5 mb-3">
        <span className="flex items-center justify-center w-7 h-7 rounded-lg bg-slate-100 text-slate-600">
          {icon}
        </span>
        <h2 className="text-base font-bold text-slate-900">{title}</h2>
      </div>
      <div className="space-y-3">{children}</div>
    </section>
  );
}

function Callout({
  color,
  icon,
  children,
}: {
  color: "blue" | "amber";
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  const styles = {
    blue: "bg-blue-50 border-blue-200 text-blue-800",
    amber: "bg-amber-50 border-amber-200 text-amber-800",
  }[color];
  return (
    <div
      className={`flex gap-3 rounded-lg border px-4 py-3 text-xs leading-relaxed mt-2 ${styles}`}
    >
      <span className="shrink-0 mt-0.5">{icon}</span>
      <span>{children}</span>
    </div>
  );
}

function Steps({ children }: { children: React.ReactNode }) {
  return <ol className="space-y-2 mt-1">{children}</ol>;
}

function Step({
  n,
  title,
  children,
}: {
  n: number;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <li className="flex gap-3">
      <span className="flex items-center justify-center w-5 h-5 rounded-full bg-blue-600 text-white text-[10px] font-bold shrink-0 mt-0.5">
        {n}
      </span>
      <div>
        <p className="text-xs font-semibold text-slate-800 mb-0.5">{title}</p>
        <p className="text-xs text-slate-500 leading-relaxed">{children}</p>
      </div>
    </li>
  );
}
