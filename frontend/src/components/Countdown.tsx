import { useEffect, useMemo, useState } from "react";
import type { RoundStatePayload } from "../types";

type Props = {
  roundState: RoundStatePayload;
};

export function Countdown({ roundState }: Props) {
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(timer);
  }, []);

  const content = useMemo(() => {
    if (roundState.phase === "countdown" && roundState.countdownRemaining !== null) {
      return {
        label: `START IN ${Math.max(1, roundState.countdownRemaining)}`,
        danger: false,
      };
    }

    if (roundState.phase !== "live" || !roundState.endsAt) {
      return { label: "READY", danger: false };
    }

    if (roundState.startedAt && now - roundState.startedAt < 1400) {
      return { label: "GO", danger: false };
    }

    const remainingMs = Math.max(0, roundState.endsAt - now);
    const seconds = Math.floor(remainingMs / 1000);
    const mm = String(Math.floor(seconds / 60)).padStart(2, "0");
    const ss = String(seconds % 60).padStart(2, "0");
    return { label: `${mm}:${ss}`, danger: seconds <= 10 };
  }, [now, roundState]);

  return (
    <div className="glass-panel min-w-[220px] rounded-2xl px-5 py-4 text-center">
      <div className="text-xs uppercase tracking-[0.35em] text-muted">Round Clock</div>
      <div
        className={[
          "mt-2 font-mono text-4xl font-semibold tracking-[0.2em]",
          content.danger ? "text-red-400 animate-pulseWarn" : "text-white",
        ].join(" ")}
      >
        {content.label}
      </div>
    </div>
  );
}
