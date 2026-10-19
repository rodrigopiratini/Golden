import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Send, Trash2 } from "lucide-react";
import { prisma } from "@/lib/db";
import { brl, dateTime, num, pct } from "@/lib/format";
import { contactFlags, summarize } from "@/lib/metrics";
import { formatPhone } from "@/lib/phone";
import { isSimulation } from "@/lib/whatsapp";
import { Funnel } from "@/components/charts";
import { PageHeader, StageBadge, Stat } from "@/components/ui";
import { PhonePreview } from "@/components/PhonePreview";
import { deleteCampaign, sendCampaignWave } from "../actions";

export const dynamic = "force-dynamic";
// Uma onda grande pode levar alguns segundos por envio em lote
export const maxDuration = 300;

const R_STATUS: Record<string, string> = { PENDING: "Pendente", SENT: "Enviado", FAILED: "Falhou", SKIPPED: "Ignorado" };

export default async function CampaignPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ sent?: string; failed?: string }> }) {
  const { id } = await params;
  const { sent: justSent, failed: justFailed } = await searchParams;
  const campaign = await prisma.campaign.findUnique({ where: { id }, include: { template: true } });
  if (!campaign) notFound();

  const [counts, recipients, rows] = await Promise.all([
    prisma.campaignRecipient.groupBy({ by: ["status"], where: { campaignId: id }, _count: { _all: true } }),
    prisma.campaignRecipient.findMany({
      where: { campaignId: id },
      orderBy: [{ sentAt: { sort: "desc", nulls: "last" } }],
      take: 100,
      include: { contact: { select: { id: true, name: true, phone: true, stage: true } } },
    }),
    contactFlags({ campaignId: id }),
  ]);
  const c = (s: string) => counts.find((x) => x.status === s)?._count._all ?? 0;
  const pending = c("PENDING");
  const total = counts.reduce((s, x) => s + x._count._all, 0);
  const s = summarize(rows);

  return (
    <>
      <Link href="/campanhas" className="mb-3 inline-flex items-center gap-1 text-sm text-muted hover:text-ink"><ArrowLeft size={14} /> Campanhas</Link>
      <PageHeader title={campaign.name} subtitle={`Template ${campaign.template.name} · criada em ${dateTime(campaign.createdAt)}`}>
        <form action={deleteCampaign.bind(null, id)}>
          <button className="btn-ghost text-red-700"><Trash2 size={16} /> Excluir</button>
        </form>
      </PageHeader>

      {justSent && (
        <p className="mb-4 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
          Onda enviada: {justSent} mensagens{Number(justFailed) > 0 && `, ${justFailed} falharam (veja o motivo na lista abaixo)`}.
          {isSimulation() && " (modo simulação — nada saiu para o WhatsApp)"}
        </p>
      )}

      <section className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat label="Público" value={num(total)} hint={`${num(pending)} aguardando envio`} />
        <Stat label="Enviados" value={num(c("SENT"))} hint={`${num(c("FAILED"))} falhas`} />
        <Stat label="Responderam" value={pct(s.replied, s.sent)} hint={`${num(s.replied)} contatos`} />
        <Stat label="Vendas" value={num(s.won)} hint={brl(s.revenue)} accent />
      </section>

      <section className="mt-6 grid gap-6 lg:grid-cols-[1fr_340px]">
        <div className="space-y-6">
          {pending > 0 && (
            <form action={sendCampaignWave.bind(null, id)} className="card flex flex-wrap items-end gap-4 border-gold/60 p-6">
              <div className="flex-1">
                <h2 className="font-display text-lg font-semibold">Disparar próxima onda</h2>
                <p className="text-sm text-muted">
                  Comece com 50–100 contatos, veja as respostas e ajuste. Números novos na Meta têm limite diário (geralmente 250 conversas/dia no início).
                </p>
              </div>
              <div className="w-28">
                <label className="label">Quantidade</label>
                <input name="n" type="number" min={1} max={1000} defaultValue={Math.min(pending, 100)} className="input" />
              </div>
              <button className="btn-gold"><Send size={16} /> Enviar agora</button>
            </form>
          )}
          <div className="card p-6">
            <h2 className="mb-4 font-display text-lg font-semibold">Funil desta campanha</h2>
            <Funnel steps={[
              { label: "Enviados", value: s.sent },
              { label: "Entregues", value: s.delivered },
              { label: "Lidos", value: s.read },
              { label: "Responderam", value: s.replied },
              { label: "Interessados", value: s.interested },
              { label: "Compraram", value: s.won },
            ]} />
          </div>
          <div className="card overflow-x-auto">
            <h2 className="px-6 pt-5 pb-3 font-display text-lg font-semibold">Destinatários <span className="text-sm font-normal text-muted">(últimos 100)</span></h2>
            <table className="w-full text-sm">
              <thead className="border-y border-line bg-paper text-left text-xs text-muted uppercase">
                <tr>
                  <th className="px-6 py-2 font-medium">Contato</th>
                  <th className="px-3 py-2 font-medium">Envio</th>
                  <th className="px-3 py-2 font-medium">Etapa atual</th>
                  <th className="px-6 py-2 text-right font-medium">Enviado em</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {recipients.map((r) => (
                  <tr key={r.id} className="hover:bg-paper">
                    <td className="px-6 py-2.5">
                      <Link href={`/contatos/${r.contact.id}`} className="font-medium hover:text-gold-dark">{r.contact.name}</Link>
                      <span className="block text-xs text-muted">{formatPhone(r.contact.phone)}</span>
                    </td>
                    <td className="px-3 py-2.5">
                      {R_STATUS[r.status]}
                      {r.error && <span className="block max-w-64 truncate text-xs text-red-700" title={r.error}>{r.error}</span>}
                    </td>
                    <td className="px-3 py-2.5"><StageBadge stage={r.contact.stage} /></td>
                    <td className="px-6 py-2.5 text-right text-muted">{r.sentAt ? dateTime(r.sentAt) : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        <aside>
          <PhonePreview body={campaign.template.body} headerImage={campaign.template.headerImage} urlButton={campaign.template.urlButton} quickReplies={campaign.template.quickReplies} />
        </aside>
      </section>
    </>
  );
}
