"use server";

import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireSession } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function createUser(form: FormData) {
  const s = await requireSession();
  if (s.role !== "ADMIN") throw new Error("Apenas administradores podem criar usuários.");
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  const password = String(form.get("password") ?? "");
  if (password.length < 8) redirect("/configuracoes?error=senha");
  await prisma.user.create({
    data: { email, name: String(form.get("name") ?? "").trim() || email, role: form.get("role") === "ADMIN" ? "ADMIN" : "ATENDENTE", passwordHash: await bcrypt.hash(password, 10) },
  });
  revalidatePath("/configuracoes");
}

export async function changePassword(form: FormData) {
  const s = await requireSession();
  const password = String(form.get("password") ?? "");
  if (password.length < 8) redirect("/configuracoes?error=senha");
  await prisma.user.update({ where: { id: s.userId }, data: { passwordHash: await bcrypt.hash(password, 10) } });
  redirect("/configuracoes?ok=senha");
}
