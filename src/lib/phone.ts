/**
 * Normaliza telefones brasileiros para o formato do WhatsApp: 55 + DDD + número (só dígitos).
 * Retorna null se o número não parecer válido.
 */
export function normalizePhone(raw: string | number | null | undefined): string | null {
  if (raw === null || raw === undefined) return null;
  let d = String(raw).replace(/\D/g, "");
  if (!d) return null;
  d = d.replace(/^0+/, ""); // 0 de discagem / operadora
  // Remove código de operadora (ex: 0 15 54 99999-9999 -> já sem o 0: 15 54 9...)
  if (d.length === 13 && !d.startsWith("55")) d = d.slice(2);
  if (d.length === 10 || d.length === 11) d = "55" + d;
  if (!d.startsWith("55")) return d.length >= 11 && d.length <= 15 ? d : null; // internacional
  if (d.length !== 12 && d.length !== 13) return null;
  const ddd = Number(d.slice(2, 4));
  if (ddd < 11 || ddd > 99) return null;
  // celular com 8 dígitos (antigo) -> acrescenta o 9
  if (d.length === 12 && /[6-9]/.test(d[4])) d = d.slice(0, 4) + "9" + d.slice(4);
  return d;
}

export function formatPhone(p: string): string {
  if (p.startsWith("55") && p.length === 13) return `(${p.slice(2, 4)}) ${p.slice(4, 9)}-${p.slice(9)}`;
  if (p.startsWith("55") && p.length === 12) return `(${p.slice(2, 4)}) ${p.slice(4, 8)}-${p.slice(8)}`;
  return "+" + p;
}

/** Variações para casar o wa_id que a Meta devolve (que pode vir sem o 9) */
export function phoneVariants(p: string): string[] {
  const out = new Set([p]);
  if (p.startsWith("55") && p.length === 12) out.add(p.slice(0, 4) + "9" + p.slice(4));
  if (p.startsWith("55") && p.length === 13 && p[4] === "9") out.add(p.slice(0, 4) + p.slice(5));
  return [...out];
}
