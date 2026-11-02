"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { Upload } from "lucide-react";
import { Badge, Button, Card, Checkbox, Notice } from "@/components/ui/primitives";
import { cn } from "@/lib/utils";

const MAX_FILES = 500;
const MAX_BYTES = 10 * 1024 * 1024;

type Status = "Queued" | "Uploading" | "Parsing" | "Ready" | "Needs review" | "Duplicate" | "Possible duplicate" | "Failed" | "Provider limit";
type Row = { key: string; name: string; size: number; status: Status; note?: string; appId?: string; file?: File };

const TONE: Record<Status, "neutral" | "accent" | "warn" | "danger" | "success"> = {
  Queued: "neutral", Uploading: "accent", Parsing: "accent", Ready: "success", "Needs review": "warn",
  Duplicate: "neutral", "Possible duplicate": "warn", Failed: "danger", "Provider limit": "warn",
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const kb = (n: number) => (n > 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);

export function UploadClient({ requisitionId, mustHaves }: { requisitionId: string; mustHaves: string[] }) {
  const [rows, setRows] = useState<Row[]>([]);
  const [consent, setConsent] = useState(false);
  const [drag, setDrag] = useState(false);
  const [rejected, setRejected] = useState<string[]>([]);
  const processing = useRef(false);
  const procQueue = useRef<string[]>([]);
  const appIds = useRef(new Map<string, string>());
  const inputRef = useRef<HTMLInputElement>(null);

  const patch = useCallback((key: string, p: Partial<Row>) => setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...p } : r))), []);

  /** One CV at a time through the AI step (master §9.8). */
  const drain = useCallback(async () => {
    if (processing.current) return;
    processing.current = true;
    while (procQueue.current.length) {
      const key = procQueue.current.shift()!;
      const appId = appIds.current.get(key);
      if (!appId) continue;
      for (let attempt = 0; attempt < 4; attempt++) {
        patch(key, { status: "Parsing", note: undefined });
        try {
          const res = await fetch(`/api/applications/${appId}/process`, { method: "POST" });
          const out = await res.json();
          if (out.status === "PARSED") { patch(key, { status: "Ready" }); break; }
          if (out.status === "NEEDS_REVIEW") { patch(key, { status: "Needs review", note: out.reasons?.[0] }); break; }
          if (out.status === "QUEUED") {
            patch(key, { status: "Provider limit", note: `Queued — provider limit. Retrying in ${out.retryAfterSeconds}s.` });
            await sleep(Math.min(out.retryAfterSeconds, 60) * 1000);
            continue;
          }
          patch(key, { status: "Failed", note: out.message ?? out.error?.message ?? "Processing failed." });
          break;
        } catch {
          patch(key, { status: "Failed", note: "Network error. Retry." });
          break;
        }
      }
    }
    processing.current = false;
  }, [patch]);

  const uploadOne = useCallback(
    async (row: Row) => {
      patch(row.key, { status: "Uploading" });
      try {
        const fd = new FormData();
        fd.append("file", row.file!);
        fd.append("consent", "true");
        const res = await fetch(`/api/requisitions/${requisitionId}/applications`, { method: "POST", body: fd });
        const out = await res.json();
        if (!res.ok) { patch(row.key, { status: "Failed", note: out?.error?.message ?? "Upload failed." }); return; }
        if (out.status === "DUPLICATE") { patch(row.key, { status: "Duplicate", note: "Already in this requisition.", appId: out.applicationId, file: undefined }); return; }
        appIds.current.set(row.key, out.applicationId);
        patch(row.key, { appId: out.applicationId, file: undefined });
        procQueue.current.push(row.key);
        drain();
      } catch {
        patch(row.key, { status: "Failed", note: "Upload failed. Retry." });
      }
    },
    [patch, requisitionId, drain],
  );

  async function addFiles(files: File[]) {
    const bad: string[] = [];
    const ok: Row[] = [];
    const room = MAX_FILES - rows.length;
    for (const f of files) {
      const okType = /\.(pdf|docx)$/i.test(f.name);
      if (!okType) bad.push(`${f.name}: only PDF or DOCX files are accepted.`);
      else if (f.size > MAX_BYTES) bad.push(`${f.name}: over 10 MB.`);
      else if (ok.length >= room) bad.push(`${f.name}: the 500 CV limit was reached.`);
      else ok.push({ key: crypto.randomUUID(), name: f.name, size: f.size, status: "Queued", file: f });
    }
    setRejected(bad);
    setRows((rs) => [...rs, ...ok]);
    // upload with concurrency 3
    const pending = [...ok];
    await Promise.all(
      [0, 1, 2].map(async () => {
        while (pending.length) await uploadOne(pending.shift()!);
      }),
    );
  }

  /** Resume anything that was uploaded but not finished (processing is driven from this page). */
  useEffect(() => {
    (async () => {
      const res = await fetch(`/api/requisitions/${requisitionId}/applications`);
      if (!res.ok) return;
      const { items } = await res.json();
      const resumed: Row[] = items
        .filter((a: { parseStatus: string }) => ["PENDING", "QUEUED", "PROCESSING"].includes(a.parseStatus))
        .map((a: { id: string; resumeFileName: string }) => ({ key: a.id, appId: a.id, name: a.resumeFileName, size: 0, status: "Queued" as Status }));
      if (resumed.length) {
        for (const r of resumed) appIds.current.set(r.key, r.appId!);
        setRows((rs) => [...resumed, ...rs]);
        procQueue.current.push(...resumed.map((r) => r.key));
        drain();
      }
    })();
  }, [requisitionId, drain]);

  async function trySamples() {
    const idx = await (await fetch("/samples/index.json")).json();
    const files = await Promise.all(
      (idx.starter as string[]).map(async (n) => new File([await (await fetch(`/samples/${n}`)).blob()], n, { type: "application/pdf" })),
    );
    addFiles(files);
  }

  async function retry(row: Row) {
    if (row.appId) {
      await fetch(`/api/applications/${row.appId}/retry`, { method: "POST" }).catch(() => null);
      procQueue.current.push(row.key);
      patch(row.key, { status: "Queued", note: undefined });
      drain();
    }
  }

  const count = (s: Status[]) => rows.filter((r) => s.includes(r.status)).length;
  const ready = count(["Ready", "Needs review", "Possible duplicate"]);
  const busy = count(["Queued", "Uploading", "Parsing", "Provider limit"]);

  return (
    <div className="space-y-6">
      <Card className="p-4">
        <p className="label mb-2">Must-have skills</p>
        <div className="flex flex-wrap gap-2">
          {mustHaves.length ? mustHaves.map((m) => <Badge key={m} tone="accent">{m}</Badge>) : <span className="text-sm text-muted">No must-have skills set.</span>}
        </div>
      </Card>

      <Card className="p-5">
        <Checkbox
          checked={consent}
          onChange={(e) => setConsent(e.target.checked)}
          label="I confirm each candidate has consented to hiring use. I can record withdrawal or deletion later."
        />
        <div
          onDragOver={(e) => { e.preventDefault(); if (consent) setDrag(true); }}
          onDragLeave={() => setDrag(false)}
          onDrop={(e) => { e.preventDefault(); setDrag(false); if (consent) addFiles([...e.dataTransfer.files]); }}
          className={cn(
            "mt-4 flex flex-col items-center justify-center rounded-[10px] border-2 border-dashed px-6 py-12 text-center t-fast",
            drag ? "border-accent bg-accent-soft" : "border-line-strong",
            !consent && "opacity-60",
          )}
        >
          <Upload className="mb-3 size-6 text-muted" aria-hidden />
          <p className="display text-xl">{rows.length ? "Drop more CVs here" : "Drop CVs here"}</p>
          <p className="mt-1 text-sm text-muted">PDF or DOCX, up to 500 files, 10 MB each.</p>
          <div className="mt-4 flex flex-wrap justify-center gap-2">
            <Button variant="secondary" disabled={!consent} disabledReason="Confirm candidate consent first" onClick={() => inputRef.current?.click()}>
              Choose files
            </Button>
            {rows.length === 0 && (
              <Button variant="ghost" disabled={!consent} disabledReason="Confirm candidate consent first" onClick={trySamples}>
                Try 3 sample CVs
              </Button>
            )}
          </div>
          <input ref={inputRef} type="file" multiple accept=".pdf,.docx" className="sr-only" aria-label="Choose CV files"
            onChange={(e) => { addFiles([...(e.target.files ?? [])]); e.target.value = ""; }} />
        </div>
        {!consent && <p className="mt-2 text-xs text-muted">Confirm consent to enable uploading.</p>}
      </Card>

      {rows.length > 50 && <Notice tone="warn">Free-tier AI processes batches slowly. Keep this tab open; unfinished CVs resume the next time you open this page.</Notice>}
      {busy > 0 && <Notice tone="accent">Reading CVs. Keep this page open while processing runs. Unfinished CVs pick up where they left off when you return.</Notice>}
      {rejected.length > 0 && (
        <Notice tone="danger">
          <ul className="space-y-0.5">{rejected.slice(0, 6).map((r) => <li key={r}>{r}</li>)}{rejected.length > 6 && <li>and {rejected.length - 6} more</li>}</ul>
        </Notice>
      )}

      {rows.length === 0 ? (
        <p className="py-6 text-center text-muted">No CVs yet. Drop a batch to start screening.</p>
      ) : (
        <Card>
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-4 py-3">
            <p className="text-sm text-muted">
              {rows.length} total · {count(["Ready"])} ready · {count(["Needs review"])} need review · {count(["Duplicate", "Possible duplicate"])} duplicates · {count(["Failed"])} failed
            </p>
            <Link href={`/requisitions/${requisitionId}`}>
              <Button disabled={ready === 0} disabledReason="Waiting for the first CV to finish">View ranked list</Button>
            </Link>
          </div>
          <ul>
            {rows.map((r) => (
              <li key={r.key} className="flex items-center gap-3 border-b border-line px-4 py-3 last:border-0">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{r.name}</p>
                  <p className="truncate text-xs text-muted">{r.size ? kb(r.size) : ""}{r.note ? `${r.size ? " · " : ""}${r.note}` : ""}</p>
                </div>
                <Badge tone={TONE[r.status]}>{r.status}</Badge>
                {r.status === "Failed" && r.appId && <Button size="sm" variant="secondary" onClick={() => retry(r)}>Retry</Button>}
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
