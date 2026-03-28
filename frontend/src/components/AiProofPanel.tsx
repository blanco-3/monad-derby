import { useDeferredValue, useState } from "react";
import type { AiProofPayload } from "../types";

export function AiProofPanel({ items }: { items: AiProofPayload[] }) {
  const deferredItems = useDeferredValue(items);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);

  // 최신 항목 우선 표시
  const displayIndex = selectedIndex !== null && selectedIndex < deferredItems.length
    ? selectedIndex
    : deferredItems.length - 1;
  const latest = deferredItems[displayIndex] ?? null;

  return (
    <div className="glass-panel flex h-full flex-col rounded-[28px] p-5">
      <div className="mb-3 flex items-center justify-between">
        <div className="text-xs uppercase tracking-[0.35em] text-muted">AI Proof</div>
        {deferredItems.length > 1 ? (
          <div className="flex gap-1">
            {deferredItems.map((_, i) => (
              <button
                key={i}
                type="button"
                onClick={() => setSelectedIndex(i)}
                className={`h-2 w-2 rounded-full transition ${
                  i === displayIndex ? "bg-white" : "bg-white/20"
                }`}
              />
            ))}
          </div>
        ) : null}
      </div>
      {latest ? (
        <div className="space-y-3 text-sm text-slate-200">
          <div className="flex flex-wrap gap-2 text-xs">
            <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">{latest.agent}</span>
            <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 uppercase">{latest.mode}</span>
            <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">{latest.provider}</span>
            <span className={`rounded-full px-3 py-1 ${latest.fallback ? "bg-amber-500/12 text-amber-200" : "bg-emerald-500/12 text-emerald-300"}`}>
              {latest.fallback ? "fallback" : "parsed"}
            </span>
            {deferredItems.length > 0 ? (
              <span className="rounded-full bg-white/5 px-3 py-1 text-muted">
                {displayIndex + 1}/{deferredItems.length}
              </span>
            ) : null}
          </div>
          <div className="rounded-2xl border border-white/8 bg-black/30 p-4 font-mono text-xs text-slate-300">
            <div className="mb-2 text-muted">Prompt Hash</div>
            <div className="break-all text-white">{latest.promptHash}</div>
          </div>
          <div className="rounded-2xl border border-white/8 bg-black/30 p-4 text-xs text-slate-300">
            {latest.parsedDecision ? (
              <div className="font-mono">
                {latest.parsedDecision.action.toUpperCase()} {latest.parsedDecision.sizePercent}% / conf {latest.parsedDecision.confidence}
                <div className="mt-2 text-slate-400">{latest.parsedDecision.reason}</div>
              </div>
            ) : (
              <div>{latest.error ?? "No parsed decision available"}</div>
            )}
          </div>
        </div>
      ) : (
        <div className="rounded-2xl border border-white/8 bg-black/30 p-4 text-sm text-muted">
          Shadow/live mode proof logs will appear here.
        </div>
      )}
    </div>
  );
}
