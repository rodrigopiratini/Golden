"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { slugify } from "@/lib/format";

const money = (v: FormDataEntryValue | null) => {
  const s = String(v ?? "").trim();
  if (!s) return null;
  const n = Number(s.replace(/\./g, "").replace(",", "."));
  return Number.isFinite(n) ? n : null;
};

export async function saveProduct(id: string | null, form: FormData) {
  await requireSession();
  const name = String(form.get("name") ?? "").trim();
  const data = {
    name,
    category: String(form.get("category") ?? "Mesa Posta"),
    description: String(form.get("description") ?? "").trim() || null,
    price: money(form.get("price")) ?? 0,
    promoPrice: money(form.get("promoPrice")),
    imageUrl: String(form.get("imageUrl") ?? "").trim() || null,
    siteUrl: String(form.get("siteUrl") ?? "").trim() || null,
    ribbon: String(form.get("ribbon") ?? "").trim() || null,
    sortOrder: Number(form.get("sortOrder") ?? 0) || 0,
    active: form.get("active") === "on",
  };
  if (id) await prisma.product.update({ where: { id }, data });
  else {
    let slug = slugify(name) || "produto";
    if (await prisma.product.findUnique({ where: { slug } })) slug += "-" + Date.now().toString(36);
    await prisma.product.create({ data: { ...data, slug } });
  }
  revalidatePath("/produtos");
  revalidatePath("/catalogo");
  redirect("/produtos");
}

export async function toggleProduct(id: string) {
  await requireSession();
  const p = await prisma.product.findUniqueOrThrow({ where: { id } });
  await prisma.product.update({ where: { id }, data: { active: !p.active } });
  revalidatePath("/produtos");
  revalidatePath("/catalogo");
}
