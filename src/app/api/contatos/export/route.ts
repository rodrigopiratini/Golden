import type { NextRequest } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { contactWhere } from "@/lib/contact-filters";
import { SEGMENT_MAP, STAGE_MAP } from "@/lib/stages";

const cell = (v: unknown) => {
  const s = v === null || v === undefined ? "" : String(v);
  return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export async function GET(req: NextRequest) {
  if (!(await getSession())) return new Response("Não autorizado", { status: 401 });
  const sp = Object.fromEntries(req.nextUrl.searchParams);
  const contacts = await prisma.contact.findMany({ where: contactWhere(sp), orderBy: { createdAt: "desc" } });
  const header = ["Nome", "Telefone", "Segmento", "Origem", "Etapa", "Valor negócio", "Cidade", "UF", "E-mail", "Comprou", "Total comprado", "Tags", "Observações", "Criado em"];
  const lines = contacts.map((c) =>
    [c.name, c.phone, SEGMENT_MAP[c.segment].label, c.source, STAGE_MAP[c.stage].label, c.dealValue?.toString().replace(".", ","), c.city, c.state, c.email, c.lastPurchaseDesc, c.totalSpent?.toString().replace(".", ","), c.tags.join(", "), c.notes, c.createdAt.toLocaleDateString("pt-BR")]
      .map(cell)
      .join(";"),
  );
  return new Response("﻿" + [header.join(";"), ...lines].join("\r\n"), {
    headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="contatos-golden-${new Date().toISOString().slice(0, 10)}.csv"` },
  });
}
