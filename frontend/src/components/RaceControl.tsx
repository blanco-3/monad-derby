import type { RoundStatePayload } from "../types";
import { useEffect, useState } from "react";

type Props = {
  roundState: RoundStatePayload;
  onStart: (options: { randomnessMode: "seeded" | "full-random"; seed: string | null }) => Promise<void>;
};

export function RaceControl({ roundState, onStart }: Props) {
  const active = roundState.phase === "countdown" || roundState.phase === "live";
  const [randomnessMode, setRandomnessMode] = useState<"seeded" | "full-random">("seeded");
  const [seedInput, setSeedInput] = useState("monad-derby");

  useEffect(() => {
    setRandomnessMode(roundState.randomnessMode);
    if (roundState.randomnessMode === "seeded" && roundState.seed) {
      setSeedInput(roundState.seed);
    }
  }, [roundState.phase, roundState.randomnessMode, roundState.seed]);

  const normalizedSeed = randomnessMode === "seeded" ? seedInput.trim() || "monad-derby" : null;

  return (
    <div className="glass-panel flex items-center gap-3 rounded-2xl px-4 py-3">
      <div className="flex rounded-2xl border border-white/10 bg-white/5 p-1">
        {(["seeded", "full-random"] as const).map((mode) => (
          <button
            key={mode}
            type="button"
            disabled={active}
            onClick={() => setRandomnessMode(mode)}
            className={`rounded-xl px-3 py-2 text-xs font-semibold uppercase tracking-[0.2em] transition ${
              randomnessMode === mode ? "bg-white text-black" : "text-slate-300"
            }`}
          >
            {mode === "seeded" ? "Seeded" : "Random"}
          </button>
        ))}
      </div>
      <input
        type="text"
        value={seedInput}
        disabled={active || randomnessMode !== "seeded"}
        onChange={(event) => setSeedInput(event.target.value)}
        placeholder="seed"
        className="w-[180px] rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-white outline-none disabled:opacity-40"
      />
      <button
        type="button"
        onClick={() => setSeedInput(crypto.randomUUID().slice(0, 8))}
        disabled={active || randomnessMode !== "seeded"}
        className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-xs font-semibold uppercase tracking-[0.2em] text-white disabled:opacity-40"
      >
        Shuffle
      </button>
      <button
        type="button"
        onClick={() => void onStart({ randomnessMode, seed: normalizedSeed })}
        disabled={active}
        className="rounded-2xl border border-white/10 bg-white px-6 py-4 font-semibold text-black transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:bg-white/15 disabled:text-white/50"
      >
        {roundState.phase === "ended" ? "New Race" : active ? "Race Running" : "Start Race"}
      </button>
    </div>
  );
}
