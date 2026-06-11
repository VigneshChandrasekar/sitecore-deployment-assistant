import type { DeployMode } from "@/lib/types";

const config: Record<
  DeployMode,
  { label: string; light: string; dark: string }
> = {
  Overwrite: {
    label: "Overwrite",
    light: "bg-amber-50 text-amber-700 ring-1 ring-amber-200",
    dark: "bg-amber-400/10 text-amber-400 ring-1 ring-amber-400/25",
  },
  Merge: {
    label: "Merge",
    light: "bg-blue-50 text-blue-700 ring-1 ring-blue-200",
    dark: "bg-blue-400/10 text-blue-400 ring-1 ring-blue-400/25",
  },
  Skip: {
    label: "Skip",
    light: "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200",
    dark: "bg-emerald-400/10 text-emerald-400 ring-1 ring-emerald-400/25",
  },
  Delete: {
    label: "Delete",
    light: "bg-red-50 text-red-700 ring-1 ring-red-200",
    dark: "bg-red-400/10 text-red-400 ring-1 ring-red-400/25",
  },
  Undefined: {
    label: "Unknown",
    light: "bg-slate-100 text-slate-500 ring-1 ring-slate-200",
    dark: "bg-slate-700/60 text-slate-400 ring-1 ring-slate-600/50",
  },
};

export default function DeployBadge({
  mode,
  variant = "light",
}: {
  mode: DeployMode;
  variant?: "light" | "dark";
}) {
  const { label, light, dark } = config[mode];
  return (
    <span
      className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold tracking-wide uppercase ${variant === "dark" ? dark : light}`}
    >
      {label}
    </span>
  );
}
