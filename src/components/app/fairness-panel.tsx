import Link from "next/link";
import type { AuditAction } from "@prisma/client";
import { db } from "@/lib/db";
import { compareAiToRecruiter } from "@/lib/fairness";
import { Badge, Button, Card, Progress, Select } from "@/components/ui/primitives";

const ACTIONS: AuditAction[] = ["CV_UPLOADED", "CV_VIEWED", "PROFILE_EDITED", "SUBMITTED", "CLIENT_VIEWED", "CLIENT_SHORTLISTED", "CLIENT_REJECTED", "SLOT_PROPOSED", "CONSENT_UPDATED", "DELETION_REQUESTED", "CANDIDATE_DELETED", "STAGE_CHANGED"];

export async function FairnessPanel({ action, actor }: { action?: string; actor?: string }) {
  const [reqs, queue, logs, users] = await Promise.all([
    db.requisition.findMany({
      include: { client: true, applications: { where: { candidate: { deletedAt: null } }, select: { id: true, overallScore: true, submittedAt: true } } },
    }),
    db.candidate.findMany({
      where: { OR: [{ consentStatus: { not: "GIVEN" } }, { deletionRequests: { some: {} } }] },
      include: { deletionRequests: { orderBy: { createdAt: "desc" }, take: 1 }, applications: { select: { requisitionId: true }, take: 1 } },
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
    db.auditLog.findMany({
      where: { ...(action ? { action: action as AuditAction } : {}), ...(actor ? { actorId: actor } : {}) },
      orderBy: { createdAt: "desc" },
      take: 50,
      include: { actor: { select: { name: true } } },
    }),
    db.user.findMany({ where: { role: "RECRUITER" }, select: { id: true, name: true } }),
  ]);

  const rows = reqs
    .map((r) => ({ r, f: compareAiToRecruiter(r.applications.map((a) => ({ id: a.id, score: a.overallScore, submitted: !!a.submittedAt }))) }))
    .filter((x) => x.f.submitted > 0);

  return (
    <div className="space-y-10">
      <div className="rounded-2xl border border-line bg-surface-2/60 px-5 py-4">
        <p className="label mb-1 text-accent">How to read this page</p>
        <p className="max-w-2xl text-[15px] leading-6 text-ink-2">AI ranks; recruiters decide. Here you can see whether they agree, who has consented, and who touched what. It is a sample, not a performance review.</p>
      </div>

      <section>
        <p className="label mb-1">Agreement</p>
        <h2 className="display mb-4 text-[22px]">AI top 10 vs what was submitted</h2>
        {rows.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-line-strong px-6 py-12 text-center text-muted">No submissions yet, so there is nothing to compare.</p>
        ) : (
          <Card className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead className="border-b border-line bg-surface-2/60"><tr className="label">{["Requisition", "Submitted", "Overlap with AI top 10", "Avg AI rank of submitted", "Overrides"].map((h) => <th key={h} className="px-4 py-3 font-medium">{h}</th>)}</tr></thead>
              <tbody>
                {rows.map(({ r, f }) => (
                  <tr key={r.id} className="border-b border-line last:border-0">
                    <td className="px-4 py-3"><Link href={`/requisitions/${r.id}`} className="font-medium hover:text-accent">{r.title}</Link><p className="text-xs text-muted">{r.client.name}</p></td>
                    <td className="mono px-4 py-3">{f.submitted}</td>
                    <td className="px-4 py-3"><div className="flex items-center gap-2"><Progress value={f.overlapPct ?? 0} max={100} label={`${f.overlapPct ?? 0} percent overlap with AI top 10`} className="w-24" /><span className="mono text-[13px]">{f.overlapPct}%</span></div></td>
                    <td className="mono px-4 py-3">{f.avgAiRankOfSubmitted ?? "—"}</td>
                    <td className="mono px-4 py-3">{f.overrides}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        )}
      </section>

      <section>
        <p className="label mb-1">Privacy</p>
        <h2 className="display mb-4 text-[22px]">Consent and deletion queue</h2>
        {queue.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-line-strong px-6 py-8 text-center text-sm text-muted">Clean. No pending or withdrawn consents and no deletion requests.</p>
        ) : (
          <Card>
            <ul>
              {queue.map((c) => {
                const d = c.deletionRequests[0];
                return (
                  <li key={c.id} className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-4 py-3 text-sm last:border-0">
                    <span className="font-medium">{c.deletedAt ? "Deleted candidate" : c.fullName}</span>
                    <span className="flex gap-2">
                      {c.consentStatus !== "GIVEN" && <Badge tone="warn">Consent {c.consentStatus.toLowerCase()}</Badge>}
                      {d && <Badge tone={d.processedAt ? "neutral" : "danger"}>{d.processedAt ? "Deletion processed" : "Deletion requested"}</Badge>}
                    </span>
                  </li>
                );
              })}
            </ul>
          </Card>
        )}
      </section>

      <section>
        <p className="label mb-1">Accountability</p>
        <h2 className="display mb-4 text-[22px]">Access log</h2>
        <form className="mb-3 flex flex-wrap gap-2">
          <input type="hidden" name="tab" value="fairness" />
          <Select name="action" defaultValue={action ?? ""} aria-label="Action" className="w-56"><option value="">All actions</option>{ACTIONS.map((a) => <option key={a} value={a}>{a.replace(/_/g, " ").toLowerCase()}</option>)}</Select>
          <Select name="actor" defaultValue={actor ?? ""} aria-label="Actor" className="w-48"><option value="">All recruiters</option>{users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}</Select>
          <Button type="submit" variant="secondary">Filter</Button>
        </form>
        <Card>
          {logs.length === 0 ? <p className="px-4 py-6 text-sm text-muted">No events match.</p> : (
            <ul>
              {logs.map((l) => (
                <li key={l.id} className="flex flex-wrap items-baseline justify-between gap-2 border-b border-line px-4 py-2.5 text-sm last:border-0">
                  <span><span className="font-medium">{l.actor?.name ?? "System"}</span> · {l.action.replace(/_/g, " ").toLowerCase()} <span className="text-muted">· {l.entityType} {l.entityId.slice(-6)}</span></span>
                  <time className="mono text-[11.5px] text-muted" dateTime={l.createdAt.toISOString()}>{l.createdAt.toLocaleString("en-IN")}</time>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </section>
    </div>
  );
}
