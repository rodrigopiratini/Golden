import { PageHeader } from "@/components/ui";
import { ImportForm } from "./ImportForm";

export const metadata = { title: "Importar contatos" };

export default function ImportPage() {
  return (
    <>
      <PageHeader title="Importar contatos" subtitle="Envie sua planilha (.xlsx ou .csv). Telefones repetidos são atualizados, não duplicados." />
      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <div className="card p-6"><ImportForm /></div>
        <aside className="card space-y-3 p-6 text-sm">
          <h2 className="font-display text-base font-semibold">Como montar a planilha</h2>
          <p className="text-muted">A primeira linha deve ter os nomes das colunas. Reconhecemos automaticamente:</p>
          <ul className="list-disc space-y-1 pl-5 text-muted">
            <li><b className="text-ink">Telefone</b> (obrigatório): telefone, celular ou WhatsApp, com DDD</li>
            <li><b className="text-ink">Nome</b></li>
            <li><b className="text-ink">Origem</b>: nome da feira/evento, site, indicação…</li>
            <li><b className="text-ink">Segmento</b>: “cliente”, “feira” ou “empresa”</li>
            <li><b className="text-ink">Produto</b> que comprou e <b className="text-ink">Valor</b></li>
            <li>Cidade, UF, e-mail, observações, tags</li>
          </ul>
          <p className="text-muted">Quem tem produto ou valor de compra vira <b className="text-ink">“Já comprou”</b>; origem com “feira”, “evento” ou “expo” vira <b className="text-ink">“Feira/Evento”</b>.</p>
          <a href="/api/contatos/modelo" className="btn-ghost w-full">Baixar planilha modelo</a>
        </aside>
      </div>
    </>
  );
}
