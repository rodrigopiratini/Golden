import crypto from "node:crypto";

/**
 * Integração com a WhatsApp Cloud API (oficial da Meta).
 * Sem WHATSAPP_TOKEN a plataforma funciona em modo simulação: as mensagens são
 * registradas mas não saem para o WhatsApp — útil para testar o fluxo inteiro.
 */
const API_VERSION = process.env.WHATSAPP_API_VERSION || "v23.0";

export const isSimulation = () => !process.env.WHATSAPP_TOKEN || !process.env.WHATSAPP_PHONE_NUMBER_ID;

type SendResult = { ok: true; id: string } | { ok: false; error: string };

async function post(payload: Record<string, unknown>): Promise<SendResult> {
  if (isSimulation()) {
    await new Promise((r) => setTimeout(r, 30));
    return { ok: true, id: `sim_${crypto.randomUUID()}` };
  }
  const url = `https://graph.facebook.com/${API_VERSION}/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`;
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`, "Content-Type": "application/json" },
      body: JSON.stringify({ messaging_product: "whatsapp", recipient_type: "individual", ...payload }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const e = data?.error;
      return { ok: false, error: e ? `${e.code ?? res.status}: ${e.error_data?.details ?? e.message}` : `HTTP ${res.status}` };
    }
    return { ok: true, id: data.messages?.[0]?.id ?? "" };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

export type TemplateSpec = {
  name: string;
  language: string;
  body: string;
  headerImage?: string | null;
  urlButton: boolean;
};

/** Envia um template aprovado. {{1}} do corpo = primeiro nome; botão de URL recebe o token do contato. */
export function sendTemplate(to: string, t: TemplateSpec, vars: { firstName: string; token: string }) {
  const components: Record<string, unknown>[] = [];
  if (t.headerImage) components.push({ type: "header", parameters: [{ type: "image", image: { link: t.headerImage } }] });
  if (t.body.includes("{{1}}")) components.push({ type: "body", parameters: [{ type: "text", text: vars.firstName }] });
  if (t.urlButton)
    components.push({ type: "button", sub_type: "url", index: "0", parameters: [{ type: "text", text: vars.token }] });
  return post({ to, type: "template", template: { name: t.name, language: { code: t.language }, components } });
}

/** Texto livre — só é entregue se o cliente falou com a empresa nas últimas 24h. */
export function sendText(to: string, body: string) {
  return post({ to, type: "text", text: { body, preview_url: true } });
}

export function renderTemplate(body: string, firstName: string) {
  return body.replaceAll("{{1}}", firstName);
}

/** Valida a assinatura X-Hub-Signature-256 enviada pela Meta no webhook. */
export function verifySignature(rawBody: string, header: string | null) {
  const secret = process.env.WHATSAPP_APP_SECRET;
  if (!secret) return process.env.NODE_ENV !== "production"; // em produção, exige o segredo
  if (!header?.startsWith("sha256=")) return false;
  const expected = crypto.createHmac("sha256", secret).update(rawBody).digest("hex");
  const got = header.slice(7);
  return got.length === expected.length && crypto.timingSafeEqual(Buffer.from(got), Buffer.from(expected));
}

export const within24h = (lastInboundAt: Date | null | undefined) =>
  !!lastInboundAt && Date.now() - new Date(lastInboundAt).getTime() < 24 * 3600 * 1000;
