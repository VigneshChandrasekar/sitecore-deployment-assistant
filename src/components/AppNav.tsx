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
  { href: "/package-inspector",  label: "Package Inspector", icon: Package  },
  { href: "/package-compare",    label: "Package Compare",   icon: GitCompare },
  { href: "/environment-sync",   label: "Environment Sync",  icon: GitMerge },
  { href: "/risk-analyzer",      label: "Risk Analyzer",     icon: Shield   },
];

export default function AppNav() {
  const pathname = usePathname();

  const isActive = (href: string) =>
    pathname === href || pathname.startsWith(href + "/");

  return (
    <header className="shrink-0 flex items-stretch h-12 bg-white border-b border-slate-400">

      {/* Brand */}
      <Link
        href="/package-inspector"
        className="flex items-center gap-2.5 shrink-0 px-4 w-[320px] border-r border-slate-400"
      >
        <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-red-600 shrink-0">
          <svg viewBox="0 0 24 24" fill="none" className="w-5 h-5" xmlns="http://www.w3.org/2000/svg">
            {/* Package base */}
            <path d="M3 12L12 7L21 12V19.5L12 22L3 19.5V12Z" stroke="white" strokeWidth="1.5" strokeLinejoin="round"/>
            {/* Package lid crease */}
            <path d="M3 12L12 16.5L21 12" stroke="white" strokeWidth="1.5" strokeLinejoin="round"/>
            <line x1="12" y1="16.5" x2="12" y2="22" stroke="white" strokeWidth="1.5"/>
            {/* Deploy arrow up */}
            <path d="M12 3V9M9.5 5.5L12 3L14.5 5.5" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </div>
        <div className="leading-tight">
          <div className="flex items-center gap-1.5">
            <span className="text-[13px] font-bold text-slate-900 tracking-tight">
              Sitecore Deployment Assistant
            </span>
            <span className="px-1 py-px rounded text-[9px] font-bold tracking-widest bg-red-600 text-white">
              CMS
            </span>
          </div>
          <p className="text-[10px] text-slate-400 tracking-wide">
            Pre-deployment toolkit
          </p>
        </div>
      </Link>

      {/* Main nav */}
      <nav className="flex items-stretch flex-1 px-2">
        {MAIN_TABS.map(({ href, label, icon: Icon }) => {
          const active = isActive(href);
          return (
            <Link
              key={href}
              href={href}
              className={`relative flex items-center gap-2 px-4 text-[13px] font-medium transition-colors whitespace-nowrap border-b-2
                ${active
                  ? "text-slate-900 font-semibold border-red-500"
                  : "text-slate-500 hover:text-slate-800 border-transparent hover:border-slate-400"
                }`}
            >
              <Icon
                className={`h-3.5 w-3.5 shrink-0 ${active ? "text-red-500" : "text-slate-400"}`}
                strokeWidth={2}
              />
              {label}
            </Link>
          );
        })}
      </nav>

      {/* Setup Instructions — far right utility link */}
      <div className="shrink-0 flex items-stretch border-l border-slate-400">
        <Link
          href="/setup-instructions"
          className={`flex items-center gap-2 px-4 text-[13px] font-medium transition-colors whitespace-nowrap border-b-2
            ${isActive("/setup-instructions")
              ? "text-slate-900 font-semibold border-red-500"
              : "text-slate-500 hover:text-slate-800 border-transparent hover:border-slate-400"
            }`}
        >
          <Terminal
            className={`h-3.5 w-3.5 shrink-0 ${isActive("/setup-instructions") ? "text-red-500" : "text-slate-400"}`}
            strokeWidth={2}
          />
          Setup Instructions
        </Link>
      </div>

    </header>
  );
}
