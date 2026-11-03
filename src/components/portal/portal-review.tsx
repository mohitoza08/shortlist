"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { AvatarInitials, Badge, Button, Card, ConfidenceDot, Field, Input, Modal, ScoreBar, Select, Textarea } from "@/components/ui/primitives";
import { REJECT_REASONS } from "@/lib/stages";

export type PortalCandidate = {
  id: string; name: string; role: string | null; years: number | null; location: string | null;
  maskedEmail: string; maskedPhone: string; score: number | null; confidence: number | null;
  highlights: { label: string; quote: string }[];
  decision: "PENDING" | "SHORTLISTED" | "REJECTED" | "INTERVIEW_PROPOSED"; reason: string | null;
  slots: { date: string; time: string; tz: string }[] | null; hasCv: boolean;
};

type Dialog = { kind: "reject" | "slot" | "cv"; c: PortalCandidate } | null;

export function PortalReview({ candidates }: { candidates: PortalCandidate[] }) {
  const router = useRouter();
  const [dialog, setDialog] = useState<Dialog>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [note, setNote] = useState("");
  const [slots, setSlots] = useState([{ date: "", time: "", tz: "IST" }]);

  async function post(c: PortalCandidate, payload: object, done: string) {
    setBusy(c.id);
    const res = await fetch(`/api/portal/applications/${c.id}/decision`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    setBusy(null);
    if (!res.ok) { toast.error((await res.json())?.error?.message ?? "Could not save your response."); return false; }
    toast.success(done);
    setDialog(null);
    router.refresh();
    return true;
  }

  async function openCv(c: PortalCandidate) {
    setDialog({ kind: "cv", c });
    fetch(`/api/portal/applications/${c.id}/viewed`, { method: "POST" }).catch(() => null);
  }

  function reset() { setReason(""); setNote(""); setSlots([{ date: "", time: "", tz: "IST" }]); }
  const slotsValid = slots.every((s) => s.date && s.time);

  return (
    <>
      <ul className="space-y-4">
        {candidates.map((c) => (
          <li key={c.id}>
            <Card className="p-5">
              <div className="flex items-start gap-3">
                <AvatarInitials name={c.name} size={44} />
                <div className="min-w-0 flex-1">
                  <h2 className="text-lg font-semibold leading-6">{c.name}</h2>
                  <p className="text-sm text-muted">{c.role ?? "Role not stated"}{c.years != null && ` · ${c.years} yrs`}{c.location && ` · ${c.location}`}</p>
                  <p className="mt-1 text-sm text-muted">{c.maskedEmail} · {c.maskedPhone}</p>
                </div>
                <div className="text-right">
                  <p className="display text-4xl leading-9">{c.score != null ? Math.round(c.score) : "—"}</p>
                  <ConfidenceDot value={c.confidence} />
                </div>
              </div>

              <div className="mt-3"><ScoreBar score={c.score} showNumber={false} /></div>

              {c.highlights.length > 0 && (
                <ul className="mt-4 space-y-2">
                  {c.highlights.map((h) => (
                    <li key={h.label} className="border-l-2 border-accent bg-accent-soft/50 px-3 py-2 text-sm">
                      <span className="label block">{h.label}</span>
                      <span className="italic">“{h.quote}”</span>
                    </li>
                  ))}
                </ul>
              )}

              {c.decision !== "PENDING" ? (
                <div className="mt-4 flex flex-wrap items-center gap-2">
                  {c.decision === "SHORTLISTED" && <Badge tone="success">You shortlisted this candidate</Badge>}
                  {c.decision === "REJECTED" && <Badge tone="danger">Rejected · {c.reason}</Badge>}
                  {c.decision === "INTERVIEW_PROPOSED" && <Badge tone="accent">Interview proposed{c.slots?.length ? `: ${c.slots.map((s) => `${s.date} ${s.time} ${s.tz}`).join(", ")}` : ""}</Badge>}
                  {c.hasCv && <Button variant="ghost" size="lg" onClick={() => openCv(c)}>View CV</Button>}
                </div>
              ) : (
                <div className="mt-4 grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
                  {c.hasCv ? <Button variant="secondary" size="lg" className="col-span-2 sm:col-span-1" onClick={() => openCv(c)}>View CV</Button> : <p className="col-span-2 text-sm text-muted">CV unavailable. Ask your recruiter.</p>}
                  <Button size="lg" loading={busy === c.id} onClick={() => post(c, { decision: "SHORTLIST" }, "Shortlisted")}>Shortlist</Button>
                  <Button size="lg" variant="secondary" onClick={() => { reset(); setDialog({ kind: "slot", c }); }}>Propose slot</Button>
                  <Button size="lg" variant="danger" className="col-span-2 sm:col-span-1" onClick={() => { reset(); setDialog({ kind: "reject", c }); }}>Reject</Button>
                </div>
              )}
            </Card>
          </li>
        ))}
      </ul>

      <Modal open={dialog?.kind === "reject"} onClose={() => setDialog(null)} title={`Reject ${dialog?.c.name ?? ""}`}>
        <div className="space-y-3">
          <Field label="Reason (required)" htmlFor="reason">
            <Select id="reason" value={reason} onChange={(e) => setReason(e.target.value)} className="h-11">
              <option value="">Choose a reason</option>
              {REJECT_REASONS.map((r) => <option key={r}>{r}</option>)}
            </Select>
          </Field>
          <Field label="Note (optional)" htmlFor="note"><Textarea id="note" rows={3} value={note} onChange={(e) => setNote(e.target.value)} /></Field>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setDialog(null)}>Cancel</Button>
          <Button variant="danger" disabled={!reason} disabledReason="Choose a reason" loading={!!busy} onClick={() => dialog && post(dialog.c, { decision: "REJECT", reason, note: note || undefined }, "Rejected")}>Confirm reject</Button>
        </div>
      </Modal>

      <Modal open={dialog?.kind === "slot"} onClose={() => setDialog(null)} title={`Propose a slot for ${dialog?.c.name ?? ""}`}>
        <div className="space-y-3">
          {slots.map((s, i) => (
            <div key={i} className="grid grid-cols-[1fr_90px_70px] gap-2">
              <Input type="date" aria-label={`Date ${i + 1}`} value={s.date} onChange={(e) => setSlots(slots.map((x, j) => (j === i ? { ...x, date: e.target.value } : x)))} className="h-11" />
              <Input type="time" aria-label={`Time ${i + 1}`} value={s.time} onChange={(e) => setSlots(slots.map((x, j) => (j === i ? { ...x, time: e.target.value } : x)))} className="h-11" />
              <Select aria-label="Timezone" value={s.tz} onChange={(e) => setSlots(slots.map((x, j) => (j === i ? { ...x, tz: e.target.value } : x)))} className="h-11 px-2"><option>IST</option><option>UTC</option><option>GMT</option></Select>
            </div>
          ))}
          {slots.length < 2 && <button className="text-sm text-accent hover:underline" onClick={() => setSlots([...slots, { date: "", time: "", tz: "IST" }])}>Add a second slot</button>}
          <Field label="Note (optional)" htmlFor="snote"><Textarea id="snote" rows={2} value={note} onChange={(e) => setNote(e.target.value)} /></Field>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setDialog(null)}>Cancel</Button>
          <Button disabled={!slotsValid} disabledReason="Add a date and time" loading={!!busy} onClick={() => dialog && post(dialog.c, { decision: "PROPOSE_SLOT", slots, note: note || undefined }, "Interview slot sent")}>Send proposal</Button>
        </div>
      </Modal>

      {dialog?.kind === "cv" && (
        <div className="fixed inset-0 z-50 flex flex-col bg-surface">
          <div className="flex h-14 items-center justify-between border-b border-line px-4">
            <p className="truncate font-medium">{dialog.c.name} · CV (view only)</p>
            <Button variant="secondary" onClick={() => setDialog(null)}>Close</Button>
          </div>
          <iframe title="CV" src={`/api/files/${dialog.c.id}#toolbar=0&navpanes=0`} className="min-h-0 flex-1 border-0" />
        </div>
      )}
    </>
  );
}
