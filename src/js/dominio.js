// Regras do negócio da Golden (sem interface): funil, telefones, importação, indicadores, campanhas e respostas.
import { uid, today, sum, sortBy } from './core/fmt.js';

// ---------- Funil ----------
export const ETAPAS = [
  { id: 'novo', label: 'Novo', cor: '#9ca3af', dica: 'Ainda não recebeu mensagem' },
  { id: 'enviado', label: 'Enviado', cor: '#60a5fa', dica: 'Mensagem enviada/entregue' },
  { id: 'lido', label: 'Lido', cor: '#818cf8', dica: 'Leu e não respondeu' },
  { id: 'respondeu', label: 'Respondeu', cor: '#f59e0b', dica: 'Respondeu a mensagem' },
  { id: 'interessado', label: 'Interessado', cor: '#eab308', dica: 'Clicou em produto ou pediu informação' },
  { id: 'negociando', label: 'Negociando', cor: '#f97316', dica: 'Orçamento / pedido em andamento' },
  { id: 'ganho', label: 'Vendido', cor: '#16a34a', dica: 'Comprou' },
  { id: 'perdido', label: 'Perdido', cor: '#dc2626', dica: 'Não vai comprar agora' },
  { id: 'nao_contatar', label: 'Não contatar', cor: '#525252', dica: 'Pediu para não receber mensagens' },
];
export const ETAPA = Object.fromEntries(ETAPAS.map((e) => [e.id, e]));
const ORDEM = ['novo', 'enviado', 'lido', 'respondeu', 'interessado', 'negociando', 'ganho'];
export const aFrente = (alvo, atual) => !['perdido', 'nao_contatar', 'ganho'].includes(atual) && ORDEM.indexOf(alvo) > ORDEM.indexOf(atual);

export const SEGMENTOS = [
  { id: 'cliente', label: 'Já comprou', cor: '#16a34a' },
  { id: 'feira', label: 'Feira/Evento', cor: '#d97706' },
  { id: 'b2b', label: 'Empresa/Lojista', cor: '#2563eb' },
  { id: 'outro', label: 'Outro', cor: '#6b7280' },
];
export const SEG = Object.fromEntries(SEGMENTOS.map((e) => [e.id, e]));
export const CATEGORIAS = ['Mesa Posta', 'Petiscar', 'Churrasco', 'Iluminar', 'Organize', 'Personalize'];

const agora = () => new Date().toISOString();
export const primeiroNome = (n) => { const p = String(n || '').trim().split(/\s+/)[0] || ''; return p ? p[0].toUpperCase() + p.slice(1).toLowerCase() : ''; };
export const contato = (s, id) => s.contatos.find((c) => c.id === id);
export const token = () => Array.from({ length: 10 }, () => 'abcdefghijkmnpqrstuvwxyz23456789'[Math.floor(Math.random() * 32)]).join('');

export function registrar(s, contatoId, tipo, texto) { s.atividades.push({ id: uid('at'), contatoId, tipo, texto, em: agora() }); }

// Avança só para a frente (eventos automáticos: leu, respondeu, clicou)
export function avancar(s, c, alvo, motivo) {
  if (!c || !aFrente(alvo, c.etapa)) return false;
  registrar(s, c.id, 'etapa', `${ETAPA[c.etapa].label} → ${ETAPA[alvo].label} (${motivo})`);
  c.etapa = alvo; c.ultimaInteracao = agora();
  return true;
}
// Mudança manual (funil / ficha): qualquer direção
export function mudarEtapa(s, c, alvo) {
  if (!c || c.etapa === alvo) return;
  registrar(s, c.id, 'etapa', `${ETAPA[c.etapa].label} → ${ETAPA[alvo].label}`);
  c.etapa = alvo; c.ultimaInteracao = agora(); c.naoContatar = alvo === 'nao_contatar';
}

// ---------- Telefones (formato do WhatsApp: 55 + DDD + número) ----------
export function normalizarTelefone(raw) {
  if (raw == null) return null;
  let d = String(raw).replace(/\D/g, '');
  if (!d) return null;
  d = d.replace(/^0+/, '');
  if (d.length === 13 && !d.startsWith('55')) d = d.slice(2);
  if (d.length === 10 || d.length === 11) d = '55' + d;
  if (!d.startsWith('55')) return d.length >= 11 && d.length <= 15 ? d : null;
  if (d.length !== 12 && d.length !== 13) return null;
  const ddd = Number(d.slice(2, 4));
  if (ddd < 11 || ddd > 99) return null;
  if (d.length === 12 && /[6-9]/.test(d[4])) d = d.slice(0, 4) + '9' + d.slice(4);
  return d;
}
export function formatarTelefone(p = '') {
  if (p.startsWith('55') && p.length === 13) return `(${p.slice(2, 4)}) ${p.slice(4, 9)}-${p.slice(9)}`;
  if (p.startsWith('55') && p.length === 12) return `(${p.slice(2, 4)}) ${p.slice(4, 8)}-${p.slice(8)}`;
  return p ? '+' + p : '';
}

// ---------- Importação de planilha (.xlsx / .csv) ----------
const norm = (s) => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
const COLUNAS = {
  telefone: ['telefone', 'celular', 'whatsapp', 'whats', 'fone', 'phone', 'tel', 'numero'],
  nome: ['nome', 'cliente', 'name', 'contato'],
  email: ['email', 'e-mail'],
  cidade: ['cidade', 'municipio'],
  uf: ['uf', 'estado'],
  origem: ['origem', 'feira', 'evento', 'fonte', 'onde'],
  segmento: ['segmento', 'tipo', 'ja comprou', 'comprou?', 'cliente?'],
  ultimaCompra: ['produto', 'o que comprou', 'comprou', 'ultima compra', 'compra'],
  totalGasto: ['valor', 'total', 'gasto'],
  obs: ['obs', 'observ', 'nota'],
  tags: ['tag', 'etiqueta'],
};
function mapearColunas(cab) {
  const map = {}, usado = new Set();
  for (const campo of Object.keys(COLUNAS)) {
    const i = cab.findIndex((h, j) => !usado.has(j) && COLUNAS[campo].some((k) => norm(h) === k || norm(h).includes(k)));
    if (i >= 0) { map[campo] = i; usado.add(i); }
  }
  return map;
}
function inferirSegmento(raw, row, padrao) {
  const v = norm(raw);
  if (v) {
    if (/(b2b|empresa|loja|lojista|corporativ|arquitet|revend)/.test(v)) return 'b2b';
    if (/(feira|evento|expo)/.test(v)) return 'feira';
    if (/(client|compr|sim|^s$)/.test(v)) return 'cliente';
  }
  if (row.ultimaCompra || row.totalGasto) return 'cliente';
  if (row.origem && /(feira|evento|expo|festa|fenavindima|expointer)/.test(norm(row.origem))) return 'feira';
  return padrao;
}
const dinheiro = (v) => { const n = Number(String(v).replace(/[^\d,.-]/g, '').replace(/\.(?=\d{3}(\D|$))/g, '').replace(',', '.')); return Number.isFinite(n) && n > 0 ? n : undefined; };

// CSV simples com aspas; detecta ; , tab |
export function lerCSV(texto) {
  texto = texto.replace(/^﻿/, '');
  const prim = texto.split(/\r?\n/)[0] || '';
  const sep = [';', ',', '\t', '|'].sort((a, b) => prim.split(b).length - prim.split(a).length)[0];
  const linhas = []; let linha = [], campo = '', aspas = false;
  for (let i = 0; i < texto.length; i++) {
    const ch = texto[i];
    if (aspas) { if (ch === '"') { if (texto[i + 1] === '"') { campo += '"'; i++; } else aspas = false; } else campo += ch; continue; }
    if (ch === '"') aspas = true;
    else if (ch === sep) { linha.push(campo); campo = ''; }
    else if (ch === '\n' || ch === '\r') { if (ch === '\r' && texto[i + 1] === '\n') i++; linha.push(campo); campo = ''; if (linha.some((x) => x.trim())) linhas.push(linha); linha = []; }
    else campo += ch;
  }
  linha.push(campo); if (linha.some((x) => x.trim())) linhas.push(linha);
  return linhas;
}
export async function lerArquivo(arquivo) {
  const buf = await arquivo.arrayBuffer();
  if (/\.xlsx?$/i.test(arquivo.name)) {
    const wb = window.XLSX.read(buf, { type: 'array', cellDates: true });
    return window.XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, raw: false, defval: '' });
  }
  let texto = new TextDecoder('utf-8').decode(buf);
  if (texto.includes('�')) texto = new TextDecoder('latin1').decode(buf); // Excel no Brasil salva em Latin-1
  return lerCSV(texto);
}
export function interpretarPlanilha(tabela, { segmento = 'outro', origem = '' } = {}) {
  if (tabela.length < 2) throw new Error('A planilha precisa ter uma linha de cabeçalho e ao menos um contato.');
  const cab = tabela[0].map(String);
  const map = mapearColunas(cab);
  if (map.telefone === undefined) throw new Error(`Não encontrei a coluna de telefone. Cabeçalhos lidos: ${cab.join(', ')}`);
  const validos = [], invalidos = [], vistos = new Set();
  tabela.slice(1).forEach((cel, i) => {
    const get = (f) => (map[f] !== undefined ? String(cel[map[f]] ?? '').trim() : '');
    const telefone = normalizarTelefone(get('telefone'));
    if (!telefone) return invalidos.push({ linha: i + 2, motivo: 'telefone inválido', bruto: cel.join(' | ') });
    if (vistos.has(telefone)) return invalidos.push({ linha: i + 2, motivo: 'telefone repetido na planilha', bruto: cel.join(' | ') });
    vistos.add(telefone);
    const row = { nome: get('nome') || 'Sem nome', telefone, email: get('email'), cidade: get('cidade'), uf: get('uf').toUpperCase().slice(0, 2), origem: get('origem') || origem,
      ultimaCompra: get('ultimaCompra'), totalGasto: dinheiro(get('totalGasto')), obs: get('obs'), tags: get('tags') ? get('tags').split(/[,;]/).map((t) => t.trim()).filter(Boolean) : [] };
    validos.push({ ...row, segmento: inferirSegmento(get('segmento'), row, segmento) });
  });
  return { validos, invalidos, colunas: Object.fromEntries(Object.entries(map).map(([f, i]) => [f, cab[i]])) };
}
// Grava os contatos importados: novos entram, os que já existem (mesmo telefone) são completados
export function importar(s, validos, rotulo) {
  const porTel = new Map(s.contatos.map((c) => [c.telefone, c]));
  let novos = 0, atualizados = 0;
  for (const r of validos) {
    const c = porTel.get(r.telefone);
    if (c) {
      for (const k of ['email', 'cidade', 'uf', 'origem', 'ultimaCompra', 'totalGasto', 'obs']) if (!c[k] && r[k]) c[k] = r[k];
      c.tags = [...new Set([...(c.tags || []), ...r.tags])];
      atualizados++;
    } else {
      const n = { id: uid('ct'), ...r, etapa: 'novo', naoContatar: false, token: token(), criadoEm: agora() };
      s.contatos.push(n); porTel.set(n.telefone, n);
      registrar(s, n.id, 'importacao', `Importado (${rotulo})`);
      novos++;
    }
  }
  return { novos, atualizados };
}

// ---------- Modelos e campanhas ----------
export const renderizar = (corpo, nome) => String(corpo || '').replaceAll('{{1}}', primeiroNome(nome) || 'cliente');
export function publico(s, f) {
  const desde = f.pularDias > 0 ? new Date(Date.now() - f.pularDias * 86400000).toISOString() : null;
  const contatadosRecente = desde ? new Set(s.mensagens.filter((m) => m.direcao === 'out' && m.em >= desde).map((m) => m.contatoId)) : new Set();
  return s.contatos.filter((c) => !c.naoContatar && !['nao_contatar', 'ganho'].includes(c.etapa)
    && (!f.etapas?.length || f.etapas.includes(c.etapa)) && (!f.segmentos?.length || f.segmentos.includes(c.segmento))
    && (!f.origens?.length || f.origens.includes(c.origem)) && (!f.tags?.length || (c.tags || []).some((t) => f.tags.includes(t)))
    && !contatadosRecente.has(c.id));
}
export const dentro24h = (c) => !!c?.ultimaEntrada && Date.now() - new Date(c.ultimaEntrada).getTime() < 24 * 3600 * 1000;

// Modo simulação: registra o envio sem sair para o WhatsApp
export function enviarOnda(s, camp, n) {
  const modelo = s.modelos.find((m) => m.id === camp.modeloId);
  camp.status = 'enviando'; camp.iniciadaEm ||= agora();
  let enviados = 0;
  for (const [cid, d] of Object.entries(camp.destinatarios)) {
    if (enviados >= n) break;
    if (d.status !== 'pendente') continue;
    const c = contato(s, cid);
    if (!c || c.naoContatar) { d.status = 'pulado'; d.erro = 'não contatar'; continue; }
    s.mensagens.push({ id: uid('mg'), contatoId: cid, campanhaId: camp.id, direcao: 'out', tipo: 'modelo', modelo: modelo?.nome, corpo: renderizar(modelo?.corpo, c.nome), status: 'enviado', simulado: true, em: agora() });
    d.status = 'enviado'; d.em = agora();
    c.ultimaInteracao = agora();
    avancar(s, c, 'enviado', `campanha "${camp.nome}"`);
    enviados++;
  }
  const restantes = Object.values(camp.destinatarios).filter((d) => d.status === 'pendente').length;
  camp.status = restantes ? 'pausada' : 'concluida';
  if (!restantes) camp.concluidaEm = agora();
  return { enviados, restantes };
}

const OPT_OUT = ['sair', 'parar', 'pare', 'stop', 'cancelar', 'descadastrar', 'nao tenho interesse', 'nao quero', 'nao quero receber', 'remover'];
const INTERESSE = ['quero uma proposta', 'quero ajuda', 'quero', 'tenho interesse', 'quero ver', 'ver catalogo', 'quero comprar'];
const normResp = (t) => norm(t).replace(/[^\w\s]/g, '').trim();
// Resposta recebida do cliente (no modo simulação, pelo botão "Simular resposta")
export function receber(s, c, texto) {
  s.mensagens.push({ id: uid('mg'), contatoId: c.id, direcao: 'in', tipo: 'texto', corpo: texto, status: 'recebido', em: agora() });
  c.naoLida = true; c.ultimaEntrada = agora(); c.ultimaInteracao = agora();
  const t = normResp(texto);
  if (OPT_OUT.includes(t)) {
    if (!c.naoContatar) {
      c.naoContatar = true; c.naoLida = false;
      registrar(s, c.id, 'opt_out', `Pediu para não receber mensagens (respondeu "${texto}")`);
      c.etapa = 'nao_contatar';
      s.mensagens.push({ id: uid('mg'), contatoId: c.id, direcao: 'out', tipo: 'texto', corpo: `Tudo bem, ${primeiroNome(c.nome)}! Não vamos mais te enviar mensagens. Se precisar de algo, é só chamar por aqui 🙂`, status: 'enviado', simulado: true, em: agora() });
    }
    return 'opt_out';
  }
  if (INTERESSE.some((k) => t === k || t.startsWith(k + ' '))) avancar(s, c, 'interessado', 'pediu informações');
  else avancar(s, c, 'respondeu', 'respondeu no WhatsApp');
  return 'ok';
}

// ---------- Indicadores ----------
export function marcos(s, filtro = () => true) {
  const porC = new Map();
  for (const m of s.mensagens) {
    const f = porC.get(m.contatoId) || {};
    if (m.direcao === 'in') f.respondeu = true;
    else if (m.status !== 'falhou') { f.enviado = true; if (['entregue', 'lido'].includes(m.status) || m.simulado) f.entregue = true; if (m.status === 'lido') f.lido = true; }
    porC.set(m.contatoId, f);
  }
  const clicou = new Set(s.cliques.filter((k) => k.tipo !== 'visita' && k.contatoId).map((k) => k.contatoId));
  return s.contatos.filter(filtro).map((c) => ({ c, ...(porC.get(c.id) || {}), clicou: clicou.has(c.id) }));
}
export function resumo(rows) {
  const ganhos = rows.filter((r) => r.c.etapa === 'ganho');
  return {
    total: rows.length, enviados: rows.filter((r) => r.enviado).length, entregues: rows.filter((r) => r.entregue).length, lidos: rows.filter((r) => r.lido || ['lido', 'respondeu', 'interessado', 'negociando', 'ganho'].includes(r.c.etapa)).length,
    responderam: rows.filter((r) => r.respondeu).length, interessados: rows.filter((r) => r.clicou || ['interessado', 'negociando', 'ganho'].includes(r.c.etapa)).length,
    ganhos: ganhos.length, faturamento: sum(ganhos, (r) => +r.c.valorNegocio || 0), emNegociacao: sum(rows.filter((r) => r.c.etapa === 'negociando'), (r) => +r.c.valorNegocio || 0),
    naoContatar: rows.filter((r) => r.c.etapa === 'nao_contatar').length,
  };
}
export function agrupar(rows, chave) {
  const m = new Map();
  for (const r of rows) { const k = chave(r) || '—'; m.set(k, [...(m.get(k) || []), r]); }
  return [...m.entries()].map(([k, l]) => ({ chave: k, ...resumo(l) }));
}
export const esperandoResposta = (s) => sortBy(s.contatos.filter((c) => c.naoLida), (c) => c.ultimaEntrada || '', true);
export function precisaFollowup(s) {
  const tres = new Date(Date.now() - 3 * 86400000).toISOString();
  const ultimaOut = new Map();
  for (const m of s.mensagens) if (m.direcao === 'out' && (!ultimaOut.get(m.contatoId) || m.em > ultimaOut.get(m.contatoId))) ultimaOut.set(m.contatoId, m.em);
  return s.contatos.filter((c) => ['enviado', 'lido'].includes(c.etapa) && !c.naoContatar && (ultimaOut.get(c.id) || '9') < tres);
}
export const hoje = today;
