import Groq from "groq-sdk";
import type { ZodType } from "zod";
import { backOff, record, waitSeconds } from "./limiter";
import { db } from "../db";

export type LlmResult<T> =
  | { ok: true; data: T; model: string; latencyMs: number; tokensIn?: number; tokensOut?: number }
  | { ok: false; kind: "RATE_LIMITED"; retryAfterSeconds: number }
  | { ok: false; kind: "INVALID_JSON" | "TIMEOUT" | "ERROR"; message: string };

export const isMock = () => process.env.AI_MOCK === "1" || !process.env.GROQ_API_KEY;

let groq: Groq | null = null;
const getGroq = () => (groq ??= new Groq({ apiKey: process.env.GROQ_API_KEY, timeout: 40_000, maxRetries: 0 }));

const estimateTokens = (s: string) => Math.ceil(s.length / 3.5);

function stripFences(s: string) {
  return s.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "").trim();
}

/** One JSON-mode call with a single repair retry. Logs an AiRun row and never stores prompt text. */
export async function callJson<T>(opts: {
  system: string;
  user: string;
  schema: ZodType<T>;
  promptVersion: string;
  applicationId?: string;
  model?: string;
}): Promise<LlmResult<T>> {
  const model = opts.model ?? process.env.GROQ_TEXT_MODEL ?? "openai/gpt-oss-20b";
  const est = estimateTokens(opts.system + opts.user) + 1200;
  const wait = waitSeconds(est);
  if (wait > 0) return { ok: false, kind: "RATE_LIMITED", retryAfterSeconds: wait };

  let lastError = "";
  for (let attempt = 0; attempt < 2; attempt++) {
    const started = Date.now();
    try {
      const messages: { role: "system" | "user"; content: string }[] = [
        { role: "system", content: opts.system },
        {
          role: "user",
          content: attempt === 0 ? opts.user : `${opts.user}\n\nYour previous JSON was invalid: ${lastError}. Return corrected JSON only.`,
        },
      ];
      const res = await getGroq().chat.completions.create({
        model,
        messages,
        temperature: 0,
        response_format: { type: "json_object" },
      });
      const latencyMs = Date.now() - started;
      const tokensIn = res.usage?.prompt_tokens;
      const tokensOut = res.usage?.completion_tokens;
      record((tokensIn ?? 0) + (tokensOut ?? 0) || est);
      const raw = res.choices[0]?.message?.content ?? "";
      let parsed: unknown;
      try {
        parsed = JSON.parse(stripFences(raw));
      } catch {
        lastError = "not parseable JSON";
        await logRun(opts, model, latencyMs, "INVALID_JSON", tokensIn, tokensOut, lastError);
        continue;
      }
      const checked = opts.schema.safeParse(parsed);
      if (!checked.success) {
        lastError = checked.error.issues.slice(0, 3).map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
        await logRun(opts, model, latencyMs, "INVALID_JSON", tokensIn, tokensOut, lastError);
        continue;
      }
      await logRun(opts, model, latencyMs, "SUCCESS", tokensIn, tokensOut);
      return { ok: true, data: checked.data, model, latencyMs, tokensIn, tokensOut };
    } catch (e) {
      const latencyMs = Date.now() - started;
      const err = e as { status?: number; headers?: Record<string, string>; name?: string; message?: string };
      if (err.status === 429) {
        const retry = Number(err.headers?.["retry-after"] ?? 30);
        backOff(retry);
        await logRun(opts, model, latencyMs, "RATE_LIMITED", undefined, undefined, "429");
        return { ok: false, kind: "RATE_LIMITED", retryAfterSeconds: retry };
      }
      const timeout = err.name?.includes("Timeout") || err.message?.toLowerCase().includes("timed out");
      lastError = timeout ? "timeout" : `provider error ${err.status ?? ""}`.trim();
      await logRun(opts, model, latencyMs, timeout ? "TIMEOUT" : "ERROR", undefined, undefined, lastError);
      if (attempt === 1) return { ok: false, kind: timeout ? "TIMEOUT" : "ERROR", message: lastError };
    }
  }
  return { ok: false, kind: "INVALID_JSON", message: lastError };
}

async function logRun(
  opts: { applicationId?: string; promptVersion: string },
  model: string,
  latencyMs: number,
  status: "SUCCESS" | "INVALID_JSON" | "TIMEOUT" | "RATE_LIMITED" | "ERROR",
  tokensIn?: number,
  tokensOut?: number,
  error?: string,
) {
  await db.aiRun.create({
    data: {
      applicationId: opts.applicationId,
      model,
      promptVersion: opts.promptVersion,
      latencyMs,
      tokensIn,
      tokensOut,
      status,
      error,
    },
  });
}
