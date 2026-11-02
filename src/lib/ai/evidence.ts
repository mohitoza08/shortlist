export function normalize(s: string) {
  return s
    .toLowerCase()
    .normalize("NFKC")
    .replace(/[​-‍﻿]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** A quote is evidence only if it is a verbatim substring of the CV text after normalisation. */
export function isGrounded(quote: string | null | undefined, resumeText: string) {
  if (!quote) return false;
  const q = normalize(quote);
  if (q.length < 12) return false;
  return normalize(resumeText).includes(q);
}

/** Confidence after grounding checks (master §9.7). */
export function adjustConfidence(opts: {
  raw: number;
  grounded: boolean;
  quote: string | null | undefined;
  lowQuality: boolean;
  requiresQuote: boolean;
}) {
  let c = Math.min(1, Math.max(0, opts.raw));
  if (opts.requiresQuote && !opts.grounded) return 0;
  if (opts.quote && normalize(opts.quote).length < 12) c = Math.min(c, 0.3);
  if (opts.lowQuality) c = Math.min(c, 0.5);
  return Math.round(c * 100) / 100;
}

export function confidenceBand(c: number): "High" | "Medium" | "Low" {
  if (c >= 0.8) return "High";
  if (c >= 0.6) return "Medium";
  return "Low";
}
