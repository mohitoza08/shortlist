import { z } from "zod";

export const criterionTypeSchema = z.enum(["SKILL", "EXPERIENCE", "NOTICE", "LOCATION", "CTC", "CUSTOM"]);

export const criterionInput = z.object({
  label: z.string().trim().min(1).max(80),
  type: criterionTypeSchema,
  weight: z.number().int().min(0).max(40),
  mustHave: z.boolean(),
  expectedValue: z.string().max(120).nullable().optional(),
});
export type CriterionInput = z.infer<typeof criterionInput>;

/** What the JD-extraction model must return. Extra keys are rejected. */
export const jdExtractionSchema = z
  .object({
    title: z.string().min(1),
    location: z.string(),
    minExpYears: z.number().int().min(0).max(40),
    maxExpYears: z.number().int().min(0).max(45),
    noticeMaxDays: z.number().int().min(0).max(365),
    ctcMaxLpa: z.number().min(0).nullable(),
    mustHaveSkills: z.array(z.string().min(1)).max(12),
    niceToHaveSkills: z.array(z.string().min(1)).max(12),
  })
  .strict();
export type JdExtraction = z.infer<typeof jdExtractionSchema>;

/**
 * Live Groq runs return numbers as strings ("5", "60 days") and sometimes null for a missing score.
 * Coerce those before validating. The range checks and .strict() below still apply, so nothing invalid gets through.
 */
const looseNumber = (inner: z.ZodType<number | null | undefined>) =>
  z.preprocess((v) => {
    if (typeof v !== "string") return v;
    const t = v.trim();
    if (t === "" || /^(n\/?a|null|none|unknown|not (stated|found))$/i.test(t)) return null;
    const n = Number(t.replace(/[^\d.-]/g, ""));
    return Number.isFinite(n) ? n : v;
  }, inner);

const quoted = z.object({
  quote: z.string().nullable(),
  confidence: looseNumber(z.number().min(0).max(1)) as unknown as z.ZodNumber,
});

/** What the CV-extraction model must return. Extra keys are rejected. */
export const cvExtractionSchema = z
  .object({
    currentRole: z.string().nullable(),
    currentCompany: z.string().nullable(),
    yearsExperience: looseNumber(z.number().min(0).max(60).nullable()) as unknown as z.ZodNullable<z.ZodNumber>,
    noticeDays: looseNumber(z.number().int().min(0).max(365).nullable()) as unknown as z.ZodNullable<z.ZodNumber>,
    expectedCtcLpa: looseNumber(z.number().min(0).nullable()) as unknown as z.ZodNullable<z.ZodNumber>,
    location: z.string().nullable(),
    skills: z.array(z.string()).max(60),
    summary: z.string().max(600),
    experienceEvidence: quoted,
    noticeEvidence: quoted,
    locationEvidence: quoted,
    ctcEvidence: quoted,
    criteria: z.array(
      z
        .object({
          label: z.string(),
          found: z.boolean(),
          related: z.boolean().optional(),
          score: looseNumber(z.number().min(0).max(100).nullish().transform((v) => v ?? undefined)) as unknown as z.ZodOptional<z.ZodNumber>,
          quote: z.string().nullable(),
          confidence: looseNumber(z.number().min(0).max(1)) as unknown as z.ZodNumber,
        })
        .strict(),
    ),
    strengths: z.array(z.string()).max(5),
    gaps: z.array(z.string()).max(5),
  })
  .strict();
export type CvExtraction = z.infer<typeof cvExtractionSchema>;
