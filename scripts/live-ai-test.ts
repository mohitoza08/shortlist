/**
 * Live check of the Groq path on a handful of sample CVs, in a throwaway requisition ("Live AI test ...").
 * Does not touch existing data. Run: npx tsx --env-file=.env scripts/live-ai-test.ts
 * Then run scripts/live-ai-report.ts to see scores and whether every shown quote is a real line of the CV.
 */
import fs from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import { processApplication } from "../src/lib/ai/pipeline";
import { sha256 } from "../src/lib/ai/dedupe";
import { sniffMime } from "../src/lib/ai/parse";

const db = new PrismaClient();
const FILES = (process.env.FILES ?? "ritika-bansal.pdf,kabir-anand-injection.pdf,tanvi-joshi.pdf").split(",");

async function main() {
  const owner = await db.user.findUniqueOrThrow({ where: { email: "recruiter@meridian.example" } });
  const base = await db.requisition.findFirstOrThrow({ where: { title: "Senior Java Developer" }, include: { criteria: true } });
  const req = await db.requisition.create({
    data: {
      clientId: base.clientId, createdById: owner.id, title: `Live AI test ${new Date().toISOString().slice(0, 16)}`,
      jdText: base.jdText, location: base.location, minExpYears: base.minExpYears, maxExpYears: base.maxExpYears,
      noticeMaxDays: base.noticeMaxDays, ctcMaxLpa: base.ctcMaxLpa,
      criteria: { create: base.criteria.map(({ label, type, weight, mustHave, expectedValue, order }) => ({ label, type, weight, mustHave, expectedValue, order })) },
    },
  });
  console.log(`Requisition: ${req.title}\n`);

  for (const f of FILES) {
    const buf = fs.readFileSync(path.join(process.cwd(), "public", "samples", f));
    const kind = sniffMime(buf)!;
    const hash = sha256(buf);
    const cand = await db.candidate.create({ data: { fullName: f.replace(/\.[^.]+$/, ""), email: "", phone: "", location: "" } });
    const app = await db.application.create({
      data: {
        requisitionId: req.id, candidateId: cand.id, resumeBlobKey: `db:${hash.slice(0, 16)}`, resumeFileName: f,
        resumeMime: kind === "pdf" ? "application/pdf" : "application/vnd.openxmlformats-officedocument.wordprocessingml.document", fileHash: hash,
      },
    });
    await db.resumeFile.create({ data: { applicationId: app.id, bytes: new Uint8Array(buf) } });

    const t0 = Date.now();
    const r = await processApplication(app.id, owner.id);
    console.log(`${f}  ->  ${r.status}  (${Date.now() - t0} ms)`);
  }
}

main().finally(() => db.$disconnect());
