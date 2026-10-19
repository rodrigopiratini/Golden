import type { NextRequest } from "next/server";
import { handleInbound, handleStatus } from "@/lib/inbound";
import { verifySignature } from "@/lib/whatsapp";

// Verificação do webhook (Meta envia GET com hub.challenge ao configurar)
export function GET(req: NextRequest) {
  const p = req.nextUrl.searchParams;
  if (p.get("hub.mode") === "subscribe" && p.get("hub.verify_token") === process.env.WHATSAPP_VERIFY_TOKEN)
    return new Response(p.get("hub.challenge") ?? "", { status: 200 });
  return new Response("Forbidden", { status: 403 });
}

type WaMessage = {
  from: string; id: string; type: string;
  text?: { body: string };
  button?: { text: string; payload?: string };
  interactive?: { button_reply?: { title: string }; list_reply?: { title: string } };
  image?: { caption?: string }; audio?: unknown; document?: { filename?: string }; sticker?: unknown; location?: unknown;
};

function messageText(m: WaMessage) {
  if (m.text) return m.text.body;
  if (m.button) return m.button.text;
  if (m.interactive) return m.interactive.button_reply?.title ?? m.interactive.list_reply?.title ?? "[interativo]";
  if (m.image) return m.image.caption ? `[imagem] ${m.image.caption}` : "[imagem]";
  if (m.audio) return "[áudio]";
  if (m.document) return `[documento] ${m.document.filename ?? ""}`.trim();
  if (m.sticker) return "[figurinha]";
  if (m.location) return "[localização]";
  return `[${m.type}]`;
}

export async function POST(req: NextRequest) {
  const raw = await req.text();
  if (!verifySignature(raw, req.headers.get("x-hub-signature-256"))) return new Response("Invalid signature", { status: 401 });

  let body: { entry?: { changes?: { value?: Record<string, unknown> }[] }[] };
  try {
    body = JSON.parse(raw);
  } catch {
    return new Response("Bad request", { status: 400 });
  }

  for (const entry of body.entry ?? []) {
    for (const change of entry.changes ?? []) {
      const v = change.value ?? {};
      const contacts = (v.contacts as { wa_id: string; profile?: { name?: string } }[]) ?? [];
      for (const m of (v.messages as WaMessage[]) ?? []) {
        const profileName = contacts.find((c) => c.wa_id === m.from)?.profile?.name;
        await handleInbound({ waId: m.from, profileName, waMessageId: m.id, type: m.type, text: messageText(m) });
      }
      for (const s of (v.statuses as { id: string; status: string; timestamp?: string; errors?: { title?: string; message?: string; error_data?: { details?: string } }[] }[]) ?? []) {
        const err = s.errors?.[0];
        await handleStatus({ waMessageId: s.id, status: s.status, timestamp: s.timestamp, error: err ? err.error_data?.details ?? err.message ?? err.title : undefined });
      }
    }
  }
  return new Response("OK", { status: 200 });
}
