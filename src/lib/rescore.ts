import { db } from "./db";
import { overall, overallConfidence, scoreStructured, type Profile } from "./ai/score";

/** Deterministic re-score after the recruiter edits parsed fields. Skill evidence is kept as is. */
export async function rescoreApplication(applicationId: string) {
  const app = await db.application.findUnique({
    where: { id: applicationId },
    include: { requisition: { include: { criteria: true } }, criterionScores: true },
  });
  if (!app || !app.parsedProfile) return null;
  const p = app.parsedProfile as Record<string, unknown>;
  const profile: Profile = {
    yearsExperience: (p.yearsExperience as number | null) ?? null,
    noticeDays: (p.noticeDays as number | null) ?? null,
    expectedCtcLpa: (p.expectedCtcLpa as number | null) ?? null,
    location: (p.location as string | null) ?? null,
  };
  const r = app.requisition;
  const req = { minExp: r.minExpYears, maxExp: r.maxExpYears, noticeMax: r.noticeMaxDays, ctcMax: r.ctcMaxLpa, location: r.location };
  const items: { weight: number; score: number; confidence: number }[] = [];
  for (const c of r.criteria) {
    const existing = app.criterionScores.find((s) => s.criterionId === c.id);
    const structured = scoreStructured(c.type, profile, req);
    if (structured != null) {
      // A recruiter-confirmed value is treated as verified for confidence.
      await db.criterionScore.upsert({
        where: { applicationId_criterionId: { applicationId, criterionId: c.id } },
        create: { applicationId, criterionId: c.id, score: structured, confidence: 0.9, grounded: false },
        update: { score: structured, confidence: Math.max(existing?.confidence ?? 0, 0.9) },
      });
      items.push({ weight: c.weight, score: structured, confidence: Math.max(existing?.confidence ?? 0, 0.9) });
    } else if (existing) {
      items.push({ weight: c.weight, score: existing.score, confidence: existing.confidence });
    }
  }
  const overallScore = overall(items);
  await db.application.update({
    where: { id: applicationId },
    data: { overallScore, parseConfidence: overallConfidence(items), parseStatus: "PARSED", parseReasons: [] },
  });
  return overallScore;
}
