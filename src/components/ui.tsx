import clsx from "clsx";
import type { Segment, Stage } from "@prisma/client";
import { SEGMENT_MAP, STAGE_MAP } from "@/lib/stages";

export function PageHeader({ title, subtitle, children }: { title: string; subtitle?: string; children?: React.ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="page-title">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-muted">{subtitle}</p>}
      </div>
      {children && <div className="flex flex-wrap items-center gap-2">{children}</div>}
    </div>
  );
}

export function StageBadge({ stage }: { stage: Stage }) {
  const s = STAGE_MAP[stage];
  return (
    <span className="badge border border-line bg-white text-ink">
      <span className="size-2 rounded-full" style={{ background: s.color }} />
      {s.label}
    </span>
  );
}

export function SegmentBadge({ segment }: { segment: Segment }) {
  const s = SEGMENT_MAP[segment];
  return (
    <span className="badge" style={{ background: `${s.color}14`, color: s.color }}>
      {s.label}
    </span>
  );
}

export function Stat({ label, value, hint, accent }: { label: string; value: string; hint?: string; accent?: boolean }) {
  return (
    <div className={clsx("card p-5", accent && "border-gold/60 bg-gold-soft")}>
      <p className="text-xs font-medium tracking-wide text-muted uppercase">{label}</p>
      <p className="mt-2 font-display text-3xl font-semibold text-ink tabular-nums">{value}</p>
      {hint && <p className="mt-1 text-xs text-muted">{hint}</p>}
    </div>
  );
}

export function Empty({ children }: { children: React.ReactNode }) {
  return <div className="rounded-xl border border-dashed border-line p-10 text-center text-sm text-muted">{children}</div>;
}
