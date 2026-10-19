import Papa from "papaparse";
import ExcelJS from "exceljs";
import type { Segment } from "@prisma/client";
import { normalizePhone } from "./phone";

export type ImportRow = {
  name: string;
  phone: string;
  email?: string;
  city?: string;
  state?: string;
  source?: string;
  segment: Segment;
  lastPurchaseDesc?: string;
  totalSpent?: number;
  notes?: string;
  tags: string[];
};

const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

// Cabeçalhos aceitos (comparação sem acento e em minúsculas, por "contém")
const FIELDS: Record<string, string[]> = {
  phone: ["telefone", "celular", "whatsapp", "whats", "fone", "phone", "tel", "numero"],
  name: ["nome", "cliente", "name", "contato"],
  email: ["email", "e-mail"],
  city: ["cidade", "municipio"],
  state: ["uf", "estado"],
  source: ["origem", "feira", "evento", "fonte", "onde"],
  segment: ["segmento", "tipo", "ja comprou", "comprou?", "cliente?"],
  lastPurchaseDesc: ["produto", "o que comprou", "comprou", "ultima compra", "compra"],
  totalSpent: ["valor", "total", "gasto"],
  notes: ["obs", "observ", "nota"],
  tags: ["tag", "etiqueta"],
};

function mapHeaders(headers: string[]) {
  const map: Record<string, number> = {};
  const used = new Set<number>();
  for (const field of Object.keys(FIELDS)) {
    const idx = headers.findIndex((h, i) => !used.has(i) && FIELDS[field].some((k) => norm(h) === k || norm(h).includes(k)));
    if (idx >= 0) {
      map[field] = idx;
      used.add(idx);
    }
  }
  return map;
}

function inferSegment(raw: string | undefined, row: Partial<ImportRow>, fallback: Segment): Segment {
  const v = norm(raw ?? "");
  if (v) {
    if (/(b2b|empresa|loja|lojista|corporativ|arquitet|revend)/.test(v)) return "B2B";
    if (/(feira|evento|expo)/.test(v)) return "FEIRA";
    if (/(client|compr|sim|^s$)/.test(v)) return "CLIENTE";
  }
  if (row.lastPurchaseDesc || row.totalSpent) return "CLIENTE";
  if (row.source && /(feira|evento|expo|festa|fenavindima|expointer)/.test(norm(row.source))) return "FEIRA";
  return fallback;
}

function parseMoney(v: string) {
  const n = Number(v.replace(/[^\d,.-]/g, "").replace(/\.(?=\d{3}(\D|$))/g, "").replace(",", "."));
  return Number.isFinite(n) && n > 0 ? n : undefined;
}

async function readTable(file: File): Promise<string[][]> {
  const buf = Buffer.from(await file.arrayBuffer());
  if (/\.xlsx$/i.test(file.name)) {
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buf as unknown as ArrayBuffer);
    const ws = wb.worksheets[0];
    const rows: string[][] = [];
    ws.eachRow({ includeEmpty: false }, (row) => {
      const vals = (row.values as unknown[]).slice(1).map((v) => {
        if (v === null || v === undefined) return "";
        if (typeof v === "object" && v && "text" in v) return String((v as { text: unknown }).text);
        if (typeof v === "object" && v && "result" in v) return String((v as { result: unknown }).result ?? "");
        if (v instanceof Date) return v.toISOString();
        return String(v);
      });
      rows.push(vals);
    });
    return rows;
  }
  // CSV: tenta UTF-8; se aparecer caractere inválido, usa Latin-1 (padrão do Excel no Brasil)
  let text = buf.toString("utf8");
  if (text.includes("�")) text = buf.toString("latin1");
  const parsed = Papa.parse<string[]>(text.replace(/^﻿/, ""), { skipEmptyLines: true, delimitersToGuess: [";", ",", "\t", "|"] });
  return parsed.data;
}

export async function parseContactsFile(file: File, defaults: { segment: Segment; source?: string }) {
  const table = await readTable(file);
  if (table.length < 2) throw new Error("A planilha precisa ter uma linha de cabeçalho e ao menos um contato.");
  const headers = table[0].map(String);
  const map = mapHeaders(headers);
  if (map.phone === undefined) throw new Error(`Não encontrei a coluna de telefone. Cabeçalhos lidos: ${headers.join(", ")}`);

  const valid: ImportRow[] = [];
  const invalid: { line: number; reason: string; raw: string }[] = [];
  const seen = new Set<string>();
  table.slice(1).forEach((cells, i) => {
    const get = (f: string) => (map[f] !== undefined ? String(cells[map[f]] ?? "").trim() : "");
    const phone = normalizePhone(get("phone"));
    if (!phone) return invalid.push({ line: i + 2, reason: "telefone inválido", raw: cells.join(" | ") });
    if (seen.has(phone)) return invalid.push({ line: i + 2, reason: "telefone repetido na planilha", raw: cells.join(" | ") });
    seen.add(phone);
    const row: Partial<ImportRow> = {
      name: get("name") || "Sem nome",
      phone,
      email: get("email") || undefined,
      city: get("city") || undefined,
      state: get("state").toUpperCase().slice(0, 2) || undefined,
      source: get("source") || defaults.source || undefined,
      lastPurchaseDesc: get("lastPurchaseDesc") || undefined,
      totalSpent: parseMoney(get("totalSpent")),
      notes: get("notes") || undefined,
      tags: get("tags") ? get("tags").split(/[,;]/).map((t) => t.trim()).filter(Boolean) : [],
    };
    valid.push({ ...(row as ImportRow), segment: inferSegment(get("segment"), row, defaults.segment) });
  });
  return { valid, invalid, columns: Object.fromEntries(Object.entries(map).map(([f, i]) => [f, headers[i]])) };
}
