import type { RaceRecord } from "../types";

const AGENT_COLORS: Record<string, string> = {
  Claude: "#7F77DD",
  GPT: "#1D9E75",
  Gemini: "#EF9F27",
};

const AGENT_INITIAL: Record<string, string> = {
  Claude: "C",
  GPT: "G",
  Gemini: "Gm",
};

type Props = {
  history: RaceRecord[];
};

export function RaceHistoryPanel({ history }: Props) {
  if (history.length === 0) {
    return (
      <div className="glass-panel flex items-center gap-6 rounded-[20px] px-6 py-3">
        <div className="text-xs uppercase tracking-[0.35em] text-muted shrink-0">Race History</div>
        <div className="text-xs text-muted">레이스가 끝나면 전적이 여기에 쌓입니다.</div>
      </div>
    );
  }

  // 에이전트별 승수 집계
  const wins: Record<string, number> = {};
  for (const rec of history) {
    wins[rec.winnerName] = (wins[rec.winnerName] ?? 0) + 1;
  }
  const total = history.length;

  // 최근 30개만 버블로 표시 (최신이 오른쪽)
  const recent = history.slice(-40);

  // 연승 스트릭 계산
  let streak = 1;
  for (let i = history.length - 2; i >= 0; i--) {
    if (history[i]!.winnerName === history[history.length - 1]!.winnerName) {
      streak++;
    } else break;
  }
  const latestWinner = history[history.length - 1]!.winnerName;
  const streakColor = AGENT_COLORS[latestWinner] ?? "#fff";

  return (
    <div className="glass-panel flex items-center gap-5 rounded-[20px] px-5 py-3">

      {/* 왼쪽: 타이틀 + 승수 스코어보드 */}
      <div className="shrink-0">
        <div className="mb-1.5 text-[10px] uppercase tracking-[0.4em] text-muted">Race History</div>
        <div className="flex gap-3">
          {Object.entries(AGENT_COLORS).map(([name, color]) => {
            const w = wins[name] ?? 0;
            const pct = total > 0 ? (w / total) * 100 : 0;
            return (
              <div key={name} className="flex items-center gap-1.5">
                <div className="h-2 w-2 rounded-full" style={{ backgroundColor: color }} />
                <span className="text-xs font-semibold" style={{ color }}>{name}</span>
                <span className="font-mono text-xs text-white">{w}</span>
                <span className="text-[10px] text-muted">({pct.toFixed(0)}%)</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* 구분선 */}
      <div className="h-8 w-px shrink-0 bg-white/10" />

      {/* 스트릭 뱃지 */}
      {streak >= 2 ? (
        <>
          <div className="shrink-0 rounded-xl border px-3 py-1.5 text-xs font-bold"
            style={{ borderColor: `${streakColor}40`, backgroundColor: `${streakColor}15`, color: streakColor }}>
            {latestWinner} {streak}연승 🔥
          </div>
          <div className="h-8 w-px shrink-0 bg-white/10" />
        </>
      ) : null}

      {/* 버블 히스토리 (최신 → 오른쪽) */}
      <div className="flex min-w-0 flex-1 items-center gap-1.5 overflow-x-auto scrollbar-hide">
        {recent.map((rec, i) => {
          const color = AGENT_COLORS[rec.winnerName] ?? "#888";
          const initial = AGENT_INITIAL[rec.winnerName] ?? rec.winnerName[0];
          const isLatest = i === recent.length - 1;
          return (
            <div
              key={rec.roundId}
              title={`R${rec.roundId}: ${rec.winnerName} (+${rec.finalPnls[rec.winnerIndex]?.toFixed(2)}%)`}
              className={[
                "relative flex shrink-0 items-center justify-center rounded-full font-bold transition-all",
                isLatest ? "h-9 w-9 text-xs shadow-lg" : "h-7 w-7 text-[10px]",
              ].join(" ")}
              style={{
                backgroundColor: `${color}22`,
                border: `1.5px solid ${color}${isLatest ? "cc" : "66"}`,
                color,
                boxShadow: isLatest ? `0 0 10px ${color}55` : undefined,
              }}
            >
              {initial}
              {isLatest ? (
                <span className="absolute -top-1 -right-1 flex h-3 w-3 items-center justify-center rounded-full bg-white text-[7px] font-black text-black">
                  {rec.roundId}
                </span>
              ) : null}
            </div>
          );
        })}
      </div>

      {/* 총 라운드 수 */}
      <div className="shrink-0 text-right">
        <div className="font-mono text-xl font-bold text-white">{total}</div>
        <div className="text-[10px] text-muted">rounds</div>
      </div>
    </div>
  );
}
