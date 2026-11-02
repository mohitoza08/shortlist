import { db } from "./db";
import { round } from "./utils";

export type Metrics = {
  screeningReductionPct: number | null; // vs 3 min per CV manual baseline
  within48hPct: number | null;
  acceptancePct: number | null;
  cvsProcessed: number;
  sample: { screened: number; submitted: number; decided: number };
};

const MANUAL_MIN_PER_CV = 3;
const HOUR = 3_600_000;

/** Pure calculation so the formulas are testable. */
export function computeMetrics(
  reqs: { createdAt: Date; firstUpload: Date | null; firstSubmit: Date | null; cvCount: number }[],
  decisions: { shortlisted: number; decided: number },
  processed: number,
): Metrics {
  const timed = reqs.filter((r) => r.firstUpload && r.firstSubmit && r.cvCount > 0);
  let reduction: number | null = null;
  if (timed.length) {
    const actual = timed.reduce((a, r) => a + (r.firstSubmit!.getTime() - r.firstUpload!.getTime()) / 60_000, 0);
    const manual = timed.reduce((a, r) => a + r.cvCount * MANUAL_MIN_PER_CV, 0);
    reduction = manual > 0 ? round(Math.max(0, (1 - actual / manual) * 100), 0) : null;
  }
  const submitted = reqs.filter((r) => r.firstSubmit);
  const within = submitted.filter((r) => r.firstSubmit!.getTime() - r.createdAt.getTime() <= 48 * HOUR).length;
  return {
    screeningReductionPct: reduction,
    within48hPct: submitted.length ? round((within / submitted.length) * 100, 0) : null,
    acceptancePct: decisions.decided ? round((decisions.shortlisted / decisions.decided) * 100, 0) : null,
    cvsProcessed: processed,
    sample: { screened: timed.length, submitted: submitted.length, decided: decisions.decided },
  };
}

export async function getMetrics(): Promise<Metrics> {
  const reqs = await db.requisition.findMany({
    select: {
      createdAt: true,
      _count: { select: { applications: true } },
      applications: { select: { createdAt: true, submittedAt: true } },
    },
  });
  const rows = reqs.map((r) => {
    const uploads = r.applications.map((a) => a.createdAt.getTime());
    const submits = r.applications.filter((a) => a.submittedAt).map((a) => a.submittedAt!.getTime());
    return {
      createdAt: r.createdAt,
      firstUpload: uploads.length ? new Date(Math.min(...uploads)) : null,
      firstSubmit: submits.length ? new Date(Math.min(...submits)) : null,
      cvCount: r._count.applications,
    };
  });
  const [shortlisted, decided, processed] = await Promise.all([
    db.application.count({ where: { clientDecision: { in: ["SHORTLISTED", "INTERVIEW_PROPOSED"] } } }),
    db.application.count({ where: { clientDecision: { not: "PENDING" } } }),
    db.application.count({ where: { parseStatus: { in: ["PARSED", "NEEDS_REVIEW"] } } }),
  ]);
  return computeMetrics(rows, { shortlisted, decided }, processed);
}
