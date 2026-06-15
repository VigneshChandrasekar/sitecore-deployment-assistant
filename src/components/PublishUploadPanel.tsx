"use client";

import { useCallback, useRef } from "react";
import { useState } from "react";
import {
  UploadCloud,
  FileArchive,
  X,
  Plus,
  Terminal,
  CheckCircle2,
} from "lucide-react";
import type { ParsedPackage } from "@/lib/types";

interface PackageEntry {
  pkg: ParsedPackage;
  name: string;
}

interface Props {
  packages: PackageEntry[];
  onAdd: (pkg: ParsedPackage, name: string) => void;
  onRemove: (index: number) => void;
  languages: string[];
  onLanguagesChange: (langs: string[]) => void;
  onGenerateScript: () => void;
}

export default function PublishUploadPanel({
  packages,
  onAdd,
  onRemove,
  languages,
  onLanguagesChange,
  onGenerateScript,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [langInput, setLangInput] = useState("");

  const process = useCallback(
    async (file: File) => {
      if (!file.name.endsWith(".zip")) return;
      const { parsePackage } = await import("@/lib/parser");
      const result = await parsePackage(await file.arrayBuffer());
      onAdd(result, file.name.replace(/\.zip$/i, ""));
    },
    [onAdd],
  );

  const onFileDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      Array.from(e.dataTransfer.files).forEach((f) => process(f));
    },
    [process],
  );

  const onChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    Array.from(e.target.files ?? []).forEach((f) => process(f));
    e.target.value = "";
  };

  const totalItems = packages.reduce((s, p) => s + p.pkg.items.length, 0);
  const ready = packages.length >= 1;

  return (
    <div className="flex flex-col gap-0">
      {/* Package list */}
      <div className="p-4 border-b border-slate-800">
        <p className="text-[11px] font-semibold text-slate-400 mb-3">
          Packages
        </p>

        <div className="flex flex-col gap-2">
          {packages.map((entry, i) => (
            <div
              key={i}
              className="flex items-stretch gap-0 rounded-lg border bg-slate-800 border-slate-700 overflow-hidden"
            >
              {/* Card content */}
              <div className="flex items-start gap-2 px-2.5 py-2.5 flex-1 min-w-0">
                <FileArchive className="h-4 w-4 text-slate-400 shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-white truncate">
                    {entry.name}
                  </p>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    {entry.pkg.items.length} items · {entry.pkg.files.length}{" "}
                    files
                  </p>
                </div>
              </div>

              {/* Remove */}
              <button
                onClick={() => onRemove(i)}
                className="shrink-0 px-2 flex items-center hover:bg-slate-700 text-slate-500 hover:text-white transition-colors border-l border-slate-700"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}

          {/* Drop zone / Add button */}
          <label
            onDragOver={(e) => {
              if (e.dataTransfer.types.includes("Files")) e.preventDefault();
            }}
            onDrop={onFileDrop}
            className="flex items-center justify-center gap-2 rounded-lg border-2 border-dashed border-white/30 hover:border-white/60 hover:bg-slate-800/60 cursor-pointer transition-all p-3"
          >
            <input
              ref={inputRef}
              type="file"
              accept=".zip"
              multiple
              className="hidden"
              onChange={onChange}
            />
            {packages.length === 0 ? (
              <div className="text-center py-2">
                <UploadCloud className="h-6 w-6 text-slate-600 mx-auto mb-1" />
                <p className="text-xs font-medium text-white">
                  Drop Sitecore packages
                </p>
                <p className="text-[10px] text-slate-500">
                  or click to browse — .zip only
                </p>
              </div>
            ) : (
              <div className="flex items-center gap-1.5 py-0.5">
                <Plus className="h-3.5 w-3.5 text-slate-400" />
                <span className="text-xs font-medium text-white">
                  Add another package
                </span>
              </div>
            )}
          </label>
        </div>
      </div>

      {packages.length > 0 && (
        <>
          {/* Summary */}
          <div className="p-4 border-b border-slate-800">
            <p className="text-[11px] font-semibold text-slate-400 mb-2.5">
              Summary
            </p>
            <div className="grid grid-cols-2 gap-2">
              <StatCard label="Packages" value={packages.length} />
              <StatCard label="Items" value={totalItems} />
            </div>

            {ready && (
              <div className="mt-2.5 flex items-start gap-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20 px-3 py-2 text-xs text-emerald-400">
                <CheckCircle2 className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                <span>Ready to generate publish script.</span>
              </div>
            )}
          </div>

          {/* Languages */}
          <div className="p-4 border-b border-slate-800">
            <p className="text-[11px] font-semibold text-slate-400 mb-2">
              Publish Languages
            </p>
            <div className="flex flex-wrap gap-1.5 mb-2">
              {languages.map((lang) => (
                <span
                  key={lang}
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-slate-700 text-slate-200 border border-slate-600"
                >
                  {lang}
                  <button
                    onClick={() =>
                      onLanguagesChange(languages.filter((l) => l !== lang))
                    }
                    className="text-slate-400 hover:text-white transition-colors"
                    title="Remove"
                  >
                    <X className="h-2.5 w-2.5" />
                  </button>
                </span>
              ))}
            </div>
            <div className="flex gap-1.5">
              <input
                type="text"
                value={langInput}
                onChange={(e) => setLangInput(e.target.value)}
                onKeyDown={(e) => {
                  if (
                    (e.key === "Enter" || e.key === ",") &&
                    langInput.trim()
                  ) {
                    e.preventDefault();
                    const lang = langInput.trim().replace(/,$/, "");
                    if (lang && !languages.includes(lang)) {
                      onLanguagesChange([...languages, lang]);
                    }
                    setLangInput("");
                  }
                }}
                placeholder="e.g. ar-AE"
                className="flex-1 min-w-0 bg-slate-800 border border-slate-600 rounded-md px-2 py-1 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
              />
              <button
                onClick={() => {
                  const lang = langInput.trim().replace(/,$/, "");
                  if (lang && !languages.includes(lang)) {
                    onLanguagesChange([...languages, lang]);
                  }
                  setLangInput("");
                }}
                disabled={!langInput.trim()}
                className="px-2 py-1 rounded-md bg-slate-700 text-slate-300 hover:bg-slate-600 hover:text-white text-xs border border-slate-600 disabled:opacity-30 transition-colors"
              >
                Add
              </button>
            </div>
            <p className="text-[10px] text-slate-500 mt-1.5">
              Press Enter or comma to add. Default is "en".
            </p>
          </div>

          {/* Actions */}
          <div className="p-4 border-b border-slate-800">
            <p className="text-[11px] font-semibold text-slate-400 mb-2.5">
              Actions
            </p>
            <button
              onClick={onGenerateScript}
              disabled={!ready}
              className="w-full flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium border transition-colors
                bg-blue-600 text-white border-blue-600 hover:bg-white hover:text-blue-600 hover:border-blue-600
                disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-blue-600 disabled:hover:text-white"
            >
              <Terminal className="h-3.5 w-3.5" />
              Generate Publish Script
            </button>
          </div>
        </>
      )}
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl px-3 py-3 text-center border bg-slate-800 border-slate-700">
      <p className="text-2xl font-bold leading-none tabular-nums text-white">
        {value}
      </p>
      <p className="text-[10px] mt-1 font-medium text-slate-500">{label}</p>
    </div>
  );
}
