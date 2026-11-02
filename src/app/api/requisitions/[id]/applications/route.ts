import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { sha256 } from "@/lib/ai/dedupe";
import { sniffMime } from "@/lib/ai/parse";
import { ApiError, handler, requireRecruiter } from "@/lib/rbac";
import { putFile } from "@/lib/storage";
import { MAX_BYTES, MAX_FILES } from "@/lib/validation";

export const maxDuration = 60;

/** Upload one CV. Safe to retry: an identical file in the same requisition is not created twice. */
export const POST = handler(async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const user = await requireRecruiter();
  const { id } = await ctx.params;
  const requisition = await db.requisition.findUnique({ where: { id } });
  if (!requisition) throw new ApiError(404, "NOT_FOUND", "Not found.");

  const form = await req.formData();
  if (form.get("consent") !== "true") {
    throw new ApiError(400, "CONSENT_REQUIRED", "Confirm candidate consent before uploading.");
  }
  const file = form.get("file");
  if (!(file instanceof File)) throw new ApiError(400, "VALIDATION", "No file received.");
  if (file.size > MAX_BYTES) throw new ApiError(413, "TOO_LARGE", "This file is over 10 MB.");
  const buf = Buffer.from(await file.arrayBuffer());
  const kind = sniffMime(buf);
  if (!kind) throw new ApiError(415, "INVALID_TYPE", "Only PDF or DOCX files are accepted.");

  const fileHash = sha256(buf);
  const dup = await db.application.findFirst({ where: { requisitionId: id, fileHash } });
  if (dup) {
    return Response.json({ status: "DUPLICATE", applicationId: dup.id, message: "Already in this requisition." });
  }
  const count = await db.application.count({ where: { requisitionId: id } });
  if (count >= MAX_FILES) throw new ApiError(400, "LIMIT", "This requisition has reached the 500 CV limit.");

  const baseName = file.name.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ").slice(0, 80) || "Unnamed candidate";
  const app = await db.$transaction(async (tx) => {
    const candidate = await tx.candidate.create({
      data: { fullName: baseName, email: "", phone: "", location: "", consentStatus: "GIVEN", consentSource: "RECRUITER_ATTESTATION", consentVersion: "v1" },
    });
    return tx.application.create({
      data: {
        requisitionId: id,
        candidateId: candidate.id,
        resumeBlobKey: `db:${fileHash.slice(0, 16)}`,
        resumeFileName: file.name.slice(0, 160),
        resumeMime: kind === "pdf" ? "application/pdf" : "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        fileHash,
      },
    });
  });
  await putFile(app.id, buf);
  await audit(user.id, "CV_UPLOADED", "Application", app.id, { fileName: file.name.slice(0, 80) });
  return Response.json({ status: "PENDING", applicationId: app.id }, { status: 201 });
});

/** Lightweight status list for upload polling. */
export const GET = handler(async (_req: Request, ctx: { params: Promise<{ id: string }> }) => {
  await requireRecruiter();
  const { id } = await ctx.params;
  const items = await db.application.findMany({
    where: { requisitionId: id },
    orderBy: { createdAt: "desc" },
    select: {
      id: true, resumeFileName: true, parseStatus: true, parseReasons: true, overallScore: true,
      duplicateStatus: true, duplicateOfId: true, createdAt: true,
      candidate: { select: { fullName: true } },
    },
  });
  return Response.json({ items });
});
