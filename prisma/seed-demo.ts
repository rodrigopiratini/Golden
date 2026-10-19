// Dados de DEMONSTRAÇÃO (contatos fictícios) para visualizar o dashboard e o kanban.
// Uso: npm run seed:demo   |   Remover: npm run seed:demo -- --clean
import { PrismaClient, type Segment, type Stage } from "@prisma/client";

const prisma = new PrismaClient();
const DEMO_TAG = "demo";

const first = ["Ana", "Bruno", "Carla", "Diego", "Elisa", "Fábio", "Gabriela", "Henrique", "Isabela", "João", "Karina", "Lucas", "Mariana", "Nelson", "Olívia", "Paulo", "Rafaela", "Sérgio", "Tatiana", "Vinícius"];
const last = ["Silva", "Bortolini", "Zanotto", "Pereira", "Basso", "Rossi", "Molon", "Costa", "Dal Pizzol", "Oliveira"];
const sources = ["Feira Fenavindima", "Expointer", "Feira do Livro POA", "Natal Luz Gramado", "Site", "Instagram", "Cliente loja"];
const stages: Stage[] = ["NOVO", "NOVO", "NOVO", "ENVIADO", "ENVIADO", "LIDO", "LIDO", "RESPONDEU", "INTERESSADO", "NEGOCIANDO", "GANHO", "PERDIDO", "OPT_OUT"];
const pick = <T,>(a: T[]) => a[Math.floor(Math.random() * a.length)];

async function main() {
  await prisma.contact.deleteMany({ where: { tags: { has: DEMO_TAG } } });
  if (process.argv.includes("--clean")) return console.log("Contatos de demonstração removidos.");
  const products = await prisma.product.findMany({ select: { id: true } });
  for (let i = 0; i < 120; i++) {
    const src = pick(sources);
    const segment: Segment = src.startsWith("Cliente") || src === "Site" ? "CLIENTE" : i % 9 === 0 ? "B2B" : "FEIRA";
    const stage = pick(stages);
    const created = new Date(Date.now() - Math.random() * 20 * 86400000);
    const c = await prisma.contact.create({
      data: {
        name: `${pick(first)} ${pick(last)}`,
        phone: `55549${String(90000000 + i * 7919).slice(0, 8)}`,
        segment,
        source: src,
        stage,
        city: pick(["Caxias do Sul", "Flores da Cunha", "Bento Gonçalves", "Porto Alegre", "Gramado", "Farroupilha"]),
        state: "RS",
        tags: [DEMO_TAG],
        optOut: stage === "OPT_OUT",
        dealValue: stage === "GANHO" || stage === "NEGOCIANDO" ? Math.round(80 + Math.random() * 600) : null,
        createdAt: created,
        lastInteractionAt: stage === "NOVO" ? null : new Date(created.getTime() + 86400000),
        unread: ["RESPONDEU", "INTERESSADO"].includes(stage) && Math.random() > 0.4,
        lastInboundAt: ["RESPONDEU", "INTERESSADO", "NEGOCIANDO", "GANHO"].includes(stage) ? new Date(Date.now() - Math.random() * 3 * 86400000) : null,
      },
    });
    if (stage !== "NOVO") {
      const reached = stages.indexOf(stage);
      await prisma.message.create({
        data: {
          contactId: c.id, direction: "OUT", type: "template", templateName: "golden_feira_natal",
          body: "Mensagem de campanha (demo)", status: reached >= 5 ? "READ" : "DELIVERED",
          sentAt: created, deliveredAt: created, readAt: reached >= 5 ? created : null, createdAt: created,
        },
      });
      if (["RESPONDEU", "INTERESSADO", "NEGOCIANDO", "GANHO"].includes(stage))
        await prisma.message.create({
          data: { contactId: c.id, direction: "IN", type: "text", body: pick(["Oi! Quero ver mais", "Quanto fica o frete para Caxias?", "Tem a tábua de churrasco?", "Lindo! Faz com gravação?"]), status: "RECEIVED", createdAt: new Date(created.getTime() + 3600000) },
        });
      if (["INTERESSADO", "NEGOCIANDO", "GANHO"].includes(stage) && products.length)
        await prisma.click.create({ data: { kind: "PRODUCT_WHATSAPP", contactId: c.id, productId: pick(products).id } });
      if (Math.random() > 0.4) await prisma.click.create({ data: { kind: "CATALOG_VIEW", contactId: c.id } });
    }
  }
  console.log("120 contatos de demonstração criados (tag 'demo').");
}

main().finally(() => prisma.$disconnect());
