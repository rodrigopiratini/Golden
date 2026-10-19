import Image from "next/image";
import { headers } from "next/headers";
import { AtSign, MapPin, MessageCircle, ShoppingBag, Truck } from "lucide-react";
import { prisma } from "@/lib/db";
import { brl, firstName, slugify } from "@/lib/format";
import { CATEGORIES } from "@/lib/stages";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Catálogo · Golden Artefatos de Madeira",
  description: "Tábuas, petisqueiras, bandejas e luminárias de madeira feitas em Flores da Cunha (RS). Peça pelo WhatsApp.",
  openGraph: { images: ["/brand/logo-dark.png"] },
};

const BOT = /bot|crawler|spider|facebookexternalhit|whatsapp|preview|slurp/i;

export default async function Catalog({ searchParams }: { searchParams: Promise<{ c?: string }> }) {
  const { c } = await searchParams;
  const contact = c ? await prisma.contact.findUnique({ where: { token: c }, select: { id: true, name: true } }) : null;

  const ua = (await headers()).get("user-agent") ?? "";
  if (!BOT.test(ua)) {
    // registra a visita (no máximo 1 a cada 30 min por contato)
    const recent = contact
      ? await prisma.click.findFirst({ where: { contactId: contact.id, kind: "CATALOG_VIEW", createdAt: { gte: new Date(Date.now() - 30 * 60000) } } })
      : null;
    if (!recent) {
      await prisma.click.create({ data: { kind: "CATALOG_VIEW", contactId: contact?.id } });
      if (contact) await prisma.contact.update({ where: { id: contact.id }, data: { lastInteractionAt: new Date() } });
    }
  }

  const products = await prisma.product.findMany({ where: { active: true }, orderBy: [{ sortOrder: "asc" }] });
  const categories = CATEGORIES.filter((cat) => products.some((p) => p.category === cat));
  const q = c ? `?c=${encodeURIComponent(c)}` : "";
  const sep = c ? "&" : "?";

  return (
    <div className="min-h-screen bg-paper">
      <header className="bg-graphite text-white">
        <div className="mx-auto flex max-w-6xl flex-col items-center gap-5 px-4 pt-10 pb-12 text-center">
          <Image src="/brand/logo-white.png" alt="Golden Artefatos de Madeira" width={140} height={127} priority />
          <div>
            <p className="text-sm tracking-[0.25em] text-gold uppercase">Catálogo</p>
            <h1 className="mt-2 font-display text-3xl font-semibold sm:text-4xl">
              {contact ? `${firstName(contact.name)}, separamos isso para você` : "Peças de madeira para a sua casa"}
            </h1>
            <p className="mx-auto mt-3 max-w-xl text-white/70">
              Tábuas, petisqueiras, bandejas e luminárias feitas em Flores da Cunha (RS). Presentes que ficam na família.
            </p>
          </div>
          <div className="flex flex-wrap justify-center gap-3 text-xs text-white/80">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5"><Truck size={14} className="text-gold" /> Frete grátis acima de R$ 150 (Sul e Sudeste)</span>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5"><MessageCircle size={14} className="text-gold" /> Atendimento pelo WhatsApp</span>
          </div>
        </div>
      </header>

      <nav className="sticky top-0 z-10 border-b border-line bg-paper/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl gap-2 overflow-x-auto px-4 py-3">
          {categories.map((cat) => (
            <a key={cat} href={`#${slugify(cat)}`} className="rounded-full border border-line bg-white px-4 py-1.5 text-sm whitespace-nowrap hover:border-gold">{cat}</a>
          ))}
        </div>
      </nav>

      <main className="mx-auto max-w-6xl space-y-12 px-4 py-10">
        {categories.map((cat) => (
          <section key={cat} id={slugify(cat)} className="scroll-mt-20">
            <h2 className="mb-5 font-display text-2xl font-semibold">{cat}</h2>
            <div className="grid grid-cols-2 gap-4 sm:gap-6 md:grid-cols-3 lg:grid-cols-4">
              {products.filter((p) => p.category === cat).map((p) => (
                <article key={p.id} className="flex flex-col overflow-hidden rounded-2xl border border-line bg-white">
                  <div className="relative aspect-square bg-wood-soft">
                    {p.imageUrl && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={p.imageUrl} alt={p.name} className="size-full object-cover" loading="lazy" />
                    )}
                    {p.ribbon && <span className="absolute top-3 left-3 rounded-full bg-gold px-2.5 py-1 text-[11px] font-semibold text-ink">{p.ribbon}</span>}
                  </div>
                  <div className="flex flex-1 flex-col p-3 sm:p-4">
                    <h3 className="text-sm leading-snug font-medium sm:text-base">{p.name}</h3>
                    {p.description && <p className="mt-1 line-clamp-2 text-xs text-muted">{p.description}</p>}
                    <p className="mt-2 mb-3">
                      {p.promoPrice ? (
                        <><s className="mr-1.5 text-xs text-muted">{brl(p.price)}</s><b className="text-lg">{brl(p.promoPrice)}</b></>
                      ) : (
                        <b className="text-lg">{brl(p.price)}</b>
                      )}
                    </p>
                    <div className="mt-auto space-y-2">
                      <a href={`/r/p/${p.id}${q}${sep}to=wa`} className="flex w-full items-center justify-center gap-2 rounded-lg bg-[#25d366] px-3 py-2.5 text-sm font-semibold text-white hover:bg-[#1ebe5b]">
                        <MessageCircle size={16} /> Quero este
                      </a>
                      {p.siteUrl && (
                        <a href={`/r/p/${p.id}${q}${sep}to=site`} className="flex w-full items-center justify-center gap-2 rounded-lg border border-line px-3 py-2 text-xs font-medium hover:border-graphite">
                          <ShoppingBag size={14} /> Comprar no site
                        </a>
                      )}
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </section>
        ))}

        <section className="rounded-2xl bg-graphite p-8 text-center text-white">
          <h2 className="font-display text-2xl font-semibold">Quer um presente personalizado?</h2>
          <p className="mx-auto mt-2 max-w-lg text-white/70">Gravamos nomes, datas e logotipos nas peças. Ideal para presentes de Natal e kits para empresas.</p>
          <a href={`/r/p/personalizado${q}${sep}to=wa`} className="mt-5 inline-flex items-center gap-2 rounded-lg bg-gold px-5 py-3 font-semibold text-ink hover:bg-gold-dark">
            <MessageCircle size={18} /> Falar com a Golden
          </a>
        </section>
      </main>

      <footer className="border-t border-line py-8 text-center text-sm text-muted">
        <Image src="/brand/logo-dark.png" alt="Golden" width={64} height={58} className="mx-auto mb-3" />
        <p className="inline-flex items-center gap-1"><MapPin size={14} /> Estrada Gaviolli, s/n · Flores da Cunha · RS</p>
        <p className="mt-1">
          <a href="https://www.instagram.com/golden.artmad/" className="inline-flex items-center gap-1 hover:text-ink"><AtSign size={14} /> @golden.artmad</a>
          {" · "}
          <a href="https://www.goldenartefatosdemadeira.com/" className="hover:text-ink">goldenartefatosdemadeira.com</a>
        </p>
      </footer>
    </div>
  );
}
