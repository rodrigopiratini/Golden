"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { audienceWhere, filtersFromForm, sendWave } from "@/lib/campaign";

export async function createCampaign(form: FormData) {
  await requireSession();
  const templateId = String(form.get("templateId") ?? "");
  const name = String(form.get("name") ?? "").trim() || "Campanha";
  const filters = filtersFromForm(form);
  const contacts = await prisma.contact.findMany({ where: audienceWhere(filters), select: { id: true } });
  if (!templateId || !contacts.length) redirect("/campanhas/nova?error=empty");
  const c = await prisma.campaign.create({
    data: { name, templateId, filters, recipients: { createMany: { data: contacts.map((x) => ({ contactId: x.id })) } } },
  });
  redirect(`/campanhas/${c.id}`);
}

export async function sendCampaignWave(id: string, form: FormData) {
  await requireSession();
  const n = Number(form.get("n") ?? 50);
  const r = await sendWave(id, n);
  revalidatePath(`/campanhas/${id}`);
  revalidatePath("/");
  redirect(`/campanhas/${id}?sent=${r.sent}&failed=${r.failed}`);
}

export async function deleteCampaign(id: string) {
  await requireSession();
  await prisma.campaign.delete({ where: { id } });
  revalidatePath("/campanhas");
  redirect("/campanhas");
}
