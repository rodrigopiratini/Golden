import Link from "next/link";
import { prisma } from "@/lib/db";
import { SEGMENT_MAP, SEGMENTS } from "@/lib/stages";
import { PageHeader } from "@/components/ui";
import { PhonePreview } from "@/components/PhonePreview";
import { saveTemplate } from "./actions";

export const dynamic = "force-dynamic";
export const metadata = { title: "Mensagens" };

export default async function TemplatesPage({ searchParams }: { searchParams: Promise<{ edit?: string }> }) {
  const { edit } = await searchParams;
  const templates = await prisma.template.findMany({ orderBy: { createdAt: "asc" }, include: { _count: { select: { campaigns: true } } } });
  const editing = edit && edit !== "new" ? templates.find((t) => t.id === edit) : null;
  const appUrl = process.env.APP_URL ?? "https://sua-plataforma.com";

  return (
    <>
      <PageHeader title="Modelos de mensagem" subtitle="A primeira mensagem para um contato precisa ser um template aprovado pela Meta.">
        <Link href="/templates?edit=new" className="btn-primary">Novo modelo</Link>
      </PageHeader>

      <div className="mb-6 rounded-xl border border-gold/50 bg-gold-soft p-4 text-sm">
        <b>Como aprovar na Meta:</b> no WhatsApp Manager → <i>Modelos de mensagem</i> → <i>Criar modelo</i>, categoria <b>Marketing</b>, idioma <b>Português (BR)</b>.
        Use <b>exatamente o mesmo nome</b> e texto daqui. No botão “Ver catálogo”, escolha <b>URL dinâmica</b> com{" "}
        <code className="rounded bg-white px-1">{appUrl}/catalogo?c={"{{1}}"}</code> — a plataforma preenche o código de rastreio de cada contato.
      </div>

      {(edit === "new" || editing) && (
        <section className="card mb-6 grid gap-6 p-6 lg:grid-cols-[1fr_320px]">
          <form action={saveTemplate.bind(null, editing?.id ?? null)} className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="label">Nome na Meta (minúsculas e _)</label>
              <input name="name" defaultValue={editing?.name} required className="input" placeholder="golden_natal_2026" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Idioma</label>
                <input name="language" defaultValue={editing?.language ?? "pt_BR"} className="input" />
              </div>
              <div>
                <label className="label">Segmento</label>
                <select name="segment" defaultValue={editing?.segment ?? ""} className="input">
                  <option value="">Todos</option>
                  {SEGMENTS.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
                </select>
              </div>
            </div>
            <div className="sm:col-span-2">
              <label className="label">Texto ({"{{1}}"} = primeiro nome do contato)</label>
              <textarea name="body" defaultValue={editing?.body} required rows={9} className="input font-mono text-[13px]" />
            </div>
            <div>
              <label className="label">Imagem do cabeçalho (URL, opcional)</label>
              <input name="headerImage" defaultValue={editing?.headerImage ?? ""} className="input" placeholder="https://…/natal.jpg" />
            </div>
            <div>
              <label className="label">Respostas rápidas (uma por linha, máx. 3)</label>
              <textarea name="quickReplies" defaultValue={editing?.quickReplies.join("\n") ?? "Não tenho interesse"} rows={3} className="input" />
            </div>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="urlButton" defaultChecked={editing?.urlButton ?? true} /> Botão “Ver catálogo” (URL dinâmica)</label>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="active" defaultChecked={editing?.active ?? true} /> Ativo</label>
            <div className="flex gap-2 sm:col-span-2">
              <button className="btn-primary">Salvar modelo</button>
              <Link href="/templates" className="btn-ghost">Cancelar</Link>
            </div>
          </form>
          {editing && <PhonePreview body={editing.body} headerImage={editing.headerImage} urlButton={editing.urlButton} quickReplies={editing.quickReplies} />}
        </section>
      )}

      <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
        {templates.map((t) => (
          <article key={t.id} className="card flex flex-col p-5">
            <div className="mb-3 flex items-start justify-between gap-2">
              <div>
                <h2 className="font-mono text-sm font-semibold">{t.name}</h2>
                <p className="text-xs text-muted">
                  {t.segment ? SEGMENT_MAP[t.segment].label : "Todos os segmentos"} · {t.language} · {t._count.campaigns} campanha(s)
                  {!t.active && " · inativo"}
                </p>
              </div>
              <Link href={`/templates?edit=${t.id}`} className="text-sm font-medium text-gold-dark hover:underline">Editar</Link>
            </div>
            <PhonePreview body={t.body} headerImage={t.headerImage} urlButton={t.urlButton} quickReplies={t.quickReplies} compact />
          </article>
        ))}
      </div>
    </>
  );
}
