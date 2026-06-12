import { Info, BookOpen } from "lucide-react";

interface TabInfoProps {
  title: string;
  what: string;
  how?: string;
  helps?: string;
  avoids?: string;
  onGuide?: () => void;
}

export default function TabInfo({ title, what, onGuide }: TabInfoProps) {
  return (
    <div className="shrink-0 flex items-center gap-2.5 px-5 py-1.5 mt-1.5 bg-slate-800 border-b border-slate-700">
      <Info className="h-3.5 w-3.5 text-slate-500 shrink-0" />
      <span className="flex-1 text-xs text-slate-400">
        <span className="font-semibold text-white">{title} — </span>
        {what}
      </span>
      {onGuide && (
        <button
          onClick={onGuide}
          className="flex items-center gap-1 text-[11px] font-semibold text-slate-400 hover:text-white transition-colors shrink-0 group"
        >
          <BookOpen className="h-3 w-3" />
          <span className="underline underline-offset-2 decoration-slate-600 group-hover:decoration-slate-300">Developer Guide</span>
        </button>
      )}
    </div>
  );
}
