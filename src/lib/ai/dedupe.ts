import { createHash } from "node:crypto";
import { normalize } from "./evidence";

export const sha256 = (b: Buffer | string) => createHash("sha256").update(b).digest("hex");

export function textHash(text: string) {
  return sha256(normalize(text));
}

export function levenshtein(a: string, b: string) {
  const m = a.length;
  const n = b.length;
  const dp = Array.from({ length: m + 1 }, (_, i) => [i, ...Array(n).fill(0)]);
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++)
    for (let j = 1; j <= n; j++)
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return dp[m][n];
}

export const normEmail = (e: string) => e.trim().toLowerCase();
export const normPhone = (p: string) => p.replace(/\D/g, "").slice(-10);

export type DupCandidate = {
  fullName: string;
  email: string;
  phone: string;
  company?: string | null;
  skills?: string[];
};

/** Cheapest-first possible-duplicate check against another person (master §10 steps 3-4). */
export function possibleDuplicate(a: DupCandidate, b: DupCandidate): "email" | "phone" | "name" | null {
  if (a.email && normEmail(a.email) === normEmail(b.email)) return "email";
  if (a.phone && normPhone(a.phone).length >= 8 && normPhone(a.phone) === normPhone(b.phone)) return "phone";
  const na = normalize(a.fullName);
  const nb = normalize(b.fullName);
  if (na && nb && levenshtein(na, nb) <= 2) {
    const sameCo = a.company && b.company && normalize(a.company) === normalize(b.company);
    const sa = new Set((a.skills ?? []).map(normalize));
    const overlap = (b.skills ?? []).map(normalize).filter((s) => sa.has(s)).length;
    if (sameCo || overlap >= 2) return "name";
  }
  return null;
}
