import { useDeferredValue, useEffect, useRef } from "react";
import type { DecisionPayload } from "../types";

type Props = {
  items: DecisionPayload[];
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
    <div className="glass-panel flex h-full flex-col rounded-[28px] p-5">
      <div className="mb-3 text-xs uppercase tracking-[0.35em] text-muted">Decision Feed</div>
      <div ref={containerRef} className="flex-1 overflow-y-auto rounded-2xl border border-white/8 bg-black/40 px-4 py-3 font-mono text-sm">
        {deferredItems.length === 0 ? (
          <div className="text-muted">Waiting for the first race signal...</div>
        ) : (
          deferredItems.map((item) => (
            <div key={item.eventId} className="mb-2 animate-riseIn">
              <span className="text-muted">[t+{item.elapsedSeconds.toFixed(1)}s]</span>{" "}
              <span style={{ color: item.color }}>{item.agent}</span>{" "}
              <span className="text-white">{item.action.toUpperCase()}</span>{" "}
              <span className="text-slate-300">{item.sizePercent}%</span>{" "}
              <span className="text-muted">@</span>{" "}
              <span className="text-slate-200">${item.price.toFixed(2)}</span>{" "}
              <span className="text-muted">|</span>{" "}
              <span className="text-slate-300">{item.reason}</span>{" "}
              <span className="text-muted">|</span>{" "}
              <span className="text-slate-200">{item.source.toUpperCase()}</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
