"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { ExternalLink } from "lucide-react";
import { AvatarInitials, Badge, Button, ConfidenceDot, Drawer, ErrorState, Field, Input, Modal, Notice, Receipt, ScoreBar, ScoreRing, Select, Skeleton, Tabs, Textarea } from "@/components/ui/primitives";
import { REJECT_REASONS } from "@/lib/stages";
import { bandFor } from "@/lib/ai/score";

type Detail = {
  id: string; candidateId: string; name: string; email: string; phone: string; location: string;
  consentStatus: "GIVEN" | "PENDING" | "WITHDRAWN";
  profile: { currentRole?: string; currentCompany?: string; yearsExperience?: number | null; noticeDays?: number | null; expectedCtcLpa?: number | null; location?: string | null; summary?: string; strengths?: string[]; gaps?: string[]; source?: string; edited?: boolean };
  parseStatus: string; reasons: string[]; overallScore: number | null; confidence: number | null; stage: string;
  duplicateStatus: string; viewedAt: string | null; submittedAt: string | null;
  resumeMime: string; resumeFileName: string; resumeText: string | null;
  scores: { criterionId: string; label: string; type: string; weight: number; mustHave: boolean; score: number; confidence: number; grounded: boolean; evidenceQuote: string | null }[];
  activity: { id: string; action: string; actor: string; at: string }[];
};

type Tab = "overview" | "resume" | "scorecard" | "activity";
const ACTION: Record<string, string> = {
  STAGE_CHANGED: "Stage changed", CLIENT_VIEWED: "Client opened the CV", CLIENT_SHORTLISTED: "Client shortlisted", CLIENT_REJECTED: "Client rejected", SLOT_PROPOSED: "Client proposed an interview slot", DELETION_REQUESTED: "Deletion requested",
  CV_UPLOADED: "CV uploaded", CV_VIEWED: "CV opened", PROFILE_EDITED: "Profile edited", SCORE_RERUN: "Score calculated",
  SUBMITTED: "Submitted to client", CONSENT_UPDATED: "Consent updated",
};

export function CandidateDrawer({ id, onClose, onChanged }: { id: string | null; onClose: () => void; onChanged: () => void }) {
  const [d, setD] = useState<Detail | null>(null);
  const [err, setErr] = useState(false);
  const [tab, setTab] = useState<Tab>("overview");
  const [busy, setBusy] = useState(false);
  const [dlg, setDlg] = useState<null | "reject" | "consent" | "delete">(null);
  const [reason, setReason] = useState("");
  const [note, setNote] = useState("");
  const [consent, setConsent] = useState<"GIVEN" | "PENDING" | "WITHDRAWN">("WITHDRAWN");
  const [delRequested, setDelRequested] = useState(false);

  async function act(url: string, body: object, ok: string) {
    setBusy(true);
    const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    setBusy(false);
    if (!res.ok) { toast.error((await res.json())?.error?.message ?? "Something went wrong."); return false; }
    toast.success(ok);
    setDlg(null);
    setReason("");
    setNote("");
    await load();
    onChanged();
    return true;
  }

  const load = useCallback(async () => {
    if (!id) return;
    const res = await fetch(`/api/applications/${id}`);
    if (!res.ok) { setErr(true); return; }
    setErr(false);
    setD(await res.json());
  }, [id]);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    fetch(`/api/applications/${id}`)
      .then(async (r) => {
        if (cancelled) return;
        if (r.ok) setD(await r.json());
        else setErr(true);
      })
      .catch(() => !cancelled && setErr(true));
    return () => {
      cancelled = true;
    };
  }, [id]);

  /** Opening the resume is what sets viewedAt (server-side). */
  const markViewed = useCallback(async () => {
    if (!id) return;
    const res = await fetch(`/api/applications/${id}/view`, { method: "POST" });
    if (res.ok) {
      const { viewedAt } = await res.json();
      setD((x) => (x ? { ...x, viewedAt } : x));
      onChanged();
    }
  }, [id, onChanged]);

  const changeTab = (t: Tab) => {
    setTab(t);
    if (t === "resume" && d && !d.viewedAt) markViewed();
  };

  async function submit() {
    if (!d) return;
    setBusy(true);
    const res = await fetch(`/api/applications/${d.id}/submit`, { method: "POST" });
    setBusy(false);
    if (!res.ok) { toast.error((await res.json())?.error?.message ?? "Could not submit."); return; }
    toast.success("Submitted to the client");
    await load();
    onChanged();
  }

  const unsure = d ? d.scores.filter((s) => s.confidence < 0.6).length : 0;
  const canSubmit = d && d.viewedAt && !d.submittedAt && d.consentStatus !== "WITHDRAWN" && ["PARSED", "NEEDS_REVIEW"].includes(d.parseStatus);
  const why = !d ? "" : d.submittedAt ? "Already submitted" : !d.viewedAt ? "Open this CV before submitting it to the client." : d.consentStatus === "WITHDRAWN" ? "Consent withdrawn" : "Still processing";

  return (
    <Drawer
      open={!!id}
      onClose={onClose}
      title="Candidate"
      footer={
        d && (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap gap-1">
              <Button variant="ghost" size="sm" onClick={() => setDlg("reject")} disabled={d.stage === "REJECTED"} disabledReason="Already rejected">Reject</Button>
              <Button variant="ghost" size="sm" onClick={() => setDlg("consent")}>Consent</Button>
              <Button variant="ghost" size="sm" onClick={() => setDlg("delete")}>Request deletion</Button>
            </div>
            <div className="flex items-center gap-3">
              <p className="hidden text-xs text-muted sm:block">{d.submittedAt ? "Submitted to the client" : !d.viewedAt ? "Open this CV before submitting it to the client." : "Ready to submit"}</p>
              <Button onClick={submit} loading={busy} disabled={!canSubmit} disabledReason={why}>Submit to client</Button>
            </div>
          </div>
        )
      }
    >
      {err ? (
        <div className="p-6"><ErrorState message="Could not load this candidate." onRetry={load} /></div>
      ) : !d ? (
        <div className="space-y-3 p-6"><Skeleton className="h-8 w-1/2" /><Skeleton className="h-4 w-1/3" /><Skeleton className="mt-6 h-24 w-full" /></div>
      ) : (
        <div>
          <div className="border-b border-line px-6 pb-0 pt-6">
            <div className="flex items-start gap-4 pr-10">
              <AvatarInitials name={d.name} size={48} />
              <div className="min-w-0 flex-1">
                <h2 className="display text-[28px]">{d.name}</h2>
                <p className="text-sm text-muted">{d.profile.currentRole ?? "Role not found"}{d.profile.currentCompany && ` · ${d.profile.currentCompany}`}</p>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <Badge tone={d.consentStatus === "GIVEN" ? "accent" : "warn"}>{d.consentStatus === "GIVEN" ? "Consent on record — hiring use only" : d.consentStatus === "WITHDRAWN" ? "Consent withdrawn" : "Consent pending"}</Badge>
                  {d.duplicateStatus !== "NONE" && d.duplicateStatus !== "IGNORED" && <Badge tone="warn">{d.duplicateStatus === "CONFIRMED" ? "Duplicate" : "Possible duplicate"}</Badge>}
                  {d.parseStatus === "NEEDS_REVIEW" && <Badge tone="warn">Needs review</Badge>}
                </div>
              </div>
              <div className="flex flex-col items-center gap-1">
                <ScoreRing score={d.overallScore} size={76} />
                <p className="label">{d.overallScore != null ? bandFor(d.overallScore) : "Not scored"}</p>
              </div>
            </div>
            <dl className="mt-4 grid grid-cols-2 gap-x-6 gap-y-1 text-[13px] sm:grid-cols-4">
              {[["Experience", d.profile.yearsExperience != null ? `${d.profile.yearsExperience} yrs` : "—"], ["Notice", d.profile.noticeDays != null ? `${d.profile.noticeDays} days` : "—"], ["Expected CTC", d.profile.expectedCtcLpa != null ? `${d.profile.expectedCtcLpa} LPA` : "—"], ["Location", d.location || d.profile.location || "—"]].map(([k, v]) => (
                <div key={k}><dt className="label">{k}</dt><dd className="font-medium">{v}</dd></div>
              ))}
            </dl>
            <dl className="mt-3 grid grid-cols-1 gap-x-6 text-[13px] text-muted sm:grid-cols-2">
              <div>{d.email || "No email found"}</div><div>{d.phone || "No phone found"}</div>
            </dl>
            <div className="mt-5">
              <Tabs value={tab} onChange={changeTab} tabs={[{ id: "overview", label: "Overview" }, { id: "resume", label: "Resume" }, { id: "scorecard", label: "Scorecard" }, { id: "activity", label: "Activity" }]} />
            </div>
          </div>

          <div className="p-6">
            {tab === "overview" && (
              <div className="space-y-5">
                {(unsure > 0 || d.reasons.length > 0) && (
                  <Notice tone="warn">
                    AI is unsure about {Math.max(unsure, 1)} criteri{Math.max(unsure, 1) === 1 ? "on" : "a"}. Open the CV before submitting.
                    {d.reasons.length > 0 && <ul className="mt-1 list-disc pl-5">{d.reasons.slice(0, 4).map((r) => <li key={r}>{r}</li>)}</ul>}
                  </Notice>
                )}
                <div>
                  <p className="label mb-1">Summary</p>
                  <p>{d.profile.summary || "No summary available."}</p>
                  <p className="mt-1 text-xs text-muted">{d.profile.source === "heuristic" ? "Generated by rules from the CV text, not by an AI model." : "Generated by AI from the CV. Facts only."}</p>
                </div>
                <div className="grid gap-5 sm:grid-cols-2">
                  <div><p className="label mb-1">Strengths</p><ul className="list-disc space-y-1 pl-5">{(d.profile.strengths?.length ? d.profile.strengths : ["None noted"]).map((s) => <li key={s}>{s}</li>)}</ul></div>
                  <div><p className="label mb-1">Gaps</p><ul className="list-disc space-y-1 pl-5">{(d.profile.gaps?.length ? d.profile.gaps : ["None noted"]).map((s) => <li key={s}>{s}</li>)}</ul></div>
                </div>
                <div className="flex items-center gap-2 text-sm"><span className="text-muted">Confidence</span><ConfidenceDot value={d.confidence} /></div>
              </div>
            )}

            {tab === "resume" && (
              <div>
                <div className="mb-3 flex items-center justify-between">
                  <p className="text-sm text-muted">{d.resumeFileName}</p>
                  <a href={`/api/files/${d.id}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-sm text-accent hover:underline">
                    Open in new tab <ExternalLink className="size-3.5" aria-hidden />
                  </a>
                </div>
                {d.resumeMime === "application/pdf" ? (
                  <iframe title="Resume" src={`/api/files/${d.id}#toolbar=0`} className="h-[70vh] w-full rounded-md border border-line" />
                ) : (
                  <pre className="max-h-[70vh] overflow-auto whitespace-pre-wrap rounded-md border border-line bg-surface-2 p-4 text-[13px] leading-6">{d.resumeText ?? "Text not available."}</pre>
                )}
              </div>
            )}

            {tab === "scorecard" && (
              <div className="space-y-4">
                <ul className="divide-y divide-line">
                  {d.scores.map((s) => (
                    <li key={s.criterionId} className="py-3.5">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{s.label}</span>
                          {s.mustHave && <Badge tone="accent">Must-have</Badge>}
                          <span className="text-xs text-muted">weight {s.weight}</span>
                        </div>
                        <div className="flex items-center gap-4"><ScoreBar score={s.score} /><ConfidenceDot value={s.confidence} /></div>
                      </div>
                      {s.evidenceQuote ? (
                        <Receipt label="Verified in CV" className="mt-2.5">“{s.evidenceQuote}”</Receipt>
                      ) : s.type === "SKILL" || s.type === "CUSTOM" || !s.grounded ? (
                        <p className="mt-2 text-[13px] text-muted">{s.score > 0 || s.confidence === 0 ? "Could not verify a verbatim line. Open the CV to check." : "No supporting line found in the CV."}</p>
                      ) : null}
                    </li>
                  ))}
                </ul>
                <ProfileEditor detail={d} onSaved={() => { load(); onChanged(); }} />
              </div>
            )}

            {tab === "activity" && (
              <ul className="space-y-3">
                {d.activity.length === 0 && <li className="text-muted">No activity yet.</li>}
                {d.activity.map((a) => (
                  <li key={a.id} className="flex items-baseline justify-between gap-4 text-sm">
                    <span>{ACTION[a.action] ?? a.action}<span className="text-muted"> · {a.actor}</span></span>
                    <time className="text-xs text-muted" dateTime={a.at}>{new Date(a.at).toLocaleString()}</time>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
      <Modal open={dlg === "reject"} onClose={() => setDlg(null)} title="Reject this candidate">
        <p className="mb-3 text-sm text-muted">The candidate stays searchable. This only moves them to Rejected.</p>
        <Select aria-label="Reason" value={reason} onChange={(e) => setReason(e.target.value)}>
          <option value="">Choose a reason</option>
          {REJECT_REASONS.map((r) => <option key={r}>{r}</option>)}
        </Select>
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setDlg(null)}>Cancel</Button>
          <Button variant="danger" loading={busy} disabled={!reason} disabledReason="Choose a reason" onClick={() => d && act(`/api/applications/${d.id}/reject`, { reason }, "Candidate rejected")}>Reject</Button>
        </div>
      </Modal>
      <Modal open={dlg === "consent"} onClose={() => setDlg(null)} title="Update consent">
        <Select aria-label="Consent status" value={consent} onChange={(e) => setConsent(e.target.value as typeof consent)}>
          <option value="GIVEN">Given</option><option value="PENDING">Pending</option><option value="WITHDRAWN">Withdrawn</option>
        </Select>
        <Field label="Note" hint="Required when withdrawing: how and when the candidate withdrew."><Textarea rows={3} value={note} onChange={(e) => setNote(e.target.value)} /></Field>
        {consent === "WITHDRAWN" && <p className="mt-2 text-xs text-warn">Withdrawn candidates are blocked from submission and hidden from the default ranking.</p>}
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setDlg(null)}>Cancel</Button>
          <Button loading={busy} disabled={consent === "WITHDRAWN" && !note.trim()} disabledReason="Add a note" onClick={() => d && act(`/api/candidates/${d.candidateId}/consent`, { status: consent, note }, "Consent updated")}>Save</Button>
        </div>
      </Modal>
      <Modal open={dlg === "delete"} onClose={() => setDlg(null)} title="Delete this candidate">
        <p className="text-sm">This removes the CV and parsed data. Scores stay anonymously for reporting.</p>
        <p className="mt-2 text-sm text-muted">Name, contact details, the file, parsed profile and evidence quotes are removed. The overall score and stage remain without any identity. This cannot be undone.</p>
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setDlg(null)}>Cancel</Button>
          {!delRequested ? (
            <Button variant="secondary" loading={busy} onClick={async () => { if (d && (await act(`/api/candidates/${d.candidateId}/deletion-request`, {}, "Deletion request recorded"))) setDelRequested(true); }}>Record request</Button>
          ) : null}
          <Button variant="danger" loading={busy} disabled={!delRequested} disabledReason="Record the deletion request first" onClick={async () => { if (d && (await act(`/api/candidates/${d.candidateId}/delete`, {}, "Candidate deleted"))) onClose(); }}>Delete now</Button>
        </div>
      </Modal>
    </Drawer>
  );
}

function ProfileEditor({ detail, onSaved }: { detail: Detail; onSaved: () => void }) {
  const p = detail.profile;
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ yearsExperience: p.yearsExperience ?? "", noticeDays: p.noticeDays ?? "", expectedCtcLpa: p.expectedCtcLpa ?? "", location: p.location ?? "" });
  const [saving, setSaving] = useState(false);
  if (!open) return <Button variant="secondary" size="sm" onClick={() => setOpen(true)}>Edit parsed fields</Button>;
  const num = (v: string | number) => (v === "" ? null : Number(v));
  async function save() {
    setSaving(true);
    const res = await fetch(`/api/applications/${detail.id}/profile`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ yearsExperience: num(f.yearsExperience), noticeDays: num(f.noticeDays), expectedCtcLpa: num(f.expectedCtcLpa), location: f.location || null }),
    });
    setSaving(false);
    if (!res.ok) { toast.error("Check the values and try again."); return; }
    toast.success("Profile saved and score recalculated");
    setOpen(false);
    onSaved();
  }
  return (
    <div className="rounded-md border border-line p-4">
      <p className="mb-3 text-sm text-muted">Edits re-run the numeric criteria. Skill evidence stays as quoted.</p>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Experience (yrs)"><Input type="number" step="0.5" value={f.yearsExperience} onChange={(e) => setF({ ...f, yearsExperience: e.target.value })} /></Field>
        <Field label="Notice (days)"><Input type="number" value={f.noticeDays} onChange={(e) => setF({ ...f, noticeDays: e.target.value })} /></Field>
        <Field label="Expected CTC (LPA)"><Input type="number" step="0.5" value={f.expectedCtcLpa} onChange={(e) => setF({ ...f, expectedCtcLpa: e.target.value })} /></Field>
        <Field label="Location"><Input value={f.location} onChange={(e) => setF({ ...f, location: e.target.value })} /></Field>
      </div>
      <div className="mt-4 flex justify-end gap-2">
        <Button variant="secondary" size="sm" onClick={() => setOpen(false)}>Cancel</Button>
        <Button size="sm" loading={saving} onClick={save}>Save and re-score</Button>
      </div>
    </div>
  );
}
