"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { Badge, AvatarInitials, Button, Card, Checkbox, ConfidenceDot, EmptyState, Input, Notice, ScoreBar, Select, Switch } from "@/components/ui/primitives";
import { CandidateDrawer } from "./candidate-drawer";

export type RankedRow = {
  id: string; name: string; fileName: string; role: string | null; years: number | null; notice: number | null;
  location: string; score: number | null; confidence: number | null;
  status: "PENDING" | "PROCESSING" | "PARSED" | "NEEDS_REVIEW" | "FAILED" | "QUEUED";
  reasons: string[]; stage: string; duplicate: string; viewed: boolean; submitted: boolean;
  consent: "GIVEN" | "PENDING" | "WITHDRAWN"; mustMet: number; mustTotal: number; topQuote: string | null;
  createdAt: string; skills: string[];
};

const STAGE_LABEL: Record<string, string> = {
  SOURCED: "Sourced", SCREENED: "Screened", SHORTLISTED: "Shortlisted", SUBMITTED: "Submitted", CLIENT_REVIEW: "Client review",
  INTERVIEW: "Interview", OFFERED: "Offered", JOINED: "Joined", REJECTED: "Rejected",
};

export function RankedClient({ requisitionId, rows, noticeMax }: { requisitionId: string; rows: RankedRow[]; noticeMax: number }) {
  const router = useRouter();
  const path = usePathname();
  const sp = useSearchParams();
  const open = sp.get("candidate");

  const [q, setQ] = useState("");
  const [minScore, setMinScore] = useState(0);
  const [noticeLe, setNoticeLe] = useState("");
  const [conf, setConf] = useState("");
  const [stage, setStage] = useState("");
  const [showLow, setShowLow] = useState(true);
  const [dupOnly, setDupOnly] = useState(false);
  const [showWithdrawn, setShowWithdrawn] = useState(false);
  const [sort, setSort] = useState("score");
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [submitting, setSubmitting] = useState(false);

  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase();
    const list = rows.filter((r) => {
      if (t && !(r.name.toLowerCase().includes(t) || r.skills.some((s) => s.includes(t)) || (r.role ?? "").toLowerCase().includes(t))) return false;
      if (r.score != null && r.score < minScore) return false;
      if (!showLow && r.score != null && r.score < 40) return false;
      if (noticeLe && (r.notice == null || r.notice > Number(noticeLe))) return false;
      if (conf) {
        const c = r.confidence ?? 0;
        const band = c >= 0.8 ? "High" : c >= 0.6 ? "Medium" : "Low";
        if (band !== conf) return false;
      }
      if (stage && r.stage !== stage) return false;
      if (dupOnly && r.duplicate === "NONE") return false;
      if (!showWithdrawn && r.consent === "WITHDRAWN") return false;
      return true;
    });
    const by: Record<string, (a: RankedRow, b: RankedRow) => number> = {
      score: (a, b) => (b.score ?? -1) - (a.score ?? -1),
      experience: (a, b) => (b.years ?? -1) - (a.years ?? -1),
      notice: (a, b) => (a.notice ?? 999) - (b.notice ?? 999),
      newest: (a, b) => b.createdAt.localeCompare(a.createdAt),
    };
    return [...list].sort(by[sort]);
  }, [rows, q, minScore, showLow, noticeLe, conf, stage, dupOnly, showWithdrawn, sort]);

  const setCandidate = (id: string | null) => {
    const p = new URLSearchParams(sp.toString());
    if (id) p.set("candidate", id);
    else p.delete("candidate");
    router.replace(`${path}${p.size ? `?${p}` : ""}`, { scroll: false });
  };

  const selectable = (r: RankedRow) => !r.submitted && r.consent !== "WITHDRAWN" && (r.status === "PARSED" || r.status === "NEEDS_REVIEW");
  const selectedRows = rows.filter((r) => sel.has(r.id));
  const unviewed = selectedRows.filter((r) => !r.viewed).length;

  async function submitSelected() {
    setSubmitting(true);
    let ok = 0;
    for (const r of selectedRows) {
      const res = await fetch(`/api/applications/${r.id}/submit`, { method: "POST" });
      if (res.ok) ok++;
      else toast.error((await res.json())?.error?.message ?? "Could not submit.");
    }
    setSubmitting(false);
    setSel(new Set());
    if (ok) toast.success(`${ok} candidate${ok === 1 ? "" : "s"} submitted to the client`);
    router.refresh();
  }

  if (rows.length === 0) {
    return (
      <EmptyState
        title="No CVs yet"
        body="Upload a batch to see candidates ranked against this scorecard."
        action={<Link href={`/requisitions/${requisitionId}/upload`}><Button>Upload CVs</Button></Link>}
      />
    );
  }

  const processing = rows.filter((r) => ["PENDING", "PROCESSING", "QUEUED"].includes(r.status)).length;

  return (
    <>
      {processing > 0 && (
        <div className="mb-4">
          <Notice tone="accent">
            {processing} CV{processing === 1 ? " is" : "s are"} still being read. <Link className="underline" href={`/requisitions/${requisitionId}/upload`}>Open the upload page</Link> to continue processing.
          </Notice>
        </div>
      )}

      <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-[1.4fr_110px_120px_170px_150px_160px]">
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name or skill" aria-label="Search name or skill" />
        <Input type="number" min={0} max={100} value={minScore || ""} onChange={(e) => setMinScore(Number(e.target.value) || 0)} placeholder="Min score" aria-label="Minimum score" />
        <Input type="number" min={0} value={noticeLe} onChange={(e) => setNoticeLe(e.target.value)} placeholder={`Notice ≤ ${noticeMax}`} aria-label="Maximum notice days" />
        <Select value={conf} onChange={(e) => setConf(e.target.value)} aria-label="Confidence">
          <option value="">Any confidence</option><option>High</option><option>Medium</option><option>Low</option>
        </Select>
        <Select value={stage} onChange={(e) => setStage(e.target.value)} aria-label="Stage">
          <option value="">All stages</option>
          {Object.entries(STAGE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </Select>
        <Select value={sort} onChange={(e) => setSort(e.target.value)} aria-label="Sort">
          <option value="score">Sort: score</option><option value="experience">Sort: experience</option><option value="notice">Sort: notice</option><option value="newest">Sort: newest</option>
        </Select>
      </div>
      <div className="mb-5 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
        <label className="flex items-center gap-2">Show low scorers <Switch label="Show low scorers" checked={showLow} onChange={setShowLow} /></label>
        <label className="flex items-center gap-2">Duplicates only <Switch label="Duplicates only" checked={dupOnly} onChange={setDupOnly} /></label>
        <label className="flex items-center gap-2">Show withdrawn consent <Switch label="Show withdrawn consent" checked={showWithdrawn} onChange={setShowWithdrawn} /></label>
        <span className="text-muted">{filtered.length} of {rows.length} candidates</span>
      </div>

      {selectedRows.length > 0 && (
        <Card className="mb-4 flex flex-wrap items-center justify-between gap-3 px-4 py-3">
          <p className="text-sm">
            {selectedRows.length} selected{unviewed > 0 && <span className="text-warn"> · {unviewed} need review before submitting</span>}
          </p>
          <Button onClick={submitSelected} loading={submitting} disabled={unviewed > 0} disabledReason="Open each CV before submitting it to the client">
            Submit to client
          </Button>
        </Card>
      )}

      {filtered.length === 0 ? (
        <EmptyState title="No candidates match these filters" action={<Button variant="secondary" onClick={() => { setQ(""); setMinScore(0); setNoticeLe(""); setConf(""); setStage(""); setShowLow(true); setDupOnly(false); setShowWithdrawn(false); }}>Clear filters</Button>} />
      ) : (
        <>
          <Card className="hidden overflow-hidden lg:block">
            <table className="w-full text-left">
              <thead className="border-b border-line bg-surface-2/60">
                <tr className="label">
                  <th className="w-10 px-4 py-3" />
                  <th className="px-2 py-3 font-medium">#</th>
                  <th className="px-3 py-3 font-medium">Candidate</th>
                  <th className="px-3 py-3 font-medium">Score</th>
                  <th className="px-3 py-3 font-medium">Must-have</th>
                  <th className="px-3 py-3 font-medium">Notice</th>
                  <th className="px-3 py-3 font-medium">Location</th>
                  <th className="px-3 py-3 font-medium">Confidence</th>
                  <th className="px-3 py-3 font-medium">Stage</th>
                  <th className="px-3 py-3" />
                </tr>
              </thead>
              <tbody>
                {filtered.map((r, i) => (
                  <tr key={r.id} className="border-b border-line align-top last:border-0 t-fast hover:bg-surface-2/50">
                    <td className="px-4 py-3.5">
                      <Checkbox aria-label={`Select ${r.name}`} checked={sel.has(r.id)} disabled={!selectable(r)} title={!selectable(r) ? (r.submitted ? "Already submitted" : r.consent === "WITHDRAWN" ? "Consent withdrawn" : "Still processing") : undefined}
                        onChange={(e) => setSel((s) => { const n = new Set(s); if (e.target.checked) n.add(r.id); else n.delete(r.id); return n; })} />
                    </td>
                    <td className="px-2 py-3.5 text-muted">{r.score == null ? "–" : i + 1}</td>
                    <td className="px-3 py-3.5">
                      <button onClick={() => setCandidate(r.id)} className="flex items-start gap-3 text-left">
                        <AvatarInitials name={r.name} />
                        <span className="min-w-0">
                          <span className="block font-medium hover:text-accent">{r.name}</span>
                          <span className="block text-xs text-muted">{r.role ?? "Role not found"}{r.years != null && ` · ${r.years} yrs`}</span>
                          {r.topQuote && <span className="mt-1 block max-w-[320px] truncate text-xs italic text-muted" title={r.topQuote}>“{r.topQuote}”</span>}
                          {r.duplicate !== "NONE" && r.duplicate !== "IGNORED" && <Badge tone="warn" className="mt-1">{r.duplicate === "CONFIRMED" ? "Duplicate" : "Possible duplicate"}</Badge>}
                        </span>
                      </button>
                    </td>
                    <td className="px-3 py-3.5">
                      {r.status === "PARSED" || r.status === "NEEDS_REVIEW" ? <ScoreBar score={r.score} /> : <StatusBadge s={r.status} />}
                    </td>
                    <td className="px-3 py-3.5 tabular-nums">{r.mustTotal ? `${r.mustMet}/${r.mustTotal}` : "—"}</td>
                    <td className="px-3 py-3.5 tabular-nums">{r.notice != null ? `${r.notice}d` : "—"}</td>
                    <td className="px-3 py-3.5">{r.location || "—"}</td>
                    <td className="px-3 py-3.5">
                      <ConfidenceDot value={r.confidence} />
                      {r.status === "NEEDS_REVIEW" && <Badge tone="warn" className="mt-1">Needs review</Badge>}
                    </td>
                    <td className="px-3 py-3.5"><Badge tone={r.submitted ? "accent" : "neutral"}>{STAGE_LABEL[r.stage]}</Badge></td>
                    <td className="px-3 py-3.5 text-right"><Button size="sm" variant="secondary" onClick={() => setCandidate(r.id)}>Open</Button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>

          <ul className="space-y-3 lg:hidden">
            {filtered.map((r) => (
              <li key={r.id}>
                <Card className="p-4">
                  <button onClick={() => setCandidate(r.id)} className="flex w-full items-start gap-3 text-left">
                    <AvatarInitials name={r.name} />
                    <div className="min-w-0 flex-1">
                      <p className="font-medium">{r.name}</p>
                      <p className="text-xs text-muted">{r.role ?? "Role not found"}{r.years != null && ` · ${r.years} yrs`}</p>
                      <div className="mt-2 flex items-center gap-3">
                        {r.status === "PARSED" || r.status === "NEEDS_REVIEW" ? <ScoreBar score={r.score} /> : <StatusBadge s={r.status} />}
                        <ConfidenceDot value={r.confidence} />
                      </div>
                      {r.topQuote && <p className="mt-2 line-clamp-2 text-xs italic text-muted">“{r.topQuote}”</p>}
                    </div>
                  </button>
                </Card>
              </li>
            ))}
          </ul>
        </>
      )}

      <CandidateDrawer key={open ?? "none"} id={open} onClose={() => setCandidate(null)} onChanged={() => router.refresh()} />
    </>
  );
}

function StatusBadge({ s }: { s: RankedRow["status"] }) {
  if (s === "FAILED") return <Badge tone="danger">Failed</Badge>;
  if (s === "QUEUED") return <Badge tone="warn">Queued — provider limit</Badge>;
  return <Badge tone="accent">Reading…</Badge>;
}
