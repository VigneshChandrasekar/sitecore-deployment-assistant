"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Package,
  FileDiff,
  Layers,
  GitMerge,
  Shield,
  Terminal,
  ChevronDown,
  SendToBack,
} from "lucide-react";

const PACKAGE_TOOLS = [
  {
    href: "/package-inspector",
    label: "Package Inspector",
    icon: Package,
    sub: "Browse items, fields & files",
  },
  {
    href: "/package-compare",
    label: "Package Compare",
    icon: FileDiff,
    sub: "Diff two packages side-by-side",
  },
  {
    href: "/package-merge",
    label: "Package Merge",
    icon: Layers,
    sub: "Combine packages into one",
  },
  {
    href: "/package-publish",
    label: "Publish Packages",
    icon: SendToBack,
    sub: "Generate publish script from packages",
  },
];

const OTHER_TABS = [
  { href: "/environment-sync", label: "Environment Sync", icon: GitMerge },
  { href: "/risk-analyzer", label: "Risk Analyzer", icon: Shield },
];

export default function AppNav() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const dropRef = useRef<HTMLDivElement>(null);

  const isActive = (href: string) =>
    pathname === href || pathname.startsWith(href + "/");
  const packageActive = PACKAGE_TOOLS.some((t) => isActive(t.href));

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropRef.current && !dropRef.current.contains(e.target as Node))
        setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const navLink = (active: boolean) =>
    `relative flex items-center gap-2 px-4 text-[13px] font-medium transition-colors whitespace-nowrap border-b-2 h-full
     ${active ? "text-blue-600 font-semibold border-blue-500" : "text-slate-500 hover:text-slate-800 border-transparent hover:border-slate-300"}`;

  return (
    <header className="shrink-0 flex items-stretch h-12 bg-white border-b border-slate-400">
      {/* Brand */}
      <Link
        href="/package-inspector"
        className="flex items-center gap-2.5 shrink-0 px-4 w-[320px] border-r border-slate-400"
      >
        <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-red-600 shrink-0">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            className="w-5 h-5"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M3 12L12 7L21 12V19.5L12 22L3 19.5V12Z"
              stroke="white"
              strokeWidth="1.5"
              strokeLinejoin="round"
            />
            <path
              d="M3 12L12 16.5L21 12"
              stroke="white"
              strokeWidth="1.5"
              strokeLinejoin="round"
            />
            <line
              x1="12"
              y1="16.5"
              x2="12"
              y2="22"
              stroke="white"
              strokeWidth="1.5"
            />
            <path
              d="M12 3V9M9.5 5.5L12 3L14.5 5.5"
              stroke="white"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
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
        {/* Packages dropdown */}
        <div ref={dropRef} className="relative flex items-stretch">
          <button
            onClick={() => setOpen((o) => !o)}
            className={`flex items-center gap-2 px-4 text-[13px] font-medium transition-colors whitespace-nowrap border-b-2 h-full
              ${packageActive ? "text-blue-600 font-semibold border-blue-500" : "text-slate-500 hover:text-slate-800 border-transparent hover:border-slate-300"}`}
          >
            <Package
              className={`h-3.5 w-3.5 shrink-0 ${packageActive ? "text-blue-500" : "text-slate-400"}`}
              strokeWidth={2}
            />
            Packages
            <ChevronDown
              className={`h-3 w-3 transition-transform ${open ? "rotate-180" : ""} ${packageActive ? "text-blue-500" : "text-slate-400"}`}
            />
          </button>

          {open && (
            <div className="absolute left-0 top-full z-50 w-64 bg-white border border-slate-200 shadow-lg overflow-hidden rounded-b-xl">
              {/* Caret anchor connecting dropdown to trigger button */}
              <div className="absolute -top-px left-5 w-3 h-px bg-white z-10" />
              <div className="absolute -top-1.5 left-4 w-3 h-3 bg-white border-l border-t border-slate-200 rotate-45 z-10" />
              <div className="pt-1">
                {PACKAGE_TOOLS.map(({ href, label, icon: Icon, sub }) => {
                  const active = isActive(href);
                  return (
                    <Link
                      key={href}
                      href={href}
                      onClick={() => setOpen(false)}
                      className={`flex items-start gap-3 px-4 py-3 transition-colors border-l-2 focus-visible:outline-none focus-visible:bg-blue-50
                        ${active ? "bg-blue-50 border-blue-500" : "border-transparent hover:bg-slate-50 hover:border-slate-300"}`}
                    >
                      <Icon
                        className={`h-4 w-4 shrink-0 mt-0.5 ${active ? "text-blue-500" : "text-slate-400"}`}
                        strokeWidth={2}
                      />
                      <div>
                        <p
                          className={`text-[13px] font-medium ${active ? "text-blue-700" : "text-slate-700"}`}
                        >
                          {label}
                        </p>
                        <p className="text-[11px] text-slate-400 mt-0.5">
                          {sub}
                        </p>
                      </div>
                    </Link>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Other nav items */}
        {OTHER_TABS.map(({ href, label, icon: Icon }) => {
          const active = isActive(href);
          return (
            <Link key={href} href={href} className={navLink(active)}>
              <Icon
                className={`h-3.5 w-3.5 shrink-0 ${active ? "text-blue-500" : "text-slate-400"}`}
                strokeWidth={2}
              />
              {label}
            </Link>
          );
        })}
      </nav>

      {/* Setup Instructions */}
      <div className="shrink-0 flex items-stretch border-l border-slate-400">
        <Link
          href="/setup-instructions"
          className={navLink(isActive("/setup-instructions"))}
        >
          <Terminal
            className={`h-3.5 w-3.5 shrink-0 ${isActive("/setup-instructions") ? "text-blue-500" : "text-slate-400"}`}
            strokeWidth={2}
          />
          Setup Instructions
        </Link>
      </div>
    </header>
  );
}
