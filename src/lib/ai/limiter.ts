/**
 * Sliding-window limiter for the provider's free-tier limits (master §9.8).
 * In-memory: good for one server instance. Production needs a shared store (see TDD).
 */
type Limits = { rpm: number; tpm: number; rpd: number; tpd: number };

const limits: Limits = {
  rpm: Number(process.env.AI_RPM ?? 28),
  tpm: Number(process.env.AI_TPM ?? 7500),
  rpd: Number(process.env.AI_RPD ?? 950),
  tpd: Number(process.env.AI_TPD ?? 190000),
};

type Hit = { at: number; tokens: number };
const hits: Hit[] = [];
let blockedUntil = 0;

const MIN = 60_000;
const DAY = 86_400_000;

function prune(now: number) {
  while (hits.length && now - hits[0].at > DAY) hits.shift();
}

/** Seconds to wait before a call of `tokens` may run; 0 means go now. */
export function waitSeconds(tokens: number, now = Date.now()) {
  prune(now);
  if (now < blockedUntil) return Math.ceil((blockedUntil - now) / 1000);
  const day = hits;
  const minute = hits.filter((h) => now - h.at <= MIN);
  const dayTokens = day.reduce((a, h) => a + h.tokens, 0);
  if (day.length + 1 > limits.rpd || dayTokens + tokens > limits.tpd) {
    return Math.ceil((day[0].at + DAY - now) / 1000);
  }
  const minTokens = minute.reduce((a, h) => a + h.tokens, 0);
  if (minute.length + 1 > limits.rpm || minTokens + tokens > limits.tpm) {
    return Math.max(1, Math.ceil((minute[0].at + MIN - now) / 1000));
  }
  return 0;
}

export function record(tokens: number, now = Date.now()) {
  hits.push({ at: now, tokens });
}

/** Called on a provider 429 with its retry-after header. */
export function backOff(retryAfterSeconds: number, now = Date.now()) {
  blockedUntil = Math.max(blockedUntil, now + retryAfterSeconds * 1000);
}

export function resetLimiter() {
  hits.length = 0;
  blockedUntil = 0;
}
