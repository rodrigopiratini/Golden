"use server";

import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { firstName } from "@/lib/format";
import { handleInbound } from "@/lib/inbound";
import { advanceStage } from "@/lib/funnel";
import { isSimulation, renderTemplate, sendTemplate, sendText, within24h } from "@/lib/whatsapp";

export async function sendReply(contactId: string, form: FormData) {
  const session = await requireSession();
  const body = String(form.get("body") ?? "").trim();
  if (!body) return;
  const c = await prisma.contact.findUniqueOrThrow({ where: { id: contactId } });
  if (!within24h(c.lastInboundAt)) throw new Error("Fora da janela de 24h: envie um modelo aprovado.");
  const res = await sendText(c.phone, body);
  await prisma.message.create({
    data: { contactId, direction: "OUT", type: "text", body, waMessageId: res.ok ? res.id : null, status: res.ok ? "SENT" : "FAILED", error: res.ok ? null : res.error, sentAt: new Date() },
  });
  await prisma.contact.update({ where: { id: contactId }, data: { unread: false, lastInteractionAt: new Date(), ownerId: c.ownerId ?? session.userId } });
  revalidatePath(`/conversas/${contactId}`);
}

export async function sendSingleTemplate(contactId: string, form: FormData) {
  await requireSession();
  const t = await prisma.template.findUniqueOrThrow({ where: { id: String(form.get("templateId")) } });
  const c = await prisma.contact.findUniqueOrThrow({ where: { id: contactId } });
  if (c.optOut) throw new Error("Este contato pediu para não receber mensagens.");
  const fname = firstName(c.name);
  const res = await sendTemplate(c.phone, t, { firstName: fname, token: c.token });
  await prisma.message.create({
    data: { contactId, direction: "OUT", type: "template", templateName: t.name, body: renderTemplate(t.body, fname), waMessageId: res.ok ? res.id : null, status: res.ok ? "SENT" : "FAILED", error: res.ok ? null : res.error, sentAt: new Date() },
  });
  if (res.ok) await advanceStage(contactId, "ENVIADO", "modelo enviado manualmente");
  revalidatePath(`/conversas/${contactId}`);
}

/** Só no modo simulação: finge que o cliente respondeu, para testar o fluxo completo */
export async function simulateInbound(contactId: string, form: FormData) {
  await requireSession();
  if (!isSimulation()) return;
  const c = await prisma.contact.findUniqueOrThrow({ where: { id: contactId } });
  await handleInbound({ waId: c.phone, type: "text", text: String(form.get("text") ?? "Oi! Quero saber mais") });
  revalidatePath(`/conversas/${contactId}`);
}
