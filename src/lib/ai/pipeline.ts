import type { Prisma } from "@prisma/client";
import { db } from "../db";
import { getFile } from "../storage";
import { audit } from "../audit";
import { callJson, isMock } from "./client";
import { assemble } from "./assemble";
import { possibleDuplicate, normEmail, normPhone, textHash } from "./dedupe";
import { heuristicCv } from "./heuristic";
import { extractContact, extractFromBuffer, sniffMime } from "./parse";
import { CV_SYSTEM, PROMPT_VERSION, cvUser } from "./prompts";
import { redact } from "./redact";
import { cvExtractionSchema, type CvExtraction } from "./schema";

export type ProcessResult =
  | { status: "PARSED"; applicationId: string; overallScore: number; confidence: number }
  | { status: "NEEDS_REVIEW"; applicationId: string; reasons: string[] }
  | { status: "QUEUED"; applicationId: string; retryAfterSeconds: number }
  | { status: "FAILED"; applicationId: string; code: string; message: string };

async function setStatus(id: string, parseStatus: "PROCESSING" | "FAILED" | "QUEUED" | "NEEDS_REVIEW" | "PARSED", reasons?: string[]) {
  await db.application.update({
    where: { id },
    data: { parseStatus, parseReasons: reasons ?? undefined },
  });
}

/** Parse + score one CV. Safe to retry: PARSED applications return their stored result. */
export async function processApplication(applicationId: string, actorId: string): Promise<ProcessResult> {
  const app = await db.application.findUnique({
    where: { id: applicationId },
    include: { candidate: true, requisition: { include: { criteria: { orderBy: { order: "asc" } } } } },
  });
  if (!app) return { status: "FAILED", applicationId, code: "NOT_FOUND", message: "Not found." };
  if (app.parseStatus === "PARSED" && app.overallScore != null) {
    return { status: "PARSED", applicationId, overallScore: app.overallScore, confidence: app.parseConfidence ?? 0 };
  }
  if (app.parseStatus === "PROCESSING") {
    return { status: "QUEUED", applicationId, retryAfterSeconds: 5 };
  }

  await setStatus(applicationId, "PROCESSING");
  try {
    // 1. text
    let text = app.resumeText ?? "";
    let lowQuality = false;
    if (!text) {
      const buf = await getFile(applicationId);
      const kind = buf ? sniffMime(buf) : null;
      if (!buf || !kind) {
        await setStatus(applicationId, "FAILED", ["The file could not be read."]);
        return { status: "FAILED", applicationId, code: "UNREADABLE", message: "The file could not be read." };
      }
      const ex = await extractFromBuffer(buf, kind);
      text = ex.text;
      lowQuality = ex.lowText;
    }
    if (text.length < 60) {
      const reasons = ["Scanned or image-only CV. No readable text was found. Open the CV to review it."];
      await db.application.update({ where: { id: applicationId }, data: { resumeText: text, parseStatus: "NEEDS_REVIEW", parseReasons: reasons } });
      return { status: "NEEDS_REVIEW", applicationId, reasons };
    }

    // 2. contact + dedupe
    const contact = extractContact(text);
    const fullName = contact.name || app.candidate.fullName;
    const tHash = textHash(text);
    const sameText = await db.application.findFirst({
      where: { requisitionId: app.requisitionId, textHash: tHash, id: { not: applicationId } },
    });
    let duplicateStatus = app.duplicateStatus;
    let duplicateOfId = app.duplicateOfId;
    if (sameText && duplicateStatus === "NONE") {
      duplicateStatus = "CONFIRMED";
      duplicateOfId = sameText.id;
    }

    // 3. redact + extract
    const redacted = redact(text, fullName);
    const criteria = app.requisition.criteria;
    const mock = isMock();
    let extraction: CvExtraction;
    let model = "heuristic-rules";
    if (mock) {
      extraction = heuristicCv(redacted, criteria);
    } else {
      const r = await callJson({
        system: CV_SYSTEM,
        user: cvUser(redacted, criteria),
        schema: cvExtractionSchema,
        promptVersion: PROMPT_VERSION,
        applicationId,
      });
      if (!r.ok) {
        if (r.kind === "RATE_LIMITED") {
          await setStatus(applicationId, "QUEUED", ["Queued — provider limit"]);
          return { status: "QUEUED", applicationId, retryAfterSeconds: r.retryAfterSeconds };
        }
        if (r.kind === "INVALID_JSON") {
          const reasons = ["The AI response was not valid. Open the CV to review it."];
          await db.application.update({ where: { id: applicationId }, data: { resumeText: text, parseStatus: "NEEDS_REVIEW", parseReasons: reasons } });
          return { status: "NEEDS_REVIEW", applicationId, reasons };
        }
        await setStatus(applicationId, "FAILED", [r.message]);
        return { status: "FAILED", applicationId, code: r.kind, message: "Processing failed. Retry in a moment." };
      }
      extraction = r.data;
      model = r.model;
    }
    if (mock) {
      await db.aiRun.create({
        data: { applicationId, provider: "heuristic", model, promptVersion: PROMPT_VERSION, latencyMs: 0, status: "SUCCESS" },
      });
    }

    // 4. score against the ORIGINAL text so quotes are verified verbatim
    const req = {
      minExp: app.requisition.minExpYears,
      maxExp: app.requisition.maxExpYears,
      noticeMax: app.requisition.noticeMaxDays,
      ctcMax: app.requisition.ctcMaxLpa,
      location: app.requisition.location,
    };
    const a = assemble(
      criteria.map((c) => ({ id: c.id, label: c.label, type: c.type, weight: c.weight, mustHave: c.mustHave })),
      req,
      extraction,
      text,
      lowQuality,
    );

    // 5. possible duplicate by person
    const email = normEmail(contact.email || app.candidate.email);
    const phone = normPhone(contact.phone || app.candidate.phone);
    if (duplicateStatus === "NONE") {
      const others = await db.candidate.findMany({
        where: { id: { not: app.candidateId }, deletedAt: null, OR: [{ email: email || "__none__" }, { phone: phone || "__none__" }] },
        take: 1,
      });
      if (others.length) {
        const other = await db.application.findFirst({ where: { candidateId: others[0].id, requisitionId: app.requisitionId } });
        if (other) {
          duplicateStatus = "POSSIBLE";
          duplicateOfId = other.id;
        } else if (possibleDuplicate({ fullName, email, phone }, { fullName: others[0].fullName, email: others[0].email, phone: others[0].phone })) {
          duplicateStatus = "POSSIBLE";
        }
      }
    }

    const status = a.reasons.length > 0 ? "NEEDS_REVIEW" : "PARSED";

    const profile: Prisma.InputJsonValue = {
      currentRole: extraction.currentRole,
      currentCompany: extraction.currentCompany,
      yearsExperience: extraction.yearsExperience,
      noticeDays: extraction.noticeDays,
      expectedCtcLpa: extraction.expectedCtcLpa,
      location: extraction.location,
      skills: extraction.skills,
      summary: extraction.summary,
      strengths: extraction.strengths,
      gaps: extraction.gaps,
      source: mock ? "heuristic" : "model",
    };

    await db.$transaction([
      db.criterionScore.deleteMany({ where: { applicationId } }),
      db.criterionScore.createMany({
        data: a.rows.map((r) => ({
          applicationId,
          criterionId: r.criterionId,
          score: r.score,
          evidenceQuote: r.evidenceQuote,
          confidence: r.confidence,
          grounded: r.grounded,
        })),
      }),
      db.candidate.update({
        where: { id: app.candidateId },
        data: {
          fullName,
          email: contact.email || app.candidate.email,
          phone: contact.phone || app.candidate.phone,
          location: extraction.location ?? app.candidate.location,
        },
      }),
      db.application.update({
        where: { id: applicationId },
        data: {
          resumeText: text,
          textHash: tHash,
          parsedProfile: profile,
          parseStatus: status,
          parseReasons: a.reasons,
          parseConfidence: a.confidence,
          overallScore: a.overallScore,
          duplicateStatus,
          duplicateOfId,
        },
      }),
    ]);
    await audit(actorId, "SCORE_RERUN", "Application", applicationId, { overall: a.overallScore, source: mock ? "heuristic" : "model" });

    return status === "PARSED"
      ? { status, applicationId, overallScore: a.overallScore, confidence: a.confidence }
      : { status, applicationId, reasons: a.reasons };
  } catch (e) {
    console.error("process failed", e instanceof Error ? e.name : "unknown");
    await setStatus(applicationId, "FAILED", ["Processing failed."]);
    return { status: "FAILED", applicationId, code: "ERROR", message: "Processing failed. Retry in a moment." };
  }
}
