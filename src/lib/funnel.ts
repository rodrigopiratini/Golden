import type { Stage } from "@prisma/client";
import { prisma } from "./db";
import { isAhead, STAGE_MAP } from "./stages";

/** Avança o contato no funil apenas se a nova etapa estiver à frente (eventos automáticos). */
export async function advanceStage(contactId: string, target: Stage, reason: string) {
  const c = await prisma.contact.findUnique({ where: { id: contactId }, select: { stage: true } });
  if (!c || !isAhead(target, c.stage)) return false;
  await prisma.$transaction([
    prisma.contact.update({ where: { id: contactId }, data: { stage: target, lastInteractionAt: new Date() } }),
    prisma.activity.create({
      data: { contactId, type: "STAGE", text: `${STAGE_MAP[c.stage].label} → ${STAGE_MAP[target].label} (${reason})` },
    }),
  ]);
  return true;
}

/** Mudança manual (kanban / ficha do contato) — permite qualquer direção. */
export async function setStage(contactId: string, target: Stage, userId?: string) {
  const c = await prisma.contact.findUnique({ where: { id: contactId }, select: { stage: true } });
  if (!c || c.stage === target) return;
  await prisma.$transaction([
    prisma.contact.update({
      where: { id: contactId },
      data: { stage: target, lastInteractionAt: new Date(), optOut: target === "OPT_OUT" },
    }),
    prisma.activity.create({
      data: { contactId, userId, type: "STAGE", text: `${STAGE_MAP[c.stage].label} → ${STAGE_MAP[target].label}` },
    }),
  ]);
}

export async function optOutContact(contactId: string, reason: string) {
  await prisma.$transaction([
    prisma.contact.update({ where: { id: contactId }, data: { optOut: true, stage: "OPT_OUT" } }),
    prisma.activity.create({ data: { contactId, type: "OPT_OUT", text: `Pediu para não receber mensagens (${reason})` } }),
  ]);
}
