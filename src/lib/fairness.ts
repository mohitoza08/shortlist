/**
 * Weekly AI-vs-recruiter sample (master §5 Fairness tab). Pure so it can be tested.
 * AI top-10 = the ten highest overall scores. "Recruiter set" = candidates submitted to the client.
 */
export type SampleApp = { id: string; score: number | null; submitted: boolean };

export type FairnessRow = {
  aiTop: number;
  submitted: number;
  overlapPct: number | null;
  avgAiRankOfSubmitted: number | null;
  overrides: number; // submitted although not in the AI top 10
};

export function compareAiToRecruiter(apps: SampleApp[], topN = 10): FairnessRow {
  const ranked = apps.filter((a) => a.score != null).sort((a, b) => b.score! - a.score!);
  const top = new Set(ranked.slice(0, topN).map((a) => a.id));
  const submitted = apps.filter((a) => a.submitted);
  const inTop = submitted.filter((a) => top.has(a.id)).length;
  const ranks = submitted.map((a) => ranked.findIndex((r) => r.id === a.id) + 1).filter((r) => r > 0);
  return {
    aiTop: top.size,
    submitted: submitted.length,
    overlapPct: submitted.length ? Math.round((inTop / submitted.length) * 100) : null,
    avgAiRankOfSubmitted: ranks.length ? Math.round((ranks.reduce((a, b) => a + b, 0) / ranks.length) * 10) / 10 : null,
    overrides: submitted.length - inTop,
  };
}
