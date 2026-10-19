import Image from "next/image";
import { loginAction } from "./actions";

export const metadata = { title: "Entrar" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string; next?: string }> }) {
  const { error, next } = await searchParams;
  return (
    <main className="grid min-h-screen lg:grid-cols-2">
      <section className="relative hidden flex-col justify-between overflow-hidden bg-graphite p-12 text-white lg:flex">
        <Image src="/brand/logo-white.png" alt="Golden Artefatos de Madeira" width={220} height={199} priority />
        <div>
          <p className="font-display text-4xl leading-tight font-semibold">
            Cada contato, <span className="text-gold">uma venda em potencial.</span>
          </p>
          <p className="mt-4 max-w-md text-white/70">
            Campanhas de WhatsApp, catálogo interativo e funil de vendas da Golden em um só lugar.
          </p>
        </div>
        <p className="text-xs text-white/40">Flores da Cunha · RS</p>
        <div className="pointer-events-none absolute -right-24 -bottom-24 size-96 rounded-full bg-gold/10" />
      </section>
      <section className="flex items-center justify-center p-6">
        <form action={loginAction} className="w-full max-w-sm space-y-5">
          <Image src="/brand/logo-dark.png" alt="Golden" width={120} height={108} className="mx-auto lg:hidden" />
          <div>
            <h1 className="page-title">Entrar</h1>
            <p className="text-sm text-muted">Acesse a plataforma de gestão de contatos.</p>
          </div>
          <input type="hidden" name="next" value={next ?? "/"} />
          <div>
            <label className="label" htmlFor="email">E-mail</label>
            <input id="email" name="email" type="email" required className="input" autoComplete="username" />
          </div>
          <div>
            <label className="label" htmlFor="password">Senha</label>
            <input id="password" name="password" type="password" required className="input" autoComplete="current-password" />
          </div>
          {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">E-mail ou senha incorretos.</p>}
          <button className="btn-primary w-full">Entrar</button>
        </form>
      </section>
    </main>
  );
}
