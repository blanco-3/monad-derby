import { useEffect, useMemo, useRef, useState } from "react";
import type {
  AiProofPayload,
  BettingSnapshot,
  ConnectionPayload,
  DecisionPayload,
  MarketTickPayload,
  RoundEndPayload,
  RoundStatePayload,
  WsEnvelope,
} from "../types";

type Handlers = {
  onDecision?: (payload: DecisionPayload) => void;
  onMarketTick?: (payload: MarketTickPayload) => void;
  onPnlUpdate?: (payload: { agents: import("../types").AgentState[] }) => void;
  onOddsUpdate?: (payload: BettingSnapshot) => void;
  onRoundEnd?: (payload: RoundEndPayload) => void;
  onRoundState?: (payload: RoundStatePayload) => void;
  onConnection?: (payload: ConnectionPayload) => void;
  onAiProof?: (payload: AiProofPayload) => void;
};

export function useMonadWs(handlers: Handlers) {
  const wsUrl = useMemo(() => import.meta.env.VITE_AGENT_WS_URL ?? "ws://localhost:8787/ws", []);
  const handlersRef = useRef(handlers);
  const reconnectTimer = useRef<number | null>(null);
  const [connectionState, setConnectionState] = useState<"connecting" | "open" | "closed">("connecting");

  handlersRef.current = handlers;

  useEffect(() => {
    let ws: WebSocket | null = null;
    let cancelled = false;

    const connect = () => {
      setConnectionState("connecting");
      ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        setConnectionState("open");
      };

      ws.onmessage = (event) => {
        let message: WsEnvelope;
        try {
          message = JSON.parse(event.data) as WsEnvelope;
        } catch {
          return;
        }
        switch (message.type) {
          case "decision":
            handlersRef.current.onDecision?.(message.payload as DecisionPayload);
            break;
          case "marketTick":
            handlersRef.current.onMarketTick?.(message.payload as MarketTickPayload);
            break;
          case "pnlUpdate":
            handlersRef.current.onPnlUpdate?.(message.payload as { agents: import("../types").AgentState[] });
            break;
          case "oddsUpdate":
            handlersRef.current.onOddsUpdate?.(message.payload as BettingSnapshot);
            break;
          case "roundEnd":
            handlersRef.current.onRoundEnd?.(message.payload as RoundEndPayload);
            break;
          case "roundState":
            handlersRef.current.onRoundState?.(message.payload as RoundStatePayload);
            break;
          case "connection":
            handlersRef.current.onConnection?.(message.payload as ConnectionPayload);
            break;
          case "aiProof":
            handlersRef.current.onAiProof?.(message.payload as AiProofPayload);
            break;
          default:
            break;
        }
      };

      ws.onclose = () => {
        setConnectionState("closed");
        if (!cancelled) {
          reconnectTimer.current = window.setTimeout(connect, 1500);
        }
      };
    };

    connect();

    return () => {
      cancelled = true;
      if (reconnectTimer.current) {
        window.clearTimeout(reconnectTimer.current);
      }
      ws?.close();
    };
  }, [wsUrl]);

  return { connectionState };
}
