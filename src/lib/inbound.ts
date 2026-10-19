import { Prisma, type MessageStatus } from "@prisma/client";
import { prisma } from "./db";
import { advanceStage, optOutContact } from "./funnel";
import { firstName } from "./format";
import { normalizePhone, phoneVariants } from "./phone";
import { sendText } from "./whatsapp";

const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^\w\s]/g, "").trim();

/** Respostas que significam "não quero mais receber mensagens" */
const OPT_OUT = ["sair", "parar", "pare", "stop", "cancelar", "descadastrar", "nao tenho interesse", "nao quero", "nao quero receber", "remover"];
/** Botões/respostas que indicam interesse direto */
const INTEREST = ["quero uma proposta", "quero ajuda", "quero", "tenho interesse", "quero ver", "ver catalogo", "quero comprar"];

export async function handleInbound(msg: { waId: string; profileName?: string; waMessageId?: string; type: string; text: string }) {
  const variants = phoneVariants(msg.waId);
  let contact = await prisma.contact.findFirst({ where: { phone: { in: variants } } });
  if (!contact) {
    contact = await prisma.contact.create({
      data: { name: msg.profileName || "Contato WhatsApp", phone: normalizePhone(msg.waId) ?? msg.waId, segment: "OUTRO", source: "WhatsApp (chamou a Golden)" },
    });
  }

  try {
    await prisma.message.create({
      data: { contactId: contact.id, direction: "IN", type: msg.type, body: msg.text, waMessageId: msg.waMessageId, status: "RECEIVED" },
    });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") return; // reentrega do webhook
    throw e;
  }
  await prisma.contact.update({ where: { id: contact.id }, data: { unread: true, lastInboundAt: new Date(), lastInteractionAt: new Date() } });

  const t = norm(msg.text);
  if (OPT_OUT.includes(t)) {
    if (!contact.optOut) {
      await optOutContact(contact.id, `respondeu "${msg.text}"`);
      await prisma.contact.update({ where: { id: contact.id }, data: { unread: false } });
      const reply = `Tudo bem, ${firstName(contact.name)}! Não vamos mais te enviar mensagens. Se precisar de algo, é só chamar por aqui 🙂`;
      const res = await sendText(contact.phone, reply);
      await prisma.message.create({
        data: { contactId: contact.id, direction: "OUT", type: "text", body: reply, waMessageId: res.ok ? res.id : null, status: res.ok ? "SENT" : "FAILED", error: res.ok ? null : res.error, sentAt: new Date() },
      });
    }
    return;
  }
  if (INTEREST.some((k) => t === k || t.startsWith(k + " "))) await advanceStage(contact.id, "INTERESSADO", "pediu informações");
  else await advanceStage(contact.id, "RESPONDEU", "respondeu no WhatsApp");
}

const RANK: Record<MessageStatus, number> = { QUEUED: 0, SENT: 1, DELIVERED: 2, READ: 3, FAILED: 4, RECEIVED: 0 };

export async function handleStatus(s: { waMessageId: string; status: string; error?: string; timestamp?: string }) {
  const map: Record<string, MessageStatus> = { sent: "SENT", delivered: "DELIVERED", read: "READ", failed: "FAILED" };
  const status = map[s.status];
  if (!status) return;
  const m = await prisma.message.findUnique({ where: { waMessageId: s.waMessageId } });
  if (!m || RANK[status] <= RANK[m.status]) return;
  const at = s.timestamp ? new Date(Number(s.timestamp) * 1000) : new Date();
  await prisma.message.update({
    where: { id: m.id },
    data: {
      status,
      ...(status === "DELIVERED" ? { deliveredAt: at } : {}),
      ...(status === "READ" ? { readAt: at, deliveredAt: m.deliveredAt ?? at } : {}),
      ...(status === "FAILED" ? { error: s.error ?? "Falha no envio" } : {}),
    },
  });
  if (status === "FAILED" && m.campaignId)
    await prisma.campaignRecipient.updateMany({ where: { campaignId: m.campaignId, contactId: m.contactId }, data: { status: "FAILED", error: s.error } });
  if (status === "READ") await advanceStage(m.contactId, "LIDO", "leu a mensagem");
}
