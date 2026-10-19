export const brl = (v: number | string | { toString(): string } | null | undefined) =>
  Number(v ?? 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export const num = (v: number) => v.toLocaleString("pt-BR");

export const pct = (part: number, total: number) =>
  total ? `${((part / total) * 100).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%` : "—";

export function firstName(name: string) {
  const n = name.trim().split(/\s+/)[0] ?? "";
  return n.charAt(0).toUpperCase() + n.slice(1).toLowerCase();
}

export function timeAgo(date: Date | string | null | undefined) {
  if (!date) return "—";
  const s = (Date.now() - new Date(date).getTime()) / 1000;
  if (s < 60) return "agora";
  if (s < 3600) return `${Math.floor(s / 60)} min`;
  if (s < 86400) return `${Math.floor(s / 3600)} h`;
  if (s < 86400 * 30) return `${Math.floor(s / 86400)} d`;
  return new Date(date).toLocaleDateString("pt-BR");
}

export const dateTime = (d: Date | string) =>
  new Date(d).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });

export function slugify(s: string) {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}
