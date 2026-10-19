import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Check, CheckCheck, Clock, AlertCircle } from "lucide-react";
import { prisma } from "@/lib/db";
import { dateTime } from "@/lib/format";
import { formatPhone } from "@/lib/phone";
import { isSimulation, within24h } from "@/lib/whatsapp";
import { SegmentBadge, StageBadge } from "@/components/ui";
import { sendReply, sendSingleTemplate, simulateInbound } from "../actions";

export const dynamic = "force-dynamic";

const StatusIcon = ({ s }: { s: string }) =>
  s === "READ" ? <CheckCheck size={14} className="text-sky-500" /> : s === "DELIVERED" ? <CheckCheck size={14} /> : s === "SENT" ? <Check size={14} /> : s === "FAILED" ? <AlertCircle size={14} className="text-red-600" /> : <Clock size={14} />;

export default async function Conversation({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const contact = await prisma.contact.findUnique({
    where: { id },
    include: { messages: { orderBy: { createdAt: "asc" }, take: 300 } },
  });
  if (!contact) notFound();
  if (contact.unread) await prisma.contact.update({ where: { id }, data: { unread: false } });
  const templates = await prisma.template.findMany({ where: { active: true }, orderBy: { createdAt: "asc" } });
  const open = within24h(contact.lastInboundAt);

  return (
    <>
      <header className="flex flex-wrap items-center gap-3 border-b border-line px-4 py-3">
        <Link href="/conversas" className="lg:hidden" aria-label="Voltar"><ArrowLeft size={18} /></Link>
        <div className="min-w-0 flex-1">
          <Link href={`/contatos/${id}`} className="block truncate font-medium hover:text-gold-dark">{contact.name}</Link>
          <p className="text-xs text-muted">{formatPhone(contact.phone)}</p>
        </div>
        <SegmentBadge segment={contact.segment} />
        <StageBadge stage={contact.stage} />
      </header>

      <div className="flex-1 space-y-2 overflow-y-auto bg-[#f4efe6] p-4" style={{ backgroundImage: "radial-gradient(#e6dccb 1px, transparent 1px)", backgroundSize: "16px 16px" }}>
        {contact.messages.map((m) => (
          <div key={m.id} className={`flex ${m.direction === "OUT" ? "justify-end" : "justify-start"}`}>
            <div className={`max-w-[80%] rounded-lg px-3 py-2 text-sm shadow-xs ${m.direction === "OUT" ? "rounded-tr-none bg-[#fff3c4]" : "rounded-tl-none bg-white"}`}>
              {m.templateName && <p className="mb-1 font-mono text-[10px] text-muted">template · {m.templateName}</p>}
              <p className="whitespace-pre-line">{m.body}</p>
              {m.error && <p className="mt-1 text-xs text-red-700">{m.error}</p>}
              <p className="mt-1 flex items-center justify-end gap-1 text-[10px] text-muted">
                {dateTime(m.createdAt)} {m.direction === "OUT" && <StatusIcon s={m.status} />}
              </p>
            </div>
          </div>
        ))}
      </div>

      <footer className="space-y-2 border-t border-line p-3">
        {contact.optOut ? (
          <p className="rounded-lg bg-paper px-3 py-2 text-sm text-muted">Este contato pediu para não receber mensagens.</p>
        ) : open ? (
          <form action={sendReply.bind(null, id)} className="flex gap-2">
            <textarea name="body" required rows={2} placeholder="Escreva sua resposta…" className="input resize-none" />
            <button className="btn-primary self-end">Enviar</button>
          </form>
        ) : (
          <form action={sendSingleTemplate.bind(null, id)} className="flex flex-wrap items-center gap-2">
            <p className="w-full text-xs text-muted">
              Fora da janela de 24h: o WhatsApp só permite iniciar conversa com um modelo aprovado. Quando o cliente responder, você pode escrever livremente.
            </p>
            <select name="templateId" className="input w-auto flex-1">
              {templates.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
            <button className="btn-gold">Enviar modelo</button>
          </form>
        )}
        {isSimulation() && (
          <form action={simulateInbound.bind(null, id)} className="flex gap-2 rounded-lg border border-dashed border-gold/60 p-2">
            <input name="text" defaultValue="Oi! Quero saber mais sobre a tábua de churrasco" className="input text-xs" />
            <button className="btn-ghost text-xs whitespace-nowrap">Simular resposta do cliente</button>
          </form>
        )}
      </footer>
    </>
  );
}
