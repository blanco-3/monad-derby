import { useEffect, useRef, useState } from "react";

type ChatMessage = {
  id: string;
  userId: string;
  nickname: string;
  text: string;
  timestamp: number;
  color: string;
};

// 닉네임 색상 — userId 해시 기반
const NICKNAME_COLORS = ["#7F77DD", "#1D9E75", "#EF9F27", "#E879A0", "#38BDF8", "#A78BFA", "#34D399"];
function nickColor(userId: string): string {
  let h = 0;
  for (let i = 0; i < userId.length; i++) h = (h * 31 + userId.charCodeAt(i)) >>> 0;
  return NICKNAME_COLORS[h % NICKNAME_COLORS.length]!;
}

function randomNick(userId: string): string {
  const adjs = ["Fast", "Bold", "Sharp", "Wild", "Lucky", "Calm", "Iron", "Dark"];
  const nouns = ["Trader", "Shark", "Bull", "Bear", "Moon", "Degen", "Chad", "Gem"];
  let h = 0;
  for (let i = 0; i < userId.length; i++) h = (h * 31 + userId.charCodeAt(i)) >>> 0;
  return `${adjs[h % adjs.length]}${nouns[(h >> 4) % nouns.length]}`;
}

type Props = {
  wsUrl: string;
  userId: string;
};

export function ChatPanel({ wsUrl, userId }: Props) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const nickname = randomNick(userId);
  const color = nickColor(userId);

  useEffect(() => {
    let cancelled = false;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

    const connect = () => {
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onmessage = (e) => {
        try {
          const msg = JSON.parse(e.data) as { type: string; payload: unknown };
          if (msg.type === "chat") {
            setMessages((prev) => [...prev.slice(-199), msg.payload as ChatMessage]);
          }
        } catch { /* ignore malformed */ }
      };

      ws.onclose = () => {
        if (!cancelled) reconnectTimer = setTimeout(connect, 2000);
      };
    };

    connect();
    return () => {
      cancelled = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      wsRef.current?.close();
    };
  }, [wsUrl]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const send = () => {
    const text = input.trim();
    if (!text || !wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
    wsRef.current.send(JSON.stringify({
      type: "chat",
      payload: { userId, nickname, color, text },
    }));
    setInput("");
  };

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); }
  };

  return (
    <div className="glass-panel flex h-full flex-col rounded-[28px] p-4">
      <div className="mb-3 flex items-center justify-between">
        <div className="text-[10px] uppercase tracking-[0.4em] text-muted">Live Chat</div>
        <div className="flex items-center gap-1.5">
          <div className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
          <span className="text-[10px] text-emerald-300">Live</span>
        </div>
      </div>

      {/* 메시지 목록 */}
      <div className="flex-1 overflow-y-auto space-y-1.5 pr-1 scrollbar-hide min-h-0">
        {messages.length === 0 ? (
          <div className="text-xs text-muted pt-2">첫 번째로 채팅을 시작해보세요!</div>
        ) : (
          messages.map((msg) => (
            <div key={msg.id} className="text-xs leading-relaxed">
              <span className="font-semibold" style={{ color: msg.color }}>{msg.nickname}</span>
              <span className="text-muted mx-1">·</span>
              <span className="text-slate-200 break-all">{msg.text}</span>
            </div>
          ))
        )}
        <div ref={bottomRef} />
      </div>

      {/* 내 닉네임 표시 */}
      <div className="mt-2 mb-1.5 flex items-center gap-1.5">
        <div className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: color }} />
        <span className="text-[10px] font-semibold" style={{ color }}>{nickname}</span>
      </div>

      {/* 입력창 */}
      <div className="flex gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKey}
          maxLength={120}
          placeholder="메시지 입력..."
          className="flex-1 rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-xs text-white outline-none placeholder:text-white/20 focus:border-white/20"
        />
        <button
          type="button"
          onClick={send}
          disabled={!input.trim()}
          className="rounded-xl bg-white/10 px-3 py-2 text-xs font-semibold text-white transition hover:bg-white/15 disabled:opacity-30"
        >
          전송
        </button>
      </div>
    </div>
  );
}
