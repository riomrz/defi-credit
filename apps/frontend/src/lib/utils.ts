import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatAmount(amount: string | number, decimals = 2): string {
  const num = typeof amount === "string" ? parseFloat(amount) : amount;
  if (isNaN(num)) return "0";
  if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(decimals)}M`;
  if (num >= 1_000) return `${(num / 1_000).toFixed(decimals)}K`;
  return num.toFixed(decimals);
}

export function formatNanos(nanos: string | bigint): string {
  const n = typeof nanos === "string" ? BigInt(nanos) : nanos;
  const iota = n / BigInt(1_000_000_000);
  return `${iota.toString()} IOTA`;
}

export function shortenDid(did: string, chars = 8): string {
  if (did.length <= chars * 2 + 3) return did;
  return `${did.slice(0, chars)}...${did.slice(-chars)}`;
}

export function shortenHash(hash: string, chars = 6): string {
  if (!hash) return "";
  return `${hash.slice(0, chars)}...${hash.slice(-chars)}`;
}

export function getRiskBandColor(band: string): string {
  const map: Record<string, string> = {
    A: "text-emerald-400 bg-emerald-900/40 border-emerald-600/40",
    B: "text-sky-400 bg-sky-900/40 border-sky-600/40",
    C: "text-amber-400 bg-amber-900/40 border-amber-600/40",
    D: "text-rose-400 bg-rose-900/40 border-rose-600/40",
  };
  return map[band] ?? "text-gray-400 bg-gray-800 border-gray-600";
}

export function getScoreColor(score: number): string {
  if (score >= 80) return "text-emerald-400";
  if (score >= 65) return "text-sky-400";
  if (score >= 50) return "text-amber-400";
  return "text-rose-400";
}

export function getMetricBarColor(score: number): string {
  if (score >= 80) return "bg-emerald-500";
  if (score >= 65) return "bg-sky-500";
  if (score >= 50) return "bg-amber-500";
  return "bg-rose-500";
}

export function mockDid(seed: string): string {
  const hash = Array.from(seed).reduce((acc, c) => (acc * 31 + c.charCodeAt(0)) | 0, 0);
  return `did:iota:tst:0x${Math.abs(hash).toString(16).padStart(40, "0")}`;
}

export function mockAddress(did: string): string {
  return `0x${did.replace("did:iota:tst:0x", "").padStart(40, "0")}`;
}
