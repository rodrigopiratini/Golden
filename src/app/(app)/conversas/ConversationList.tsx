"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import clsx from "clsx";
import type { Stage } from "@prisma/client";
import { timeAgo } from "@/lib/format";
import { STAGE_MAP } from "@/lib/stages";

type Item = { id: string; name: string; unread: boolean; stage: Stage; last: string; lastIn: boolean; at: string | null };

export function ConversationList({ items }: { items: Item[] }) {
  const { id } = useParams<{ id?: string }>();
  const [q, setQ] = useState("");
  const [onlyUnread, setOnlyUnread] = useState(false);
  const list = items.filter((i) => (!onlyUnread || i.unread) && i.name.toLowerCase().includes(q.toLowerCase()));
  return (
    <aside className={clsx("flex min-h-0 flex-col border-r border-line", id && "hidden lg:flex")}>
      <div className="space-y-2 border-b border-line p-3">
        <h1 className="font-display text-lg font-semibold">Conversas</h1>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar…" className="input" />
        <label className="flex items-center gap-2 text-xs text-muted">
          <input type="checkbox" checked={onlyUnread} onChange={(e) => setOnlyUnread(e.target.checked)} /> Só não lidas
        </label>
      </div>
      <ul className="flex-1 divide-y divide-line overflow-y-auto">
        {list.map((i) => (
          <li key={i.id}>
            <Link href={`/conversas/${i.id}`} className={clsx("flex gap-3 px-3 py-3 hover:bg-paper", id === i.id && "bg-gold-soft")}>
              <span className="grid size-9 shrink-0 place-items-center rounded-full bg-graphite text-sm font-semibold text-white">{i.name.charAt(0).toUpperCase()}</span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-2">
                  <span className={clsx("flex-1 truncate text-sm", i.unread ? "font-semibold" : "font-medium")}>{i.name}</span>
                  <span className="text-[11px] text-muted">{timeAgo(i.at)}</span>
                </span>
                <span className="flex items-center gap-2">
                  <span className={clsx("flex-1 truncate text-xs", i.unread ? "text-ink" : "text-muted")}>{i.lastIn ? "" : "Você: "}{i.last}</span>
                  {i.unread && <span className="size-2 rounded-full bg-gold" />}
                </span>
                <span className="mt-0.5 flex items-center gap-1 text-[11px] text-muted">
                  <span className="size-1.5 rounded-full" style={{ background: STAGE_MAP[i.stage].color }} />{STAGE_MAP[i.stage].label}
                </span>
              </span>
            </Link>
          </li>
        ))}
        {!list.length && <li className="p-6 text-center text-sm text-muted">Nenhuma conversa.</li>}
      </ul>
    </aside>
  );
}
