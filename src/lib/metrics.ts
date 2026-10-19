import { Prisma, type Segment, type Stage } from "@prisma/client";
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
  const rows = await prisma.$queryRaw<
    { id: string; segment: Segment; source: string | null; stage: Stage; dealValue: string | null; sent: boolean; delivered: boolean; read: boolean; replied: boolean; clicked: boolean }[]
  >`
    SELECT c.id, c.segment, c.source, c.stage, c."dealValue"::text AS "dealValue",
      EXISTS (SELECT 1 FROM "Message" m WHERE m."contactId" = c.id AND m.direction = 'OUT' AND m.status <> 'FAILED') AS sent,
      EXISTS (SELECT 1 FROM "Message" m WHERE m."contactId" = c.id AND m.direction = 'OUT' AND m.status IN ('DELIVERED','READ')) AS delivered,
      EXISTS (SELECT 1 FROM "Message" m WHERE m."contactId" = c.id AND m.direction = 'OUT' AND m.status = 'READ') AS read,
      EXISTS (SELECT 1 FROM "Message" m WHERE m."contactId" = c.id AND m.direction = 'IN') AS replied,
      EXISTS (SELECT 1 FROM "Click" k WHERE k."contactId" = c.id AND k.kind <> 'CATALOG_VIEW') AS clicked
    FROM "Contact" c
    ${where.campaignId ? Prisma.sql`WHERE EXISTS (SELECT 1 FROM "CampaignRecipient" r WHERE r."contactId" = c.id AND r."campaignId" = ${where.campaignId})` : Prisma.empty}
  `;
  return rows.map((r) => ({ ...r, dealValue: Number(r.dealValue ?? 0) }));
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
