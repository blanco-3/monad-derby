import type { RoundStatePayload } from "../types";

type Props = {
  roundState: RoundStatePayload;
  onStart: (options: { randomnessMode: "seeded" | "full-random"; seed: string | null }) => Promise<void>;
  onStop: () => Promise<void>;
};

export function RaceControl({ roundState, onStart, onStop }: Props) {
  const live = roundState.phase === "live";
  const active = roundState.phase === "countdown" || live;
  const ended = roundState.phase === "ended";

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={() => void onStart({ randomnessMode: "full-random", seed: null })}
        disabled={active}
        className={[
          "rounded-2xl px-7 py-4 font-semibold text-base tracking-wide transition-all",
          active
            ? "cursor-not-allowed bg-white/10 text-white/40"
            : ended
              ? "bg-gradient-to-r from-violet-500 to-indigo-500 text-white shadow-[0_0_24px_rgba(139,92,246,0.4)] hover:shadow-[0_0_32px_rgba(139,92,246,0.6)]"
              : "bg-white text-black hover:bg-slate-100 shadow-[0_0_20px_rgba(255,255,255,0.15)]",
        ].join(" ")}
      >
        {active ? "Race Running..." : ended ? "New Race" : "Start Race"}
      </button>

      {live && (
        <button
          type="button"
          onClick={() => void onStop()}
          className="rounded-2xl border border-rose-500/40 bg-rose-500/10 px-4 py-4 text-sm font-semibold text-rose-400 transition-all hover:bg-rose-500/20"
        >
          Stop
        </button>
      )}
    </div>
  );
}
