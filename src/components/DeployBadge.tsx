import type { DeployMode } from "@/lib/types";

const config: Record<DeployMode, { label: string; classes: string }> = {
  Overwrite: {
    label: "Overwrite",
    classes: "bg-amber-50 text-amber-700 ring-1 ring-amber-200",
  },
  Merge: {
    label: "Merge",
    classes: "bg-blue-50 text-blue-700 ring-1 ring-blue-200",
  },
  Skip: {
    label: "Skip",
    classes: "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200",
  },
  Delete: {
    label: "Delete",
    classes: "bg-red-50 text-red-700 ring-1 ring-red-200",
  },
  Undefined: {
    label: "Unknown",
    classes: "bg-slate-100 text-slate-500 ring-1 ring-slate-200",
  },
};

export default function DeployBadge({ mode }: { mode: DeployMode }) {
  const { label, classes } = config[mode];
  return (
    <span
      className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold tracking-wide uppercase ${classes}`}
    >
      {label}
    </span>
  );
}
