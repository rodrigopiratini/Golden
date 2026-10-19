"use client";

import Link from "next/link";
import { useActionState } from "react";
import { CheckCircle2, Upload } from "lucide-react";
import { SEGMENTS } from "@/lib/stages";
import { importContacts, type ImportState } from "../actions";

const FIELD_LABELS: Record<string, string> = {
  phone: "Telefone", name: "Nome", email: "E-mail", city: "Cidade", state: "UF", source: "Origem", segment: "Segmento",
  lastPurchaseDesc: "Produto comprado", totalSpent: "Valor", notes: "Observações", tags: "Tags",
};

export function ImportForm() {
  const [state, action, pending] = useActionState<ImportState, FormData>(importContacts, {});
  return (
    <div className="space-y-6">
      <form action={action} className="space-y-4">
        <label className="flex cursor-pointer flex-col items-center gap-2 rounded-xl border-2 border-dashed border-line bg-paper p-8 text-center hover:border-gold">
          <Upload className="text-gold-dark" />
          <span className="text-sm font-medium">Clique para escolher o arquivo</span>
          <span className="text-xs text-muted">.xlsx ou .csv · até 10 MB</span>
          <input type="file" name="file" accept=".csv,.xlsx" required className="text-xs" />
        </label>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label">Segmento padrão (quando não der para identificar)</label>
            <select name="segment" defaultValue="FEIRA" className="input">
              {SEGMENTS.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Origem padrão (opcional)</label>
            <input name="source" placeholder="ex: Feira Fenavindima 2026" className="input" />
          </div>
        </div>
        <button className="btn-primary" disabled={pending}>{pending ? "Importando…" : "Importar contatos"}</button>
      </form>

      {state.error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>}
      {state.ok && (
        <div className="space-y-4 rounded-xl border border-green-200 bg-green-50 p-4 text-sm">
          <p className="flex items-center gap-2 font-medium text-green-800">
            <CheckCircle2 size={18} /> {state.created} contatos novos · {state.updated} atualizados · {state.invalid?.length ?? 0} ignorados
          </p>
          {state.columns && (
            <p className="text-green-900/80">
              Colunas reconhecidas: {Object.entries(state.columns).map(([f, h]) => `${FIELD_LABELS[f] ?? f} ← “${h}”`).join(" · ")}
            </p>
          )}
          {!!state.invalid?.length && (
            <details className="text-ink">
              <summary className="cursor-pointer">Ver linhas ignoradas</summary>
              <ul className="mt-2 max-h-60 space-y-1 overflow-y-auto text-xs">
                {state.invalid.map((r) => <li key={r.line}>Linha {r.line}: {r.reason} — <span className="text-muted">{r.raw}</span></li>)}
              </ul>
            </details>
          )}
          <Link href="/contatos" className="btn-primary">Ver contatos</Link>
        </div>
      )}
    </div>
  );
}
