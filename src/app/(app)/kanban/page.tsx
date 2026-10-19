import type { Prisma, Segment } from "@prisma/client";
import { prisma } from "@/lib/db";
import { SEGMENTS, STAGES } from "@/lib/stages";
import { PageHeader } from "@/components/ui";
import { Board, type Card } from "./Board";

export const dynamic = "force-dynamic";
export const metadata = { title: "Funil" };

const PER_COLUMN = 80;

export default async function KanbanPage({ searchParams }: { searchParams: Promise<{ q?: string; segment?: string; source?: string }> }) {
  const { q, segment, source } = await searchParams;
  const where: Prisma.ContactWhereInput = {
    ...(q ? { OR: [{ name: { contains: q, mode: "insensitive" } }, { phone: { contains: q.replace(/\D/g, "") || q } }] } : {}),
    ...(segment ? { segment: segment as Segment } : {}),
    ...(source ? { source } : {}),
  };

  const [counts, sources, columns] = await Promise.all([
    prisma.contact.groupBy({ by: ["stage"], where, _count: { _all: true }, _sum: { dealValue: true } }),
    prisma.contact.findMany({ where: { source: { not: null } }, distinct: ["source"], select: { source: true }, orderBy: { source: "asc" } }),
    Promise.all(
      STAGES.map((s) =>
        prisma.contact.findMany({
          where: { ...where, stage: s.id },
          orderBy: [{ position: "asc" }, { lastInteractionAt: { sort: "desc", nulls: "last" } }, { createdAt: "desc" }],
          take: PER_COLUMN,
          select: { id: true, name: true, phone: true, segment: true, source: true, stage: true, dealValue: true, position: true, unread: true, lastInteractionAt: true },
        }),
      ),
    ),
  ]);

  const cards: Card[] = columns.flat().map((c) => ({ ...c, dealValue: c.dealValue ? Number(c.dealValue) : null, lastInteractionAt: c.lastInteractionAt?.toISOString() ?? null }));
  const totals = Object.fromEntries(counts.map((c) => [c.stage, { count: c._count._all, value: Number(c._sum.dealValue ?? 0) }]));

  return (
    <>
      <PageHeader title="Funil de vendas" subtitle="Arraste os cards para mudar a etapa. Respostas e cliques no catálogo movem os contatos automaticamente." />
      <form className="mb-4 flex flex-wrap gap-2">
        <input name="q" defaultValue={q} placeholder="Buscar nome ou telefone…" className="input max-w-xs" />
        <select name="segment" defaultValue={segment ?? ""} className="input w-auto">
          <option value="">Todos os segmentos</option>
          {SEGMENTS.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
        </select>
        <select name="source" defaultValue={source ?? ""} className="input w-auto max-w-56">
          <option value="">Todas as origens</option>
          {sources.map((s) => <option key={s.source} value={s.source!}>{s.source}</option>)}
        </select>
        <button className="btn-ghost">Filtrar</button>
      </form>
      <Board initial={cards} totals={totals} perColumn={PER_COLUMN} />
    </>
  );
}
