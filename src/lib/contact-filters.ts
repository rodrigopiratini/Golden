import type { Prisma, Segment, Stage } from "@prisma/client";

export type ContactFilters = { q?: string; segment?: string; stage?: string; source?: string; page?: string };

export function contactWhere({ q, segment, stage, source }: ContactFilters): Prisma.ContactWhereInput {
  return {
    ...(q ? { OR: [{ name: { contains: q, mode: "insensitive" } }, { phone: { contains: q.replace(/\D/g, "") || q } }, { city: { contains: q, mode: "insensitive" } }] } : {}),
    ...(segment ? { segment: segment as Segment } : {}),
    ...(stage ? { stage: stage as Stage } : {}),
    ...(source ? { source } : {}),
  };
}
