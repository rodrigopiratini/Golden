import Link from "next/link";
import { contactWhere, type ContactFilters as SP } from "@/lib/contact-filters";
import { Download, Plus, Upload } from "lucide-react";
import { prisma } from "@/lib/db";
import { brl, num, timeAgo } from "@/lib/format";
import { formatPhone } from "@/lib/phone";
import { SEGMENTS, STAGES } from "@/lib/stages";
import { Empty, PageHeader, SegmentBadge, StageBadge } from "@/components/ui";

export const dynamic = "force-dynamic";
export const metadata = { title: "Contatos" };
const PAGE = 50;

export default async function ContactsPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page) || 1);
  const where = contactWhere(sp);
  const [total, contacts, sources] = await Promise.all([
    prisma.contact.count({ where }),
    prisma.contact.findMany({ where, orderBy: { createdAt: "desc" }, skip: (page - 1) * PAGE, take: PAGE }),
    prisma.contact.findMany({ where: { source: { not: null } }, distinct: ["source"], select: { source: true }, orderBy: { source: "asc" } }),
  ]);
  const qs = (p: number) => "?" + new URLSearchParams({ ...Object.fromEntries(Object.entries(sp).filter(([, v]) => v)), page: String(p) }).toString();
  const exportQs = new URLSearchParams(Object.fromEntries(Object.entries(sp).filter(([k, v]) => v && k !== "page"))).toString();

  return (
    <>
      <PageHeader title="Contatos" subtitle={`${num(total)} contatos encontrados`}>
        <a href={`/api/contatos/export?${exportQs}`} className="btn-ghost"><Download size={16} /> Exportar</a>
        <Link href="/contatos/importar" className="btn-ghost"><Upload size={16} /> Importar planilha</Link>
        <Link href="/contatos/novo" className="btn-primary"><Plus size={16} /> Novo contato</Link>
      </PageHeader>

      <form className="mb-4 flex flex-wrap gap-2">
        <input name="q" defaultValue={sp.q} placeholder="Nome, telefone ou cidade…" className="input max-w-xs" />
        <select name="segment" defaultValue={sp.segment ?? ""} className="input w-auto">
          <option value="">Todos os segmentos</option>
          {SEGMENTS.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
        </select>
        <select name="stage" defaultValue={sp.stage ?? ""} className="input w-auto">
          <option value="">Todas as etapas</option>
          {STAGES.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
        </select>
        <select name="source" defaultValue={sp.source ?? ""} className="input w-auto max-w-56">
          <option value="">Todas as origens</option>
          {sources.map((s) => <option key={s.source} value={s.source!}>{s.source}</option>)}
        </select>
        <button className="btn-ghost">Filtrar</button>
      </form>

      {contacts.length === 0 ? (
        <Empty>
          Nenhum contato encontrado. <Link href="/contatos/importar" className="font-medium text-gold-dark underline">Importe sua planilha</Link> para começar.
        </Empty>
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-line bg-paper text-left text-xs text-muted uppercase">
              <tr>
                <th className="px-4 py-2.5 font-medium">Nome</th>
                <th className="px-4 py-2.5 font-medium">Telefone</th>
                <th className="px-4 py-2.5 font-medium">Segmento</th>
                <th className="px-4 py-2.5 font-medium">Origem</th>
                <th className="px-4 py-2.5 font-medium">Etapa</th>
                <th className="px-4 py-2.5 text-right font-medium">Valor</th>
                <th className="px-4 py-2.5 text-right font-medium">Última interação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {contacts.map((c) => (
                <tr key={c.id} className="hover:bg-paper">
                  <td className="px-4 py-2.5">
                    <Link href={`/contatos/${c.id}`} className="font-medium hover:text-gold-dark">{c.name}</Link>
                    {c.city && <span className="block text-xs text-muted">{c.city}{c.state ? `/${c.state}` : ""}</span>}
                  </td>
                  <td className="px-4 py-2.5 whitespace-nowrap tabular-nums">{formatPhone(c.phone)}</td>
                  <td className="px-4 py-2.5"><SegmentBadge segment={c.segment} /></td>
                  <td className="max-w-48 truncate px-4 py-2.5 text-muted">{c.source ?? "—"}</td>
                  <td className="px-4 py-2.5"><StageBadge stage={c.stage} /></td>
                  <td className="px-4 py-2.5 text-right tabular-nums">{c.dealValue ? brl(c.dealValue) : "—"}</td>
                  <td className="px-4 py-2.5 text-right text-muted">{timeAgo(c.lastInteractionAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {total > PAGE && (
        <div className="mt-4 flex items-center justify-between text-sm text-muted">
          <span>Página {page} de {Math.ceil(total / PAGE)}</span>
          <div className="flex gap-2">
            {page > 1 && <Link href={qs(page - 1)} className="btn-ghost">Anterior</Link>}
            {page * PAGE < total && <Link href={qs(page + 1)} className="btn-ghost">Próxima</Link>}
          </div>
        </div>
      )}
    </>
  );
}
