import { describe, expect, it } from "vitest";
import { computeMetrics } from "@/lib/metrics";
import { compareAiToRecruiter } from "@/lib/fairness";
import { canMoveManually } from "@/lib/stages";

const h = (n: number) => n * 3_600_000;
const t0 = new Date("2026-01-01T00:00:00Z");

describe("metrics", () => {
  it("returns null, not zero, when there is no data", () => {
    const m = computeMetrics([], { shortlisted: 0, decided: 0 }, 0);
    expect(m.screeningReductionPct).toBeNull();
    expect(m.within48hPct).toBeNull();
    expect(m.acceptancePct).toBeNull();
  });
  it("computes screening time saved against 3 minutes per CV", () => {
    // 100 CVs by hand = 300 min; actual 60 min -> 80% saved
    const m = computeMetrics([{ createdAt: t0, firstUpload: t0, firstSubmit: new Date(t0.getTime() + 60 * 60_000), cvCount: 100 }], { shortlisted: 0, decided: 0 }, 100);
    expect(m.screeningReductionPct).toBe(80);
  });
  it("computes the 48 hour share", () => {
    const m = computeMetrics(
      [
        { createdAt: t0, firstUpload: t0, firstSubmit: new Date(t0.getTime() + h(20)), cvCount: 10 },
        { createdAt: t0, firstUpload: t0, firstSubmit: new Date(t0.getTime() + h(60)), cvCount: 10 },
      ],
      { shortlisted: 0, decided: 0 },
      20,
    );
    expect(m.within48hPct).toBe(50);
  });
  it("computes client acceptance", () => {
    expect(computeMetrics([], { shortlisted: 3, decided: 5 }, 0).acceptancePct).toBe(60);
  });
});

describe("fairness sample", () => {
  const apps = Array.from({ length: 15 }, (_, i) => ({ id: `a${i}`, score: 100 - i * 5, submitted: false }));
  it("compares AI top 10 with the submitted set", () => {
    apps[0].submitted = true; // rank 1
    apps[2].submitted = true; // rank 3
    apps[12].submitted = true; // rank 13 -> an override
    const f = compareAiToRecruiter(apps);
    expect(f.submitted).toBe(3);
    expect(f.overlapPct).toBe(67);
    expect(f.overrides).toBe(1);
    expect(f.avgAiRankOfSubmitted).toBe(5.7);
  });
  it("handles no submissions", () => {
    expect(compareAiToRecruiter([{ id: "x", score: 50, submitted: false }]).overlapPct).toBeNull();
  });
});

describe("stage rules", () => {
  it("never lets submission or rejection bypass their own routes", () => {
    expect(canMoveManually("SUBMITTED")).toBe(false);
    expect(canMoveManually("REJECTED")).toBe(false);
    expect(canMoveManually("INTERVIEW")).toBe(true);
  });
});
