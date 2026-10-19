"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import {
  DndContext, DragOverlay, PointerSensor, TouchSensor, closestCorners, pointerWithin, useDroppable, useSensor, useSensors,
  type CollisionDetection, type DragEndEvent, type DragStartEvent,
} from "@dnd-kit/core";
import { SortableContext, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import clsx from "clsx";
import type { Segment, Stage } from "@prisma/client";
import { STAGES } from "@/lib/stages";
import { brl, timeAgo } from "@/lib/format";
import { formatPhone } from "@/lib/phone";
import { SegmentBadge } from "@/components/ui";
import { moveContact } from "./actions";

// Prioriza o que está sob o ponteiro (card ou coluna); fora disso, o mais próximo
const collision: CollisionDetection = (args) => {
  const hits = pointerWithin(args);
  return hits.length ? hits : closestCorners(args);
};

export type Card = {
  id: string; name: string; phone: string; segment: Segment; source: string | null; stage: Stage;
  dealValue: number | null; position: number; unread: boolean; lastInteractionAt: string | null;
};

export function Board({ initial, totals, perColumn }: { initial: Card[]; totals: Record<string, { count: number; value: number }>; perColumn: number }) {
  const [cards, setCards] = useState(initial);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }), useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 6 } }));

  const byStage = useMemo(() => {
    const m = Object.fromEntries(STAGES.map((s) => [s.id, [] as Card[]])) as Record<Stage, Card[]>;
    for (const c of cards) m[c.stage].push(c);
    return m;
  }, [cards]);

  const active = cards.find((c) => c.id === activeId);

  function onDragEnd(e: DragEndEvent) {
    setActiveId(null);
    const { active, over } = e;
    if (!over) return;
    const card = cards.find((c) => c.id === active.id);
    if (!card) return;
    const overCard = cards.find((c) => c.id === over.id);
    const target = (overCard ? overCard.stage : (over.id as Stage));
    const col = byStage[target].filter((c) => c.id !== card.id);
    const idx = overCard ? col.findIndex((c) => c.id === overCard.id) : col.length;
    const before = col[idx - 1]?.position;
    const after = col[idx]?.position;
    const position = before === undefined && after === undefined ? 0 : before === undefined ? after! - 1 : after === undefined ? before + 1 : (before + after) / 2;
    if (card.stage === target && card.position === position) return;

    const prevStage = card.stage;
    setCards((cs) => cs.map((c) => (c.id === card.id ? { ...c, stage: target, position } : c)));
    startTransition(async () => {
      try {
        await moveContact(card.id, target, position);
      } catch {
        setCards((cs) => cs.map((c) => (c.id === card.id ? { ...c, stage: prevStage } : c)));
        alert("Não foi possível mover o contato.");
      }
    });
  }

  return (
    <DndContext sensors={sensors} collisionDetection={collision} onDragStart={(e: DragStartEvent) => setActiveId(String(e.active.id))} onDragEnd={onDragEnd} onDragCancel={() => setActiveId(null)}>
      <div className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-4 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
        {STAGES.map((s) => {
          const list = [...byStage[s.id]].sort((a, b) => a.position - b.position);
          const total = totals[s.id]?.count ?? 0;
          return <Column key={s.id} stage={s} cards={list} total={Math.max(total, list.length)} value={totals[s.id]?.value ?? 0} perColumn={perColumn} />;
        })}
      </div>
      <DragOverlay>{active ? <CardView card={active} dragging /> : null}</DragOverlay>
    </DndContext>
  );
}

function Column({ stage, cards, total, value, perColumn }: { stage: (typeof STAGES)[number]; cards: Card[]; total: number; value: number; perColumn: number }) {
  const { setNodeRef, isOver } = useDroppable({ id: stage.id });
  return (
    <section ref={setNodeRef} className={clsx("flex w-72 shrink-0 flex-col rounded-xl border bg-wood-soft/40 transition", isOver ? "border-gold" : "border-line")}>
      <header className="sticky top-0 rounded-t-xl border-b border-line bg-white/80 px-3 py-2.5 backdrop-blur" title={stage.hint}>
        <div className="flex items-center gap-2">
          <span className="size-2.5 rounded-full" style={{ background: stage.color }} />
          <h2 className="flex-1 text-sm font-semibold">{stage.label}</h2>
          <span className="rounded-full bg-paper px-2 text-xs font-medium text-muted tabular-nums">{total}</span>
        </div>
        {value > 0 && <p className="mt-0.5 pl-4.5 text-xs text-muted">{brl(value)}</p>}
      </header>
      <SortableContext items={cards.map((c) => c.id)} strategy={verticalListSortingStrategy}>
        <div className="flex max-h-[calc(100vh-260px)] min-h-24 flex-col gap-2 overflow-y-auto p-2">
          {cards.map((c) => <SortableCard key={c.id} card={c} />)}
          {total > cards.length && cards.length >= perColumn && (
            <p className="py-2 text-center text-xs text-muted">+{total - cards.length} contatos — use os filtros</p>
          )}
        </div>
      </SortableContext>
    </section>
  );
}

function SortableCard({ card }: { card: Card }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: card.id });
  return (
    <div ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition }} className={clsx(isDragging && "opacity-30")} {...attributes} {...listeners}>
      <CardView card={card} />
    </div>
  );
}

function CardView({ card, dragging }: { card: Card; dragging?: boolean }) {
  return (
    <article className={clsx("cursor-grab rounded-lg border border-line bg-white p-3 text-sm shadow-xs hover:border-gold/60", dragging && "rotate-2 cursor-grabbing shadow-lg")}>
      <div className="flex items-start gap-2">
        <Link href={`/contatos/${card.id}`} className="min-w-0 flex-1 truncate font-medium hover:text-gold-dark" onPointerDown={(e) => e.stopPropagation()}>
          {card.name}
        </Link>
        {card.unread && <span className="mt-1 size-2 shrink-0 rounded-full bg-gold" title="Mensagem não lida" />}
      </div>
      <p className="text-xs text-muted">{formatPhone(card.phone)}</p>
      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        <SegmentBadge segment={card.segment} />
        {card.source && <span className="badge max-w-36 truncate bg-paper text-muted">{card.source}</span>}
      </div>
      <div className="mt-2 flex items-center justify-between text-xs text-muted">
        <span>{card.dealValue ? <b className="text-ink">{brl(card.dealValue)}</b> : ""}</span>
        <span>{timeAgo(card.lastInteractionAt)}</span>
      </div>
    </article>
  );
}
