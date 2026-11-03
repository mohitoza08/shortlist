import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PrismaClient } from "@prisma/client";
import { deleteCandidate } from "@/lib/deletion";
import { getApplicationFor, ApiError } from "@/lib/access";

// Runs against the local database (DATABASE_URL). Skipped when it is not set.
const run = process.env.DATABASE_URL ? describe : describe.skip;
const db = new PrismaClient();

run("RBAC isolation, consent and deletion (database)", () => {
  let ashford: string, vela: string, owner: string, reqId: string, appId: string, candId: string, ashfordUser: string, velaUser: string;

  beforeAll(async () => {
    const c = await db.client.findMany();
    ashford = c.find((x) => x.name === "Ashford Bank")!.id;
    vela = c.find((x) => x.name === "Vela Retail")!.id;
    owner = (await db.user.findUniqueOrThrow({ where: { email: "recruiter@meridian.example" } })).id;
    ashfordUser = (await db.user.findUniqueOrThrow({ where: { email: "hiring@ashfordbank.example" } })).id;
    velaUser = (await db.user.findUniqueOrThrow({ where: { email: "hiring@velaretail.example" } })).id;
    const req = await db.requisition.create({ data: { clientId: ashford, createdById: owner, title: "TEST isolation", jdText: "x", location: "Noida", minExpYears: 1, maxExpYears: 3, noticeMaxDays: 30 } });
    reqId = req.id;
    const cand = await db.candidate.create({ data: { fullName: "Test Person", email: "test.person@example.com", phone: "9876543210", location: "Noida" } });
    candId = cand.id;
    const app = await db.application.create({
      data: { requisitionId: reqId, candidateId: candId, resumeBlobKey: "k", resumeFileName: "t.pdf", resumeMime: "application/pdf", fileHash: "h-test", resumeText: "secret resume text", parsedProfile: { currentRole: "X" }, overallScore: 77, stage: "SUBMITTED" },
    });
    appId = app.id;
    await db.resumeFile.create({ data: { applicationId: appId, bytes: new Uint8Array([37, 80, 68, 70]) } });
  });

  afterAll(async () => {
    await db.requisition.delete({ where: { id: reqId } }).catch(() => null);
    await db.candidate.delete({ where: { id: candId } }).catch(() => null);
    await db.$disconnect();
  });

  const as = (id: string, clientId: string) => ({ id, role: "CLIENT" as const, clientId, name: "c" });

  it("hides an unsubmitted candidate from its own client (404)", async () => {
    await expect(getApplicationFor(as(ashfordUser, ashford), appId)).rejects.toMatchObject({ status: 404 });
  });

  it("shows a submitted candidate to the owning client only", async () => {
    await db.application.update({ where: { id: appId }, data: { submittedAt: new Date() } });
    await expect(getApplicationFor(as(ashfordUser, ashford), appId)).resolves.toBeTruthy();
    const err = await getApplicationFor(as(velaUser, vela), appId).catch((e) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect(err.status).toBe(404);
  });

  it("lets a recruiter see any application", async () => {
    await expect(getApplicationFor({ id: owner, role: "RECRUITER", clientId: null, name: "r" }, appId)).resolves.toBeTruthy();
  });

  it("deletion removes the file and PII but keeps the aggregate score", async () => {
    await db.criterionScore.deleteMany({ where: { applicationId: appId } });
    await deleteCandidate(candId, owner);
    const cand = await db.candidate.findUniqueOrThrow({ where: { id: candId } });
    const app = await db.application.findUniqueOrThrow({ where: { id: appId } });
    expect(cand.fullName).toBe("Deleted candidate");
    expect(cand.email).toBe("");
    expect(cand.phone).toBe("");
    expect(cand.deletedAt).not.toBeNull();
    expect(app.resumeText).toBeNull();
    expect(app.parsedProfile).toBeNull();
    expect(await db.resumeFile.count({ where: { applicationId: appId } })).toBe(0);
    expect(app.overallScore).toBe(77);
    expect(app.stage).toBe("SUBMITTED");
    // and the client can no longer open it
    await expect(getApplicationFor(as(ashfordUser, ashford), appId)).rejects.toMatchObject({ status: 404 });
    const log = await db.auditLog.findFirst({ where: { action: "CANDIDATE_DELETED", entityId: candId } });
    expect(log).toBeTruthy();
    expect(JSON.stringify(log?.meta ?? {})).not.toContain("Test Person");
  });
});
