import { createServer } from "node:http";
import cors from "cors";
import express from "express";
import { WebSocketServer } from "ws";
import { loadConfig } from "./config.js";
import { RoundManager } from "./engine/RoundManager.js";
import type { AiProofEvent } from "./agents/AIStrategy.js";
import { ChainRuntime } from "./runtime/ChainRuntime.js";
import { MockRuntime } from "./runtime/MockRuntime.js";
import type { RuntimeAdapter } from "./runtime/RuntimeAdapter.js";

const app = express();
const requestedConfig = loadConfig();
let runtime: RuntimeAdapter = requestedConfig.mode === "chain" ? new ChainRuntime(requestedConfig) : new MockRuntime(requestedConfig);
let fallback = false;

try {
  await runtime.init();
} catch (error) {
  if (requestedConfig.mode === "chain") {
    fallback = true;
    runtime = new MockRuntime({ ...requestedConfig, mode: "mock" });
    await runtime.init();
  } else {
    throw error;
  }
}

const manager = new RoundManager(runtime, { ...requestedConfig, mode: runtime.mode });
const server = createServer(app);
const wss = new WebSocketServer({ server, path: "/ws" });
const aiProofs: AiProofEvent[] = [];

type RaceRecord = {
  roundId: number;
  winnerIndex: number;
  winnerName: string;
  finalPnls: number[];
  endedAt: number;
  proofHash: string;
};
const raceHistory: RaceRecord[] = [];
let connectionInfo = {
  mode: runtime.mode,
  fallback,
  aiMode: requestedConfig.race.aiExecutionMode,
  priceFeedMode: requestedConfig.race.priceFeedMode,
  randomnessMode: requestedConfig.race.randomnessMode,
};

app.use(cors({ origin: requestedConfig.corsOrigin }));
app.use(express.json());

function broadcast(type: string, payload: unknown) {
  const message = JSON.stringify({ type, payload });
  for (const client of wss.clients) {
    if (client.readyState === client.OPEN) {
      client.send(message);
    }
  }
}

manager.on("connection", (payload) => {
  connectionInfo = { ...payload, fallback };
  broadcast("connection", connectionInfo);
});
manager.on("marketTick", (payload) => broadcast("marketTick", payload));
manager.on("decision", (payload) => broadcast("decision", payload));
manager.on("pnlUpdate", (payload) => broadcast("pnlUpdate", payload));
manager.on("oddsUpdate", (payload) => broadcast("oddsUpdate", payload));
manager.on("roundState", (payload) => broadcast("roundState", payload));
manager.on("roundEnd", (payload) => {
  raceHistory.push({
    roundId: payload.roundId,
    winnerIndex: payload.winnerIndex,
    winnerName: payload.winnerName,
    finalPnls: payload.finalPnls,
    endedAt: payload.endedAt,
    proofHash: payload.proofHash,
  });
  if (raceHistory.length > 100) raceHistory.shift();
  broadcast("roundEnd", payload);
  broadcast("historyUpdate", raceHistory);
});
manager.on("aiProof", (payload) => {
  aiProofs.push(payload);
  if (aiProofs.length > 24) {
    aiProofs.shift();
  }
  broadcast("aiProof", payload);
});

await manager.init();

app.get("/api/status", async (_req, res) => {
  res.json({
    status: await manager.getStatus(),
    betting: await runtime.getBettingSnapshot(),
    fallback,
    connection: connectionInfo,
    proofs: aiProofs,
    history: raceHistory,
  });
});

app.get("/api/history", (_req, res) => {
  res.json({ history: raceHistory });
});

app.get("/api/agents", async (_req, res) => {
  res.json({
    agents: await manager.getAgents(),
  });
});

app.post("/api/start", async (req, res) => {
  try {
    const durationSeconds = Number(req.body?.durationSeconds ?? requestedConfig.roundDurationSeconds);
    const randomnessMode = req.body?.randomnessMode === "full-random" ? "full-random" : req.body?.randomnessMode === "seeded" ? "seeded" : undefined;
    const seed = typeof req.body?.seed === "string" ? req.body.seed : undefined;
    const status = await manager.startRound(durationSeconds, { randomnessMode, seed });
    res.json({ ok: true, status });
  } catch (error) {
    res.status(400).json({ ok: false, error: error instanceof Error ? error.message : "failed to start round" });
  }
});

app.post("/api/bet", async (req, res) => {
  if (!runtime.placeBet) {
    res.status(400).json({ ok: false, error: "mock betting only" });
    return;
  }

  try {
    const userId = String(req.body?.userId ?? "demo-user");
    const agentIndex = Number(req.body?.agentIndex);
    const amount = Number(req.body?.amount);
    const bet = await manager.placeBet(userId, agentIndex, amount);
    res.json({ ok: true, bet });
  } catch (error) {
    res.status(400).json({ ok: false, error: error instanceof Error ? error.message : "failed to place bet" });
  }
});

wss.on("connection", async (socket) => {
  socket.send(JSON.stringify({ type: "connection", payload: connectionInfo }));
  socket.send(JSON.stringify({ type: "roundState", payload: await manager.getStatus() }));
  socket.send(JSON.stringify({ type: "pnlUpdate", payload: { agents: await manager.getAgents() } }));
  socket.send(JSON.stringify({ type: "oddsUpdate", payload: await runtime.getBettingSnapshot() }));
  aiProofs.forEach((proof) => {
    socket.send(JSON.stringify({ type: "aiProof", payload: proof }));
  });
  if (raceHistory.length > 0) {
    socket.send(JSON.stringify({ type: "historyUpdate", payload: raceHistory }));
  }

  // Chat relay: broadcast incoming chat messages to all clients
  socket.on("message", (data) => {
    let msg: { type: string; payload: unknown };
    try {
      msg = JSON.parse(data.toString()) as { type: string; payload: unknown };
    } catch {
      return;
    }
    if (msg.type === "chat" && msg.payload && typeof msg.payload === "object") {
      const p = msg.payload as Record<string, unknown>;
      const chatMsg = {
        id: crypto.randomUUID(),
        userId: String(p.userId ?? ""),
        nickname: String(p.nickname ?? ""),
        text: String(p.text ?? "").slice(0, 120),
        timestamp: Date.now(),
        color: String(p.color ?? "#fff"),
      };
      broadcast("chat", chatMsg);
    }
  });
});

server.listen(requestedConfig.port, () => {
  console.log(`[agent-engine] listening on http://localhost:${requestedConfig.port}`);
  console.log(`[agent-engine] ws://localhost:${requestedConfig.port}/ws (${runtime.mode}${fallback ? ", fallback" : ""})`);
});
