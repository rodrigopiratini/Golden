// Golden CRM — integração com a WhatsApp Cloud API (oficial da Meta), como Supabase Edge Function.
// Publicar SEM verificação de JWT (a Meta chama o webhook sem login; as ações do app conferem o login por dentro):
//   supabase functions deploy golden-whatsapp --no-verify-jwt
// Segredos (Supabase › Edge Functions › Secrets): WHATSAPP_TOKEN, WHATSAPP_PHONE_NUMBER_ID, WHATSAPP_APP_SECRET,
//   WHATSAPP_VERIFY_TOKEN e (opcional) WHATSAPP_API_VERSION. SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY já existem.
// Webhook na Meta: https://<projeto>.supabase.co/functions/v1/golden-whatsapp  (campo "messages").
//
// Ações do app (POST com login de gestão): { acao: 'onda', campanhaId, n } · { acao: 'texto', contatoId, texto } · { acao: 'modelo', contatoId, modeloId }
// Os dados ficam em golden.docs (um documento JSON por registro), igual ao que o app grava.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';

const env = (k: string) => Deno.env.get(k) || '';
const VERSAO = env('WHATSAPP_API_VERSION') || 'v23.0';
const db = createClient(env('SUPABASE_URL'), env('SUPABASE_SERVICE_ROLE_KEY'), { db: { schema: 'golden' }, auth: { persistSession: false } });
const CORS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type', 'Access-Control-Allow-Methods': 'POST, GET, OPTIONS' };
const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });
const agora = () => new Date().toISOString();
const novoId = (p: string) => p + crypto.randomUUID().replace(/-/g, '').slice(0, 16);
type Doc = Record<string, any>;

// ---------- banco ----------
async function doc(emp: string, id: string): Promise<Doc | null> {
  const { data } = await db.from('docs').select('data').eq('empresa_id', emp).eq('id', id).maybeSingle();
  return data?.data ?? null;
}
async function gravar(emp: string, colecao: string, d: Doc) {
  const { error } = await db.from('docs').upsert({ empresa_id: emp, id: d.id, colecao, data: d }, { onConflict: 'empresa_id,id' });
  if (error) throw new Error(error.message);
}
const ORDEM = ['novo', 'enviado', 'lido', 'respondeu', 'interessado', 'negociando', 'ganho'];
const ROT: Record<string, string> = { novo: 'Novo', enviado: 'Enviado', lido: 'Lido', respondeu: 'Respondeu', interessado: 'Interessado', negociando: 'Negociando', ganho: 'Vendido', perdido: 'Perdido', nao_contatar: 'Não contatar' };
async function avancar(emp: string, c: Doc, alvo: string, motivo: string) {
  if (['perdido', 'nao_contatar', 'ganho'].includes(c.etapa) || ORDEM.indexOf(alvo) <= ORDEM.indexOf(c.etapa)) return;
  await gravar(emp, 'atividades', { id: novoId('at'), contatoId: c.id, tipo: 'etapa', texto: `${ROT[c.etapa]} → ${ROT[alvo]} (${motivo})`, em: agora() });
  c.etapa = alvo; c.ultimaInteracao = agora();
}
const primeiro = (n: string) => { const p = String(n || '').trim().split(/\s+/)[0] || ''; return p ? p[0].toUpperCase() + p.slice(1).toLowerCase() : 'cliente'; };

// ---------- Cloud API ----------
async function enviar(payload: Doc): Promise<{ ok: boolean; id?: string; erro?: string }> {
  const r = await fetch(`https://graph.facebook.com/${VERSAO}/${env('WHATSAPP_PHONE_NUMBER_ID')}/messages`, {
    method: 'POST', headers: { Authorization: `Bearer ${env('WHATSAPP_TOKEN')}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ messaging_product: 'whatsapp', recipient_type: 'individual', ...payload }),
  });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) { const e = d?.error; return { ok: false, erro: e ? `${e.code ?? r.status}: ${e.error_data?.details ?? e.message}` : `HTTP ${r.status}` }; }
  return { ok: true, id: d.messages?.[0]?.id ?? '' };
}
function enviarModelo(tel: string, m: Doc, c: Doc) {
  const comps: Doc[] = [];
  if (String(m.corpo).includes('{{1}}')) comps.push({ type: 'body', parameters: [{ type: 'text', text: primeiro(c.nome) }] });
  if (m.botaoCatalogo) comps.push({ type: 'button', sub_type: 'url', index: '0', parameters: [{ type: 'text', text: c.token }] });
  return enviar({ to: tel, type: 'template', template: { name: m.nome, language: { code: m.idioma || 'pt_BR' }, components: comps } });
}

// ---------- ações do app ----------
async function empresaDoLogin(req: Request): Promise<string | null> {
  const jwt = (req.headers.get('Authorization') || '').replace(/^Bearer /, '');
  const { data } = await db.auth.getUser(jwt);
  if (!data?.user) return null;
  const { data: p } = await db.from('perfis').select('empresa_id,papel').eq('user_id', data.user.id).maybeSingle();
  return p && ['dono', 'gestor'].includes(p.papel) ? p.empresa_id : null;
}
async function acaoOnda(emp: string, campanhaId: string, n: number) {
  const camp = await doc(emp, campanhaId);
  if (!camp) throw new Error('Campanha não encontrada');
  const modelo = await doc(emp, camp.modeloId);
  camp.status = 'enviando'; camp.iniciadaEm ||= agora();
  let enviados = 0, falhas = 0;
  for (const [cid, d] of Object.entries<Doc>(camp.destinatarios)) {
    if (enviados + falhas >= Math.min(Math.max(n, 1), 500)) break;
    if (d.status !== 'pendente') continue;
    const c = await doc(emp, cid);
    if (!c || c.naoContatar) { d.status = 'pulado'; continue; }
    const r = await enviarModelo(c.telefone, modelo!, c);
    await gravar(emp, 'mensagens', { id: novoId('mg'), contatoId: cid, campanhaId, direcao: 'out', tipo: 'modelo', modelo: modelo!.nome, corpo: String(modelo!.corpo).replaceAll('{{1}}', primeiro(c.nome)), waId: r.id || null, status: r.ok ? 'enviado' : 'falhou', erro: r.erro || null, em: agora() });
    d.status = r.ok ? 'enviado' : 'falhou'; d.em = agora(); if (r.erro) d.erro = r.erro;
    if (r.ok) { enviados++; c.ultimaInteracao = agora(); await avancar(emp, c, 'enviado', `campanha "${camp.nome}"`); await gravar(emp, 'contatos', c); } else falhas++;
  }
  const restantes = Object.values<Doc>(camp.destinatarios).filter((d) => d.status === 'pendente').length;
  camp.status = restantes ? 'pausada' : 'concluida'; if (!restantes) camp.concluidaEm = agora();
  await gravar(emp, 'campanhas', camp);
  return { enviados, falhas, restantes };
}

// ---------- webhook (Meta) ----------
async function assinaturaOk(raw: string, header: string | null) {
  const segredo = env('WHATSAPP_APP_SECRET');
  if (!segredo || !header?.startsWith('sha256=')) return false;
  const k = await crypto.subtle.importKey('raw', new TextEncoder().encode(segredo), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = Array.from(new Uint8Array(await crypto.subtle.sign('HMAC', k, new TextEncoder().encode(raw)))).map((b) => b.toString(16).padStart(2, '0')).join('');
  return sig === header.slice(7);
}
const variantes = (p: string) => { const s = new Set([p]); if (p.startsWith('55') && p.length === 12) s.add(p.slice(0, 4) + '9' + p.slice(4)); if (p.startsWith('55') && p.length === 13 && p[4] === '9') s.add(p.slice(0, 4) + p.slice(5)); return [...s]; };
const norm = (t: string) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^\w\s]/g, '').trim();
const OPT_OUT = ['sair', 'parar', 'pare', 'stop', 'cancelar', 'descadastrar', 'nao tenho interesse', 'nao quero', 'nao quero receber', 'remover'];
const INTERESSE = ['quero uma proposta', 'quero ajuda', 'quero', 'tenho interesse', 'quero ver', 'ver catalogo', 'quero comprar'];
function textoDe(m: Doc) {
  if (m.text) return m.text.body; if (m.button) return m.button.text;
  if (m.interactive) return m.interactive.button_reply?.title ?? m.interactive.list_reply?.title ?? '[interativo]';
  if (m.image) return m.image.caption ? `[imagem] ${m.image.caption}` : '[imagem]';
  return m.audio ? '[áudio]' : m.document ? '[documento]' : m.sticker ? '[figurinha]' : m.location ? '[localização]' : `[${m.type}]`;
}
async function recebida(m: Doc, nomePerfil?: string) {
  // contato pelo telefone, em qualquer empresa do app (cada número da Meta é de uma empresa; aqui há uma só)
  const { data: achados } = await db.from('docs').select('empresa_id,data').eq('colecao', 'contatos').in('data->>telefone', variantes(m.from)).limit(1);
  let emp = achados?.[0]?.empresa_id, c: Doc | undefined = achados?.[0]?.data;
  if (!emp) { const { data: e } = await db.from('empresas').select('id').order('criado_em').limit(1).maybeSingle(); emp = e?.id; }
  if (!emp) return;
  if (!c) { c = { id: novoId('ct'), nome: nomePerfil || 'Contato WhatsApp', telefone: m.from, segmento: 'outro', origem: 'WhatsApp (chamou a loja)', etapa: 'novo', naoContatar: false, token: crypto.randomUUID().slice(0, 10), tags: [], criadoEm: agora() }; }
  const { data: rep } = await db.from('docs').select('id').eq('empresa_id', emp).eq('colecao', 'mensagens').eq('data->>waId', m.id).limit(1);
  if (rep?.length) return; // reentrega do webhook
  const texto = textoDe(m);
  await gravar(emp, 'mensagens', { id: novoId('mg'), contatoId: c.id, direcao: 'in', tipo: m.type, corpo: texto, waId: m.id, status: 'recebido', em: agora() });
  c.naoLida = true; c.ultimaEntrada = agora(); c.ultimaInteracao = agora();
  const t = norm(texto);
  if (OPT_OUT.includes(t)) {
    if (!c.naoContatar) {
      c.naoContatar = true; c.naoLida = false;
      await gravar(emp, 'atividades', { id: novoId('at'), contatoId: c.id, tipo: 'opt_out', texto: `Pediu para não receber mensagens (respondeu "${texto}")`, em: agora() });
      c.etapa = 'nao_contatar';
      const resp = `Tudo bem, ${primeiro(c.nome)}! Não vamos mais te enviar mensagens. Se precisar de algo, é só chamar por aqui 🙂`;
      const r = await enviar({ to: c.telefone, type: 'text', text: { body: resp } });
      await gravar(emp, 'mensagens', { id: novoId('mg'), contatoId: c.id, direcao: 'out', tipo: 'texto', corpo: resp, waId: r.id || null, status: r.ok ? 'enviado' : 'falhou', em: agora() });
    }
  } else if (INTERESSE.some((k) => t === k || t.startsWith(k + ' '))) await avancar(emp, c, 'interessado', 'pediu informações');
  else await avancar(emp, c, 'respondeu', 'respondeu no WhatsApp');
  await gravar(emp, 'contatos', c);
}
const RANK: Record<string, number> = { enviado: 1, entregue: 2, lido: 3, falhou: 4 };
async function status(s: Doc) {
  const mapa: Record<string, string> = { sent: 'enviado', delivered: 'entregue', read: 'lido', failed: 'falhou' };
  const st = mapa[s.status]; if (!st) return;
  const { data } = await db.from('docs').select('empresa_id,data').eq('colecao', 'mensagens').eq('data->>waId', s.id).limit(1);
  const linha = data?.[0]; if (!linha) return;
  const m = linha.data; if ((RANK[st] ?? 0) <= (RANK[m.status] ?? 0)) return;
  m.status = st; if (st === 'falhou') m.erro = s.errors?.[0]?.error_data?.details ?? s.errors?.[0]?.message ?? 'Falha no envio';
  await gravar(linha.empresa_id, 'mensagens', m);
  if (st === 'lido') { const c = await doc(linha.empresa_id, m.contatoId); if (c) { await avancar(linha.empresa_id, c, 'lido', 'leu a mensagem'); await gravar(linha.empresa_id, 'contatos', c); } }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  const url = new URL(req.url);
  if (req.method === 'GET') { // verificação do webhook pela Meta
    if (url.searchParams.get('hub.mode') === 'subscribe' && url.searchParams.get('hub.verify_token') === env('WHATSAPP_VERIFY_TOKEN')) return new Response(url.searchParams.get('hub.challenge') ?? '');
    return new Response('Forbidden', { status: 403 });
  }
  const raw = await req.text();
  const assinatura = req.headers.get('x-hub-signature-256');
  if (assinatura) { // chamada da Meta
    if (!(await assinaturaOk(raw, assinatura))) return new Response('Invalid signature', { status: 401 });
    const corpo = JSON.parse(raw);
    for (const e of corpo.entry ?? []) for (const ch of e.changes ?? []) {
      const v = ch.value ?? {};
      for (const m of v.messages ?? []) await recebida(m, (v.contacts ?? []).find((c: Doc) => c.wa_id === m.from)?.profile?.name);
      for (const s of v.statuses ?? []) await status(s);
    }
    return new Response('OK');
  }
  // chamada do app
  const emp = await empresaDoLogin(req);
  if (!emp) return json({ error: 'Sem permissão' }, 401);
  if (!env('WHATSAPP_TOKEN')) return json({ error: 'WhatsApp não configurado (segredos da função)' }, 400);
  try {
    const b = JSON.parse(raw || '{}');
    if (b.acao === 'onda') return json(await acaoOnda(emp, b.campanhaId, +b.n || 100));
    const c = await doc(emp, b.contatoId);
    if (!c) return json({ error: 'Contato não encontrado' }, 404);
    if (b.acao === 'texto') {
      const r = await enviar({ to: c.telefone, type: 'text', text: { body: b.texto, preview_url: true } });
      await gravar(emp, 'mensagens', { id: novoId('mg'), contatoId: c.id, direcao: 'out', tipo: 'texto', corpo: b.texto, waId: r.id || null, status: r.ok ? 'enviado' : 'falhou', erro: r.erro || null, em: agora() });
      c.naoLida = false; c.ultimaInteracao = agora(); await gravar(emp, 'contatos', c);
      return r.ok ? json({ ok: true }) : json({ error: r.erro }, 502);
    }
    if (b.acao === 'modelo') {
      const m = await doc(emp, b.modeloId);
      const r = await enviarModelo(c.telefone, m!, c);
      await gravar(emp, 'mensagens', { id: novoId('mg'), contatoId: c.id, direcao: 'out', tipo: 'modelo', modelo: m!.nome, corpo: String(m!.corpo).replaceAll('{{1}}', primeiro(c.nome)), waId: r.id || null, status: r.ok ? 'enviado' : 'falhou', erro: r.erro || null, em: agora() });
      if (r.ok) { await avancar(emp, c, 'enviado', 'modelo avulso'); await gravar(emp, 'contatos', c); }
      return r.ok ? json({ ok: true }) : json({ error: r.erro }, 502);
    }
    return json({ error: 'Ação desconhecida' }, 400);
  } catch (e) { return json({ error: String((e as Error).message || e) }, 500); }
});
