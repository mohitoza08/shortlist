import type { Metrics } from "@/lib/metrics";
import { Card } from "@/components/ui/primitives";

/** Goal-gradient: each metric shows a progress meter toward its target so the number is read as progress, not trivia. */
function Tile({ label, value, unit, target, goal, tip, empty, i }: { label: string; value: number | null; unit?: string; target: string; goal?: number; tip: string; empty: string; i: number }) {
  const pct = value != null && goal ? Math.max(0, Math.min(100, (value / goal) * 100)) : null;
  const hit = value != null && goal != null && value >= goal;
  return (
    <div className="rise p-5 sm:p-6" title={tip} style={{ ["--i" as string]: i }}>
      <p className="label">{label}</p>
      <p className="serif mt-4 text-[56px]">
        {value == null ? <span className="text-line-strong">—</span> : value}
        {value != null && unit && <span className="ml-1 text-[26px] text-muted">{unit}</span>}
      </p>
      {pct != null && (
        <div className="mt-4 h-1 overflow-hidden rounded-full bg-surface-3" aria-hidden>
          <div className="h-full rounded-full" style={{ width: `${pct}%`, background: hit ? "var(--accent-bright)" : "var(--accent)" }} />
        </div>
      )}
      <p className="mt-3 text-[12.5px] leading-5 text-muted">{value == null ? empty : target}</p>
    </div>
  );
}

export function ImpactStrip({ m }: { m: Metrics }) {
  return (
    <section aria-label="Impact" className="mb-10">
      <Card className="hair-grid grid overflow-hidden sm:grid-cols-2 xl:grid-cols-4">
        <Tile
          i={0}
          label="Screening time saved"
          value={m.screeningReductionPct}
          unit="%"
          goal={60}
          target="Target 60% vs 3 min per CV by hand"
          tip="1 − (time from first upload to first submission ÷ 3 minutes × CVs in that requisition), across requisitions with a submission."
          empty="Appears after a requisition has uploaded CVs and a submission."
        />
        <Tile
          i={1}
          label="Shortlisted within 48h"
          value={m.within48hPct}
          unit="%"
          goal={80}
          target={`Target 80% · ${m.sample.submitted} requisition${m.sample.submitted === 1 ? "" : "s"} with a submission`}
          tip="Share of requisitions whose first submission to the client happened within 48 hours of the requisition being created."
          empty="Appears after the first submission to a client."
        />
        <Tile
          i={2}
          label="Client acceptance"
          value={m.acceptancePct}
          unit="%"
          goal={60}
          target={`Baseline 45% · target 60% · ${m.sample.decided} decided`}
          tip="Candidates the client shortlisted or proposed an interview for, divided by all candidates the client has decided on."
          empty="Appears after clients respond to a shortlist."
        />
        <Tile
          i={3}
          label="CVs processed"
          value={m.cvsProcessed}
          target="Parsed and scored, including those needing review"
          tip="Applications that finished parsing and scoring."
          empty=""
        />
      </Card>
    </section>
  );
}
