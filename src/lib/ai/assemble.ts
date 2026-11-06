import { adjustConfidence, isGrounded } from "./evidence";
import { lineContaining, skillTerms } from "./heuristic";
import type { CvExtraction } from "./schema";
import { overall, overallConfidence, scoreStructured, skillMatch, type CriterionType, type Reqmt } from "./score";

export type CriterionRow = {
  id: string;
  label: string;
  type: CriterionType;
  weight: number;
  mustHave: boolean;
};

export type ScoredRow = {
  criterionId: string;
  score: number;
  evidenceQuote: string | null;
  grounded: boolean;
  confidence: number;
};

export type Assembled = {
  rows: ScoredRow[];
  overallScore: number;
  confidence: number;
  reasons: string[];
};

/**
 * Combine model/heuristic extraction with deterministic scoring.
 * Quotes are verified against the full resume text. If the model's quote is not verbatim we look for a real
 * line in the CV ourselves; if there is none, the criterion is marked ungrounded and gets no credit.
 */
export function assemble(
  criteria: CriterionRow[],
  req: Reqmt,
  x: CvExtraction,
  resumeText: string,
  lowQuality = false,
): Assembled {
  const rows: ScoredRow[] = [];
  const reasons: string[] = [];
  const profile = {
    yearsExperience: x.yearsExperience,
    noticeDays: x.noticeDays,
    expectedCtcLpa: x.expectedCtcLpa,
    location: x.location,
  };

  for (const c of criteria) {
    let score = 0;
    let quote: string | null = null;
    let raw = 0.5;
    let requiresQuote = true;

    if (c.type === "SKILL" || c.type === "CUSTOM") {
      const item = x.criteria.find((i) => i.label.toLowerCase() === c.label.toLowerCase());
      const claimed = item?.found || skillMatch(c.label, x.skills) > 0;
      quote = item?.quote ?? null;
      raw = item?.confidence ?? 0.4;
      if (claimed && !isGrounded(quote, resumeText)) {
        quote = lineContaining(resumeText, skillTerms(c.label));
      }
      const grounded = isGrounded(quote, resumeText);
      if (c.type === "CUSTOM") {
        score = grounded ? Math.round(item?.score ?? 0) : 0;
      } else if (grounded) {
        score = item?.related && !item.found ? 50 : 100;
      }
      if (!grounded && claimed) reasons.push(`Could not verify evidence for “${c.label}”`);
      if (!grounded && !claimed) raw = Math.max(raw, 0.6); // a confident "not found" is not a failure
      requiresQuote = grounded || claimed;
      const conf = adjustConfidence({ raw, grounded, quote, lowQuality, requiresQuote });
      rows.push({ criterionId: c.id, score, evidenceQuote: grounded ? quote : null, grounded, confidence: conf });
      continue;
    }

    const ev =
      c.type === "EXPERIENCE"
        ? x.experienceEvidence
        : c.type === "NOTICE"
          ? x.noticeEvidence
          : c.type === "LOCATION"
            ? x.locationEvidence
            : x.ctcEvidence;
    score = scoreStructured(c.type, profile, req) ?? 0;
    quote = ev.quote;
    raw = ev.confidence;
    const stated =
      c.type === "EXPERIENCE"
        ? profile.yearsExperience != null
        : c.type === "NOTICE"
          ? profile.noticeDays != null
          : c.type === "LOCATION"
            ? !!profile.location
            : profile.expectedCtcLpa != null;
    const grounded = isGrounded(quote, resumeText);
    if (stated && !grounded) reasons.push(`Could not verify a line for “${c.label}”`);
    if (!stated) raw = 0.3; // not stated is scored neutrally and shown as low confidence, not as a failure
    // Unstated values are scored neutrally, not as a quote failure.
    const conf = adjustConfidence({ raw, grounded, quote, lowQuality, requiresQuote: stated });
    rows.push({ criterionId: c.id, score, evidenceQuote: grounded ? quote : null, grounded, confidence: conf });
  }

  const weighted = criteria.map((c, i) => ({ weight: c.weight, score: rows[i].score, confidence: rows[i].confidence }));
  const conf = overallConfidence(weighted);
  if (conf < 0.7) reasons.push("Overall confidence is below 0.70");
  if (lowQuality) reasons.push("Low-quality text extraction");
  return { rows, overallScore: overall(weighted), confidence: conf, reasons: Array.from(new Set(reasons)) };
}
