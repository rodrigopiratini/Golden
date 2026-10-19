import { CheckCircle2, CircleAlert } from "lucide-react";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { isSimulation } from "@/lib/whatsapp";
import { formatPhone } from "@/lib/phone";
import { PageHeader } from "@/components/ui";
import { appUrl as getAppUrl } from "@/lib/format";
import { changePassword, createUser } from "./actions";

export const dynamic = "force-dynamic";
export const metadata = { title: "Configurações" };

export default async function SettingsPage({ searchParams }: { searchParams: Promise<{ error?: string; ok?: string }> }) {
  const { error, ok } = await searchParams;
  const session = await getSession();
  const users = await prisma.user.findMany({ orderBy: { createdAt: "asc" } });
  const sim = isSimulation();
  const appUrl = getAppUrl();
  const env = (k: string) => !!process.env[k];

  const checks = [
    { label: "Token de acesso (WHATSAPP_TOKEN)", ok: env("WHATSAPP_TOKEN") },
    { label: "ID do número (WHATSAPP_PHONE_NUMBER_ID)", ok: env("WHATSAPP_PHONE_NUMBER_ID") },
    { label: "Chave secreta do app (WHATSAPP_APP_SECRET) — valida o webhook", ok: env("WHATSAPP_APP_SECRET") },
    { label: "Token de verificação do webhook (WHATSAPP_VERIFY_TOKEN)", ok: env("WHATSAPP_VERIFY_TOKEN") },
    { label: "WhatsApp que recebe pedidos do catálogo (COMPANY_WHATSAPP)", ok: env("COMPANY_WHATSAPP") },
    { label: `URL pública da plataforma: ${appUrl}`, ok: !appUrl.includes("localhost") },
  ];

  return (
    <>
      <PageHeader title="Configurações" />
      {error === "senha" && <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">A senha precisa ter pelo menos 8 caracteres.</p>}
      {ok === "senha" && <p className="mb-4 rounded-lg bg-green-50 px-3 py-2 text-sm text-green-800">Senha alterada.</p>}

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="card p-6">
          <h2 className="font-display text-lg font-semibold">WhatsApp Cloud API</h2>
          <p className={`mt-2 mb-4 rounded-lg px-3 py-2 text-sm ${sim ? "bg-gold-soft" : "bg-green-50 text-green-800"}`}>
            {sim ? "Modo simulação: as mensagens ficam registradas, mas não são enviadas. Preencha as variáveis abaixo para conectar." : "Conectado à API oficial do WhatsApp."}
          </p>
          <ul className="space-y-2 text-sm">
            {checks.map((c) => (
              <li key={c.label} className="flex items-start gap-2">
                {c.ok ? <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-green-600" /> : <CircleAlert size={16} className="mt-0.5 shrink-0 text-gold-dark" />}
                {c.label}
              </li>
            ))}
          </ul>
          <div className="mt-5 space-y-2 text-sm">
            <p className="label">Webhook (cole no painel da Meta → WhatsApp → Configuração)</p>
            <code className="block overflow-x-auto rounded-lg bg-paper px-3 py-2 text-xs">{appUrl}/api/webhooks/whatsapp</code>
            <p className="text-xs text-muted">Assine os campos <b>messages</b>. O token de verificação é o valor de WHATSAPP_VERIFY_TOKEN.</p>
            {process.env.COMPANY_WHATSAPP && <p className="text-xs text-muted">Pedidos do catálogo vão para {formatPhone(process.env.COMPANY_WHATSAPP)}.</p>}
          </div>
        </section>

        <section className="card p-6">
          <h2 className="mb-4 font-display text-lg font-semibold">Usuários</h2>
          <ul className="mb-5 divide-y divide-line text-sm">
            {users.map((u) => (
              <li key={u.id} className="flex items-center justify-between py-2">
                <span>{u.name} <span className="text-muted">· {u.email}</span></span>
                <span className="badge bg-paper text-muted">{u.role === "ADMIN" ? "Admin" : "Atendente"}</span>
              </li>
            ))}
          </ul>
          {session?.role === "ADMIN" && (
            <form action={createUser} className="grid gap-3 sm:grid-cols-2">
              <input name="name" placeholder="Nome" required className="input" />
              <input name="email" type="email" placeholder="E-mail" required className="input" />
              <input name="password" type="password" placeholder="Senha (mín. 8)" required className="input" />
              <select name="role" className="input"><option value="ATENDENTE">Atendente</option><option value="ADMIN">Administrador</option></select>
              <button className="btn-primary sm:col-span-2">Adicionar usuário</button>
            </form>
          )}
          <form action={changePassword} className="mt-6 flex gap-2 border-t border-line pt-5">
            <input name="password" type="password" placeholder="Nova senha" required className="input" />
            <button className="btn-ghost whitespace-nowrap">Trocar minha senha</button>
          </form>
        </section>
      </div>
    </>
  );
}
