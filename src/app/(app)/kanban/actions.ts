"use server";

import type { Stage } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { setStage } from "@/lib/funnel";
import { STAGE_MAP } from "@/lib/stages";

export async function moveContact(contactId: string, stage: Stage, position: number) {
  const session = await requireSession();
  if (!STAGE_MAP[stage]) throw new Error("Etapa inválida");
  await setStage(contactId, stage, session.userId);
  await prisma.contact.update({ where: { id: contactId }, data: { position } });
  revalidatePath("/");
  revalidatePath("/kanban");
}
