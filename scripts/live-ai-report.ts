/** Prints the latest "Live AI test" requisition from the database: provider, scores, and quote verification. */
import { PrismaClient } from "@prisma/client";
import { isGrounded } from "../src/lib/ai/evidence";

const db = new PrismaClient();

async function main() {
  const req = await db.requisition.findFirstOrThrow({ where: { title: { startsWith: "Live AI test" } }, orderBy: { createdAt: "desc" } });
  const apps = await db.application.findMany({
    where: { requisitionId: req.id },
    include: { criterionScores: { include: { criterion: true } }, candidate: true },
    orderBy: { createdAt: "asc" },
  });
  console.log(`Requisition: ${req.title}\n`);
  for (const a of apps) {
    console.log(`── ${a.resumeFileName}  →  ${a.parseStatus}  overall ${a.overallScore ?? "—"} `);
    if (Array.isArray(a.parseReasons) && a.parseReasons.length) console.log(`  reasons: ${a.parseReasons.join(" | ")}`);
    const runs = await db.aiRun.findMany({ where: { applicationId: a.id }, orderBy: { createdAt: "asc" } });
    for (const r of runs) console.log(`  run: ${r.provider} / ${r.model} / ${r.status} / ${r.latencyMs} ms / tokens ${r.tokensIn ?? "?"}→${r.tokensOut ?? "?"}${r.error ? " / " + r.error : ""}`);
    let bad = 0;
    for (const s of a.criterionScores) {
      const ok = s.evidenceQuote ? isGrounded(s.evidenceQuote, a.resumeText ?? "") : null;
      if (ok === false) bad++;
      console.log(`  ${String(Math.round(s.score)).padStart(3)}  ${s.criterion.label.padEnd(16)} ${ok === null ? "(no quote)" : ok ? "✓ verbatim" : "✗ NOT IN CV"}  ${s.evidenceQuote ? "“" + s.evidenceQuote.slice(0, 80) + "”" : ""}`);
    }
    console.log(`  ungrounded quotes shown: ${bad}\n`);
  }
}

main().finally(() => db.$disconnect());
