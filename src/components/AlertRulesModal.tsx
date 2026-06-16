"use client";

import { useState } from "react";
import type { AlertRule, AlertTrigger } from "@/lib/logTypes";
import { X, Plus, Trash2 } from "lucide-react";

interface Props {
  rules: AlertRule[];
  triggers: AlertTrigger[];
  onSave: (rules: AlertRule[]) => void;
  onClose: () => void;
}

function fmtTime(d: Date) {
  return d.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

export default function AlertRulesModal({
  rules,
  triggers,
  onSave,
  onClose,
}: Props) {
  const [draft, setDraft] = useState<AlertRule[]>(() =>
    JSON.parse(JSON.stringify(rules)),
  );

  function update(id: string, patch: Partial<AlertRule>) {
    setDraft((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  }

  function addRule() {
    const id = `rule-${Date.now()}`;
    setDraft((prev) => [
      ...prev,
      {
        id,
        label: "New rule",
        level: "ERROR",
        thresholdCount: 5,
        windowMinutes: 1,
        enabled: true,
      },
    ]);
  }

  function removeRule(id: string) {
    setDraft((prev) => prev.filter((r) => r.id !== id));
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-xl shadow-2xl w-[560px] max-h-[80vh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200">
          <h2 className="text-[14px] font-semibold text-slate-800">
            Alert Rules
          </h2>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="overflow-y-auto flex-1 p-5 flex flex-col gap-3">
          {/* Triggers */}
          {triggers.length > 0 && (
            <div className="rounded-lg bg-red-50 border border-red-200 p-3 mb-1">
              <div className="text-[11px] font-semibold text-red-700 mb-2">
                {triggers.length} alert{triggers.length !== 1 ? "s" : ""}{" "}
                triggered
              </div>
              {triggers.map((t, i) => (
                <div key={i} className="text-[11px] text-red-600 mb-1">
                  <strong>{t.rule.label}</strong>: {t.count} events in{" "}
                  {t.rule.windowMinutes}min window starting{" "}
                  {fmtTime(t.windowStart)}
                </div>
              ))}
            </div>
          )}

          {/* Rule editor */}
          {draft.map((rule) => (
            <div
              key={rule.id}
              className="border border-slate-200 rounded-lg p-3 flex flex-col gap-2"
            >
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={rule.enabled}
                  onChange={(e) =>
                    update(rule.id, { enabled: e.target.checked })
                  }
                  className="accent-blue-600"
                />
                <input
                  type="text"
                  value={rule.label}
                  onChange={(e) => update(rule.id, { label: e.target.value })}
                  className="flex-1 text-[12px] px-2 py-1 border border-slate-200 rounded focus:outline-none focus:border-blue-400"
                />
                <button
                  onClick={() => removeRule(rule.id)}
                  className="text-slate-300 hover:text-red-500"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
              <div className="flex items-center gap-3 text-[11px] text-slate-600">
                <label className="flex items-center gap-1">
                  Level:
                  <select
                    value={rule.level}
                    onChange={(e) =>
                      update(rule.id, {
                        level: e.target.value as AlertRule["level"],
                      })
                    }
                    className="ml-1 text-[11px] px-1.5 py-1 border border-slate-200 rounded focus:outline-none"
                  >
                    {["FATAL", "ERROR", "WARN"].map((l) => (
                      <option key={l}>{l}</option>
                    ))}
                  </select>
                </label>
                <label className="flex items-center gap-1">
                  ≥
                  <input
                    type="number"
                    min={1}
                    value={rule.thresholdCount}
                    onChange={(e) =>
                      update(rule.id, {
                        thresholdCount: Number(e.target.value),
                      })
                    }
                    className="w-12 text-[11px] px-1.5 py-1 border border-slate-200 rounded text-center"
                  />
                  events in
                  <input
                    type="number"
                    min={1}
                    value={rule.windowMinutes}
                    onChange={(e) =>
                      update(rule.id, { windowMinutes: Number(e.target.value) })
                    }
                    className="w-12 text-[11px] px-1.5 py-1 border border-slate-200 rounded text-center"
                  />
                  min
                </label>
              </div>
            </div>
          ))}

          <button
            onClick={addRule}
            className="flex items-center gap-1.5 text-[12px] text-blue-600 hover:text-blue-800 self-start"
          >
            <Plus className="h-3.5 w-3.5" />
            Add rule
          </button>
        </div>

        <div className="flex justify-end gap-2 px-5 py-3 border-t border-slate-200">
          <button
            onClick={onClose}
            className="px-4 py-1.5 text-[12px] text-slate-600 hover:bg-slate-100 rounded"
          >
            Cancel
          </button>
          <button
            onClick={() => {
              onSave(draft);
              onClose();
            }}
            className="px-4 py-1.5 text-[12px] bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Save rules
          </button>
        </div>
      </div>
    </div>
  );
}
