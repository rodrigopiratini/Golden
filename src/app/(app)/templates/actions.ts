"use server";

import type { Segment } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireSession } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function saveTemplate(id: string | null, form: FormData) {
  await requireSession();
  const data = {
    name: String(form.get("name") ?? "").trim().toLowerCase().replace(/[^a-z0-9_]/g, "_"),
    language: String(form.get("language") ?? "pt_BR"),
    segment: (String(form.get("segment") ?? "") || null) as Segment | null,
    body: String(form.get("body") ?? "").trim(),
    headerImage: String(form.get("headerImage") ?? "").trim() || null,
    urlButton: form.get("urlButton") === "on",
    quickReplies: String(form.get("quickReplies") ?? "").split("\n").map((s) => s.trim()).filter(Boolean).slice(0, 3),
    active: form.get("active") === "on",
  };
  if (!data.name || !data.body) throw new Error("Nome e texto são obrigatórios");
  if (id) await prisma.template.update({ where: { id }, data });
  else await prisma.template.create({ data });
  revalidatePath("/templates");
  redirect("/templates");
}
