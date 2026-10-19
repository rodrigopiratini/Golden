import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Ban, MessageCircle, MousePointerClick, StickyNote, Trash2 } from "lucide-react";
import { prisma } from "@/lib/db";
import { appUrl as getAppUrl, brl, dateTime } from "@/lib/format";
import { formatPhone } from "@/lib/phone";
import { PageHeader, SegmentBadge, StageBadge } from "@/components/ui";
import { ContactForm } from "../ContactForm";
import { addNote, deleteContact, toggleOptOut, updateContact } from "../actions";

export const dynamic = "force-dynamic";

const STATUS: Record<string, string> = { QUEUED: "na fila", SENT: "enviada", DELIVERED: "entregue", READ: "lida", FAILED: "falhou", RECEIVED: "recebida" };
const CLICK: Record<string, string> = { CATALOG_VIEW: "Abriu o catálogo", PRODUCT_WHATSAPP: "Clicou em “Quero este” (WhatsApp)", PRODUCT_SITE: "Clicou em “Comprar no site”" };

export default async function ContactPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const contact = await prisma.contact.findUnique({
    where: { id },
    include: {
      messages: { orderBy: { createdAt: "desc" }, take: 50 },
      activities: { orderBy: { createdAt: "desc" }, take: 50, include: { user: { select: { name: true } } } },
      clicks: { orderBy: { createdAt: "desc" }, take: 30, include: { product: { select: { name: true } } } },
    },
  });
  if (!contact) notFound();

  const timeline = [
    ...contact.messages.map((m) => ({ at: m.createdAt, kind: "msg" as const, m })),
    ...contact.activities.map((a) => ({ at: a.createdAt, kind: "act" as const, a })),
    ...contact.clicks.map((k) => ({ at: k.createdAt, kind: "click" as const, k })),
  ].sort((x, y) => y.at.getTime() - x.at.getTime());

  const appUrl = getAppUrl();

  return (
    <>
      <Link href="/contatos" className="mb-3 inline-flex items-center gap-1 text-sm text-muted hover:text-ink"><ArrowLeft size={14} /> Contatos</Link>
      <PageHeader title={contact.name} subtitle={formatPhone(contact.phone)}>
        <SegmentBadge segment={contact.segment} />
        <StageBadge stage={contact.stage} />
        <Link href={`/conversas/${contact.id}`} className="btn-primary"><MessageCircle size={16} /> Conversa</Link>
      </PageHeader>

      <div className="grid gap-6 lg:grid-cols-[1fr_420px]">
        <div className="space-y-6">
          <section className="card p-6">
            <h2 className="mb-4 font-display text-lg font-semibold">Dados do contato</h2>
            <ContactForm contact={contact} action={updateContact.bind(null, contact.id)} submitLabel="Salvar alterações" />
          </section>
          <section className="card space-y-3 p-6 text-sm">
            <h2 className="font-display text-lg font-semibold">Link do catálogo deste contato</h2>
            <p className="text-muted">Os cliques feitos por este link ficam registrados na ficha e movem o contato no funil.</p>
            <code className="block overflow-x-auto rounded-lg bg-paper px-3 py-2 text-xs">{appUrl}/catalogo?c={contact.token}</code>
            <div className="flex flex-wrap gap-2 pt-2">
              <form action={toggleOptOut.bind(null, contact.id)}>
                <button className="btn-ghost"><Ban size={16} /> {contact.optOut ? "Voltar a permitir mensagens" : "Marcar como “não contatar”"}</button>
              </form>
              <form action={deleteContact.bind(null, contact.id)}>
                <button className="btn-ghost text-red-700"><Trash2 size={16} /> Excluir contato</button>
              </form>
            </div>
          </section>
        </div>

        <section className="card h-fit p-6">
          <h2 className="mb-4 font-display text-lg font-semibold">Linha do tempo</h2>
          <form action={addNote.bind(null, contact.id)} className="mb-5 flex gap-2">
            <input name="text" placeholder="Adicionar nota (ex: ligou pedindo orçamento)" className="input" />
            <button className="btn-gold">Salvar</button>
          </form>
          {contact.dealValue && <p className="mb-4 rounded-lg bg-gold-soft px-3 py-2 text-sm">Negócio: <b>{brl(contact.dealValue)}</b></p>}
          <ol className="relative space-y-4 border-l border-line pl-5">
            {timeline.map((t, i) => (
              <li key={i} className="relative text-sm">
                <span className="absolute top-1.5 -left-[25px] size-2.5 rounded-full border-2 border-white bg-gold" />
                <p className="text-xs text-muted">{dateTime(t.at)}</p>
                {t.kind === "msg" && (
                  <div className={`mt-1 rounded-lg px-3 py-2 ${t.m.direction === "IN" ? "bg-paper" : "bg-gold-soft"}`}>
                    <p className="mb-0.5 text-xs font-medium text-muted">
                      {t.m.direction === "IN" ? "Cliente" : t.m.templateName ? `Template ${t.m.templateName}` : "Golden"} · {STATUS[t.m.status]}
                    </p>
                    <p className="whitespace-pre-line">{t.m.body}</p>
                    {t.m.error && <p className="mt-1 text-xs text-red-700">{t.m.error}</p>}
                  </div>
                )}
                {t.kind === "act" && (
                  <p className="mt-0.5 flex items-start gap-1.5">
                    {t.a.type === "NOTE" && <StickyNote size={14} className="mt-0.5 shrink-0 text-gold-dark" />}
                    <span>{t.a.text}{t.a.user && <span className="text-muted"> · {t.a.user.name}</span>}</span>
                  </p>
                )}
                {t.kind === "click" && (
                  <p className="mt-0.5 flex items-start gap-1.5">
                    <MousePointerClick size={14} className="mt-0.5 shrink-0 text-gold-dark" />
                    <span>{CLICK[t.k.kind]}{t.k.product && <b> · {t.k.product.name}</b>}</span>
                  </p>
                )}
              </li>
            ))}
            {!timeline.length && <li className="text-sm text-muted">Nenhuma interação ainda.</li>}
          </ol>
        </section>
      </div>
    </>
  );
}
