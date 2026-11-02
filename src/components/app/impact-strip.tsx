import type { Metrics } from "@/lib/metrics";
import { Card } from "@/components/ui/primitives";

function Tile({ label, value, unit, target, tip, empty }: { label: string; value: number | null; unit?: string; target: string; tip: string; empty: string }) {
  return (
    <Card className="p-5" title={tip}>
      <p className="label">{label}</p>
      <p className="display mt-2 text-[40px] leading-[44px]">
        {value == null ? "—" : value}
        {value != null && unit && <span className="ml-0.5 text-xl text-muted">{unit}</span>}
      </p>
      <p className="mt-2 text-xs text-muted">{value == null ? empty : target}</p>
    </Card>
  );
}

export function ImpactStrip({ m }: { m: Metrics }) {
  return (
    <section aria-label="Impact" className="mb-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <Tile
        label="Screening time saved"
        value={m.screeningReductionPct}
        unit="%"
        target="Target 60% vs 3 min per CV by hand"
        tip="1 − (time from first upload to first submission ÷ 3 minutes × CVs in that requisition), across requisitions with a submission."
        empty="Appears after a requisition has uploaded CVs and a submission."
      />
      <Tile
        label="Shortlisted within 48h"
        value={m.within48hPct}
        unit="%"
        target={`Target 80% · ${m.sample.submitted} requisition${m.sample.submitted === 1 ? "" : "s"} with a submission`}
        tip="Share of requisitions whose first submission to the client happened within 48 hours of the requisition being created."
        empty="Appears after the first submission to a client."
      />
      <Tile
        label="Client acceptance"
        value={m.acceptancePct}
        unit="%"
        target={`Baseline 45% · target 60% · ${m.sample.decided} decided`}
        tip="Candidates the client shortlisted or proposed an interview for, divided by all candidates the client has decided on."
        empty="Appears after clients respond to a shortlist."
      />
      <Tile
        label="CVs processed"
        value={m.cvsProcessed}
        target="Parsed and scored, including those needing review"
        tip="Applications that finished parsing and scoring."
        empty=""
      />
    </section>
  );
}
