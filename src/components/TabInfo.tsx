import Link from "next/link";
import { Info, BookOpen } from "lucide-react";

interface TabInfoProps {
  title: string;
  what: string;
  how?: string;
  helps?: string;
  avoids?: string;
  guideHref?: string;
}

export default function TabInfo({ title, what, guideHref }: TabInfoProps) {
  return (
    <div className="shrink-0 flex items-center gap-2.5 px-5 py-2.5 border-b border-slate-200 bg-white">
      <Info className="h-3.5 w-3.5 text-slate-400 shrink-0" />
      <span className="flex-1 text-xs text-slate-500">
        <span className="font-semibold text-slate-700">{title} — </span>
        {what}
      </span>
      {guideHref && (
        <Link
          href={guideHref}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1.5 text-[11px] font-medium text-white bg-slate-800 border border-slate-700 hover:bg-white hover:text-slate-900 hover:border-slate-300 px-2.5 py-1 rounded-md transition-all hover:-translate-y-0.5 hover:shadow-md shrink-0"
        >
          <BookOpen className="h-3 w-3" />
          Developer Guide
        </Link>
      )}
    </div>
  );
}
