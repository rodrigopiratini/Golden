import Link from "next/link";
import { ArrowRight, Clock, MessageCircle } from "lucide-react";
import { prisma } from "@/lib/db";
import { contactFlags, groupBy, summarize } from "@/lib/metrics";
import { brl, num, pct, timeAgo } from "@/lib/format";
import { SEGMENT_MAP, STAGES } from "@/lib/stages";
import { BarList, Funnel } from "@/components/charts";
import { Empty, PageHeader, SegmentBadge, Stat } from "@/components/ui";

export const dynamic = "force-dynamic";
export const metadata = { title: "Dashboard" };

export default async function Dashboard() {
  const rows = await contactFlags();
  const s = summarize(rows);
  const bySegment = groupBy(rows, (r) => r.segment).sort((a, b) => b.total - a.total);
  const bySource = groupBy(rows, (r) => r.source || "Sem origem").sort((a, b) => b.total - a.total).slice(0, 8);
  const stageCounts = STAGES.map((st) => ({ label: st.label, color: st.color, value: rows.filter((r) => r.stage === st.id).length }));

  const threeDaysAgo = new Date(Date.now() - 3 * 86400000);
  const [catalogViews, topProducts, followUp, waiting] = await Promise.all([
    prisma.click.count({ where: { kind: "CATALOG_VIEW" } }),
    prisma.click.groupBy({
      by: ["productId"],
      where: { productId: { not: null }, kind: { in: ["PRODUCT_WHATSAPP", "PRODUCT_SITE"] } },
      _count: { _all: true },
      orderBy: { _count: { productId: "desc" } },
      take: 6,
    }),
    prisma.contact.findMany({
      where: { stage: { in: ["ENVIADO", "LIDO"] }, optOut: false, lastInteractionAt: { lt: threeDaysAgo } },
      orderBy: { lastInteractionAt: "asc" },
      take: 6,
      select: { id: true, name: true, segment: true, stage: true, lastInteractionAt: true },
    }),
    prisma.contact.findMany({
      where: { unread: true },
      orderBy: { lastInboundAt: "desc" },
      take: 6,
      select: { id: true, name: true, lastInboundAt: true, messages: { where: { direction: "IN" }, orderBy: { createdAt: "desc" }, take: 1, select: { body: true } } },
    }),
  ]);
  const productNames = new Map(
    (await prisma.product.findMany({ where: { id: { in: topProducts.map((p) => p.productId!) } }, select: { id: true, name: true } })).map((p) => [p.id, p.name]),
  );

  return (
    <>
      <PageHeader title="Dashboard" subtitle="Visão geral da base de contatos e das campanhas de WhatsApp">
        <Link href="/campanhas/nova" className="btn-gold">Nova campanha</Link>
      </PageHeader>

      <section className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        <Stat label="Contatos na base" value={num(s.total)} hint={`${num(s.total - s.sent)} ainda não abordados`} />
        <Stat label="Abordados" value={num(s.sent)} hint={`${pct(s.sent, s.total)} da base`} />
        <Stat label="Taxa de resposta" value={pct(s.replied, s.sent)} hint={`${num(s.replied)} responderam`} />
        <Stat label="Vendas" value={num(s.won)} hint={`conversão ${pct(s.won, s.sent)} dos abordados`} />
        <Stat label="Faturamento" value={brl(s.revenue)} hint={`${brl(s.pipeline)} em negociação`} accent />
      </section>

      <section className="mt-6 grid gap-6 lg:grid-cols-3">
        <div className="card p-6 lg:col-span-2">
          <h2 className="font-display text-lg font-semibold">Funil da campanha</h2>
          <p className="mb-5 text-xs text-muted">Contatos que atingiram cada etapa · % em relação à etapa anterior</p>
          <Funnel
            steps={[
              { label: "Abordados", value: s.sent },
              { label: "Entregues", value: s.delivered },
              { label: "Lidos", value: s.read },
              { label: "Responderam", value: s.replied },
              { label: "Interessados", value: s.interested },
              { label: "Compraram", value: s.won },
            ]}
          />
          <p className="mt-4 text-xs text-muted">
            {num(catalogViews)} visualizações do catálogo · {num(s.optOut)} pediram para não receber mensagens
          </p>
        </div>
        <div className="card p-6">
          <h2 className="mb-4 font-display text-lg font-semibold">Contatos por etapa</h2>
          <BarList items={stageCounts} />
          <Link href="/kanban" className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-gold-dark hover:underline">
            Abrir kanban <ArrowRight size={14} />
          </Link>
        </div>
      </section>

      <section className="mt-6 grid gap-6 lg:grid-cols-2">
        <div className="card overflow-hidden">
          <h2 className="px-6 pt-5 pb-3 font-display text-lg font-semibold">Desempenho por segmento</h2>
          <PerformanceTable rows={bySegment.map((g) => ({ ...g, label: <SegmentBadge segment={g.key} />, key: SEGMENT_MAP[g.key].label }))} />
        </div>
        <div className="card overflow-hidden">
          <h2 className="px-6 pt-5 pb-3 font-display text-lg font-semibold">Desempenho por origem</h2>
          <PerformanceTable rows={bySource.map((g) => ({ ...g, label: g.key }))} />
        </div>
      </section>

      <section className="mt-6 grid gap-6 lg:grid-cols-3">
        <div className="card p-6">
          <h2 className="mb-4 font-display text-lg font-semibold">Produtos mais clicados</h2>
          {topProducts.length ? (
            <BarList color="var(--color-gold-dark)" items={topProducts.map((p) => ({ label: productNames.get(p.productId!) ?? "—", value: p._count._all, suffix: "cliques" }))} />
          ) : (
            <Empty>Os cliques no catálogo aparecem aqui.</Empty>
          )}
        </div>
        <div className="card p-6">
          <h2 className="mb-4 flex items-center gap-2 font-display text-lg font-semibold">
            <MessageCircle size={18} className="text-gold-dark" /> Aguardando resposta
          </h2>
          {waiting.length ? (
            <ul className="divide-y divide-line">
              {waiting.map((c) => (
                <li key={c.id}>
                  <Link href={`/conversas/${c.id}`} className="flex items-center gap-3 py-2.5 hover:text-gold-dark">
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">{c.name}</span>
                      <span className="block truncate text-xs text-muted">{c.messages[0]?.body ?? "—"}</span>
                    </span>
                    <span className="text-xs text-muted">{timeAgo(c.lastInboundAt)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <Empty>Nenhuma conversa esperando por você.</Empty>
          )}
        </div>
        <div className="card p-6">
          <h2 className="mb-4 flex items-center gap-2 font-display text-lg font-semibold">
            <Clock size={18} className="text-gold-dark" /> Precisam de follow-up
          </h2>
          {followUp.length ? (
            <ul className="divide-y divide-line">
              {followUp.map((c) => (
                <li key={c.id}>
                  <Link href={`/contatos/${c.id}`} className="flex items-center gap-3 py-2.5 hover:text-gold-dark">
                    <span className="min-w-0 flex-1 truncate text-sm font-medium">{c.name}</span>
                    <SegmentBadge segment={c.segment} />
                    <span className="text-xs text-muted">{timeAgo(c.lastInteractionAt)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <Empty>Ninguém parado há mais de 3 dias.</Empty>
          )}
          <p className="mt-3 text-xs text-muted">Receberam a mensagem há mais de 3 dias e não responderam.</p>
        </div>
      </section>
    </>
  );
}

function PerformanceTable({ rows }: { rows: { key: string; label: React.ReactNode; total: number; sent: number; replied: number; won: number; revenue: number }[] }) {
  if (!rows.length) return <div className="px-6 pb-6"><Empty>Importe contatos para ver os indicadores.</Empty></div>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="border-y border-line bg-paper text-left text-xs text-muted uppercase">
          <tr>
            <th className="px-4 py-2 font-medium"></th>
            <th className="px-3 py-2 text-right font-medium">Contatos</th>
            <th className="px-3 py-2 text-right font-medium">Abord.</th>
            <th className="px-3 py-2 text-right font-medium">Resposta</th>
            <th className="px-3 py-2 text-right font-medium">Vendas</th>
            <th className="px-4 py-2 text-right font-medium">Faturamento</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line tabular-nums">
          {rows.map((r) => (
            <tr key={r.key} className="hover:bg-paper">
              <td className="max-w-[180px] truncate px-4 py-2.5">{r.label}</td>
              <td className="px-3 py-2.5 text-right">{num(r.total)}</td>
              <td className="px-3 py-2.5 text-right">{num(r.sent)}</td>
              <td className="px-3 py-2.5 text-right">{pct(r.replied, r.sent)}</td>
              <td className="px-3 py-2.5 text-right">{num(r.won)}</td>
              <td className="px-4 py-2.5 text-right whitespace-nowrap">{brl(r.revenue)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
