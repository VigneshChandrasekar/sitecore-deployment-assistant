"use client";

import { useState, useMemo } from "react";
import { Box, Download, Link2, AlertTriangle } from "lucide-react";
import UploadPanel from "@/components/UploadPanel";
import ItemTree from "@/components/ItemTree";
import TabInfo from "@/components/TabInfo";
import RepackageScriptButton from "@/components/RepackageScriptButton";
import ReferenceReport from "@/components/ReferenceReport";
import type { ParsedPackage } from "@/lib/types";
import { checkReferences } from "@/lib/referenceChecker";

export default function InspectPage() {
  const [pkg, setPkg]                   = useState<ParsedPackage | null>(null);
  const [loading, setLoading]           = useState(false);
  const [refReportOpen, setRefReportOpen] = useState(false);

  const refResult = useMemo(
    () => (pkg ? checkReferences(pkg.items) : null),
    [pkg],
  );

  return (
    <>
      {/* Sidebar */}
      <aside className="w-[280px] shrink-0 min-h-0 bg-slate-950 border-r border-slate-800 overflow-y-auto dark-scroll">
        <UploadPanel
          onParsed={setPkg}
          pkg={pkg}
          loading={loading}
          setLoading={setLoading}
        />
      </aside>

      {/* Main */}
      <main className="flex-1 min-w-0 overflow-hidden flex flex-col bg-slate-50">
        {/* Toolbar */}
        {pkg && !loading && (
          <div className="shrink-0 flex items-center gap-3 px-5 py-2.5 border-b border-slate-200 bg-white shadow-sm">
            <Box className="h-4 w-4 text-slate-400 shrink-0" />
            <span className="text-sm font-semibold text-slate-800 truncate max-w-[240px]">
              {pkg.metadata.name}
            </span>
            {pkg.metadata.version && (
              <span className="shrink-0 px-1.5 py-0.5 rounded-md text-[10px] font-bold text-slate-500 bg-slate-100 uppercase tracking-wide">
                v{pkg.metadata.version}
              </span>
            )}
            <div className="h-4 w-px bg-slate-200 shrink-0" />
            <div className="flex items-center gap-1.5 text-xs text-slate-500">
              <span className="tabular-nums">{pkg.items.length} items</span>
              {pkg.files.length > 0 && (
                <>
                  <span className="text-slate-300">·</span>
                  <span className="tabular-nums">{pkg.files.length} files</span>
                </>
              )}
            </div>
            {[...new Set(pkg.items.map((i) => i.database))].map((db) => (
              <span
                key={db}
                className="shrink-0 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-slate-900 text-slate-400 uppercase tracking-wide"
              >
                {db}
              </span>
            ))}

            <div className="ml-auto flex items-center gap-2">
              {/* Reference check button */}
              {refResult && (
                <button
                  onClick={() => setRefReportOpen(true)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium border transition-all hover:-translate-y-0.5 hover:shadow-md
                    ${refResult.missing.length > 0
                      ? "bg-amber-500 hover:bg-white hover:text-amber-700 text-white border-amber-600 hover:border-amber-300"
                      : "bg-slate-800 hover:bg-white hover:text-slate-900 text-white border-slate-700 hover:border-slate-300"
                    }`}
                >
                  {refResult.missing.length > 0
                    ? <AlertTriangle className="h-3.5 w-3.5" />
                    : <Link2 className="h-3.5 w-3.5 text-slate-300" />
                  }
                  {refResult.missing.length > 0
                    ? `${refResult.missing.length} Missing Ref${refResult.missing.length !== 1 ? "s" : ""}`
                    : "References OK"
                  }
                </button>
              )}

              <RepackageScriptButton pkg={pkg} />

              <button
                onClick={async () => {
                  const { exportToExcel } = await import("@/lib/exporter");
                  exportToExcel(pkg);
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-slate-800 hover:bg-white hover:text-slate-900 text-white text-xs font-medium border border-slate-700 hover:border-slate-300 transition-all hover:-translate-y-0.5 hover:shadow-md"
              >
                <Download className="h-3.5 w-3.5" />
                Export Excel
              </button>
            </div>
          </div>
        )}

        <TabInfo
          title="Package Inspector"
          what="Unpack and browse every item, field, and file inside a Sitecore .zip package before it is deployed. Generate re-package scripts and export to Excel."
          guideHref="/package-inspector/guide"
        />

        {pkg && !loading ? (
          <ItemTree pkg={pkg} />
        ) : (
          <div className="flex flex-col items-center justify-center flex-1 gap-5">
            <div className="flex items-center justify-center w-20 h-20 rounded-3xl bg-white border border-slate-200 shadow-md">
              <Box className="h-9 w-9 text-slate-300" strokeWidth={1.5} />
            </div>
            <div className="text-center">
              <p className="text-base font-semibold text-slate-600">No package loaded</p>
              <p className="text-sm text-slate-400 mt-1">
                Upload a .zip Sitecore package using the sidebar
              </p>
            </div>
          </div>
        )}
      </main>

      {/* Reference report modal */}
      {refReportOpen && pkg && refResult && (
        <ReferenceReport
          pkg={pkg}
          result={refResult}
          onClose={() => setRefReportOpen(false)}
        />
      )}
    </>
  );
}
