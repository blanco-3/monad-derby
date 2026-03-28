import { createHash } from "node:crypto";
import type { AgentConfig } from "./AgentConfig.js";
import type { IStrategy, MarketData, RaceDecision } from "./IStrategy.js";
import { clamp, safeParseJson } from "../utils.js";

export interface AiProofEvent {
  agent: string;
  provider: "anthropic" | "openai" | "google";
  model: string;
  mode: "shadow" | "live";
  promptHash: string;
  rawResponse: string;
  parsedDecision?: RaceDecision;
  fallback: boolean;
  error?: string;
  timestamp: number;
}

type Options = {
  mode: "disabled" | "shadow" | "live";
  maxCallsPerRound: number;
  roundDurationSeconds: number;
  onProof?: (proof: AiProofEvent) => void;
};

export class AIStrategy implements IStrategy {
  name = "AIStrategy";
  private readonly callCheckpoints: number[];
  private callCount = 0;
  private attemptedCheckpoints = new Set<number>();

  constructor(
    private readonly config: AgentConfig,
    private readonly fallback: IStrategy,
    private readonly options: Options,
  ) {
    this.callCheckpoints = buildCheckpoints(options.maxCallsPerRound, options.roundDurationSeconds);
  }

  async decide(marketData: MarketData): Promise<RaceDecision> {
    const baseDecision = await this.fallback.decide(marketData);

    if (this.options.mode === "disabled") {
      return baseDecision;
    }

    const checkpoint = this.getCheckpoint(marketData.elapsed);
    if (checkpoint === null) {
      return baseDecision;
    }
    this.attemptedCheckpoints.add(checkpoint);

    if (!this.config.aiConfig?.apiKey) {
      this.emitProof({
        fallback: true,
        mode: this.options.mode,
        promptHash: hashPrompt(`missing-key:${this.config.name}:${checkpoint}`),
        rawResponse: "",
        error: "missing api key",
      });
      return this.options.mode === "live" ? { ...baseDecision, source: "fallback" } : baseDecision;
    }

    const prompt = buildPrompt(marketData, this.config.name);
    const promptHash = hashPrompt(prompt);

    try {
      const responseText = await withTimeout(callProvider(this.config, prompt), 5_000);
      const parsed = normalizeDecision(safeParseJson<Partial<RaceDecision>>(responseText));

      this.emitProof({
        fallback: !parsed,
        mode: this.options.mode,
        promptHash,
        rawResponse: responseText,
        parsedDecision: parsed ?? undefined,
        error: parsed ? undefined : "invalid ai decision",
      });

      if (!parsed) {
        return this.options.mode === "live" ? { ...baseDecision, source: "fallback" } : baseDecision;
      }

      return this.options.mode === "live" ? parsed : baseDecision;
    } catch (error) {
      this.emitProof({
        fallback: true,
        mode: this.options.mode,
        promptHash,
        rawResponse: "",
        error: error instanceof Error ? error.message : "ai request failed",
      });
      return this.options.mode === "live" ? { ...baseDecision, source: "fallback" } : baseDecision;
    }
  }

  private getCheckpoint(elapsedSeconds: number): number | null {
    if (this.callCount >= this.options.maxCallsPerRound) return null;

    const checkpoint = this.callCheckpoints.find((target, index) => elapsedSeconds >= target && !this.attemptedCheckpoints.has(index));
    if (checkpoint === undefined) return null;

    const index = this.callCheckpoints.indexOf(checkpoint);
    this.callCount += 1;
    return index;
  }

  private emitProof(partial: Omit<AiProofEvent, "agent" | "provider" | "model" | "timestamp">) {
    if (!this.options.onProof) return;

    const provider = this.config.aiConfig?.provider ?? providerForAgent(this.config.name);
    const model = this.config.aiConfig?.model ?? "unconfigured";
    this.options.onProof({
      agent: this.config.name,
      provider,
      model,
      timestamp: Date.now(),
      ...partial,
    });
  }
}

function buildCheckpoints(maxCalls: number, roundDurationSeconds: number): number[] {
  if (maxCalls <= 0) return [];
  if (maxCalls === 1) return [8];
  return [8, Math.max(12, Math.floor(roundDurationSeconds / 2))].slice(0, maxCalls);
}

function normalizeDecision(parsed: Partial<RaceDecision> | null): RaceDecision | null {
  if (!parsed) return null;
  if (parsed.action !== "long" && parsed.action !== "short" && parsed.action !== "flat") {
    return null;
  }

  return {
    action: parsed.action,
    sizePercent: Math.round(clamp(Number(parsed.sizePercent ?? 0), 0, 100)),
    confidence: Math.round(clamp(Number(parsed.confidence ?? 0), 0, 100)),
    reason: typeof parsed.reason === "string" && parsed.reason.trim() ? parsed.reason.trim() : "AI directional bias",
    source: "ai",
  };
}

function buildPrompt(marketData: MarketData, agentName: string): string {
  return JSON.stringify({
    instruction:
      "Return strict JSON only: { action: 'long'|'short'|'flat', sizePercent: number, confidence: number, reason: string }.",
    agent: agentName,
    market: {
      symbol: marketData.symbol,
      price: Number(marketData.price.toFixed(2)),
      recentReturns: marketData.recentReturns,
      volatility: Number(marketData.volatility.toFixed(6)),
      regime: marketData.regime,
      elapsed: marketData.elapsed,
      roundDuration: marketData.roundDuration,
      seed: marketData.seed,
      history: marketData.history.slice(-12).map((point) => ({
        timestamp: point.timestamp,
        price: Number(point.price.toFixed(2)),
        source: point.source,
      })),
      currentPosition: marketData.currentPosition,
      portfolio: marketData.portfolio,
      leaderboard: marketData.leaderboard,
    },
  });
}

function hashPrompt(prompt: string): string {
  return createHash("sha256").update(prompt).digest("hex");
}

function providerForAgent(agentName: string): "anthropic" | "openai" | "google" {
  switch (agentName) {
    case "Claude":
      return "anthropic";
    case "GPT":
      return "openai";
    case "Gemini":
      return "google";
    default:
      return "openai";
  }
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  return await Promise.race<T>([
    promise,
    new Promise<T>((_, reject) => {
      const timer = setTimeout(() => {
        clearTimeout(timer);
        reject(new Error("ai request timeout"));
      }, timeoutMs);
    }),
  ]);
}

async function callProvider(config: AgentConfig, prompt: string): Promise<string> {
  if (!config.aiConfig) {
    throw new Error("missing ai config");
  }

  const { provider, apiKey, model } = config.aiConfig;

  if (provider === "anthropic") {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model,
        max_tokens: 200,
        messages: [{ role: "user", content: prompt }],
      }),
    });
    if (!response.ok) {
      throw new Error(`anthropic request failed (${response.status})`);
    }

    const data = (await response.json()) as { content?: Array<{ type: string; text?: string }> };
    return data.content?.find((entry) => entry.type === "text")?.text ?? "";
  }

  if (provider === "openai") {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        temperature: 0.2,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content: "Respond with JSON only.",
          },
          {
            role: "user",
            content: prompt,
          },
        ],
      }),
    });
    if (!response.ok) {
      throw new Error(`openai request failed (${response.status})`);
    }

    const data = (await response.json()) as { choices?: Array<{ message?: { content?: string } }> };
    return data.choices?.[0]?.message?.content ?? "";
  }

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
      }),
    },
  );
  if (!response.ok) {
    throw new Error(`google request failed (${response.status})`);
  }

  const data = (await response.json()) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  };
  return data.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
}
