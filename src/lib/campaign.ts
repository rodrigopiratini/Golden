import type { Prisma, Segment, Stage } from "@prisma/client";
import { prisma } from "./db";
import { advanceStage } from "./funnel";
import { firstName } from "./format";
import { renderTemplate, sendTemplate } from "./whatsapp";

export type CampaignFilters = { segments: Segment[]; stages: Stage[]; sources: string[]; tags: string[]; skipContactedDays: number };

export function filtersFromForm(form: FormData | URLSearchParams): CampaignFilters {
  const all = (k: string) => form.getAll(k).map(String).filter(Boolean);
  return {
    segments: all("segments") as Segment[],
    stages: all("stages") as Stage[],
    sources: all("sources"),
    tags: all("tags"),
    skipContactedDays: Number(form.get("skipContactedDays") ?? 7) || 0,
  };
}

export function audienceWhere(f: CampaignFilters): Prisma.ContactWhereInput {
  return {
    optOut: false,
    stage: { notIn: ["OPT_OUT", "GANHO"], ...(f.stages.length ? { in: f.stages } : {}) },
    ...(f.segments.length ? { segment: { in: f.segments } } : {}),
    ...(f.sources.length ? { source: { in: f.sources } } : {}),
    ...(f.tags.length ? { tags: { hasSome: f.tags } } : {}),
    ...(f.skipContactedDays > 0
      ? { messages: { none: { direction: "OUT", createdAt: { gte: new Date(Date.now() - f.skipContactedDays * 86400000) } } } }
      : {}),
  };
}

/** Envia a próxima "onda" de uma campanha (n contatos pendentes). */
export async function sendWave(campaignId: string, n: number) {
  const campaign = await prisma.campaign.findUniqueOrThrow({ where: { id: campaignId }, include: { template: true } });
  if (campaign.status === "DONE") return { sent: 0, failed: 0, remaining: 0 };
  await prisma.campaign.update({ where: { id: campaignId }, data: { status: "RUNNING", startedAt: campaign.startedAt ?? new Date() } });

  const batch = await prisma.campaignRecipient.findMany({
    where: { campaignId, status: "PENDING" },
    include: { contact: true },
    take: Math.min(Math.max(n, 1), 1000),
  });

  let sent = 0;
  let failed = 0;
  const queue = [...batch];
  // 5 envios simultâneos — bem abaixo do limite de throughput da Cloud API
  await Promise.all(
    Array.from({ length: 5 }, async () => {
      for (let r = queue.shift(); r; r = queue.shift()) {
        const c = r.contact;
        // "reserva" o destinatário — evita envio duplicado se duas ondas rodarem ao mesmo tempo
        const claimed = await prisma.campaignRecipient.updateMany({ where: { id: r.id, status: "PENDING" }, data: { status: "SENT", sentAt: new Date() } });
        if (!claimed.count) continue;
        if (c.optOut) {
          await prisma.campaignRecipient.update({ where: { id: r.id }, data: { status: "SKIPPED", error: "não contatar" } });
          continue;
        }
        const fname = firstName(c.name);
        const res = await sendTemplate(c.phone, campaign.template, { firstName: fname, token: c.token });
        await prisma.message.create({
          data: {
            contactId: c.id, campaignId, direction: "OUT", type: "template", templateName: campaign.template.name,
            body: renderTemplate(campaign.template.body, fname), waMessageId: res.ok ? res.id : null,
            status: res.ok ? "SENT" : "FAILED", error: res.ok ? null : res.error, sentAt: new Date(),
          },
        });
        await prisma.campaignRecipient.update({
          where: { id: r.id },
          data: { status: res.ok ? "SENT" : "FAILED", error: res.ok ? null : res.error, sentAt: new Date() },
        });
        if (res.ok) {
          sent++;
          await prisma.contact.update({ where: { id: c.id }, data: { lastInteractionAt: new Date() } });
          await advanceStage(c.id, "ENVIADO", `campanha "${campaign.name}"`);
        } else failed++;
      }
    }),
  );

  const remaining = await prisma.campaignRecipient.count({ where: { campaignId, status: "PENDING" } });
  await prisma.campaign.update({
    where: { id: campaignId },
    data: remaining ? { status: "PAUSED" } : { status: "DONE", finishedAt: new Date() },
  });
  return { sent, failed, remaining };
}
