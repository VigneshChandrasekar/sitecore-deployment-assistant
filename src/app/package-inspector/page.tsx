"use client";

import { useState, useMemo } from "react";
import { Box } from "lucide-react";
import UploadPanel from "@/components/UploadPanel";
import ItemTree from "@/components/ItemTree";
import TabInfo from "@/components/TabInfo";
import ReferenceReport from "@/components/ReferenceReport";
import GuideModal from "@/components/GuideModal";
import type { ParsedPackage } from "@/lib/types";
import { checkReferences } from "@/lib/referenceChecker";
import type { ReferenceCheckResult } from "@/lib/referenceChecker";

export default function InspectPage() {
  const [pkg, setPkg] = useState<ParsedPackage | null>(null);
  const [loading, setLoading] = useState(false);
  const [refReportOpen, setRefReportOpen] = useState(false);
  const [guideOpen, setGuideOpen] = useState(false);

  const refResult = useMemo(
    () => (pkg ? checkReferences(pkg.items) : null),
    [pkg],
  );

  return (
    <div className="flex flex-col flex-1 min-h-0 overflow-hidden gap-y-1.5">
      {/* Info bar — full width, dark */}
      <TabInfo
        title="Package Inspector"
        what="Unpack and browse every item, field, and file inside a Sitecore .zip package before it is deployed. Generate re-package scripts and export to Excel."
        onGuide={() => setGuideOpen(true)}
      />

      {/* Sidebar + main row */}
      <div className="flex flex-1 overflow-hidden min-h-0">
        {/* Sidebar */}
        <aside className="w-[320px] shrink-0 min-h-0 bg-slate-900 border-r border-slate-800 overflow-y-auto">
          <UploadPanel
            onParsed={setPkg}
            pkg={pkg}
            loading={loading}
            setLoading={setLoading}
            refResult={refResult}
            onRefReport={() => setRefReportOpen(true)}
          />
        </aside>

        {/* Main */}
        <main className="flex-1 min-w-0 overflow-hidden flex flex-col bg-slate-50">
          {pkg && !loading ? (
            <ItemTree pkg={pkg} showDownloadXml />
          ) : (
            <div className="flex flex-col items-center justify-center flex-1 gap-5">
              <div className="flex items-center justify-center w-20 h-20 rounded-3xl bg-white border border-slate-200 shadow-md">
                <Box className="h-9 w-9 text-slate-300" strokeWidth={1.5} />
              </div>
              <div className="text-center">
                <p className="text-base font-semibold text-slate-600">
                  No package loaded
                </p>
                <p className="text-sm text-slate-400 mt-1">
                  Upload a .zip Sitecore package using the sidebar
                </p>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* Reference report modal */}
      {refReportOpen && pkg && refResult && (
        <ReferenceReport
          pkg={pkg}
          result={refResult}
          onClose={() => setRefReportOpen(false)}
        />
      )}

      {/* Developer Guide modal */}
      {guideOpen && <GuideModal onClose={() => setGuideOpen(false)} />}
    </div>
  );
}
