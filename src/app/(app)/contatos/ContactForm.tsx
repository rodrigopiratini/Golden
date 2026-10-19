import type { Contact } from "@prisma/client";
import { SEGMENTS, STAGES } from "@/lib/stages";
import { formatPhone } from "@/lib/phone";

export function ContactForm({ contact, action, submitLabel }: { contact?: Contact; action: (f: FormData) => Promise<void>; submitLabel: string }) {
  const dec = (v: unknown) => (v ? String(v).replace(".", ",") : "");
  return (
    <form action={action} className="grid gap-4 sm:grid-cols-2">
      <Field label="Nome" name="name" defaultValue={contact?.name} required />
      <Field label="WhatsApp (com DDD)" name="phone" defaultValue={contact ? formatPhone(contact.phone) : ""} required placeholder="(54) 99999-9999" />
      <div>
        <label className="label">Segmento</label>
        <select name="segment" defaultValue={contact?.segment ?? "FEIRA"} className="input">
          {SEGMENTS.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
        </select>
      </div>
      <Field label="Origem (feira, evento, site…)" name="source" defaultValue={contact?.source ?? ""} />
      {contact && (
        <div>
          <label className="label">Etapa do funil</label>
          <select name="stage" defaultValue={contact.stage} className="input">
            {STAGES.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
          </select>
        </div>
      )}
      <Field label="Valor do negócio (R$)" name="dealValue" defaultValue={dec(contact?.dealValue)} inputMode="decimal" />
      <Field label="E-mail" name="email" type="email" defaultValue={contact?.email ?? ""} />
      <div className="grid grid-cols-[1fr_80px] gap-3">
        <Field label="Cidade" name="city" defaultValue={contact?.city ?? ""} />
        <Field label="UF" name="state" defaultValue={contact?.state ?? ""} maxLength={2} />
      </div>
      <Field label="O que já comprou" name="lastPurchaseDesc" defaultValue={contact?.lastPurchaseDesc ?? ""} />
      <Field label="Total já comprado (R$)" name="totalSpent" defaultValue={dec(contact?.totalSpent)} inputMode="decimal" />
      <Field label="Tags (separadas por vírgula)" name="tags" defaultValue={contact?.tags.join(", ") ?? ""} />
      <div className="sm:col-span-2">
        <label className="label">Observações</label>
        <textarea name="notes" defaultValue={contact?.notes ?? ""} rows={3} className="input" />
      </div>
      <div className="sm:col-span-2">
        <button className="btn-primary">{submitLabel}</button>
      </div>
    </form>
  );
}

function Field({ label, ...props }: { label: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div>
      <label className="label" htmlFor={props.name}>{label}</label>
      <input id={props.name} className="input" {...props} />
    </div>
  );
}
