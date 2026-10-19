import { num, pct } from "@/lib/format";

/** Funil horizontal — uma série, um tom (dourado). % relativo à primeira etapa e à anterior. */
export function Funnel({ steps }: { steps: { label: string; value: number }[] }) {
  const max = Math.max(1, ...steps.map((s) => s.value));
  return (
    <ol className="space-y-2.5">
      {steps.map((s, i) => {
        const prev = i > 0 ? steps[i - 1].value : null;
        return (
          <li key={s.label} className="group relative grid grid-cols-[110px_1fr_auto] items-center gap-3 text-sm">
            <span className="text-muted">{s.label}</span>
            <div className="h-7 rounded-md bg-wood-soft/60">
              <div
                className="h-full rounded-md bg-gold transition-all group-hover:bg-gold-dark"
                style={{ width: `${Math.max((s.value / max) * 100, s.value ? 1.5 : 0)}%` }}
              />
            </div>
            <span className="w-28 text-right tabular-nums">
              <b className="text-ink">{num(s.value)}</b>
              {prev !== null && <span className="ml-1.5 text-xs text-muted">{pct(s.value, prev)}</span>}
            </span>
            <span className="pointer-events-none absolute -top-8 left-[120px] z-10 hidden rounded-md bg-ink px-2 py-1 text-xs whitespace-nowrap text-white shadow group-hover:block">
              {s.label}: {num(s.value)} · {pct(s.value, steps[0].value)} do total
              {prev !== null && ` · ${pct(s.value, prev)} da etapa anterior`}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

/** Barras horizontais simples com rótulo direto (uma série). */
export function BarList({ items, color = "var(--color-graphite)" }: { items: { label: string; value: number; color?: string; suffix?: string }[]; color?: string }) {
  const max = Math.max(1, ...items.map((i) => i.value));
  return (
    <ul className="space-y-2">
      {items.map((it) => (
        <li key={it.label} className="group grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 text-sm" title={`${it.label}: ${num(it.value)}`}>
          <div className="min-w-0">
            <div className="mb-1 flex items-center gap-2 truncate text-ink">
              {it.color && <span className="size-2 shrink-0 rounded-full" style={{ background: it.color }} />}
              <span className="truncate">{it.label}</span>
            </div>
            <div className="h-1.5 rounded-full bg-wood-soft/70">
              <div className="h-full rounded-full opacity-90 group-hover:opacity-100" style={{ width: `${(it.value / max) * 100}%`, background: it.color ?? color }} />
            </div>
          </div>
          <span className="self-end text-right font-medium tabular-nums">
            {num(it.value)}
            {it.suffix && <span className="ml-1 text-xs font-normal text-muted">{it.suffix}</span>}
          </span>
        </li>
      ))}
    </ul>
  );
}
