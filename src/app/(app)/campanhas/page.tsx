import Link from "next/link";
import { Plus } from "lucide-react";
import { prisma } from "@/lib/db";
import { num, pct } from "@/lib/format";
import { campaignReplies } from "@/lib/metrics";
import { Empty, PageHeader } from "@/components/ui";

export const dynamic = "force-dynamic";
export const metadata = { title: "Campanhas" };

const STATUS: Record<string, { label: string; cls: string }> = {
  DRAFT: { label: "Rascunho", cls: "bg-paper text-muted" },
  RUNNING: { label: "Enviando", cls: "bg-blue-50 text-blue-700" },
  PAUSED: { label: "Em andamento", cls: "bg-gold-soft text-gold-dark" },
  DONE: { label: "Concluída", cls: "bg-green-50 text-green-700" },
};

export default async function CampaignsPage() {
  const campaigns = await prisma.campaign.findMany({ orderBy: { createdAt: "desc" }, include: { template: { select: { name: true } } } });
  const stats = await prisma.campaignRecipient.groupBy({ by: ["campaignId", "status"], _count: { _all: true } });
  const replies = await campaignReplies();
  const get = (id: string, s: string) => stats.find((x) => x.campaignId === id && x.status === s)?._count._all ?? 0;

  return (
    <>
      <PageHeader title="Campanhas" subtitle="Disparos em ondas pelo WhatsApp oficial">
        <Link href="/campanhas/nova" className="btn-gold"><Plus size={16} /> Nova campanha</Link>
      </PageHeader>
      {campaigns.length === 0 ? (
        <Empty>Nenhuma campanha ainda. Comece pelos clientes que já compraram — são os que mais respondem.</Empty>
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-line bg-paper text-left text-xs text-muted uppercase">
              <tr>
                <th className="px-4 py-2.5 font-medium">Campanha</th>
                <th className="px-4 py-2.5 font-medium">Status</th>
                <th className="px-4 py-2.5 text-right font-medium">Público</th>
                <th className="px-4 py-2.5 text-right font-medium">Enviados</th>
                <th className="px-4 py-2.5 text-right font-medium">Pendentes</th>
                <th className="px-4 py-2.5 text-right font-medium">Falhas</th>
                <th className="px-4 py-2.5 text-right font-medium">Responderam</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line tabular-nums">
              {campaigns.map((c) => {
                const sent = get(c.id, "SENT");
                const pending = get(c.id, "PENDING");
                const total = sent + pending + get(c.id, "FAILED") + get(c.id, "SKIPPED");
                const replied = replies.get(c.id) ?? 0;
                return (
                  <tr key={c.id} className="hover:bg-paper">
                    <td className="px-4 py-3">
                      <Link href={`/campanhas/${c.id}`} className="font-medium hover:text-gold-dark">{c.name}</Link>
                      <span className="block font-mono text-xs text-muted">{c.template.name} · {c.createdAt.toLocaleDateString("pt-BR")}</span>
                    </td>
                    <td className="px-4 py-3"><span className={`badge ${STATUS[c.status].cls}`}>{STATUS[c.status].label}</span></td>
                    <td className="px-4 py-3 text-right">{num(total)}</td>
                    <td className="px-4 py-3 text-right">{num(sent)}</td>
                    <td className="px-4 py-3 text-right">{num(pending)}</td>
                    <td className="px-4 py-3 text-right">{num(get(c.id, "FAILED"))}</td>
                    <td className="px-4 py-3 text-right">{num(replied)} <span className="text-xs text-muted">{pct(replied, sent)}</span></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
