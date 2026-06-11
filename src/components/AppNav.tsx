"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Box,
  Package,
  GitCompare,
  GitMerge,
  Shield,
  Terminal,
} from "lucide-react";

const MAIN_TABS = [
  {
    href: "/package-inspector",
    label: "Package Inspector",
    sub: "Browse package contents",
    icon: Package,
  },
  {
    href: "/package-compare",
    label: "Package Compare",
    sub: "Diff two packages",
    icon: GitCompare,
  },
  {
    href: "/environment-sync",
    label: "Environment Sync",
    sub: "Detect env differences",
    icon: GitMerge,
  },
  {
    href: "/risk-analyzer",
    label: "Risk Analyzer",
    sub: "Pre-deploy risk check",
    icon: Shield,
  },
];

export default function AppNav() {
  const pathname = usePathname();

  const isActive = (href: string) =>
    pathname === href || pathname.startsWith(href + "/");

  return (
    <header className="shrink-0 flex items-center gap-0 px-5 h-14 bg-slate-950 border-b border-slate-800 shadow-[0_1px_0_theme(colors.slate.800)]">
      {/* Logo */}
      <Link
        href="/package-inspector"
        className="flex items-center gap-2.5 shrink-0 mr-6"
      >
        <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-red-600 shadow-[0_0_12px_rgba(239,68,68,0.4)]">
          <Box className="h-4.5 w-4.5 text-white" strokeWidth={1.8} />
        </div>
        <div className="leading-tight">
          <div className="flex items-center gap-1.5">
            <span className="text-[14px] font-bold text-white tracking-tight">
              Sitecore Deployment Assistant
            </span>
            <span className="px-1.5 py-0.5 rounded text-[9px] font-bold tracking-widest bg-red-600 text-white">
              CMS
            </span>
          </div>
          <p className="text-[10px] text-slate-500 tracking-wide">
            Pre-deployment toolkit
          </p>
        </div>
      </Link>

      {/* Divider */}
      <div className="h-8 w-px bg-slate-700 mr-5 shrink-0" />

      {/* Main nav */}
      <nav className="flex items-stretch gap-0.5 flex-1">
        {MAIN_TABS.map(({ href, label, sub, icon: Icon }) => {
          const active = isActive(href);
          return (
            <Link
              key={href}
              href={href}
              className={`relative flex items-center gap-2.5 px-3.5 py-2 rounded-lg transition-all group
                ${
                  active
                    ? "bg-white text-slate-900 shadow-sm"
                    : "text-slate-400 hover:text-white hover:bg-slate-800/70"
                }`}
            >
              <Icon
                className={`h-4 w-4 shrink-0 ${active ? "text-red-500" : "text-slate-600 group-hover:text-slate-300"}`}
              />
              <div className="leading-tight">
                <p
                  className={`text-[12px] font-semibold whitespace-nowrap ${active ? "text-slate-900" : ""}`}
                >
                  {label}
                </p>
                <p
                  className={`text-[10px] whitespace-nowrap ${active ? "text-slate-500" : "text-slate-600 group-hover:text-slate-400"}`}
                >
                  {sub}
                </p>
              </div>
              {active && (
                <span className="absolute bottom-0 left-3 right-3 h-0.5 bg-red-500 rounded-full" />
              )}
            </Link>
          );
        })}
      </nav>

      {/* Setup Instructions — far right, utility style */}
      <div className="shrink-0 ml-4 pl-4 border-l border-slate-700">
        <Link
          href="/setup-instructions"
          className={`flex items-center gap-2 px-3.5 py-2 rounded-lg transition-all group
            ${
              isActive("/setup-instructions")
                ? "bg-slate-700 text-white"
                : "text-slate-500 hover:text-slate-200 hover:bg-slate-800"
            }`}
        >
          <Terminal
            className={`h-3.5 w-3.5 shrink-0 ${isActive("/setup-instructions") ? "text-white" : "text-slate-500 group-hover:text-slate-300"}`}
          />
          <div className="leading-tight">
            <p className="text-[12px] font-semibold whitespace-nowrap">
              Setup Instructions
            </p>
            <p
              className={`text-[10px] whitespace-nowrap ${isActive("/setup-instructions") ? "text-slate-300" : "text-slate-600 group-hover:text-slate-400"}`}
            >
              PowerShell snapshot
            </p>
          </div>
        </Link>
      </div>
    </header>
  );
}
