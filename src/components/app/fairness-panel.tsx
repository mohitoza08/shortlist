import Link from "next/link";
import type { AuditAction } from "@prisma/client";
import { db } from "@/lib/db";
import { compareAiToRecruiter } from "@/lib/fairness";
import { Badge, Button, Card, Select } from "@/components/ui/primitives";

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
      <p className="text-sm text-muted">AI ranks; recruiters decide. This is a sample, not a performance review.</p>

      <section>
        <h2 className="display mb-3 text-xl">Weekly sample: AI top 10 vs submitted</h2>
        {rows.length === 0 ? (
          <p className="rounded-[10px] border border-dashed border-line-strong px-6 py-10 text-center text-muted">No submissions yet, so there is nothing to compare.</p>
        ) : (
          <Card className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead className="border-b border-line bg-surface-2/60"><tr className="label">{["Requisition", "Submitted", "Overlap with AI top 10", "Avg AI rank of submitted", "Overrides"].map((h) => <th key={h} className="px-4 py-3 font-medium">{h}</th>)}</tr></thead>
              <tbody>
                {rows.map(({ r, f }) => (
                  <tr key={r.id} className="border-b border-line last:border-0">
                    <td className="px-4 py-3"><Link href={`/requisitions/${r.id}`} className="font-medium hover:text-accent">{r.title}</Link><p className="text-xs text-muted">{r.client.name}</p></td>
                    <td className="px-4 py-3 tabular-nums">{f.submitted}</td>
                    <td className="px-4 py-3"><div className="flex items-center gap-2"><div className="h-1.5 w-24 overflow-hidden rounded-full bg-surface-2"><div className="h-full bg-accent" style={{ width: `${f.overlapPct ?? 0}%` }} /></div><span className="tabular-nums">{f.overlapPct}%</span></div></td>
                    <td className="px-4 py-3 tabular-nums">{f.avgAiRankOfSubmitted ?? "—"}</td>
                    <td className="px-4 py-3 tabular-nums">{f.overrides}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        )}
      </section>

      <section>
        <h2 className="display mb-3 text-xl">Consent and deletion queue</h2>
        {queue.length === 0 ? (
          <p className="text-sm text-muted">No pending or withdrawn consents and no deletion requests.</p>
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
        <h2 className="display mb-3 text-xl">Access log</h2>
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
                  <time className="text-xs text-muted" dateTime={l.createdAt.toISOString()}>{l.createdAt.toLocaleString("en-IN")}</time>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </section>
    </div>
  );
}
