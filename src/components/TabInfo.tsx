"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp, Info } from "lucide-react";

interface TabInfoProps {
  title: string;
  what: string;
  how: string;
  helps: string;
  avoids: string;
}

export default function TabInfo({
  title,
  what,
  how,
  helps,
  avoids,
}: TabInfoProps) {
  const [open, setOpen] = useState(true);

  return (
    <div className="shrink-0 border-b border-slate-200 bg-white">
      {/* Collapsed bar */}
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center gap-2.5 px-5 py-2.5 text-left hover:bg-slate-50 transition-colors"
      >
        <Info className="h-3.5 w-3.5 text-slate-400 shrink-0" />
        <span className="flex-1 text-xs text-slate-500">
          <span className="font-semibold text-slate-700">{title} — </span>
          {what}
        </span>
        {open ? (
          <ChevronUp className="h-3.5 w-3.5 text-slate-400 shrink-0" />
        ) : (
          <ChevronDown className="h-3.5 w-3.5 text-slate-400 shrink-0" />
        )}
      </button>

      {/* Expanded detail */}
      {open && (
        <div className="px-5 pb-4 grid grid-cols-3 gap-4 border-t border-slate-100">
          <Card label="How it works" color="slate" text={how} />
          <Card label="How it helps deployment" color="emerald" text={helps} />
          <Card label="Risks it avoids" color="red" text={avoids} />
        </div>
      )}
    </div>
  );
}

function Card({
  label,
  color,
  text,
}: {
  label: string;
  color: "slate" | "emerald" | "red";
  text: string;
}) {
  const styles = {
    slate: { wrap: "bg-slate-50 border-slate-200", heading: "text-slate-600" },
    emerald: {
      wrap: "bg-emerald-50 border-emerald-200",
      heading: "text-emerald-700",
    },
    red: { wrap: "bg-red-50 border-red-200", heading: "text-red-700" },
  }[color];

  return (
    <div
      className={`rounded-lg border px-3 py-2.5 space-y-1 mt-3 ${styles.wrap}`}
    >
      <p
        className={`text-[11px] font-semibold uppercase tracking-wide ${styles.heading}`}
      >
        {label}
      </p>
      <p className="text-xs text-slate-600 leading-relaxed">{text}</p>
    </div>
  );
}
