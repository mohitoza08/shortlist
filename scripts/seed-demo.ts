/**
 * Loads the synthetic CVs through the REAL pipeline (src/lib/ai/pipeline.ts) and gives them a realistic
 * spread of stages, client decisions and timestamps. Run: npm run seed:demo [-- --reset]
 *
 * Scores/evidence come from whichever extractor is configured: Groq when GROQ_API_KEY is set and AI_MOCK!=1,
 * otherwise the rule-based extractor. Each AiRun row records which one ran (provider "groq" or "heuristic").
 * Evidence is never invented: quotes are lines that exist in the CV text and are re-verified.
 */
import fs from "node:fs";
import path from "node:path";
import { PrismaClient, type Stage } from "@prisma/client";
import { processApplication } from "../src/lib/ai/pipeline";
import { sha256 } from "../src/lib/ai/dedupe";
import { sniffMime } from "../src/lib/ai/parse";

const db = new PrismaClient();
const dir = path.join(process.cwd(), "prisma", "seed-data", "resumes");
const H = 3_600_000;

const LADDER: { stage: Stage; decision?: "SHORTLISTED" | "REJECTED" | "INTERVIEW_PROPOSED"; reason?: string }[] = [
  { stage: "JOINED", decision: "SHORTLISTED" },
  { stage: "OFFERED", decision: "SHORTLISTED" },
  { stage: "INTERVIEW", decision: "INTERVIEW_PROPOSED" },
  { stage: "CLIENT_REVIEW", decision: "SHORTLISTED" },
  { stage: "CLIENT_REVIEW" },
  { stage: "SUBMITTED" },
  { stage: "SHORTLISTED" },
  { stage: "SCREENED" },
];

async function main() {
  const reset = process.argv.includes("--reset");
  if (reset) {
    await db.auditLog.deleteMany({});
    await db.aiRun.deleteMany({});
    await db.deletionRequest.deleteMany({});
    await db.application.deleteMany({});
    await db.requisition.deleteMany({ where: { title: { startsWith: "Smoke" } } });
    await db.candidate.deleteMany({});
  } else if ((await db.application.count()) > 0) {
    console.log("Applications already exist. Use --reset to rebuild the demo data.");
    return;
  }
  const owner = await db.user.findUniqueOrThrow({ where: { email: "recruiter@meridian.example" } });
  const clientUsers = await db.user.findMany({ where: { role: "CLIENT" } });
  const manifest: { file: string; req: string; kind: string }[] = JSON.parse(fs.readFileSync(path.join(dir, "manifest.json"), "utf8"));
  const reqs = await db.requisition.findMany();
  const byTitle = new Map(reqs.map((r) => [r.title, r]));

  // Backdate requisitions so the impact strip has real elapsed time.
  let k = 0;
  const uploadOffsetH = new Map<string, number>(); // some requisitions wait 2+ days before CVs arrive
  for (const r of reqs) {
    uploadOffsetH.set(r.id, k % 3 === 2 ? 55 : 4);
    await db.requisition.update({ where: { id: r.id }, data: { createdAt: new Date(Date.now() - (3 + k++ * 2) * 24 * H) } });
  }

  const created: { id: string; req: string; kind: string; file: string }[] = [];
  for (const m of manifest) {
    const buf = fs.readFileSync(path.join(dir, m.file));
    const kind = sniffMime(buf);
    if (!kind) throw new Error(`Bad seed file ${m.file}`);
    const req = byTitle.get(m.req)!;
    const hash = sha256(buf);
    const candidate = await db.candidate.create({ data: { fullName: m.file.replace(/\.[^.]+$/, "").replace(/[-_]+/g, " "), email: "", phone: "", location: "" } });
    const app = await db.application.create({
      data: {
        requisitionId: req.id, candidateId: candidate.id, resumeBlobKey: `db:${hash.slice(0, 16)}`, resumeFileName: m.file,
        resumeMime: kind === "pdf" ? "application/pdf" : "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        fileHash: hash,
        createdAt: new Date(req.createdAt.getTime() + (uploadOffsetH.get(req.id) ?? 4) * H),
      },
    });
    await db.resumeFile.create({ data: { applicationId: app.id, bytes: new Uint8Array(buf) } });
    await db.auditLog.create({ data: { actorId: owner.id, action: "CV_UPLOADED", entityType: "Application", entityId: app.id, createdAt: app.createdAt } });
    created.push({ id: app.id, req: m.req, kind: m.kind, file: m.file });
    process.stdout.write(".");
  }
  console.log();

  // Process every CV with the real pipeline, one at a time.
  for (const c of created) {
    const first = created.find((x) => x.file !== c.file && x.kind !== "exact-duplicate" && x.id !== c.id && x.req === c.req && sameBytes(x.file, c.file));
    if (c.kind === "exact-duplicate" && first) {
      await db.application.update({ where: { id: c.id }, data: { duplicateStatus: "CONFIRMED", duplicateOfId: first.id, parseStatus: "PARSED", overallScore: null } });
      continue;
    }
    const r = await processApplication(c.id, owner.id);
    if (r.status === "QUEUED" || r.status === "FAILED") console.log("  not processed:", c.file, r.status);
  }

  // Stages, client decisions and timestamps per requisition.
  for (const r of reqs) {
    const apps = await db.application.findMany({
      where: { requisitionId: r.id, duplicateStatus: { not: "CONFIRMED" }, parseStatus: "PARSED" },
      orderBy: { overallScore: "desc" },
      include: { candidate: true },
    });
    const clientUser = clientUsers.find((u) => u.clientId === r.clientId);
    for (const [i, a] of apps.entries()) {
      const step = LADDER[i];
      if (!step) {
        if (i === apps.length - 1 && apps.length > 8) {
          await db.application.update({ where: { id: a.id }, data: { stage: "REJECTED", viewedAt: new Date(r.createdAt.getTime() + (uploadOffsetH.get(r.id) ?? 4) * H + 600_000), clientDecision: "REJECTED", clientReason: "Skills mismatch", submittedAt: new Date(r.createdAt.getTime() + (uploadOffsetH.get(r.id) ?? 4) * H + 1_800_000) } });
        }
        continue;
      }
      const uploadAt = r.createdAt.getTime() + (uploadOffsetH.get(r.id) ?? 4) * H;
      const viewedAt = new Date(uploadAt + (5 + i * 2) * 60_000);
      const submitted = ["SUBMITTED", "CLIENT_REVIEW", "INTERVIEW", "OFFERED", "JOINED"].includes(step.stage);
      const submittedAt = submitted ? new Date(uploadAt + (15 + i * 4) * 60_000) : null;
      await db.application.update({
        where: { id: a.id },
        data: {
          stage: step.stage, viewedAt, submittedAt, clientDecision: step.decision ?? "PENDING",
          clientViewedAt: submitted && step.stage !== "SUBMITTED" ? new Date((submittedAt ?? viewedAt).getTime() + 3 * H) : null,
          stageChangedAt: new Date(Date.now() - (i + 1) * 20 * H),
          proposedSlots: step.stage === "INTERVIEW" ? [{ date: nextDate(2), time: "11:00", tz: "IST" }, { date: nextDate(3), time: "15:30", tz: "IST" }] : undefined,
        },
      });
      await db.auditLog.create({ data: { actorId: owner.id, action: "CV_VIEWED", entityType: "Application", entityId: a.id, createdAt: viewedAt } });
      if (submittedAt) {
        await db.auditLog.create({ data: { actorId: owner.id, action: "SUBMITTED", entityType: "Application", entityId: a.id, createdAt: submittedAt } });
        if (clientUser && step.decision) {
          const action = step.decision === "SHORTLISTED" ? "CLIENT_SHORTLISTED" : step.decision === "REJECTED" ? "CLIENT_REJECTED" : "SLOT_PROPOSED";
          await db.auditLog.create({ data: { actorId: clientUser.id, action, entityType: "Application", entityId: a.id, createdAt: new Date(submittedAt.getTime() + 5 * H) } });
        }
      }
    }
  }

  // Consent withdrawn + a pending deletion request, on two ordinary candidates.
  const some = await db.application.findMany({ where: { duplicateStatus: "NONE", submittedAt: null, parseStatus: "PARSED" }, include: { candidate: true }, take: 4, orderBy: { createdAt: "asc" } });
  if (some[0]) {
    await db.candidate.update({ where: { id: some[0].candidateId }, data: { consentStatus: "WITHDRAWN", consentNote: "Candidate emailed the recruiter to withdraw." } });
    await db.auditLog.create({ data: { actorId: owner.id, action: "CONSENT_UPDATED", entityType: "Candidate", entityId: some[0].candidateId, meta: { status: "WITHDRAWN" } } });
  }
  if (some[1]) {
    await db.deletionRequest.create({ data: { candidateId: some[1].candidateId, requestedById: owner.id, note: "Candidate asked for deletion." } });
    await db.auditLog.create({ data: { actorId: owner.id, action: "DELETION_REQUESTED", entityType: "Candidate", entityId: some[1].candidateId } });
  }
  const counts = await db.application.groupBy({ by: ["parseStatus"], _count: true });
  console.log("Seeded applications by status:", counts.map((c) => `${c.parseStatus}=${c._count}`).join(", "));
}

const bytesCache = new Map<string, string>();
function sameBytes(a: string, b: string) {
  const h = (f: string) => bytesCache.get(f) ?? (bytesCache.set(f, sha256(fs.readFileSync(path.join(dir, f)))), bytesCache.get(f)!);
  return h(a) === h(b);
}
function nextDate(days: number) {
  return new Date(Date.now() + days * 24 * H).toISOString().slice(0, 10);
}

main().finally(() => db.$disconnect());
