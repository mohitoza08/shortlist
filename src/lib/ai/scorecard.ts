import type { CriterionInput, JdExtraction } from "./schema";
import { defaultWeights, normaliseWeights } from "./score";

/** Turn a JD extraction into editable criteria with default weights. */
export function criteriaFromExtraction(x: JdExtraction): CriterionInput[] {
  const w = defaultWeights(x.mustHaveSkills.length);
  const out: CriterionInput[] = x.mustHaveSkills.map((s, i) => ({
    label: s,
    type: "SKILL",
    weight: Math.min(40, w.skill + (i === 0 ? w.firstSkillExtra : 0)),
    mustHave: true,
    expectedValue: null,
  }));
  out.push({
    label: `Experience ${x.minExpYears}–${x.maxExpYears} years`,
    type: "EXPERIENCE",
    weight: w.experience,
    mustHave: true,
    expectedValue: `${x.minExpYears}-${x.maxExpYears}`,
  });
  out.push({
    label: `Notice up to ${x.noticeMaxDays} days`,
    type: "NOTICE",
    weight: w.notice,
    mustHave: false,
    expectedValue: String(x.noticeMaxDays),
  });
  if (x.location) {
    out.push({ label: `Location ${x.location}`, type: "LOCATION", weight: w.location, mustHave: false, expectedValue: x.location });
  }
  if (x.ctcMaxLpa != null) {
    out.push({ label: `CTC up to ${x.ctcMaxLpa} LPA`, type: "CTC", weight: w.ctc, mustHave: false, expectedValue: String(x.ctcMaxLpa) });
  }
  for (const s of x.niceToHaveSkills) {
    out.push({ label: s, type: "SKILL", weight: 0, mustHave: false, expectedValue: null });
  }
  return normaliseWeights(out.map((c) => c)).map((c, i) => ({ ...c, weight: out[i].weight === 0 ? 0 : c.weight }));
}
