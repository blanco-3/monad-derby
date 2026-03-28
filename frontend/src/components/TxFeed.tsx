import { useDeferredValue, useEffect, useRef } from "react";
import type { DecisionPayload } from "../types";

type Props = {
  items: DecisionPayload[];
};

const ACTION_COLORS: Record<string, string> = {
  long: "#34d399",
  short: "#f87171",
  flat: "#94a3b8",
};

export function TxFeed({ items }: Props) {
  const deferredItems = useDeferredValue(items);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    container.scrollTop = container.scrollHeight;
  }, [deferredItems]);

  return (
    <div className="glass-panel flex h-full flex-col rounded-[28px] p-4">
      <div className="mb-2 flex items-center gap-2">
        <span className="text-[10px] uppercase tracking-[0.35em] text-muted">Decision Feed</span>
        <span className="text-[10px] text-muted/50">{deferredItems.length} entries</span>
      </div>
      <div
        ref={containerRef}
        className="flex-1 min-h-0 overflow-y-auto rounded-2xl border border-white/8 bg-black/40 px-3 py-2 font-mono"
      >
        {deferredItems.length === 0 ? (
          <div className="text-xs text-muted pt-1">Waiting for the first race signal...</div>
        ) : (
          deferredItems.map((item) => (
            <div key={item.eventId} className="flex items-baseline gap-1.5 py-[1px] text-[11px] leading-[1.45] animate-riseIn">
              <span className="shrink-0 text-muted/60 w-[38px]">+{item.elapsedSeconds.toFixed(1)}s</span>
              <span className="shrink-0 w-[44px] font-semibold" style={{ color: item.color }}>{item.agent}</span>
              <span
                className="shrink-0 w-[36px] font-bold"
                style={{ color: ACTION_COLORS[item.action] ?? "#fff" }}
              >
                {item.action.toUpperCase()}
              </span>
              <span className="shrink-0 text-slate-400 w-[32px]">{item.sizePercent}%</span>
              <span className="shrink-0 text-slate-300 w-[72px]">${item.price.toFixed(0)}</span>
              <span className="truncate text-muted/70">{item.reason}</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
