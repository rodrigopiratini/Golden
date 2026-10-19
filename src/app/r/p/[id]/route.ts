import type { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { advanceStage } from "@/lib/funnel";
import { brl } from "@/lib/format";

/**
 * Redirecionador rastreado do catálogo:
 *  /r/p/<produto>?c=<token do contato>&to=wa   → abre o WhatsApp da Golden com a mensagem pronta
 *  /r/p/<produto>?c=<token do contato>&to=site → abre a página do produto na loja online
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const token = req.nextUrl.searchParams.get("c");
  const to = req.nextUrl.searchParams.get("to") === "site" ? "site" : "wa";

  const [product, contact] = await Promise.all([
    id === "personalizado" ? null : prisma.product.findUnique({ where: { id } }),
    token ? prisma.contact.findUnique({ where: { token }, select: { id: true } }) : null,
  ]);

  await prisma.click.create({ data: { kind: to === "site" ? "PRODUCT_SITE" : "PRODUCT_WHATSAPP", productId: product?.id, contactId: contact?.id } });
  if (contact) {
    await prisma.activity.create({
      data: { contactId: contact.id, type: "CLICK", text: `Clicou em ${to === "site" ? "“Comprar no site”" : "“Quero este”"}: ${product?.name ?? "peça personalizada"}` },
    });
    await advanceStage(contact.id, "INTERESSADO", `clicou em ${product?.name ?? "personalizado"}`);
  }

  if (to === "site" && product?.siteUrl) return Response.redirect(product.siteUrl, 302);

  const text = product
    ? `Olá! Vi o catálogo da Golden e tenho interesse em: *${product.name}* (${brl(product.promoPrice ?? product.price)}). Pode me ajudar?`
    : "Olá! Vi o catálogo da Golden e quero um presente personalizado. Pode me ajudar?";
  const phone = (process.env.COMPANY_WHATSAPP ?? "").replace(/\D/g, "");
  return Response.redirect(`https://wa.me/${phone}?text=${encodeURIComponent(text)}`, 302);
}
