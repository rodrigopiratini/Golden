import Link from "next/link";
import { ExternalLink, Eye, EyeOff, Plus } from "lucide-react";
import { prisma } from "@/lib/db";
import { brl } from "@/lib/format";
import { CATEGORIES } from "@/lib/stages";
import { PageHeader } from "@/components/ui";
import { saveProduct, toggleProduct } from "./actions";

export const dynamic = "force-dynamic";
export const metadata = { title: "Catálogo" };

export default async function ProductsPage({ searchParams }: { searchParams: Promise<{ edit?: string }> }) {
  const { edit } = await searchParams;
  const products = await prisma.product.findMany({ orderBy: [{ category: "asc" }, { sortOrder: "asc" }], include: { _count: { select: { clicks: true } } } });
  const editing = edit && edit !== "new" ? products.find((p) => p.id === edit) : null;
  const dec = (v: unknown) => (v ? String(v).replace(".", ",") : "");

  return (
    <>
      <PageHeader title="Catálogo de produtos" subtitle="Produtos exibidos no catálogo que os clientes abrem pelo WhatsApp">
        <a href="/catalogo" target="_blank" className="btn-ghost"><ExternalLink size={16} /> Ver catálogo público</a>
        <Link href="/produtos?edit=new" className="btn-primary"><Plus size={16} /> Novo produto</Link>
      </PageHeader>

      {(edit === "new" || editing) && (
        <form action={saveProduct.bind(null, editing?.id ?? null)} className="card mb-6 grid gap-4 p-6 sm:grid-cols-2 lg:grid-cols-4">
          <div className="sm:col-span-2">
            <label className="label">Nome</label>
            <input name="name" defaultValue={editing?.name} required className="input" />
          </div>
          <div>
            <label className="label">Categoria</label>
            <select name="category" defaultValue={editing?.category ?? CATEGORIES[0]} className="input">
              {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Selo (NOVO, OFERTA…)</label>
            <input name="ribbon" defaultValue={editing?.ribbon ?? ""} className="input" />
          </div>
          <div>
            <label className="label">Preço (R$)</label>
            <input name="price" defaultValue={dec(editing?.price)} required inputMode="decimal" className="input" />
          </div>
          <div>
            <label className="label">Preço promocional (R$)</label>
            <input name="promoPrice" defaultValue={dec(editing?.promoPrice)} inputMode="decimal" className="input" />
          </div>
          <div className="sm:col-span-2">
            <label className="label">URL da foto</label>
            <input name="imageUrl" defaultValue={editing?.imageUrl ?? ""} className="input" />
          </div>
          <div className="sm:col-span-2">
            <label className="label">Link para comprar no site</label>
            <input name="siteUrl" defaultValue={editing?.siteUrl ?? ""} className="input" />
          </div>
          <div>
            <label className="label">Ordem</label>
            <input name="sortOrder" type="number" defaultValue={editing?.sortOrder ?? 0} className="input" />
          </div>
          <label className="flex items-center gap-2 self-end pb-2 text-sm"><input type="checkbox" name="active" defaultChecked={editing?.active ?? true} /> Visível no catálogo</label>
          <div className="sm:col-span-2 lg:col-span-4">
            <label className="label">Descrição (medidas, madeira, personalização…)</label>
            <textarea name="description" defaultValue={editing?.description ?? ""} rows={2} className="input" />
          </div>
          <div className="flex gap-2 sm:col-span-2 lg:col-span-4">
            <button className="btn-primary">Salvar produto</button>
            <Link href="/produtos" className="btn-ghost">Cancelar</Link>
          </div>
        </form>
      )}

      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-5">
        {products.map((p) => (
          <article key={p.id} className={`card overflow-hidden ${p.active ? "" : "opacity-50"}`}>
            <div className="relative aspect-square bg-wood-soft">
              {p.imageUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={p.imageUrl} alt={p.name} className="size-full object-cover" loading="lazy" />
              )}
              {p.ribbon && <span className="badge absolute top-2 left-2 bg-gold text-ink">{p.ribbon}</span>}
            </div>
            <div className="space-y-1 p-3">
              <p className="text-[11px] tracking-wide text-muted uppercase">{p.category}</p>
              <h2 className="line-clamp-2 text-sm leading-snug font-medium">{p.name}</h2>
              <p className="text-sm">
                {p.promoPrice ? <><s className="text-xs text-muted">{brl(p.price)}</s> <b>{brl(p.promoPrice)}</b></> : <b>{brl(p.price)}</b>}
              </p>
              <p className="text-xs text-muted">{p._count.clicks} cliques</p>
              <div className="flex items-center justify-between pt-1">
                <Link href={`/produtos?edit=${p.id}`} className="text-xs font-medium text-gold-dark hover:underline">Editar</Link>
                <form action={toggleProduct.bind(null, p.id)}>
                  <button className="text-muted hover:text-ink" title={p.active ? "Ocultar do catálogo" : "Mostrar no catálogo"}>
                    {p.active ? <Eye size={16} /> : <EyeOff size={16} />}
                  </button>
                </form>
              </div>
            </div>
          </article>
        ))}
      </div>
    </>
  );
}
