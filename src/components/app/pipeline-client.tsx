"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { DndContext, PointerSensor, KeyboardSensor, useDraggable, useDroppable, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { toast } from "sonner";
import { Badge, Card, ScoreBar, Select, Tabs } from "@/components/ui/primitives";
import { cn, ageLabel } from "@/lib/utils";
import { STAGES, STAGE_LABEL } from "@/lib/stages";

export type PipelineCard = {
  id: string; name: string; role: string | null; score: number | null; stage: string; stageChangedAt: string;
  decision: "PENDING" | "SHORTLISTED" | "REJECTED" | "INTERVIEW_PROPOSED"; reason: string | null; viewed: boolean;
  slots: { date: string; time: string; tz: string }[] | null;
};

const NEXT: Record<string, string> = {
  SOURCED: "Screen the CV", SCREENED: "Open the CV, then shortlist", SHORTLISTED: "Submit to client", SUBMITTED: "Waiting for client",
  CLIENT_REVIEW: "Waiting for client decision", INTERVIEW: "Confirm the slot", OFFERED: "Track joining", JOINED: "Done",
};

function CardView({ c, onMove }: { c: PipelineCard; onMove: (to: string) => void }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: c.id });
  const style = transform ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` } : undefined;
  return (
    <div ref={setNodeRef} style={style} className={cn("rounded-[8px] border border-line bg-surface p-3 shadow-[var(--shadow-card)]", isDragging && "z-20 shadow-[var(--shadow-hover)]")}>
      <div className="flex items-start justify-between gap-2">
        <button {...listeners} {...attributes} aria-label={`Drag ${c.name}`} className="min-w-0 flex-1 cursor-grab touch-none text-left active:cursor-grabbing">
          <span className="block truncate text-sm font-medium">{c.name}</span>
          <span className="block truncate text-xs text-muted">{c.role ?? "Role not found"}</span>
        </button>
        <span className="text-sm font-semibold tabular-nums">{c.score != null ? Math.round(c.score) : "—"}</span>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        {c.decision === "SHORTLISTED" && <Badge tone="success">Client shortlisted</Badge>}
        {c.decision === "INTERVIEW_PROPOSED" && <Badge tone="accent">Slot proposed</Badge>}
        {c.decision === "REJECTED" && <Badge tone="danger">Client rejected</Badge>}
        <span className="text-xs text-muted">{ageLabel(c.stageChangedAt)} in stage</span>
      </div>
      {c.slots?.length ? <p className="mt-1 text-xs text-muted">{c.slots.map((s) => `${s.date} ${s.time} ${s.tz}`).join(" · ")}</p> : null}
      <p className="mt-1 text-xs text-muted">{NEXT[c.stage]}</p>
      <div className="mt-2 flex items-center gap-2">
        <Select aria-label={`Move ${c.name}`} value={c.stage} onChange={(e) => onMove(e.target.value)} className="h-8 text-xs">
          {STAGES.map((s) => <option key={s} value={s}>{STAGE_LABEL[s]}</option>)}
        </Select>
      </div>
    </div>
  );
}

function Column({ stage, cards, onMove }: { stage: string; cards: PipelineCard[]; onMove: (id: string, to: string) => void }) {
  const { setNodeRef, isOver } = useDroppable({ id: stage });
  return (
    <section ref={setNodeRef} aria-label={STAGE_LABEL[stage]} className={cn("w-[260px] shrink-0 rounded-[10px] bg-surface-2/60 p-2 t-fast", isOver && "bg-accent-soft")}>
      <header className="mb-2 border-t-2 border-accent px-1 pt-2">
        <div className="flex items-center justify-between"><h3 className="text-sm font-semibold">{STAGE_LABEL[stage]}</h3><span className="text-xs text-muted tabular-nums">{cards.length}</span></div>
      </header>
      <div className="min-h-16 space-y-2">
        {cards.length === 0 && <p className="px-1 py-3 text-xs text-muted">No candidates.</p>}
        {cards.map((c) => <CardView key={c.id} c={c} onMove={(to) => onMove(c.id, to)} />)}
      </div>
    </section>
  );
}

export function PipelineClient({ requisitionId, initial }: { requisitionId: string; initial: PipelineCard[] }) {
  const router = useRouter();
  const [cards, setCards] = useState(initial);
  const [tab, setTab] = useState<"board" | "rejected">("board");
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }), useSensor(KeyboardSensor));

  async function move(id: string, to: string) {
    const prev = cards;
    const card = cards.find((c) => c.id === id);
    if (!card || card.stage === to) return;
    setCards((cs) => cs.map((c) => (c.id === id ? { ...c, stage: to, stageChangedAt: new Date().toISOString() } : c)));
    const res = await fetch(`/api/applications/${id}/stage`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ stage: to }) });
    if (!res.ok) {
      setCards(prev);
      const msg = (await res.json())?.error?.message ?? "Could not move this candidate.";
      toast.error(msg, card.viewed ? undefined : { description: "Open the CV from the ranked list first." });
      return;
    }
    router.refresh();
  }

  function onDragEnd(e: DragEndEvent) {
    if (e.over && typeof e.over.id === "string") move(String(e.active.id), e.over.id);
  }

  const rejected = cards.filter((c) => c.stage === "REJECTED");
  const board = cards.filter((c) => c.stage !== "REJECTED");

  if (cards.length === 0) {
    return <p className="rounded-[10px] border border-dashed border-line-strong px-6 py-14 text-center text-muted">No candidates in this pipeline yet. Upload CVs to start.</p>;
  }
  return (
    <div className="space-y-5">
      <Tabs value={tab} onChange={setTab} tabs={[{ id: "board", label: `Board (${board.length})` }, { id: "rejected", label: `Rejected (${rejected.length})` }]} />
      {tab === "board" ? (
        <DndContext sensors={sensors} onDragEnd={onDragEnd}>
          <div className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-4 md:mx-0 md:px-0">
            {STAGES.map((s) => <Column key={s} stage={s} cards={board.filter((c) => c.stage === s)} onMove={move} />)}
          </div>
        </DndContext>
      ) : rejected.length === 0 ? (
        <p className="py-8 text-center text-muted">No rejected candidates.</p>
      ) : (
        <Card>
          <ul>
            {rejected.map((c) => (
              <li key={c.id} className="flex items-center justify-between gap-3 border-b border-line px-4 py-3 last:border-0">
                <Link href={`/requisitions/${requisitionId}?candidate=${c.id}`} className="font-medium hover:text-accent">{c.name}</Link>
                <div className="flex items-center gap-3"><ScoreBar score={c.score} /><Badge tone="danger">{c.reason ?? "Rejected"}</Badge></div>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
