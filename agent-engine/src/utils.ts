import { formatEther } from "ethers";

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function average(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

export function stdDev(values: number[]): number {
  if (values.length < 2) return 0;
  const mean = average(values);
  const variance = average(values.map((value) => (value - mean) ** 2));
  return Math.sqrt(variance);
}

export function safeParseJson<T>(value: string): T | null {
  try {
    return JSON.parse(value) as T;
  } catch {
    const match = value.match(/\{[\s\S]*\}/);
    if (!match) return null;
    try {
      return JSON.parse(match[0]) as T;
    } catch {
      return null;
    }
  }
}

export function rankDescending(values: number[]): number[] {
  const sorted = [...values]
    .map((value, index) => ({ value, index }))
    .sort((a, b) => b.value - a.value);
  const ranks = Array.from({ length: values.length }, () => 0);
  sorted.forEach((entry, index) => {
    ranks[entry.index] = index + 1;
  });
  return ranks;
}

export function formatMon(amount: bigint): number {
  return Number(formatEther(amount));
}

export function roundTo(value: number, precision = 2): number {
  return Number(value.toFixed(precision));
}

export function hashString(value: string): string {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

export function createSeededRandom(seed: string): () => number {
  let state = hashString(seed)
    .split("")
    .reduce((acc, char) => ((acc << 5) - acc + char.charCodeAt(0)) >>> 0, 0x9e3779b9);

  return () => {
    state += 0x6d2b79f5;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function pickOne<T>(items: readonly T[], random: () => number): T {
  const index = Math.min(items.length - 1, Math.floor(random() * items.length));
  return items[index]!;
}

export function uid(prefix: string, timestamp = Date.now()): string {
  return `${prefix}_${timestamp}_${Math.floor(Math.random() * 1_000_000).toString(16).padStart(5, "0")}`;
}
