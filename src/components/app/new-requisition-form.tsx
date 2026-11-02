"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Trash2, Plus, Wand2 } from "lucide-react";
import { Badge, Button, Card, ErrorState, Field, Input, Modal, Select, Skeleton, Switch, Textarea } from "@/components/ui/primitives";
import { normaliseWeights } from "@/lib/ai/score";
import type { CriterionInput } from "@/lib/ai/schema";

const SAMPLE_JD = `Senior Java Developer, 5-8 years, Spring Boot, Noida, notice up to 60 days

Client: Ashford Bank. We need a hands-on backend engineer to build and run payment services.

Must have: Java, Spring Boot, microservices. Nice to have: Hibernate, REST APIs.
Budget up to 28 LPA. Location: Noida (hybrid).`;

const TYPE_LABEL: Record<CriterionInput["type"], string> = {
  SKILL: "Skill", EXPERIENCE: "Experience", NOTICE: "Notice", LOCATION: "Location", CTC: "CTC", CUSTOM: "Custom",
};

type State = "idle" | "extracting" | "error";

export function NewRequisitionForm({ clients }: { clients: { id: string; name: string }[] }) {
  const router = useRouter();
  const [jd, setJd] = useState("");
  const [state, setState] = useState<State>("idle");
  const [errMsg, setErrMsg] = useState("");
  const [dirty, setDirty] = useState(false);
  const [confirmReextract, setConfirmReextract] = useState(false);
  const [saving, setSaving] = useState(false);
  const [touched, setTouched] = useState(false);

  const [title, setTitle] = useState("");
  const [clientId, setClientId] = useState("");
  const [location, setLocation] = useState("");
  const [minExp, setMinExp] = useState(0);
  const [maxExp, setMaxExp] = useState(3);
  const [notice, setNotice] = useState(60);
  const [ctc, setCtc] = useState<string>("");
  const [criteria, setCriteria] = useState<CriterionInput[]>([]);

  const total = useMemo(() => criteria.reduce((a, c) => a + c.weight, 0), [criteria]);
  const scored = criteria.filter((c) => c.weight > 0 || c.mustHave);
  const bonus = criteria.filter((c) => c.weight === 0 && !c.mustHave);

  const edit = <T,>(setter: (v: T) => void) => (v: T) => {
    setDirty(true);
    setter(v);
  };

  async function extract() {
    setConfirmReextract(false);
    setState("extracting");
    setErrMsg("");
    try {
      const res = await fetch("/api/scorecard/extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jdText: jd }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error?.message ?? "Could not read the JD.");
      const x = data.extraction;
      setTitle(x.title);
      setLocation(x.location);
      setMinExp(x.minExpYears);
      setMaxExp(x.maxExpYears);
      setNotice(x.noticeMaxDays);
      setCtc(x.ctcMaxLpa == null ? "" : String(x.ctcMaxLpa));
      setCriteria(data.criteria);
      setDirty(false);
      setState("idle");
      if (data.source === "heuristic") toast.message("Read with rules, not the AI model. Check each criterion.");
    } catch (e) {
      setErrMsg(e instanceof Error ? e.message : "Could not read the JD.");
      setState("error");
    }
  }

  function onExtractClick() {
    if (dirty && criteria.length) setConfirmReextract(true);
    else extract();
  }

  const update = (i: number, patch: Partial<CriterionInput>) => {
    setDirty(true);
    setCriteria((cs) => cs.map((c, idx) => (idx === i ? { ...c, ...patch } : c)));
  };

  const errors = {
    title: touched && title.trim().length < 2 ? "Add a role title." : "",
    client: touched && !clientId ? "Choose a client." : "",
    criteria: touched && criteria.length === 0 ? "Add at least one criterion." : "",
    exp: maxExp < minExp ? "Max experience must be at least the minimum." : "",
  };
  const canSave = title.trim().length >= 2 && !!clientId && criteria.length > 0 && !errors.exp;
  const reason = !title.trim() ? "Add a role title" : !clientId ? "Choose a client" : criteria.length === 0 ? "Add at least one criterion" : errors.exp;

  async function save() {
    setTouched(true);
    if (!canSave) return;
    setSaving(true);
    const res = await fetch("/api/requisitions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        clientId, title: title.trim(), jdText: jd, location: location.trim(),
        minExpYears: minExp, maxExpYears: maxExp, noticeMaxDays: notice,
        ctcMaxLpa: ctc === "" ? null : Number(ctc), criteria,
      }),
    });
    const data = await res.json();
    setSaving(false);
    if (!res.ok) {
      toast.error(data?.error?.message ?? "Could not save the requisition.");
      return;
    }
    toast.success("Requisition saved");
    router.push(`/requisitions/${data.id}/upload`);
  }

  const row = (c: CriterionInput, i: number) => (
    <li key={i} className="grid gap-3 border-b border-line py-3 last:border-0 sm:grid-cols-[1fr_auto]">
      <div className="flex items-center gap-3">
        <Badge>{TYPE_LABEL[c.type]}</Badge>
        <Input aria-label="Criterion label" value={c.label} onChange={(e) => update(i, { label: e.target.value })} className="h-9" />
      </div>
      <div className="flex items-center gap-4">
        <label className="flex items-center gap-2 text-xs text-muted">
          Must-have
          <Switch label={`${c.label} must-have`} checked={c.mustHave} onChange={(v) => update(i, { mustHave: v })} />
        </label>
        <div className="flex items-center gap-2">
          <input
            type="range" min={0} max={40} value={c.weight} aria-label={`${c.label} weight`}
            onChange={(e) => update(i, { weight: Number(e.target.value) })}
            className="w-28 accent-[var(--accent)]"
          />
          <span className="w-7 text-right text-sm font-semibold tabular-nums">{c.weight}</span>
        </div>
        <button aria-label={`Remove ${c.label}`} onClick={() => { setDirty(true); setCriteria((cs) => cs.filter((_, idx) => idx !== i)); }} className="grid size-9 place-items-center rounded-md text-muted t-fast hover:bg-danger-soft hover:text-danger">
          <Trash2 className="size-4" />
        </button>
      </div>
    </li>
  );

  return (
    <div className="grid gap-6 lg:grid-cols-[55fr_45fr]">
      <section>
        <Field label="Paste the job description" htmlFor="jd" hint={`${jd.length.toLocaleString()} characters`}>
          <Textarea id="jd" rows={16} value={jd} onChange={(e) => setJd(e.target.value)} placeholder="Paste the JD the client emailed." />
        </Field>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <Button onClick={onExtractClick} loading={state === "extracting"} disabled={jd.trim().length < 20} disabledReason="Paste at least a few lines of the JD">
            <Wand2 className="size-4" aria-hidden /> Extract scorecard
          </Button>
          <button type="button" className="text-sm text-accent underline-offset-2 hover:underline" onClick={() => setJd(SAMPLE_JD)}>
            Use sample JD
          </button>
        </div>
        {state === "error" && (
          <div className="mt-4">
            <ErrorState message={`${errMsg} You can also fill the scorecard by hand.`} onRetry={extract} />
          </div>
        )}
      </section>

      <Card className="p-5">
        <h2 className="display text-xl">Scorecard</h2>
        {state === "extracting" ? (
          <div className="mt-4 space-y-3" aria-live="polite">
            <p className="text-sm text-muted">Reading the JD…</p>
            {[0, 1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-10 w-full" />)}
          </div>
        ) : (
          <>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <Field label="Role title" error={errors.title} htmlFor="title">
                <Input id="title" value={title} onChange={(e) => edit(setTitle)(e.target.value)} invalid={!!errors.title} />
              </Field>
              <Field label="Client" error={errors.client} htmlFor="client">
                <Select id="client" value={clientId} onChange={(e) => setClientId(e.target.value)}>
                  <option value="">Choose a client</option>
                  {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </Select>
              </Field>
              <Field label="Location" htmlFor="loc">
                <Input id="loc" value={location} onChange={(e) => edit(setLocation)(e.target.value)} />
              </Field>
              <Field label="CTC max (LPA)" htmlFor="ctc">
                <Input id="ctc" type="number" min={0} step="0.5" value={ctc} onChange={(e) => edit(setCtc)(e.target.value)} placeholder="No limit" />
              </Field>
              <Field label="Experience min (yrs)" htmlFor="min">
                <Input id="min" type="number" min={0} value={minExp} onChange={(e) => edit(setMinExp)(Number(e.target.value))} />
              </Field>
              <Field label="Experience max (yrs)" htmlFor="max" error={errors.exp}>
                <Input id="max" type="number" min={0} value={maxExp} onChange={(e) => edit(setMaxExp)(Number(e.target.value))} invalid={!!errors.exp} />
              </Field>
              <Field label="Notice max (days)" htmlFor="notice">
                <Input id="notice" type="number" min={0} value={notice} onChange={(e) => edit(setNotice)(Number(e.target.value))} />
              </Field>
            </div>

            <div className="mt-6 flex items-center justify-between">
              <p className="label">Criteria</p>
              {criteria.length > 0 && (
                total === 100 ? (
                  <Badge tone="success">Weights total 100%</Badge>
                ) : (
                  <span className="flex items-center gap-2">
                    <Badge tone="warn">Weights total {total}%</Badge>
                    <button className="text-xs text-accent underline-offset-2 hover:underline" onClick={() => { setDirty(true); setCriteria((cs) => normaliseWeights(cs)); }}>
                      Normalise
                    </button>
                  </span>
                )
              )}
            </div>

            {criteria.length === 0 ? (
              <p className="mt-3 rounded-md bg-surface-2 px-4 py-6 text-center text-sm text-muted">
                No criteria yet. Extract them from the JD, or add them by hand.
              </p>
            ) : (
              <>
                <ul className="mt-1">{criteria.map((c, i) => (c.weight > 0 || c.mustHave ? row(c, i) : null))}</ul>
                {bonus.length > 0 && (
                  <>
                    <p className="label mt-5">Nice to have · bonus</p>
                    <ul className="mt-1">{criteria.map((c, i) => (c.weight === 0 && !c.mustHave ? row(c, i) : null))}</ul>
                  </>
                )}
              </>
            )}
            {errors.criteria && <p role="alert" className="mt-2 text-xs text-danger">{errors.criteria}</p>}
            <Button
              variant="secondary" size="sm" className="mt-3"
              onClick={() => { setDirty(true); setCriteria((cs) => [...cs, { label: "New skill", type: "SKILL", weight: 0, mustHave: false, expectedValue: null }]); }}
            >
              <Plus className="size-4" aria-hidden /> Add criterion
            </Button>
            {scored.length === 0 && criteria.length > 0 && <p className="mt-2 text-xs text-muted">Every criterion is a bonus. Give at least one a weight.</p>}

            <div className="mt-6 flex justify-end border-t border-line pt-4">
              <Button onClick={save} loading={saving} disabled={!canSave} disabledReason={reason}>
                Save requisition
              </Button>
            </div>
          </>
        )}
      </Card>

      <Modal open={confirmReextract} onClose={() => setConfirmReextract(false)} title="Replace your edits?">
        <p className="text-sm text-muted">Extracting again will replace the scorecard you have edited. This cannot be undone.</p>
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setConfirmReextract(false)}>Keep my edits</Button>
          <Button onClick={extract}>Replace scorecard</Button>
        </div>
      </Modal>
    </div>
  );
}
