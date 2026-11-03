import { db } from "./db";
import { audit } from "./audit";

/**
 * DPDP deletion on request: remove the file, parsed data and evidence; anonymise the candidate;
 * keep the aggregate score and stage for reporting. The audit entry carries no personal data.
 */
export async function deleteCandidate(candidateId: string, actorId: string) {
  const apps = await db.application.findMany({ where: { candidateId }, select: { id: true } });
  const ids = apps.map((a) => a.id);
  await db.$transaction([
    db.resumeFile.deleteMany({ where: { applicationId: { in: ids } } }),
    db.criterionScore.deleteMany({ where: { applicationId: { in: ids } } }),
    db.application.updateMany({
      where: { candidateId },
      data: {
        resumeText: null,
        parsedProfile: undefined,
        resumeFileName: "deleted",
        resumeBlobKey: "deleted",
        recruiterNotes: null,
        clientNote: null,
        proposedSlots: undefined,
      },
    }),
    db.candidate.update({
      where: { id: candidateId },
      data: { fullName: "Deleted candidate", email: "", phone: "", location: "", deletedAt: new Date(), anonymizedAt: new Date(), consentNote: null },
    }),
    db.deletionRequest.updateMany({ where: { candidateId, processedAt: null }, data: { status: "PROCESSED", processedAt: new Date() } }),
  ]);
  // parsedProfile is a nullable Json column: clear it explicitly (updateMany cannot set JSON null via undefined).
  await db.$executeRaw`UPDATE "Application" SET "parsedProfile" = NULL, "proposedSlots" = NULL WHERE "candidateId" = ${candidateId}`;
  await audit(actorId, "CANDIDATE_DELETED", "Candidate", candidateId);
}
