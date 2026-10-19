import type { Segment, Stage } from "@prisma/client";
import { prisma } from "./db";

export type ContactFlags = {
  id: string;
  segment: Segment;
  source: string | null;
  stage: Stage;
  dealValue: number;
  sent: boolean;
  delivered: boolean;
  read: boolean;
  replied: boolean;
  clicked: boolean;
};

/** Uma linha por contato com os marcos atingidos — base de todos os indicadores. */
export async function contactFlags(where: { campaignId?: string } = {}): Promise<ContactFlags[]> {
  const contactWhere = where.campaignId ? { recipients: { some: { campaignId: where.campaignId } } } : {};
  const [contacts, msgs, clicks] = await Promise.all([
    prisma.contact.findMany({ where: contactWhere, select: { id: true, segment: true, source: true, stage: true, dealValue: true } }),
    prisma.message.groupBy({ by: ["contactId", "direction", "status"], where: { contact: contactWhere } }),
    prisma.click.findMany({
      where: { kind: { not: "CATALOG_VIEW" }, contactId: { not: null }, contact: contactWhere },
      distinct: ["contactId"],
      select: { contactId: true },
    }),
  ]);

  const flags = new Map<string, { sent: boolean; delivered: boolean; read: boolean; replied: boolean }>();
  for (const m of msgs) {
    const f = flags.get(m.contactId) ?? { sent: false, delivered: false, read: false, replied: false };
    if (m.direction === "IN") f.replied = true;
    else if (m.status !== "FAILED") {
      f.sent = true;
      if (m.status === "DELIVERED" || m.status === "READ") f.delivered = true;
      if (m.status === "READ") f.read = true;
    }
    flags.set(m.contactId, f);
  }
  const clicked = new Set(clicks.map((c) => c.contactId));

  return contacts.map((c) => ({
    ...c,
    dealValue: Number(c.dealValue ?? 0),
    ...(flags.get(c.id) ?? { sent: false, delivered: false, read: false, replied: false }),
    clicked: clicked.has(c.id),
  }));
}

export function summarize(rows: ContactFlags[]) {
  const won = rows.filter((r) => r.stage === "GANHO");
  const interested = rows.filter((r) => r.clicked || ["INTERESSADO", "NEGOCIANDO", "GANHO"].includes(r.stage));
  return {
    total: rows.length,
    sent: rows.filter((r) => r.sent).length,
    delivered: rows.filter((r) => r.delivered).length,
    read: rows.filter((r) => r.read).length,
    replied: rows.filter((r) => r.replied).length,
    interested: interested.length,
    won: won.length,
    revenue: won.reduce((s, r) => s + r.dealValue, 0),
    pipeline: rows.filter((r) => r.stage === "NEGOCIANDO").reduce((s, r) => s + r.dealValue, 0),
    optOut: rows.filter((r) => r.stage === "OPT_OUT").length,
  };
}

export function groupBy<K extends string>(rows: ContactFlags[], key: (r: ContactFlags) => K) {
  const map = new Map<K, ContactFlags[]>();
  for (const r of rows) {
    const k = key(r);
    map.set(k, [...(map.get(k) ?? []), r]);
  }
  return [...map.entries()].map(([k, list]) => ({ key: k, ...summarize(list) }));
}

/** Contatos que responderam depois de receber a campanha, por campanha */
export async function campaignReplies() {
  const [recipients, lastInbound] = await Promise.all([
    prisma.campaignRecipient.findMany({ where: { status: "SENT", sentAt: { not: null } }, select: { campaignId: true, contactId: true, sentAt: true } }),
    prisma.message.groupBy({ by: ["contactId"], where: { direction: "IN" }, _max: { createdAt: true } }),
  ]);
  const last = new Map(lastInbound.map((m) => [m.contactId, m._max.createdAt]));
  const out = new Map<string, number>();
  for (const r of recipients) {
    const at = last.get(r.contactId);
    if (at && r.sentAt && at >= r.sentAt) out.set(r.campaignId, (out.get(r.campaignId) ?? 0) + 1);
  }
  return out;
}
