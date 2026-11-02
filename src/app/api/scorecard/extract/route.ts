import { callJson, isMock } from "@/lib/ai/client";
import { heuristicJd } from "@/lib/ai/heuristic";
import { JD_SYSTEM, PROMPT_VERSION, jdUser } from "@/lib/ai/prompts";
import { criteriaFromExtraction } from "@/lib/ai/scorecard";
import { jdExtractionSchema } from "@/lib/ai/schema";
import { handler, requireRecruiter } from "@/lib/rbac";
import { extractBody } from "@/lib/validation";

export const maxDuration = 60;

/** Extract a scorecard from pasted JD text. Never blocks: on AI failure the client keeps manual entry. */
export const POST = handler(async (req: Request) => {
  await requireRecruiter();
  const { jdText } = extractBody.parse(await req.json());
  if (isMock()) {
    const x = heuristicJd(jdText);
    return Response.json({ source: "heuristic", extraction: x, criteria: criteriaFromExtraction(x) });
  }
  const r = await callJson({ system: JD_SYSTEM, user: jdUser(jdText), schema: jdExtractionSchema, promptVersion: PROMPT_VERSION });
  if (!r.ok) {
    return Response.json(
      {
        error: {
          code: r.kind,
          message:
            r.kind === "RATE_LIMITED"
              ? "The AI provider is at its limit. Enter the scorecard manually or try again shortly."
              : "Could not read the JD. Enter the scorecard manually or retry.",
        },
      },
      { status: r.kind === "RATE_LIMITED" ? 429 : 502 },
    );
  }
  return Response.json({ source: "model", extraction: r.data, criteria: criteriaFromExtraction(r.data) });
});
