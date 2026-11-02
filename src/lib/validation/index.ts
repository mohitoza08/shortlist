import { z } from "zod";
import { criterionInput } from "../ai/schema";

export const requisitionBody = z.object({
  clientId: z.string().min(1),
  title: z.string().trim().min(2).max(120),
  jdText: z.string().max(20000).default(""),
  location: z.string().trim().max(80).default(""),
  minExpYears: z.number().int().min(0).max(40),
  maxExpYears: z.number().int().min(0).max(45),
  noticeMaxDays: z.number().int().min(0).max(365),
  ctcMaxLpa: z.number().min(0).nullable(),
  criteria: z.array(criterionInput).min(1).max(30),
});
export type RequisitionBody = z.infer<typeof requisitionBody>;

export const requisitionPatch = requisitionBody.partial().extend({
  status: z.enum(["DRAFT", "OPEN", "CLOSED"]).optional(),
});

export const extractBody = z.object({ jdText: z.string().trim().min(20).max(20000) });

export const profilePatch = z.object({
  currentRole: z.string().max(120).nullable().optional(),
  currentCompany: z.string().max(120).nullable().optional(),
  yearsExperience: z.number().min(0).max(60).nullable().optional(),
  noticeDays: z.number().int().min(0).max(365).nullable().optional(),
  expectedCtcLpa: z.number().min(0).max(500).nullable().optional(),
  location: z.string().max(80).nullable().optional(),
});

export const duplicateBody = z.object({ action: z.enum(["keep", "skip"]) });

export const MAX_FILES = 500;
export const MAX_BYTES = 10 * 1024 * 1024;
