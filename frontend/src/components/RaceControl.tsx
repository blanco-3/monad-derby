import type { RoundStatePayload } from "../types";

type Props = {
  roundState: RoundStatePayload;
  onStart: (options: { randomnessMode: "seeded" | "full-random"; seed: string | null }) => Promise<void>;
};

export function RaceControl({ roundState, onStart }: Props) {
  const active = roundState.phase === "countdown" || roundState.phase === "live";
  const ended = roundState.phase === "ended";

  return (
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
  );
}
