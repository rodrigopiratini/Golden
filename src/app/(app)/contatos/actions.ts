"use server";

import { Prisma, type Segment, type Stage } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { setStage } from "@/lib/funnel";
import { parseContactsFile } from "@/lib/import";
import { normalizePhone } from "@/lib/phone";

const str = (f: FormData, k: string) => {
  const v = String(f.get(k) ?? "").trim();
  return v || null;
};
const money = (v: string | null) => {
  if (!v) return null;
  const n = Number(v.replace(/\./g, "").replace(",", "."));
  return Number.isFinite(n) ? n : null;
};

export type ImportState = { ok?: boolean; error?: string; created?: number; updated?: number; invalid?: { line: number; reason: string; raw: string }[]; columns?: Record<string, string> };

export async function importContacts(_: ImportState, form: FormData): Promise<ImportState> {
  const session = await requireSession();
  const file = form.get("file");
  if (!(file instanceof File) || file.size === 0) return { error: "Selecione um arquivo .csv ou .xlsx." };
  if (file.size > 10 * 1024 * 1024) return { error: "Arquivo muito grande (máx. 10 MB)." };
  try {
    const { valid, invalid, columns } = await parseContactsFile(file, {
      segment: (str(form, "segment") as Segment) || "OUTRO",
      source: str(form, "source") ?? undefined,
    });
    const existing = new Set((await prisma.contact.findMany({ where: { phone: { in: valid.map((v) => v.phone) } }, select: { phone: true } })).map((c) => c.phone));
    const toCreate = valid.filter((v) => !existing.has(v.phone));
    const toUpdate = valid.filter((v) => existing.has(v.phone));

    await prisma.contact.createMany({ data: toCreate.map((v) => ({ ...v, totalSpent: v.totalSpent ?? null })), skipDuplicates: true });
    for (const v of toUpdate) {
      // Atualiza apenas dados cadastrais; não mexe na etapa do funil nem no histórico
      await prisma.contact.update({
        where: { phone: v.phone },
        data: {
          ...(v.name !== "Sem nome" ? { name: v.name } : {}),
          ...(v.email ? { email: v.email } : {}),
          ...(v.city ? { city: v.city } : {}),
          ...(v.state ? { state: v.state } : {}),
          ...(v.source ? { source: v.source } : {}),
          ...(v.lastPurchaseDesc ? { lastPurchaseDesc: v.lastPurchaseDesc } : {}),
          ...(v.totalSpent ? { totalSpent: v.totalSpent } : {}),
          segment: v.segment,
        },
      });
    }
    const created = await prisma.contact.findMany({ where: { phone: { in: toCreate.map((v) => v.phone) } }, select: { id: true } });
    await prisma.activity.createMany({ data: created.map((c) => ({ contactId: c.id, userId: session.userId, type: "IMPORT", text: `Importado de ${file.name}` })) });
    revalidatePath("/contatos");
    return { ok: true, created: toCreate.length, updated: toUpdate.length, invalid, columns };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Erro ao ler o arquivo." };
  }
}

function contactData(form: FormData) {
  return {
    name: str(form, "name") ?? "Sem nome",
    email: str(form, "email"),
    city: str(form, "city"),
    state: str(form, "state")?.toUpperCase().slice(0, 2) ?? null,
    segment: (str(form, "segment") as Segment) ?? "OUTRO",
    source: str(form, "source"),
    notes: str(form, "notes"),
    lastPurchaseDesc: str(form, "lastPurchaseDesc"),
    totalSpent: money(str(form, "totalSpent")),
    dealValue: money(str(form, "dealValue")),
    tags: (str(form, "tags") ?? "").split(",").map((t) => t.trim()).filter(Boolean),
  };
}

export async function createContact(form: FormData) {
  const session = await requireSession();
  const phone = normalizePhone(str(form, "phone"));
  if (!phone) redirect("/contatos/novo?error=phone");
  let id: string;
  try {
    const c = await prisma.contact.create({ data: { ...contactData(form), phone, ownerId: session.userId } });
    id = c.id;
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") redirect("/contatos/novo?error=dup");
    throw e;
  }
  await prisma.activity.create({ data: { contactId: id, userId: session.userId, type: "NOTE", text: "Contato criado manualmente" } });
  redirect(`/contatos/${id}`);
}

export async function updateContact(id: string, form: FormData) {
  const session = await requireSession();
  const phone = normalizePhone(str(form, "phone"));
  const stage = str(form, "stage") as Stage | null;
  await prisma.contact.update({ where: { id }, data: { ...contactData(form), ...(phone ? { phone } : {}) } });
  if (stage) await setStage(id, stage, session.userId);
  revalidatePath(`/contatos/${id}`);
  revalidatePath("/kanban");
}

export async function addNote(id: string, form: FormData) {
  const session = await requireSession();
  const text = str(form, "text");
  if (!text) return;
  await prisma.activity.create({ data: { contactId: id, userId: session.userId, type: "NOTE", text } });
  await prisma.contact.update({ where: { id }, data: { lastInteractionAt: new Date() } });
  revalidatePath(`/contatos/${id}`);
}

export async function toggleOptOut(id: string) {
  const session = await requireSession();
  const c = await prisma.contact.findUniqueOrThrow({ where: { id }, select: { optOut: true } });
  if (c.optOut) {
    await prisma.contact.update({ where: { id }, data: { optOut: false } });
    await setStage(id, "NOVO", session.userId);
  } else {
    await setStage(id, "OPT_OUT", session.userId);
  }
  revalidatePath(`/contatos/${id}`);
}

export async function deleteContact(id: string) {
  await requireSession();
  await prisma.contact.delete({ where: { id } });
  revalidatePath("/contatos");
  redirect("/contatos");
}
