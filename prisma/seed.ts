import { PrismaClient, type Segment } from "@prisma/client";
import bcrypt from "bcryptjs";
import products from "./products.json";

const prisma = new PrismaClient();

const slugify = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

// Templates sugeridos. Precisam ser criados com o MESMO nome no WhatsApp Manager da Meta (ver docs/ESTRATEGIA.md)
const templates: { name: string; segment: Segment | null; body: string; quickReplies: string[] }[] = [
  {
    name: "golden_reativacao_cliente",
    segment: "CLIENTE",
    body: `Oi, {{1}}! Aqui é da Golden Artefatos de Madeira, de Flores da Cunha 🌳

Você já tem uma peça nossa em casa, por isso quisemos mostrar as novidades de Natal primeiro para você: tábuas, petisqueiras, bandejas e peças com gravação personalizada.

Frete grátis acima de R$ 150 para o Sul e o Sudeste.

Toque no botão abaixo para ver o catálogo 👇`,
    quickReplies: ["Não tenho interesse"],
  },
  {
    name: "golden_feira_natal",
    segment: "FEIRA",
    body: `Oi, {{1}}, tudo bem? Aqui é da Golden Artefatos de Madeira. Nos conhecemos em uma feira e você deixou seu contato com a gente 😊

O Natal está chegando e montamos um catálogo com nossas peças de madeira para presentear (ou para deixar a sua mesa mais bonita): petisqueiras, tábuas de churrasco, bandejas e luminárias.

Veja os modelos e peça direto pelo WhatsApp 👇`,
    quickReplies: ["Não tenho interesse"],
  },
  {
    name: "golden_b2b_kits",
    segment: "B2B",
    body: `Olá, {{1}}! Aqui é da Golden Artefatos de Madeira, fábrica em Flores da Cunha (RS).

Estamos fechando pedidos de kits de fim de ano para empresas e lojistas: tábuas, petisqueiras e bandejas de madeira, com gravação da sua marca.

Quer ver o catálogo e receber uma proposta com preço de atacado?`,
    quickReplies: ["Quero uma proposta", "Não tenho interesse"],
  },
  {
    name: "golden_followup",
    segment: null,
    body: `Oi, {{1}}! Passando só para saber se você conseguiu ver o nosso catálogo de Natal 🎄

Se quiser, te ajudo a escolher um presente ou montar um kit. É só responder aqui.`,
    quickReplies: ["Quero ajuda", "Não tenho interesse"],
  },
];

async function main() {
  const email = process.env.ADMIN_EMAIL || "admin@golden.local";
  const password = process.env.ADMIN_PASSWORD || "golden123";
  await prisma.user.upsert({
    where: { email },
    update: {},
    create: { email, name: "Administrador", role: "ADMIN", passwordHash: await bcrypt.hash(password, 10) },
  });

  for (const p of products) {
    const slug = slugify(p.name);
    const data = {
      name: p.name,
      category: p.category,
      price: p.price,
      promoPrice: p.promoPrice,
      ribbon: p.ribbon,
      imageUrl: p.imageUrl,
      siteUrl: p.siteUrl,
      sortOrder: p.sortOrder,
    };
    await prisma.product.upsert({ where: { slug }, update: {}, create: { slug, ...data } });
  }

  for (const t of templates) {
    await prisma.template.upsert({
      where: { name_language: { name: t.name, language: "pt_BR" } },
      update: {},
      create: { ...t, language: "pt_BR", urlButton: true },
    });
  }
  console.log(`Seed ok: admin ${email}, ${products.length} produtos, ${templates.length} templates`);
}

main().finally(() => prisma.$disconnect());
