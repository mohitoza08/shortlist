import { db } from "@/lib/db";
import { maskEmail, maskPhone } from "@/lib/mask";
import { getApplicationFor, handler, requireUser } from "@/lib/rbac";

/** Recruiter: full detail. Client: masked fields only, never resumeText/email/phone/blob key. */
export const GET = handler(async (_req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const user = await requireUser();
  const { id } = await ctx.params;
  const app = await getApplicationFor(user, id);
  const scores = await db.criterionScore.findMany({
    where: { applicationId: id },
    include: { criterion: true },
    orderBy: { criterion: { order: "asc" } },
  });
  const profile = (app.parsedProfile as Record<string, unknown> | null) ?? {};

  const scoreDtos = scores.map((s) => ({
    criterionId: s.criterionId,
    label: s.criterion.label,
    type: s.criterion.type,
    weight: s.criterion.weight,
    mustHave: s.criterion.mustHave,
    score: s.score,
    confidence: s.confidence,
    grounded: s.grounded,
    // Ungrounded quotes are never returned as evidence.
    evidenceQuote: s.grounded ? s.evidenceQuote : null,
  }));

  if (user.role === "CLIENT") {
    return Response.json({
      id: app.id,
      name: app.candidate.fullName,
      currentRole: profile.currentRole ?? null,
      yearsExperience: profile.yearsExperience ?? null,
      location: app.candidate.location,
      maskedEmail: maskEmail(app.candidate.email),
      maskedPhone: maskPhone(app.candidate.phone),
      overallScore: app.overallScore,
      confidence: app.parseConfidence,
      scores: scoreDtos,
      summary: profile.summary ?? null,
    });
  }

  const activity = await db.auditLog.findMany({
    where: { entityType: "Application", entityId: id },
    orderBy: { createdAt: "desc" },
    take: 50,
    include: { actor: { select: { name: true } } },
  });

  return Response.json({
    id: app.id,
    candidateId: app.candidateId,
    name: app.candidate.fullName,
    email: app.candidate.email,
    phone: app.candidate.phone,
    location: app.candidate.location,
    consentStatus: app.candidate.consentStatus,
    consentAt: app.candidate.consentAt,
    profile,
    parseStatus: app.parseStatus,
    reasons: (app.parseReasons as string[] | null) ?? [],
    overallScore: app.overallScore,
    confidence: app.parseConfidence,
    stage: app.stage,
    duplicateStatus: app.duplicateStatus,
    duplicateOfId: app.duplicateOfId,
    viewedAt: app.viewedAt,
    submittedAt: app.submittedAt,
    resumeMime: app.resumeMime,
    resumeFileName: app.resumeFileName,
    resumeText: app.resumeMime.includes("wordprocessing") ? app.resumeText : null,
    scores: scoreDtos,
    activity: activity.map((a) => ({ id: a.id, action: a.action, actor: a.actor?.name ?? "System", at: a.createdAt })),
  });
});
