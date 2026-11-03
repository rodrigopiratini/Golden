// Golden CRM — Gestão
import { criarApp } from '../core/app.js';
import { editar, formHTML, lerCampos } from '../core/form.js';
import * as D from '../dominio.js';
import { money, money0, int, percent, date, dateShort, esc, sortBy, sum, uid, plural, today } from '../core/fmt.js';
import { icon, kpi, badge, empty, iniciais, toast, confirmar, modal, closeModal, download, toCSV, waLink } from '../core/ui.js';
import { hbars } from '../core/charts.js';

const S = () => A.S();
const agora = () => new Date().toISOString();
const quando = (iso) => (iso ? new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—');
const whatsappAtivo = () => A.store.modo === 'nuvem' && !!S().meta.whatsappAtivo;
const etapaBadge = (id) => `<span class="badge" style="background:${D.ETAPA[id]?.cor}22;color:${D.ETAPA[id]?.cor}">${esc(D.ETAPA[id]?.label || id)}</span>`;
const segBadge = (id) => `<span class="tiny"><span class="dot-c" style="background:${D.SEG[id]?.cor}"></span>${esc(D.SEG[id]?.label || '—')}</span>`;
const origens = (s) => [...new Set(s.contatos.map((c) => c.origem).filter(Boolean))].sort();
function linkCatalogo(c) {
  const u = new URL('../catalogo/', location.href);
  if (A.store.modo === 'local') u.searchParams.set('demo', '1'); else u.searchParams.set('e', A.store.perfil()?.empresaId || '');
  if (c) u.searchParams.set('c', c.token);
  return u.href;
}

const CAMPOS_CONTATO = [
  { k: 'nome', label: 'Nome', obrig: true, col: 2 },
  { k: 'telefone', label: 'WhatsApp', tipo: 'tel', obrig: true, ph: '(54) 99999-9999' },
  { k: 'email', label: 'E-mail', tipo: 'email' },
  { k: 'segmento', label: 'Segmento', tipo: 'select', obrig: true, padrao: 'outro', opcoes: D.SEGMENTOS.map((x) => [x.id, x.label]) },
  { k: 'origem', label: 'Origem', ph: 'Feira Expointer 2026, Site, Indicação…' },
  { k: 'cidade', label: 'Cidade' }, { k: 'uf', label: 'UF', maiusculas: true },
  { k: 'valorNegocio', label: 'Valor do negócio', tipo: 'money' },
  { k: 'ultimaCompra', label: 'Última compra' },
  { k: 'obs', label: 'Observações', tipo: 'textarea', col: 2 },
];
const CAMPOS_PRODUTO = [
  { k: 'nome', label: 'Nome', obrig: true, col: 2 },
  { k: 'categoria', label: 'Categoria', tipo: 'select', obrig: true, opcoes: D.CATEGORIAS.map((c) => [c, c]) },
  { k: 'selo', label: 'Selo', tipo: 'select', opcoes: [['NOVO', 'Novo'], ['OFERTA', 'Oferta'], ['MAIS VENDIDO', 'Mais vendido']] },
  { k: 'preco', label: 'Preço', tipo: 'money', obrig: true },
  { k: 'precoPromo', label: 'Preço promocional', tipo: 'money' },
  { k: 'imagem', label: 'Endereço da foto', col: 2, ph: 'https://…' },
  { k: 'urlSite', label: 'Página do produto na loja', col: 2, ph: 'https://…' },
  { k: 'ordem', label: 'Ordem', tipo: 'number' },
  { k: 'ativo', label: 'Aparece no catálogo', tipo: 'checkbox', padrao: true },
];
const CAMPOS_MODELO = [
  { k: 'nome', label: 'Nome exato na Meta', obrig: true, ph: 'golden_natal_2026', dica: 'Igual ao nome do modelo aprovado no WhatsApp Manager.' },
  { k: 'segmento', label: 'Segmento sugerido', tipo: 'select', opcoes: D.SEGMENTOS.map((x) => [x.id, x.label]) },
  { k: 'corpo', label: 'Texto ({{1}} = primeiro nome)', tipo: 'textarea', obrig: true, col: 2 },
  { k: 'respostas', label: 'Respostas rápidas (separe por vírgula)', col: 2, ph: 'Não tenho interesse' },
  { k: 'botaoCatalogo', label: 'Botão "Ver catálogo" com link rastreado', tipo: 'checkbox', padrao: true, col: 2 },
  { k: 'ativo', label: 'Ativo', tipo: 'checkbox', padrao: true },
];

function novoContato(inicial = null) {
  editar({ titulo: 'Contato', colecao: 'contatos', campos: CAMPOS_CONTATO, prefixo: 'ct', inicial,
    antesDeSalvar: (c, antes) => {
      const tel = D.normalizarTelefone(c.telefone);
      if (!tel) return 'Telefone inválido';
      if (S().contatos.some((x) => x.telefone === tel && x.id !== c.id)) return 'Já existe um contato com este telefone';
      c.telefone = tel;
      if (!antes) Object.assign(c, { etapa: 'novo', naoContatar: false, token: D.token(), tags: [] });
    },
    onSalvo: (c, novo) => { if (novo && c) A.store.commit((s) => D.registrar(s, c.id, 'nota', 'Cadastrado manualmente')); } });
}

// ---------- App ----------
const A = criarApp({
  tipo: 'gestao',
  inicio: '#/painel',
  nav: [['#/painel', 'chart', 'Painel'], ['#/funil', 'swap', 'Funil'], ['#/contatos', 'users', 'Contatos'], ['#/campanhas', 'spark', 'Campanhas'],
    ['#/conversas', 'whatsapp', 'Conversas'], ['#/catalogo', 'store', 'Catálogo'], ['#/modelos', 'file', 'Mensagens']],
  tabs: [['#/painel', 'chart', 'Painel'], ['#/funil', 'swap', 'Funil'], ['#/conversas', 'whatsapp', 'Conversas'], ['#/contatos', 'users', 'Contatos'], ['#/mais', 'menu', 'Mais']],
  badges: (s) => ({ '#/conversas': s.contatos.filter((c) => c.naoLida).length }),
  ativo: (h, r) => (h === '#/contatos' && r.startsWith('#/contato/')) || (h === '#/campanhas' && r.startsWith('#/campanha/')) || (h === '#/conversas' && r.startsWith('#/conversa/')),
  rotas: [['/painel', vPainel], ['/funil', vFunil], ['/contatos', vContatos], ['/contato/:id', vContato], ['/campanhas', vCampanhas], ['/campanha/:id', vCampanha],
    ['/conversas', vConversas], ['/conversa/:id', vConversas], ['/catalogo', vCatalogo], ['/modelos', vModelos]],
  camposEmpresa: [['whatsapp', 'WhatsApp da loja (botão "Quero este" do catálogo)', '5554999999999'], ['siteUrl', 'Site da loja', 'https://…'], ['limiteDiario', 'Limite diário de envios (Meta)', '250']],
  configExtra: (s) => `<div class="card col"><h2>WhatsApp oficial</h2>
    <div class="small ink2">${whatsappAtivo() ? `${icon('check')} Conectado à Cloud API da Meta: as campanhas e respostas saem de verdade.` : `<b>Modo simulação:</b> tudo funciona, mas nada é enviado de verdade. Em Conversas aparece "Simular resposta do cliente" para testar o fluxo inteiro.`}</div>
    <div class="tiny muted">Para conectar: veja docs/WHATSAPP.md (número na Meta, modelos aprovados e a função golden-whatsapp no Supabase).</div>
    <a class="btn ghost" href="${linkCatalogo()}" target="_blank" rel="noopener">${icon('link')} Abrir catálogo público</a></div>`,
  aoMudar: (msg, externo, info) => { if (externo && info?.colecao === 'mensagens' && info.novo && info.doc.direcao === 'in') toast(`Nova mensagem de ${D.contato(S(), info.doc.contatoId)?.nome || 'contato'}`); },
  naoRedesenhar: (pattern, externo) => externo && pattern === '/conversa/:id' && document.activeElement?.name === 'texto',
  acoes: {
    novoContato: () => novoContato(),
    editarContato: (el) => editar({ titulo: 'Contato', colecao: 'contatos', campos: CAMPOS_CONTATO, doc: S().contatos.find((c) => c.id === el.dataset.id),
      antesDeSalvar: (c) => { const tel = D.normalizarTelefone(c.telefone); if (!tel) return 'Telefone inválido'; if (S().contatos.some((x) => x.telefone === tel && x.id !== c.id)) return 'Já existe um contato com este telefone'; c.telefone = tel; },
      onSalvo: (c) => { if (!c) location.hash = '#/contatos'; } }),
    etapa: (el) => { A.store.commit((s) => D.mudarEtapa(s, D.contato(s, el.dataset.id), el.value)); toast(`Etapa: ${D.ETAPA[el.value].label}`); },
    nota: (f) => { const t = f.texto.value.trim(); if (!t) return; A.store.commit((s) => D.registrar(s, f.dataset.id, 'nota', t)); toast('Nota registrada'); },
    copiarLink: (el) => { navigator.clipboard?.writeText(linkCatalogo(D.contato(S(), el.dataset.id))); toast('Link do catálogo copiado'); },
    importar: () => modalImportar(),
    exportar: () => exportarContatos(),
    modeloPlanilha: () => download('modelo-contatos.csv', toCSV([['Nome', 'Telefone', 'Cidade', 'UF', 'Origem', 'Segmento', 'O que comprou', 'Valor', 'Obs'], ['Maria Silva', '(54) 99999-1234', 'Caxias do Sul', 'RS', 'Feira Expointer 2026', 'Feira', '', '', '']]), 'text/csv;charset=utf-8'),
    // funil: arrastar e soltar
    arrastar: () => {},
    novaCampanha: () => modalCampanha(),
    onda: (el) => enviarOnda(el.dataset.id, +(document.getElementById('nonda')?.value || 100)),
    apagarCampanha: async (el) => { if (await confirmar('Apagar esta campanha? As mensagens já enviadas continuam no histórico dos contatos.', { ok: 'Apagar' })) { A.store.commit((s) => { s.campanhas = s.campanhas.filter((c) => c.id !== el.dataset.id); }); location.hash = '#/campanhas'; } },
    enviarTexto: (f) => enviarTexto(f),
    enviarModelo: (el) => enviarModeloAvulso(el.dataset.id),
    simular: (el) => modal({ title: 'Simular resposta do cliente', body: `<form id="fsim" class="col"><div class="chips">${['Oi! Quero ver mais', 'Quanto fica o frete?', 'Quero uma proposta', 'Não tenho interesse'].map((t) => `<button type="button" class="chip" data-act="simTexto" data-t="${esc(t)}">${esc(t)}</button>`).join('')}</div><label class="field"><span>Ou escreva</span><input class="input" name="texto"></label></form>`,
      foot: '<button class="btn" data-act="ok">Simular</button>', handlers: {
        simTexto: (b) => { document.querySelector('#fsim [name=texto]').value = b.dataset.t; },
        ok: () => { const t = document.querySelector('#fsim [name=texto]').value.trim(); if (!t) return; let r; A.store.commit((s) => { r = D.receber(s, D.contato(s, el.dataset.id), t); }); closeModal(); toast(r === 'opt_out' ? 'Cliente pediu para sair: removido da lista e resposta automática enviada' : 'Resposta simulada'); } } }),
    lida: (el) => A.store.commit((s) => { D.contato(s, el.dataset.id).naoLida = false; }),
    novoProduto: () => editar({ titulo: 'Produto', colecao: 'produtos', campos: CAMPOS_PRODUTO, prefixo: 'pd' }),
    editarProduto: (el) => editar({ titulo: 'Produto', colecao: 'produtos', campos: CAMPOS_PRODUTO, doc: S().produtos.find((p) => p.id === el.dataset.id) }),
    novoModelo: () => editarModelo(null),
    editarModelo: (el) => editarModelo(S().modelos.find((m) => m.id === el.dataset.id)),
  },
  aposRender: (pattern) => { if (pattern === '/funil') ligarArrastar(); if (pattern === '/conversa/:id') { const c = document.querySelector('.chat'); if (c) c.scrollTop = c.scrollHeight; } },
});

// ---------- Painel ----------
function vPainel() {
  const s = S();
  const rows = D.marcos(s);
  const r = D.resumo(rows);
  const taxa = (a, b) => (b ? percent(a / b) : '—');
  const funil = [['Enviado', r.enviados], ['Entregue', r.entregues], ['Lido', r.lidos], ['Respondeu', r.responderam], ['Interessado', r.interessados], ['Comprou', r.ganhos]];
  const tabela = (grupos, rot) => `<div class="tbl-wrap"><table class="tbl"><thead><tr><th>${rot}</th><th class="r">Contatos</th><th class="r">Abordados</th><th class="r">Resposta</th><th class="r">Vendas</th><th class="r">Faturamento</th></tr></thead>
    <tbody>${sortBy(grupos, (g) => -g.faturamento - g.total / 1000).map((g) => `<tr><td>${g.rot}</td><td class="r">${int(g.total)}</td><td class="r">${int(g.enviados)}</td><td class="r">${taxa(g.responderam, g.enviados)}</td><td class="r">${int(g.ganhos)}</td><td class="r">${money0(g.faturamento)}</td></tr>`).join('')}</tbody></table></div>`;
  const porSeg = D.agrupar(rows, (x) => x.c.segmento).map((g) => ({ ...g, rot: segBadge(g.chave) }));
  const porOrig = D.agrupar(rows, (x) => x.c.origem).map((g) => ({ ...g, rot: esc(g.chave) }));
  const cliq = s.cliques.filter((k) => k.produtoId);
  const maisClicados = sortBy(s.produtos.map((p) => ({ p, n: cliq.filter((k) => k.produtoId === p.id).length })).filter((x) => x.n), (x) => -x.n).slice(0, 8);
  const esperando = D.esperandoResposta(s).slice(0, 8);
  const follow = D.precisaFollowup(s);
  return A.tela('Painel', `${A.pageHead('Painel', `${plural(r.total, 'contato')} · ${whatsappAtivo() ? 'WhatsApp conectado' : 'modo simulação'}`, `<button class="btn ghost" data-act="importar">${icon('upload')} Importar contatos</button><button class="btn" data-act="novaCampanha">${icon('spark')} Nova campanha</button>`)}
    <div class="grid g4">${kpi('Abordados', int(r.enviados), `de ${int(r.total)} contatos`)}${kpi('Taxa de resposta', taxa(r.responderam, r.enviados), `${int(r.responderam)} responderam`)}${kpi('Vendas', int(r.ganhos), `${taxa(r.ganhos, r.enviados)} dos abordados`)}${kpi('Faturamento', money0(r.faturamento), `${money0(r.emNegociacao)} em negociação`)}</div>
    <div class="grid g2 mt">
      <div class="card funil"><div class="head"><h2>Funil</h2><span class="muted small">enviado → comprou</span></div>${hbars(funil.map(([n, v]) => ({ label: n, value: v, sub: taxa(v, r.enviados) + ' dos enviados', color: 'var(--destaque)' })), int, { max: Math.max(1, r.enviados) })}</div>
      <div class="card"><div class="head"><h2>Esperando resposta</h2><a class="small" href="#/conversas">ver conversas</a></div><div class="list">${esperando.map((c) => `<a class="li" href="#/conversa/${c.id}"><div class="avatar">${esc(iniciais(c.nome))}</div><div class="grow"><div class="t">${esc(c.nome)}</div><div class="s">${quando(c.ultimaEntrada)} · ${esc(D.ETAPA[c.etapa]?.label)}</div></div>${badge('Responder', 'warn')}</a>`).join('') || empty('Ninguém esperando. 👍', 'whatsapp')}</div>
        ${follow.length ? `<div class="aviso mt">${icon('clock')}<span class="grow"><b>${plural(follow.length, 'contato')}</b> leu ou recebeu há mais de 3 dias e não respondeu: hora de um lembrete (modelo golden_followup).</span><button class="btn sm" data-act="novaCampanha">Criar follow-up</button></div>` : ''}</div>
    </div>
    <div class="grid g2 mt">
      <div class="card pad-0"><div style="padding:16px 16px 0"><h2>Por segmento</h2></div>${tabela(porSeg, 'Segmento')}</div>
      <div class="card pad-0"><div style="padding:16px 16px 0"><h2>Por origem</h2><div class="tiny muted">qual feira vende mais</div></div>${tabela(porOrig, 'Origem')}</div>
    </div>
    <div class="card mt"><div class="head"><h2>Produtos mais clicados no catálogo</h2></div>${maisClicados.length ? hbars(maisClicados.map((x) => ({ label: x.p.nome, value: x.n })), (v) => plural(v, 'clique')) : empty('Os cliques no catálogo aparecem aqui.', 'store')}</div>`);
}

// ---------- Funil (kanban) ----------
function vFunil() {
  const s = S();
  return A.tela('Funil', `${A.pageHead('Funil', 'Arraste os cartões entre as etapas. Os contatos também andam sozinhos: leu → Lido, respondeu → Respondeu, clicou em produto → Interessado.', A.busca('Buscar contato…'))}
    <div class="kanban k9">${D.ETAPAS.map((e) => { const cs = sortBy(s.contatos.filter((c) => c.etapa === e.id), (c) => c.ultimaInteracao || c.criadoEm || '', true);
      return `<div class="kcol" data-etapa="${e.id}"><div class="khead"><b><span class="dot-c" style="background:${e.cor}"></span>${e.label}</b><span class="badge">${cs.length}</span></div>
        ${cs.slice(0, 80).map((c) => `<div class="card kcard col" draggable="true" data-id="${c.id}" data-busca="${esc(c.nome + ' ' + c.telefone + ' ' + (c.origem || ''))}" style="gap:6px"><a href="#/contato/${c.id}" style="color:inherit"><b>${esc(c.nome)}</b></a>
          <div class="row between">${segBadge(c.segmento)}${c.valorNegocio ? `<b class="small num">${money0(c.valorNegocio)}</b>` : ''}</div>
          <select class="input hide-d" data-onchange="etapa" data-id="${c.id}" style="padding:6px 8px;font-size:13px">${D.ETAPAS.map((x) => `<option value="${x.id}" ${x.id === c.etapa ? 'selected' : ''}>${x.label}</option>`).join('')}</select></div>`).join('')}
        ${cs.length > 80 ? `<div class="tiny muted center">+ ${cs.length - 80} (veja em Contatos)</div>` : ''}</div>`; }).join('')}</div>`);
}
function ligarArrastar() {
  let id = null;
  document.querySelectorAll('.kcard[draggable]').forEach((el) => el.addEventListener('dragstart', (e) => { id = el.dataset.id; e.dataTransfer.setData('text/plain', id); }));
  document.querySelectorAll('.kcol').forEach((col) => {
    col.addEventListener('dragover', (e) => { e.preventDefault(); col.classList.add('alvo'); });
    col.addEventListener('dragleave', () => col.classList.remove('alvo'));
    col.addEventListener('drop', (e) => { e.preventDefault(); col.classList.remove('alvo'); const cid = id || e.dataTransfer.getData('text/plain'); if (!cid) return; A.store.commit((s) => D.mudarEtapa(s, D.contato(s, cid), col.dataset.etapa)); });
  });
}

// ---------- Contatos ----------
function filtrar(s, q) {
  return s.contatos.filter((c) => (!q.etapa || c.etapa === q.etapa) && (!q.seg || c.segmento === q.seg) && (!q.origem || c.origem === q.origem) && (!q.nl || c.naoLida));
}
function vContatos({ query }) {
  const s = S();
  const lista = sortBy(filtrar(s, query), (c) => c.ultimaInteracao || c.criadoEm || '', true);
  const sel = (k, ops, rot) => `<select class="input" style="width:auto" onchange="location.hash='#/contatos?'+new URLSearchParams({...Object.fromEntries(new URLSearchParams(location.hash.split('?')[1]||'')), ${k}: this.value}).toString()"><option value="">${rot}</option>${ops.map(([v, n]) => `<option value="${esc(v)}" ${query[k] === v ? 'selected' : ''}>${esc(n)}</option>`).join('')}</select>`;
  return A.tela('Contatos', `${A.pageHead('Contatos', `${plural(lista.length, 'contato')}${lista.length !== s.contatos.length ? ` de ${int(s.contatos.length)}` : ''}`, `${A.busca('Nome, telefone, cidade…')}<button class="btn ghost" data-act="exportar">${icon('download')} Exportar</button><button class="btn ghost" data-act="importar">${icon('upload')} Importar</button><button class="btn" data-act="novoContato">${icon('plus')} Contato</button>`)}
    <div class="row wrap mb">${sel('etapa', D.ETAPAS.map((e) => [e.id, e.label]), 'Todas as etapas')}${sel('seg', D.SEGMENTOS.map((e) => [e.id, e.label]), 'Todos os segmentos')}${sel('origem', origens(s).map((o) => [o, o]), 'Todas as origens')}${Object.values(query).some(Boolean) ? '<a class="btn ghost sm" href="#/contatos">Limpar filtros</a>' : ''}</div>
    <div class="card pad-0"><div class="tbl-wrap"><table class="tbl"><thead><tr><th>Contato</th><th class="hide-m">Segmento</th><th class="hide-m">Origem</th><th>Etapa</th><th class="r hide-m">Valor</th><th class="hide-m">Última interação</th></tr></thead>
    <tbody>${lista.slice(0, 500).map((c) => `<tr class="click" data-act="goto" data-h="#/contato/${c.id}" data-busca="${esc(`${c.nome} ${c.telefone} ${D.formatarTelefone(c.telefone)} ${c.cidade || ''} ${c.email || ''} ${(c.tags || []).join(' ')}`)}"><td><b>${esc(c.nome)}</b>${c.naoLida ? ' ' + badge('nova mensagem', 'warn') : ''}<div class="tiny muted">${esc(D.formatarTelefone(c.telefone))}${c.cidade ? ' · ' + esc(c.cidade) : ''}</div></td>
      <td class="hide-m">${segBadge(c.segmento)}</td><td class="hide-m small">${esc(c.origem || '—')}</td><td>${etapaBadge(c.etapa)}</td><td class="r hide-m">${c.valorNegocio ? money0(c.valorNegocio) : ''}</td><td class="hide-m small">${quando(c.ultimaInteracao)}</td></tr>`).join('') || `<tr><td colspan="6">${empty('Nenhum contato. Importe uma planilha para começar.', 'users')}</td></tr>`}</tbody></table></div></div>
    ${lista.length > 500 ? '<div class="tiny muted mt-s">Mostrando os 500 mais recentes; use a busca ou os filtros.</div>' : ''}`);
}

function exportarContatos() {
  const s = S();
  download(`contatos-golden-${today()}.csv`, toCSV([['Nome', 'Telefone', 'E-mail', 'Cidade', 'UF', 'Segmento', 'Origem', 'Etapa', 'Valor do negócio', 'Não contatar', 'Última compra', 'Obs'],
    ...s.contatos.map((c) => [c.nome, D.formatarTelefone(c.telefone), c.email, c.cidade, c.uf, D.SEG[c.segmento]?.label, c.origem, D.ETAPA[c.etapa]?.label, c.valorNegocio || '', c.naoContatar ? 'sim' : '', c.ultimaCompra, c.obs])]), 'text/csv;charset=utf-8');
}

function modalImportar() {
  let resultado = null;
  modal({ title: 'Importar contatos', wide: true, body: `<form id="fimp" class="col">
    <div class="small ink2">Planilha do Excel (.xlsx) ou .csv. As colunas são reconhecidas pelo nome (telefone/celular/WhatsApp, nome, cidade, origem/feira, o que comprou…). Telefones são corrigidos e repetidos são unidos.</div>
    <label class="field"><span>Arquivo</span><input class="input" type="file" name="arquivo" accept=".xlsx,.xls,.csv,text/csv" data-onchange="lerPlanilha"></label>
    <div class="grid g2"><label class="field"><span>Segmento quando não der para saber</span><select class="input" name="segmento">${D.SEGMENTOS.map((x) => `<option value="${x.id}" ${x.id === 'feira' ? 'selected' : ''}>${x.label}</option>`).join('')}</select></label>
      <label class="field"><span>Origem (quando a planilha não tiver)</span><input class="input" name="origem" placeholder="Ex.: Feira Expointer 2026"></label></div>
    <div id="imp-prev" class="small muted">Escolha o arquivo para ver a prévia.</div>
    <a href="#" class="tiny" data-act="modeloPlanilha">Baixar planilha modelo</a></form>`,
    foot: '<button class="btn ghost" data-act="close">Cancelar</button><button class="btn" data-act="ok" disabled>Importar</button>',
    handlers: {
      modeloPlanilha: () => download('modelo-contatos.csv', toCSV([['Nome', 'Telefone', 'Cidade', 'UF', 'Origem', 'Segmento', 'O que comprou', 'Valor', 'Obs'], ['Maria Silva', '(54) 99999-1234', 'Caxias do Sul', 'RS', 'Feira Expointer 2026', 'Feira', '', '', '']]), 'text/csv;charset=utf-8'),
      lerPlanilha: async (el) => {
        const f = document.getElementById('fimp');
        try {
          const tabela = await D.lerArquivo(el.files[0]);
          resultado = D.interpretarPlanilha(tabela, { segmento: f.segmento.value, origem: f.origem.value.trim() });
          const existentes = new Set(S().contatos.map((c) => c.telefone));
          const novos = resultado.validos.filter((r) => !existentes.has(r.telefone)).length;
          document.getElementById('imp-prev').innerHTML = `<div class="ajuste-box" style="background:var(--ok-bg);color:var(--ok)"><b>${int(resultado.validos.length)} contatos válidos</b>: ${int(novos)} novos e ${int(resultado.validos.length - novos)} já cadastrados (serão completados).</div>
            <div class="tiny mt-s">Colunas reconhecidas: ${Object.entries(resultado.colunas).map(([k, v]) => `${esc(k)} ← "${esc(v)}"`).join(' · ')}</div>
            ${resultado.invalidos.length ? `<details class="mt-s"><summary class="small" style="color:var(--crit)">${int(resultado.invalidos.length)} linhas ignoradas</summary><div class="tiny">${resultado.invalidos.slice(0, 50).map((x) => `Linha ${x.linha}: ${esc(x.motivo)} — ${esc(x.bruto.slice(0, 80))}`).join('<br>')}</div></details>` : ''}
            <div class="tbl-wrap mt-s"><table class="tbl"><tbody>${resultado.validos.slice(0, 5).map((r) => `<tr><td>${esc(r.nome)}</td><td>${esc(D.formatarTelefone(r.telefone))}</td><td>${esc(D.SEG[r.segmento].label)}</td><td class="small">${esc(r.origem || '')}</td></tr>`).join('')}</tbody></table></div>`;
          document.querySelector('.modal [data-act=ok]').disabled = !resultado.validos.length;
        } catch (e) { document.getElementById('imp-prev').innerHTML = `<span style="color:var(--crit)">${esc(e.message)}</span>`; }
      },
      ok: () => {
        let r; const nome = document.querySelector('#fimp [name=arquivo]').files[0]?.name || 'planilha';
        A.store.commit((s) => { r = D.importar(s, resultado.validos, nome); });
        closeModal(); toast(`Importação: ${r.novos} novos, ${r.atualizados} atualizados`); location.hash = '#/contatos';
      },
    } });
}

function vContato({ id }) {
  const s = S();
  const c = D.contato(s, id);
  if (!c) return A.tela('Contato', empty('Contato não encontrado'), { back: true });
  const linha = sortBy([
    ...s.atividades.filter((a) => a.contatoId === id).map((a) => ({ em: a.em, ic: a.tipo === 'etapa' ? 'swap' : a.tipo === 'nota' ? 'edit' : a.tipo === 'opt_out' ? 'x' : 'info', t: esc(a.texto) })),
    ...s.mensagens.filter((m) => m.contatoId === id).map((m) => ({ em: m.em, ic: 'whatsapp', t: `${m.direcao === 'in' ? '<b>Cliente:</b> ' : `<b>Enviado${m.modelo ? ' (' + esc(m.modelo) + ')' : ''}:</b> `}${esc(String(m.corpo || '').slice(0, 140))}${m.direcao === 'out' ? ` <span class="muted">· ${esc(m.status)}${m.simulado ? ' (simulação)' : ''}</span>` : ''}` })),
    ...s.cliques.filter((k) => k.contatoId === id).map((k) => ({ em: k.em, ic: 'link', t: k.tipo === 'visita' ? 'Abriu o catálogo' : `${k.tipo === 'site' ? 'Foi comprar no site' : 'Clicou em "Quero este"'}: <b>${esc(s.produtos.find((p) => p.id === k.produtoId)?.nome || '')}</b>` })),
  ], (x) => x.em || '', true);
  return A.tela(c.nome, `${A.pageHead(esc(c.nome), `${esc(D.formatarTelefone(c.telefone))}${c.cidade ? ' · ' + esc(c.cidade) + (c.uf ? '/' + esc(c.uf) : '') : ''} · ${segBadge(c.segmento)}`,
      `<a class="btn ghost" target="_blank" rel="noopener" href="${waLink(c.telefone, `Olá, ${D.primeiroNome(c.nome)}!`)}">${icon('whatsapp')} WhatsApp</a><a class="btn ghost" href="#/conversa/${c.id}">Conversa</a><button class="btn ghost" data-act="editarContato" data-id="${c.id}">${icon('edit')} Editar</button>`)}
    ${c.naoContatar ? `<div class="aviso crit">${icon('alert')}<span>Este contato pediu para não receber mensagens: fica fora das campanhas.</span></div>` : ''}
    <div class="grid g-2-1">
      <div class="card"><div class="head"><h2>Linha do tempo</h2></div>
        <form class="row mb" data-onsubmit="nota" data-id="${c.id}"><input class="input" name="texto" placeholder="Anotar (ligação, orçamento enviado…)"><button class="btn">Anotar</button></form>
        <div class="list">${linha.map((x) => `<div class="li"><span class="avatar">${icon(x.ic)}</span><div class="grow"><div class="small">${x.t}</div><div class="s">${quando(x.em)}</div></div></div>`).join('') || empty('Sem histórico ainda.')}</div></div>
      <div class="col">
        <div class="card col"><h2>Etapa</h2><select class="input" data-onchange="etapa" data-id="${c.id}">${D.ETAPAS.map((e) => `<option value="${e.id}" ${e.id === c.etapa ? 'selected' : ''}>${e.label}</option>`).join('')}</select>
          <div class="small ink2">Valor do negócio: <b>${c.valorNegocio ? money(c.valorNegocio) : '—'}</b></div></div>
        <div class="card col"><h2>Dados</h2><div class="small ink2">${[['Origem', c.origem], ['E-mail', c.email], ['Última compra', c.ultimaCompra], ['Total gasto', c.totalGasto ? money(c.totalGasto) : ''], ['Etiquetas', (c.tags || []).join(', ')], ['Obs.', c.obs], ['Cadastrado em', date(String(c.criadoEm || '').slice(0, 10))]].filter(([, v]) => v).map(([k, v]) => `<div><span class="muted">${k}:</span> ${esc(v)}</div>`).join('')}</div></div>
        <div class="card col"><h2>Catálogo deste contato</h2><div class="tiny muted">Link com código próprio: os cliques aparecem nesta ficha e no painel.</div><button class="btn ghost" data-act="copiarLink" data-id="${c.id}">${icon('link')} Copiar link</button><a class="btn ghost" target="_blank" rel="noopener" href="${linkCatalogo(c)}">Abrir como ${esc(D.primeiroNome(c.nome))}</a></div>
      </div>
    </div>`, { back: true });
}

// ---------- Campanhas ----------
function lerFiltros() {
  const f = document.getElementById('fcamp');
  const marcados = (n) => [...f.querySelectorAll(`[name="${n}"]:checked`)].map((x) => x.value);
  return { segmentos: marcados('seg'), etapas: marcados('etapa'), origens: marcados('origem'), pularDias: +f.pular.value || 0 };
}
function modalCampanha() {
  const s = S();
  const chk = (n, v, rot, on) => `<label class="chip ${on ? 'on' : ''}" style="display:inline-flex;gap:6px;align-items:center"><input type="checkbox" name="${n}" value="${esc(v)}" ${on ? 'checked' : ''} data-onchange="contar" style="display:none">${esc(rot)}</label>`;
  const ativos = s.modelos.filter((m) => m.ativo !== false);
  modal({ title: 'Nova campanha', wide: true, body: `<form id="fcamp" class="col">
    <div class="grid g2"><label class="field"><span>Nome</span><input class="input" name="nome" placeholder="Ex.: Natal · clientes" required></label>
      <label class="field"><span>Modelo de mensagem</span><select class="input" name="modelo" data-onchange="contar">${ativos.map((m) => `<option value="${m.id}">${esc(m.nome)}</option>`).join('')}</select></label></div>
    <div class="field"><span>Segmentos (nenhum = todos)</span><div class="chips">${D.SEGMENTOS.map((x) => chk('seg', x.id, x.label, false)).join('')}</div></div>
    <div class="field"><span>Etapas (nenhuma = todas, exceto vendido e não contatar)</span><div class="chips">${D.ETAPAS.filter((e) => !['ganho', 'nao_contatar'].includes(e.id)).map((e) => chk('etapa', e.id, e.label, false)).join('')}</div></div>
    ${origens(s).length ? `<div class="field"><span>Origens</span><div class="chips">${origens(s).map((o) => chk('origem', o, o, false)).join('')}</div></div>` : ''}
    <label class="field"><span>Não enviar para quem recebeu mensagem nos últimos (dias)</span><input class="input" type="number" name="pular" value="7" min="0" data-onchange="contar" style="width:120px"></label>
    <div id="camp-prev"></div></form>`,
    foot: '<button class="btn ghost" data-act="close">Cancelar</button><button class="btn" data-act="ok">Criar campanha</button>',
    onMount: () => setTimeout(() => contar(), 0),
    handlers: { ok: () => {
      const f = document.getElementById('fcamp'); const nome = f.nome.value.trim(); if (!nome) return toast('Dê um nome à campanha');
      const filtros = lerFiltros(); const alvo = D.publico(S(), filtros);
      if (!alvo.length) return toast('Nenhum contato com esses filtros');
      const camp = { id: uid('cp'), nome, modeloId: f.modelo.value, filtros, destinatarios: Object.fromEntries(alvo.map((c) => [c.id, { status: 'pendente' }])), status: 'rascunho', criadaEm: agora() };
      A.store.commit((s2) => s2.campanhas.push(camp)); closeModal(); location.hash = '#/campanha/' + camp.id;
    } } });
  function contar() {
    document.querySelectorAll('#fcamp .chip').forEach((l) => l.classList.toggle('on', l.querySelector('input').checked));
    const n = D.publico(S(), lerFiltros()).length;
    const m = S().modelos.find((x) => x.id === document.querySelector('#fcamp [name=modelo]').value);
    document.getElementById('camp-prev').innerHTML = `<div class="row top gap-l"><div class="grande">${int(n)}</div><div class="small ink2">contatos vão receber.<br>Envie em ondas (ex.: 100 por vez) e acompanhe a taxa de resposta antes de mandar o resto.</div></div>
      ${m ? `<div class="wa mt-s">${esc(D.renderizar(m.corpo, 'Maria'))}${m.botaoCatalogo ? '\n\n🔗 Ver catálogo' : ''}${(m.respostasRapidas || []).map((r) => `\n↩ ${r}`).join('')}</div>` : ''}`;
  }
  document.getElementById('fcamp')?.addEventListener('change', contar);
}

function statsCampanha(s, camp) {
  const ids = new Set(Object.keys(camp.destinatarios));
  const rows = D.marcos(s, (c) => ids.has(c.id));
  const enviados = Object.values(camp.destinatarios).filter((d) => d.status === 'enviado');
  const msgs = s.mensagens.filter((m) => m.campanhaId === camp.id);
  const lidos = new Set(msgs.filter((m) => m.status === 'lido').map((m) => m.contatoId));
  const resp = rows.filter((r) => r.respondeu).length;
  return { total: ids.size, enviados: enviados.length, pendentes: Object.values(camp.destinatarios).filter((d) => d.status === 'pendente').length, lidos: lidos.size, responderam: resp, ...D.resumo(rows) };
}
function vCampanhas() {
  const s = S();
  const lista = sortBy(s.campanhas, (c) => c.criadaEm, true);
  const ST = { rascunho: ['Rascunho', ''], enviando: ['Enviando', 'warn'], pausada: ['Em ondas', 'info'], concluida: ['Concluída', 'ok'] };
  return A.tela('Campanhas', `${A.pageHead('Campanhas', 'Disparo em ondas, respeitando o limite diário da Meta.', `<button class="btn" data-act="novaCampanha">${icon('plus')} Nova campanha</button>`)}
    <div class="card pad-0"><div class="tbl-wrap"><table class="tbl"><thead><tr><th>Campanha</th><th>Situação</th><th class="r">Público</th><th class="r">Enviados</th><th class="r hide-m">Responderam</th><th class="r hide-m">Vendas</th></tr></thead>
    <tbody>${lista.map((c) => { const st = statsCampanha(s, c); return `<tr class="click" data-act="goto" data-h="#/campanha/${c.id}"><td><b>${esc(c.nome)}</b><div class="tiny muted">${esc(s.modelos.find((m) => m.id === c.modeloId)?.nome || '')} · ${date(String(c.criadaEm).slice(0, 10))}</div></td><td>${badge(...(ST[c.status] || [c.status]))}</td><td class="r">${int(st.total)}</td><td class="r">${int(st.enviados)}</td><td class="r hide-m">${int(st.responderam)} (${st.enviados ? percent(st.responderam / st.enviados) : '—'})</td><td class="r hide-m">${int(st.ganhos)}</td></tr>`; }).join('') || `<tr><td colspan="6">${empty('Nenhuma campanha ainda.', 'spark')}</td></tr>`}</tbody></table></div></div>`);
}
function vCampanha({ id }) {
  const s = S();
  const camp = s.campanhas.find((c) => c.id === id);
  if (!camp) return A.tela('Campanha', empty('Campanha não encontrada'), { back: true });
  const st = statsCampanha(s, camp);
  const modelo = s.modelos.find((m) => m.id === camp.modeloId);
  const hojeEnv = s.mensagens.filter((m) => m.direcao === 'out' && m.tipo === 'modelo' && String(m.em).slice(0, 10) === today()).length;
  const limite = +s.meta.limiteDiario || 250;
  const dest = Object.entries(camp.destinatarios).slice(0, 300);
  return A.tela(camp.nome, `${A.pageHead(esc(camp.nome), `Modelo ${esc(modelo?.nome || '—')} · criada em ${date(String(camp.criadaEm).slice(0, 10))}`, `<button class="btn ghost" data-act="apagarCampanha" data-id="${id}" style="color:var(--crit)">${icon('trash')}</button>`)}
    <div class="grid g4">${kpi('Enviados', `${int(st.enviados)} / ${int(st.total)}`, `${int(st.pendentes)} pendentes`)}${kpi('Leram', int(st.lidos), st.enviados ? percent(st.lidos / st.enviados) : '—')}${kpi('Responderam', int(st.responderam), st.enviados ? percent(st.responderam / st.enviados) : '—')}${kpi('Vendas', int(st.ganhos), money0(st.faturamento))}</div>
    ${st.pendentes ? `<div class="card mt col"><h2>Enviar próxima onda</h2>
      <div class="small ink2">Hoje já saíram <b>${int(hojeEnv)}</b> de ${int(limite)} mensagens (limite diário da Meta). ${whatsappAtivo() ? '' : '<b>Modo simulação:</b> nada sai de verdade.'}</div>
      <div class="row wrap"><input class="input" id="nonda" type="number" min="1" value="${Math.max(1, Math.min(100, st.pendentes, limite - hojeEnv))}" style="width:110px"><button class="btn" data-act="onda" data-id="${id}">${icon('whatsapp')} Enviar onda</button></div></div>` : ''}
    <div class="grid g2 mt"><div class="card"><div class="head"><h2>Mensagem</h2></div><div class="wa">${esc(D.renderizar(modelo?.corpo, 'Maria'))}</div></div>
      <div class="card pad-0"><div style="padding:16px 16px 0"><h2>Destinatários</h2></div><div class="tbl-wrap"><table class="tbl"><tbody>${dest.map(([cid, d]) => { const c = D.contato(s, cid); return `<tr class="click" data-act="goto" data-h="#/contato/${cid}"><td>${esc(c?.nome || '—')}</td><td>${badge(d.status, d.status === 'enviado' ? 'ok' : d.status === 'falhou' ? 'crit' : '')}</td><td>${c ? etapaBadge(c.etapa) : ''}</td></tr>`; }).join('')}</tbody></table></div></div></div>`, { back: true });
}
async function enviarOnda(id, n) {
  if (!(n > 0)) return toast('Informe quantos enviar');
  if (whatsappAtivo()) {
    try { const r = await A.store.funcao('golden-whatsapp', { acao: 'onda', campanhaId: id, n }); toast(`Onda enviada: ${r.enviados} enviados${r.falhas ? `, ${r.falhas} falharam` : ''}`); await A.store.recarregar(); } catch (e) { toast('Falha no envio: ' + e.message); }
    return;
  }
  let r; A.store.commit((s) => { r = D.enviarOnda(s, s.campanhas.find((c) => c.id === id), n); });
  toast(`Simulação: ${r.enviados} mensagens registradas${r.restantes ? `, faltam ${r.restantes}` : ''}`);
}

// ---------- Conversas ----------
function vConversas({ id }) {
  const s = S();
  const ultima = new Map();
  for (const m of s.mensagens) if (!ultima.get(m.contatoId) || m.em > ultima.get(m.contatoId).em) ultima.set(m.contatoId, m);
  const lista = sortBy(s.contatos.filter((c) => ultima.has(c.id)), (c) => (c.naoLida ? '1' : '0') + (ultima.get(c.id)?.em || ''), true).slice(0, 200);
  const c = id ? D.contato(s, id) : null;
  if (c?.naoLida) setTimeout(() => A.store.commit((s2) => { D.contato(s2, id).naoLida = false; }), 400);
  const msgs = c ? sortBy(s.mensagens.filter((m) => m.contatoId === id), (m) => m.em) : [];
  const janela = D.dentro24h(c);
  const listaHTML = `<div class="card pad-0 ${c ? 'hide-m' : ''}" style="max-height:75vh;overflow-y:auto"><div class="list" style="padding:0 14px">${lista.map((x) => { const u = ultima.get(x.id); return `<a class="li" href="#/conversa/${x.id}" data-busca="${esc(x.nome)}" style="${x.id === id ? 'background:var(--surface-2);margin:0 -14px;padding-left:14px;padding-right:14px' : ''}"><div class="avatar">${esc(iniciais(x.nome))}</div><div class="grow"><div class="t ellipsis">${esc(x.nome)}</div><div class="s ellipsis">${u.direcao === 'in' ? '' : 'Você: '}${esc(String(u.corpo || '').slice(0, 60))}</div></div>${x.naoLida ? '<span class="badge dot">•</span>' : `<span class="tiny muted">${dateShort(String(u.em).slice(0, 10))}</span>`}</a>`; }).join('') || empty('As conversas aparecem aqui depois da primeira campanha.', 'whatsapp')}</div></div>`;
  const chatHTML = c ? `<div class="col"><div class="row between"><div><a href="#/contato/${c.id}"><b>${esc(c.nome)}</b></a> <span class="small muted">${esc(D.formatarTelefone(c.telefone))}</span> ${etapaBadge(c.etapa)}</div><a href="#/conversas" class="btn ghost sm hide-d">${icon('arrowL')}</a></div>
      <div class="chat">${msgs.map((m) => `<div class="bolha ${m.direcao}">${esc(m.corpo)}<div class="m">${quando(m.em)}${m.direcao === 'out' ? ` · ${esc(m.status)}${m.simulado ? ' (sim.)' : ''}` : ''}</div></div>`).join('') || '<div class="muted small center">Sem mensagens.</div>'}</div>
      ${c.naoContatar ? '<div class="aviso crit">Pediu para não receber mensagens.</div>' : janela ? `<form class="row" data-onsubmit="enviarTexto" data-id="${c.id}"><input class="input" name="texto" placeholder="Escreva uma resposta…" autocomplete="off"><button class="btn">${icon('arrowR')}</button></form><div class="tiny muted">Janela de 24h aberta: pode responder com texto livre.</div>`
        : `<div class="aviso">${icon('clock')}<span class="grow">Fora da janela de 24h do WhatsApp: só dá para enviar um modelo aprovado.</span><button class="btn sm" data-act="enviarModelo" data-id="${c.id}">Enviar modelo</button></div>`}
      ${whatsappAtivo() ? '' : `<button class="btn ghost sm" data-act="simular" data-id="${c.id}" style="align-self:flex-start">${icon('spark')} Simular resposta do cliente</button>`}</div>` : `<div class="card hide-m">${empty('Escolha uma conversa.', 'whatsapp')}</div>`;
  return A.tela('Conversas', `${c ? '' : A.pageHead('Conversas', `${plural(s.contatos.filter((x) => x.naoLida).length, 'conversa')} esperando resposta`, A.busca('Buscar…'))}<div class="grid g-2-1" style="grid-template-columns:minmax(0,1fr) minmax(0,2fr)">${listaHTML}${chatHTML}</div>`);
}
async function enviarTexto(f) {
  const texto = f.texto.value.trim(); if (!texto) return;
  const cid = f.dataset.id;
  if (whatsappAtivo()) { try { await A.store.funcao('golden-whatsapp', { acao: 'texto', contatoId: cid, texto }); await A.store.recarregar(); } catch (e) { return toast('Falha no envio: ' + e.message); } return; }
  A.store.commit((s) => { const c = D.contato(s, cid); s.mensagens.push({ id: uid('mg'), contatoId: cid, direcao: 'out', tipo: 'texto', corpo: texto, status: 'enviado', simulado: true, em: agora() }); c.naoLida = false; c.ultimaInteracao = agora(); });
}
function enviarModeloAvulso(cid) {
  const s = S();
  modal({ title: 'Enviar modelo', body: `<form id="fmd" class="col"><select class="input" name="m">${s.modelos.filter((m) => m.ativo !== false).map((m) => `<option value="${m.id}">${esc(m.nome)}</option>`).join('')}</select></form>`,
    foot: '<button class="btn" data-act="ok">Enviar</button>', handlers: { ok: async () => {
      const mid = document.querySelector('#fmd [name=m]').value;
      if (whatsappAtivo()) { try { await A.store.funcao('golden-whatsapp', { acao: 'modelo', contatoId: cid, modeloId: mid }); closeModal(); await A.store.recarregar(); } catch (e) { toast('Falha no envio: ' + e.message); } return; }
      A.store.commit((s2) => { const c = D.contato(s2, cid); const m = s2.modelos.find((x) => x.id === mid); s2.mensagens.push({ id: uid('mg'), contatoId: cid, direcao: 'out', tipo: 'modelo', modelo: m.nome, corpo: D.renderizar(m.corpo, c.nome), status: 'enviado', simulado: true, em: agora() }); D.avancar(s2, c, 'enviado', 'modelo avulso'); });
      closeModal(); toast('Modelo registrado (simulação)');
    } } });
}

// ---------- Catálogo e modelos ----------
function vCatalogo() {
  const s = S();
  const cliq = (pid) => s.cliques.filter((k) => k.produtoId === pid).length;
  return A.tela('Catálogo', `${A.pageHead('Catálogo', `${plural(s.produtos.filter((p) => p.ativo !== false).length, 'produto')} no catálogo público. Cada cliente recebe um link com código próprio.`, `<a class="btn ghost" target="_blank" rel="noopener" href="${linkCatalogo()}">${icon('link')} Ver catálogo</a><button class="btn" data-act="novoProduto">${icon('plus')} Produto</button>`)}
    <div class="grid g4">${sortBy(s.produtos, (p) => (+p.ordem || 0)).map((p) => `<a class="card col ${p.ativo === false ? 'li off' : ''}" href="#" data-act="editarProduto" data-id="${p.id}" style="color:inherit;gap:6px;padding:12px">
      ${p.imagem ? `<img src="${esc(p.imagem)}" alt="" loading="lazy" style="width:100%;aspect-ratio:1;object-fit:cover;border-radius:10px;background:var(--surface-2)">` : ''}
      <div class="small"><b>${esc(p.nome)}</b></div><div class="row between"><span class="tiny muted">${esc(p.categoria)}</span>${p.selo ? badge(p.selo, 'opp') : ''}</div>
      <div class="row between"><b class="num">${p.precoPromo ? `<s class="muted small">${money(p.preco)}</s> ${money(p.precoPromo)}` : money(p.preco)}</b><span class="tiny muted">${plural(cliq(p.id), 'clique')}</span></div></a>`).join('')}</div>`);
}
function editarModelo(doc) {
  const comResp = doc ? { ...doc, respostas: (doc.respostasRapidas || []).join(', ') } : null;
  editar({ titulo: 'Modelo de mensagem', colecao: 'modelos', campos: CAMPOS_MODELO, doc: comResp, prefixo: 'md',
    extra: '<div class="tiny muted mt">Prévia aparece na lista de modelos. Depois de criar aqui, cadastre o modelo com o mesmo nome no WhatsApp Manager da Meta (veja docs/ESTRATEGIA.md).</div>',
    antesDeSalvar: (m) => { m.respostasRapidas = String(m.respostas || '').split(',').map((x) => x.trim()).filter(Boolean); delete m.respostas; m.idioma ||= 'pt_BR'; if (!/^[a-z0-9_]+$/.test(m.nome)) return 'Nome só com letras minúsculas, números e _ (regra da Meta)'; } });
}
function vModelos() {
  const s = S();
  return A.tela('Mensagens', `${A.pageHead('Modelos de mensagem', 'Os modelos precisam estar aprovados na Meta com o mesmo nome. {{1}} vira o primeiro nome do contato.', `<button class="btn" data-act="novoModelo">${icon('plus')} Modelo</button>`)}
    <div class="grid g2">${s.modelos.map((m) => `<div class="card col ${m.ativo === false ? 'li off' : ''}"><div class="row between"><b>${esc(m.nome)}</b><button class="btn ghost sm" data-act="editarModelo" data-id="${m.id}">${icon('edit')}</button></div>
      <div class="tiny muted">${m.segmento ? 'Sugerido para: ' + esc(D.SEG[m.segmento]?.label) : 'Qualquer segmento'}</div>
      <div class="wa">${esc(D.renderizar(m.corpo, 'Maria'))}${m.botaoCatalogo ? '\n\n🔗 Ver catálogo' : ''}${(m.respostasRapidas || []).map((r) => `\n↩ ${esc(r)}`).join('')}</div></div>`).join('') || empty('Nenhum modelo.')}</div>`);
}

A.iniciar();
