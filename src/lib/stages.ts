import type { Segment, Stage } from "@prisma/client";

export const STAGES: { id: Stage; label: string; color: string; hint: string }[] = [
  { id: "NOVO", label: "Novo", color: "#9ca3af", hint: "Ainda não recebeu mensagem" },
  { id: "ENVIADO", label: "Enviado", color: "#60a5fa", hint: "Mensagem enviada/entregue" },
  { id: "LIDO", label: "Lido", color: "#818cf8", hint: "Leu e não respondeu" },
  { id: "RESPONDEU", label: "Respondeu", color: "#f59e0b", hint: "Respondeu a mensagem" },
  { id: "INTERESSADO", label: "Interessado", color: "#eab308", hint: "Clicou em produto ou pediu informação" },
  { id: "NEGOCIANDO", label: "Negociando", color: "#f97316", hint: "Orçamento / pedido em andamento" },
  { id: "GANHO", label: "Vendido", color: "#16a34a", hint: "Comprou" },
  { id: "PERDIDO", label: "Perdido", color: "#dc2626", hint: "Não vai comprar agora" },
  { id: "OPT_OUT", label: "Não contatar", color: "#525252", hint: "Pediu para não receber mensagens" },
];

export const STAGE_MAP = Object.fromEntries(STAGES.map((s) => [s.id, s])) as Record<Stage, (typeof STAGES)[number]>;

/** Ordem do funil "automático": só avançamos para frente com eventos do WhatsApp/catálogo */
const ORDER: Stage[] = ["NOVO", "ENVIADO", "LIDO", "RESPONDEU", "INTERESSADO", "NEGOCIANDO", "GANHO"];
export function isAhead(target: Stage, current: Stage) {
  if (current === "PERDIDO" || current === "OPT_OUT" || current === "GANHO") return false;
  return ORDER.indexOf(target) > ORDER.indexOf(current);
}

export const SEGMENTS: { id: Segment; label: string; color: string }[] = [
  { id: "CLIENTE", label: "Já comprou", color: "#16a34a" },
  { id: "FEIRA", label: "Feira/Evento", color: "#d97706" },
  { id: "B2B", label: "Empresa/Lojista", color: "#2563eb" },
  { id: "OUTRO", label: "Outro", color: "#6b7280" },
];
export const SEGMENT_MAP = Object.fromEntries(SEGMENTS.map((s) => [s.id, s])) as Record<Segment, (typeof SEGMENTS)[number]>;

export const CATEGORIES = ["Mesa Posta", "Petiscar", "Churrasco", "Iluminar", "Organize", "Personalize"];
