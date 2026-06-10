"use client";

import { useState } from "react";
import { Box, Download } from "lucide-react";
import UploadPanel from "@/components/UploadPanel";
import ItemTree from "@/components/ItemTree";
import TabInfo from "@/components/TabInfo";
import type { ParsedPackage } from "@/lib/types";

export default function InspectPage() {
  const [pkg, setPkg] = useState<ParsedPackage | null>(null);
  const [loading, setLoading] = useState(false);

  return (
    <>
      {/* Sidebar */}
      <aside className="w-[300px] shrink-0 min-h-0 bg-white border-r border-slate-200 overflow-y-auto">
        <UploadPanel
          onParsed={setPkg}
          pkg={pkg}
          loading={loading}
          setLoading={setLoading}
        />
      </aside>

      {/* Main */}
      <main className="flex-1 min-w-0 overflow-hidden flex flex-col bg-slate-50">
        {/* Inline toolbar when package is loaded */}
        {pkg && !loading && (
          <div className="shrink-0 flex items-center gap-3 px-4 py-2 border-b border-slate-200 bg-white">
            <span className="text-xs text-slate-500 font-medium truncate max-w-xs">
              {pkg.metadata.name}
            </span>
            <div className="h-3.5 w-px bg-slate-200" />
            <span className="text-xs text-slate-400">
              {pkg.items.length} items
            </span>
            {pkg.files.length > 0 && (
              <>
                <div className="h-3.5 w-px bg-slate-200" />
                <span className="text-xs text-slate-400">
                  {pkg.files.length} files
                </span>
              </>
            )}
            <button
              onClick={async () => {
                const { exportToExcel } = await import("@/lib/exporter");
                exportToExcel(pkg);
              }}
              className="ml-auto flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-slate-800 hover:bg-slate-700 text-white text-xs font-medium transition-colors"
            >
              <Download className="h-3.5 w-3.5" />
              Export Excel
            </button>
          </div>
        )}

        <TabInfo
          title="Package Inspector"
          what="Unpack and browse every item, field, and file inside a Sitecore .zip package before it is deployed."
          how="Parses the ZIP structure — item XML files, properties files, and physical files — and presents them as a filterable tree with deploy modes, templates, databases, and field values."
          helps="Gives developers and release managers full visibility into exactly what a package contains before it touches any environment. No more surprises on deployment day."
          avoids="Deploying unexpected items, wrong deploy modes (e.g. Delete instead of Merge), or packages built from the wrong branch."
        />

        {pkg && !loading ? (
          <ItemTree pkg={pkg} />
        ) : (
          <div className="flex flex-col items-center justify-center h-full gap-4">
            <div className="flex items-center justify-center w-16 h-16 rounded-2xl bg-white border border-slate-200 shadow-sm">
              <Box className="h-8 w-8 text-slate-300" strokeWidth={1.5} />
            </div>
            <div className="text-center">
              <p className="text-sm font-medium text-slate-500">
                No package loaded
              </p>
              <p className="text-xs text-slate-400 mt-1">
                Upload a .zip Sitecore package to inspect
              </p>
            </div>
          </div>
        )}
      </main>
    </>
  );
}
