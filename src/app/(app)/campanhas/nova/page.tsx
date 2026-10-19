import Link from "next/link";
import { prisma } from "@/lib/db";
import { num } from "@/lib/format";
import { audienceWhere, filtersFromForm } from "@/lib/campaign";
import { SEGMENT_MAP, SEGMENTS, STAGES } from "@/lib/stages";
import { PageHeader } from "@/components/ui";
import { PhonePreview } from "@/components/PhonePreview";
import { createCampaign } from "../actions";

export const dynamic = "force-dynamic";
export const metadata = { title: "Nova campanha" };

export default async function NewCampaign({ searchParams }: { searchParams: Promise<Record<string, string | string[]>> }) {
  const raw = await searchParams;
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(raw)) (Array.isArray(v) ? v : [v]).forEach((x) => sp.append(k, x));
  const touched = sp.has("templateId");
  if (!touched) sp.append("stages", "NOVO");
  const filters = filtersFromForm(sp);

  const [templates, sources, audience] = await Promise.all([
    prisma.template.findMany({ where: { active: true }, orderBy: { createdAt: "asc" } }),
    prisma.contact.findMany({ where: { source: { not: null } }, distinct: ["source"], select: { source: true }, orderBy: { source: "asc" } }),
    prisma.contact.count({ where: audienceWhere(filters) }),
  ]);
  const templateId = sp.get("templateId") ?? templates[0]?.id;
  const template = templates.find((t) => t.id === templateId);

  return (
    <>
      <PageHeader title="Nova campanha" subtitle="Escolha a mensagem e o público. Os envios acontecem em ondas, quando você mandar." />
      {sp.get("error") && <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">Nenhum contato no público selecionado.</p>}
      <form className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <div className="card space-y-6 p-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="label">Nome da campanha</label>
              <input name="name" defaultValue={sp.get("name") ?? `Natal ${new Date().getFullYear()}`} className="input" />
            </div>
            <div>
              <label className="label">Modelo de mensagem</label>
              <select name="templateId" defaultValue={templateId} className="input">
                {templates.map((t) => <option key={t.id} value={t.id}>{t.name}{t.segment ? ` (${SEGMENT_MAP[t.segment].label})` : ""}</option>)}
              </select>
            </div>
          </div>

          <fieldset>
            <legend className="label">Segmentos (vazio = todos)</legend>
            <div className="flex flex-wrap gap-2">
              {SEGMENTS.map((s) => (
                <Chip key={s.id} name="segments" value={s.id} label={s.label} checked={filters.segments.includes(s.id)} />
              ))}
            </div>
          </fieldset>
          <fieldset>
            <legend className="label">Etapas do funil</legend>
            <div className="flex flex-wrap gap-2">
              {STAGES.filter((s) => !["GANHO", "OPT_OUT"].includes(s.id)).map((s) => (
                <Chip key={s.id} name="stages" value={s.id} label={s.label} checked={filters.stages.includes(s.id)} />
              ))}
            </div>
          </fieldset>
          {sources.length > 0 && (
            <fieldset>
              <legend className="label">Origens (vazio = todas)</legend>
              <div className="flex flex-wrap gap-2">
                {sources.map((s) => <Chip key={s.source} name="sources" value={s.source!} label={s.source!} checked={filters.sources.includes(s.source!)} />)}
              </div>
            </fieldset>
          )}
          <div className="max-w-xs">
            <label className="label">Não enviar para quem recebeu mensagem nos últimos (dias)</label>
            <input name="skipContactedDays" type="number" min={0} defaultValue={filters.skipContactedDays} className="input" />
          </div>
          <p className="text-xs text-muted">Contatos marcados como “não contatar” e quem já comprou nesta etapa nunca entram no público.</p>

          <div className="flex flex-wrap items-center gap-3 border-t border-line pt-5">
            <button className="btn-ghost">Atualizar público</button>
            <button formAction={createCampaign} className="btn-gold" disabled={!audience}>Criar campanha com {num(audience)} contatos</button>
            <Link href="/campanhas" className="text-sm text-muted">Cancelar</Link>
          </div>
        </div>
        <aside className="space-y-3">
          <div className="card p-5">
            <p className="text-xs tracking-wide text-muted uppercase">Público selecionado</p>
            <p className="font-display text-4xl font-semibold">{num(audience)}</p>
            <p className="text-xs text-muted">contatos</p>
          </div>
          {template && <PhonePreview body={template.body} headerImage={template.headerImage} urlButton={template.urlButton} quickReplies={template.quickReplies} />}
        </aside>
      </form>
    </>
  );
}

function Chip({ name, value, label, checked }: { name: string; value: string; label: string; checked: boolean }) {
  return (
    <label className="cursor-pointer">
      <input type="checkbox" name={name} value={value} defaultChecked={checked} className="peer sr-only" />
      <span className="inline-block rounded-full border border-line bg-white px-3 py-1.5 text-sm peer-checked:border-graphite peer-checked:bg-graphite peer-checked:text-white peer-focus-visible:ring-2 peer-focus-visible:ring-gold">
        {label}
      </span>
    </label>
  );
}
