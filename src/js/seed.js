// Dados iniciais e de demonstração (modo local / ?demo=1). seed({ vazio: true }) = só catálogo e modelos.
import { PRODUTOS } from './produtos.js';
import { uid, addDays, today } from './core/fmt.js';
import { token } from './dominio.js';

export const MODELOS = [
  { id: 'md1', nome: 'golden_reativacao_cliente', idioma: 'pt_BR', segmento: 'cliente', botaoCatalogo: true, respostasRapidas: ['Não tenho interesse'], ativo: true,
    corpo: 'Oi, {{1}}! Aqui é da Golden Artefatos de Madeira, de Flores da Cunha 🌳\n\nVocê já tem uma peça nossa em casa, por isso quisemos mostrar as novidades de Natal primeiro para você: tábuas, petisqueiras, bandejas e peças com gravação personalizada.\n\nFrete grátis acima de R$ 150 para o Sul e o Sudeste.\n\nToque no botão abaixo para ver o catálogo 👇' },
  { id: 'md2', nome: 'golden_feira_natal', idioma: 'pt_BR', segmento: 'feira', botaoCatalogo: true, respostasRapidas: ['Não tenho interesse'], ativo: true,
    corpo: 'Oi, {{1}}, tudo bem? Aqui é da Golden Artefatos de Madeira. Nos conhecemos em uma feira e você deixou seu contato com a gente 😊\n\nO Natal está chegando e montamos um catálogo com nossas peças de madeira para presentear (ou para deixar a sua mesa mais bonita): petisqueiras, tábuas de churrasco, bandejas e luminárias.\n\nVeja os modelos e peça direto pelo WhatsApp 👇' },
  { id: 'md3', nome: 'golden_b2b_kits', idioma: 'pt_BR', segmento: 'b2b', botaoCatalogo: true, respostasRapidas: ['Quero uma proposta', 'Não tenho interesse'], ativo: true,
    corpo: 'Olá, {{1}}! Aqui é da Golden Artefatos de Madeira, fábrica em Flores da Cunha (RS).\n\nEstamos fechando pedidos de kits de fim de ano para empresas e lojistas: tábuas, petisqueiras e bandejas de madeira, com gravação da sua marca.\n\nQuer ver o catálogo e receber uma proposta com preço de atacado?' },
  { id: 'md4', nome: 'golden_followup', idioma: 'pt_BR', segmento: null, botaoCatalogo: true, respostasRapidas: ['Quero ajuda', 'Não tenho interesse'], ativo: true,
    corpo: 'Oi, {{1}}! Passando só para saber se você conseguiu ver o nosso catálogo de Natal 🎄\n\nSe quiser, te ajudo a escolher um presente ou montar um kit. É só responder aqui.' },
];

export function seed({ vazio = false } = {}) {
  const meta = { versao: 1, demo: !vazio, empresa: vazio ? 'Golden Artefatos de Madeira' : 'Golden Artefatos de Madeira (demonstração)', pinGestao: '0000', whatsapp: '', siteUrl: 'https://www.goldenartefatosdemadeira.com', limiteDiario: 250 };
  const base = { meta, produtos: PRODUTOS.map((p) => ({ ...p })), modelos: MODELOS.map((m) => ({ ...m })), contatos: [], mensagens: [], campanhas: [], cliques: [], atividades: [], acessos: [] };
  if (vazio) return base;
  let sem = 11;
  const rnd = () => ((sem = (sem * 9301 + 49297) % 233280) / 233280);
  const pick = (a) => a[Math.floor(rnd() * a.length)];
  const nomes = ['Ana', 'Bruno', 'Carla', 'Daniel', 'Eduarda', 'Fernando', 'Gabriela', 'Henrique', 'Isabela', 'João', 'Karina', 'Lucas', 'Mariana', 'Nicolas', 'Patrícia', 'Rafael', 'Sabrina', 'Tiago', 'Vanessa', 'William'];
  const sobren = ['Silva', 'Pereira', 'Bortolini', 'Zanella', 'Andreazza', 'Tomasi', 'Rossi', 'Costa', 'Marcon', 'Sartori', 'Dal Pizzol', 'Menegotto'];
  const origens = ['Feira Expointer 2026', 'Fenavindima 2026', 'Festa da Uva 2026', 'Cliente loja física', 'Site', 'Indicação'];
  const etapas = ['novo', 'novo', 'enviado', 'enviado', 'lido', 'lido', 'respondeu', 'interessado', 'negociando', 'ganho', 'perdido', 'nao_contatar'];
  const cidades = ['Caxias do Sul', 'Flores da Cunha', 'Bento Gonçalves', 'Porto Alegre', 'Gramado', 'Farroupilha'];
  const t = Date.now();
  const iso = (ms) => new Date(ms).toISOString();
  for (let i = 0; i < 120; i++) {
    const origem = pick(origens);
    const segmento = origem.startsWith('Cliente') || origem === 'Site' ? 'cliente' : i % 9 === 0 ? 'b2b' : 'feira';
    const etapa = pick(etapas);
    const criado = t - rnd() * 20 * 86400000;
    const c = { id: 'ct' + i, nome: `${pick(nomes)} ${pick(sobren)}`, telefone: `55549${String(90000000 + i * 7919).slice(0, 8)}`, segmento, origem, etapa, cidade: pick(cidades), uf: 'RS', tags: [],
      naoContatar: etapa === 'nao_contatar', valorNegocio: ['ganho', 'negociando'].includes(etapa) ? Math.round(80 + rnd() * 600) : null, token: token(), criadoEm: iso(criado),
      ultimaInteracao: etapa === 'novo' ? null : iso(criado + 86400000), naoLida: ['respondeu', 'interessado'].includes(etapa) && rnd() > 0.4,
      ultimaEntrada: ['respondeu', 'interessado', 'negociando', 'ganho'].includes(etapa) ? iso(t - rnd() * 3 * 86400000) : null };
    base.contatos.push(c);
    base.atividades.push({ id: uid('at'), contatoId: c.id, tipo: 'importacao', texto: `Importado (${origem})`, em: iso(criado) });
    if (etapa !== 'novo') {
      const alcancou = etapas.indexOf(etapa);
      const md = segmento === 'cliente' ? MODELOS[0] : segmento === 'b2b' ? MODELOS[2] : MODELOS[1];
      base.mensagens.push({ id: uid('mg'), contatoId: c.id, direcao: 'out', tipo: 'modelo', modelo: md.nome, corpo: md.corpo.replaceAll('{{1}}', c.nome.split(' ')[0]), status: alcancou >= 4 ? 'lido' : 'entregue', em: iso(criado + 3600000), campanhaId: 'cp1' });
      if (['respondeu', 'interessado', 'negociando', 'ganho'].includes(etapa))
        base.mensagens.push({ id: uid('mg'), contatoId: c.id, direcao: 'in', tipo: 'texto', corpo: pick(['Oi! Quero ver mais', 'Quanto fica o frete para Caxias?', 'Tem a tábua de churrasco?', 'Lindo! Faz com gravação?']), status: 'recebido', em: c.ultimaEntrada || iso(criado + 7200000) });
      if (['interessado', 'negociando', 'ganho'].includes(etapa)) base.cliques.push({ id: uid('ck'), tipo: 'whatsapp', contatoId: c.id, produtoId: pick(PRODUTOS).id, em: iso(criado + 9000000) });
      if (rnd() > 0.4) base.cliques.push({ id: uid('ck'), tipo: 'visita', contatoId: c.id, em: iso(criado + 8000000) });
    }
  }
  const dest = Object.fromEntries(base.contatos.filter((c) => c.etapa !== 'novo').map((c) => [c.id, { status: 'enviado', em: c.criadoEm }]));
  base.campanhas.push({ id: 'cp1', nome: 'Natal 2026 · primeira onda', modeloId: 'md2', filtros: { segmentos: ['feira', 'cliente'], etapas: ['novo'] }, destinatarios: dest, status: 'concluida', criadaEm: iso(t - 20 * 86400000), iniciadaEm: iso(t - 20 * 86400000), concluidaEm: iso(t - 19 * 86400000) });
  return base;
}
export const _hoje = () => addDays(today(), 0);
