"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import clsx from "clsx";
import {
  BookOpen, KanbanSquare, LayoutDashboard, LogOut, Menu, MessageCircle, Megaphone, FileText, Settings, Users, X,
} from "lucide-react";
import { logoutAction } from "@/app/login/actions";

const NAV = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/kanban", label: "Funil (Kanban)", icon: KanbanSquare },
  { href: "/contatos", label: "Contatos", icon: Users },
  { href: "/conversas", label: "Conversas", icon: MessageCircle },
  { href: "/campanhas", label: "Campanhas", icon: Megaphone },
  { href: "/produtos", label: "Catálogo", icon: BookOpen },
  { href: "/templates", label: "Mensagens", icon: FileText },
  { href: "/configuracoes", label: "Configurações", icon: Settings },
];

export function Sidebar({ userName, unread, simulation }: { userName: string; unread: number; simulation: boolean }) {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  const active = (href: string) => (href === "/" ? path === "/" : path.startsWith(href));

  return (
    <>
      <header className="sticky top-0 z-30 flex items-center justify-between bg-graphite px-4 py-3 lg:hidden">
        <Image src="/brand/logo-white.png" alt="Golden" width={52} height={47} />
        <button onClick={() => setOpen(true)} className="text-white" aria-label="Abrir menu">
          <Menu />
        </button>
      </header>
      {open && <div className="fixed inset-0 z-40 bg-black/40 lg:hidden" onClick={() => setOpen(false)} />}
      <aside
        className={clsx(
          "fixed inset-y-0 left-0 z-50 flex w-64 flex-col bg-graphite text-white transition-transform lg:translate-x-0",
          open ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="flex items-center justify-between px-6 pt-6 pb-4">
          <Link href="/" onClick={() => setOpen(false)}>
            <Image src="/brand/logo-white.png" alt="Golden Artefatos de Madeira" width={96} height={87} priority />
          </Link>
          <button onClick={() => setOpen(false)} className="text-white/70 lg:hidden" aria-label="Fechar menu">
            <X />
          </button>
        </div>
        <p className="px-6 pb-4 text-[11px] tracking-[0.2em] text-gold uppercase">CRM · WhatsApp</p>
        <nav className="flex-1 space-y-0.5 overflow-y-auto px-3">
          {NAV.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              onClick={() => setOpen(false)}
              className={clsx(
                "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition",
                active(href) ? "bg-white/10 font-medium text-white" : "text-white/65 hover:bg-white/5 hover:text-white",
              )}
            >
              <Icon size={18} className={active(href) ? "text-gold" : ""} />
              <span className="flex-1">{label}</span>
              {href === "/conversas" && unread > 0 && (
                <span className="rounded-full bg-gold px-1.5 text-[11px] font-semibold text-ink">{unread}</span>
              )}
            </Link>
          ))}
        </nav>
        {simulation && (
          <Link href="/configuracoes" className="mx-3 mb-3 rounded-lg border border-gold/40 bg-gold/10 px-3 py-2 text-xs text-gold">
            Modo simulação: WhatsApp não conectado
          </Link>
        )}
        <div className="flex items-center gap-3 border-t border-white/10 px-6 py-4">
          <div className="grid size-8 place-items-center rounded-full bg-gold font-semibold text-ink">
            {userName.charAt(0).toUpperCase()}
          </div>
          <span className="flex-1 truncate text-sm">{userName}</span>
          <form action={logoutAction}>
            <button className="text-white/60 hover:text-white" title="Sair" aria-label="Sair">
              <LogOut size={18} />
            </button>
          </form>
        </div>
      </aside>
    </>
  );
}
