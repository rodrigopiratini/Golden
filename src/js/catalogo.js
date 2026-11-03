// Catálogo público (sem login). Link de cada cliente: catalogo/?e=<empresa>&c=<código do contato>.
// Mostra os produtos ativos, registra visita e cliques ("Quero este" / "Comprar no site") e abre o WhatsApp da loja.
import { CONFIG } from './config.js';
import { SEGMENTO } from './segmento.js';
import { money, esc, uid } from './core/fmt.js';
import { icon, waLink } from './core/ui.js';

const q = new URLSearchParams(location.search);
const demo = q.has('demo') || !CONFIG.supabaseUrl;
const emp = q.get('e') || null, tok = q.get('c') || null;
const app = document.getElementById('app');
let sb = null, store = null;

async function carregar() {
  if (demo) {
    store = await import('./core/store.js');
    const s = store.get();
    const c = tok && s.contatos.find((x) => x.token === tok);
    return { empresa: s.meta.empresa, config: { whatsapp: s.meta.whatsapp, siteUrl: s.meta.siteUrl }, contato: c ? { nome: c.nome.split(' ')[0] } : null, produtos: s.produtos.filter((p) => p.ativo !== false) };
  }
  sb = window.supabase.createClient(CONFIG.supabaseUrl, CONFIG.supabaseKey, { db: { schema: SEGMENTO.schema }, auth: { persistSession: false } });
  const { data, error } = await sb.rpc('catalogo_publico', { p_empresa: emp, p_token: tok });
  if (error) throw error;
  return data;
}
function registrar(tipo, produtoId) {
  if (demo) {
    const s = store.get(); const c = tok && s.contatos.find((x) => x.token === tok);
    store.commit((st) => {
      st.cliques.push({ id: uid('ck'), tipo, contatoId: c?.id || null, produtoId: produtoId || null, em: new Date().toISOString() });
      const cc = c && st.contatos.find((x) => x.id === c.id);
      if (cc && tipo !== 'visita' && !['interessado', 'negociando', 'ganho', 'perdido', 'nao_contatar'].includes(cc.etapa)) {
        st.atividades.push({ id: uid('at'), contatoId: cc.id, tipo: 'etapa', texto: 'Clicou em produto no catálogo → Interessado', em: new Date().toISOString() });
        cc.etapa = 'interessado';
      }
    });
    return;
  }
  sb.rpc('registrar_clique', { p_empresa: emp, p_token: tok, p_produto: produtoId || null, p_tipo: tipo }).then(({ error }) => error && console.warn(error.message));
}

function pintar(d) {
  const nome = d.contato?.nome;
  const cats = [...new Set(d.produtos.map((p) => p.categoria))];
  app.innerHTML = `<div class="cat-top"><img src="../assets/brand/logo-white.png" alt="${esc(d.empresa)}"><div class="ola">${nome ? `Olá, ${esc(nome)}! Separamos estas peças para você.` : 'Peças de madeira feitas em Flores da Cunha (RS).'}</div></div>
    <div class="cat">${cats.map((cat) => `<h2 class="mt mb">${esc(cat)}</h2><div class="cat-grid">${d.produtos.filter((p) => p.categoria === cat).map((p) => `<div class="cat-card">
      ${p.imagem ? `<img src="${esc(p.imagem)}" alt="${esc(p.nome)}" loading="lazy">` : ''}
      <div class="in">${p.selo ? `<span class="badge opp" style="align-self:flex-start">${esc(p.selo)}</span>` : ''}<div class="n">${esc(p.nome)}</div>
        <div class="p">${p.precoPromo ? `<s class="muted small">${money(p.preco)}</s> ${money(p.precoPromo)}` : money(p.preco)}</div>
        <div class="acoes"><a class="btn wa" href="#" data-q="${esc(p.id)}">${icon('whatsapp')} Quero este</a>${p.urlSite ? `<a class="btn ghost sm" href="${esc(p.urlSite)}" target="_blank" rel="noopener" data-s="${esc(p.id)}">Comprar no site</a>` : ''}</div></div></div>`).join('')}</div>`).join('')}
      <div class="tiny muted center mt" style="padding:24px 0">${esc(d.empresa)}</div></div>`;
  app.addEventListener('click', (e) => {
    const a = e.target.closest('[data-q]'); const s = e.target.closest('[data-s]');
    if (s) registrar('site', s.dataset.s);
    if (!a) return;
    e.preventDefault();
    const p = d.produtos.find((x) => x.id === a.dataset.q);
    registrar('whatsapp', p.id);
    location.href = waLink(d.config?.whatsapp, `Olá! ${nome ? `Sou ${nome}. ` : ''}Tenho interesse no produto "${p.nome}" (${money(p.precoPromo || p.preco)}) que vi no catálogo.`);
  });
}

carregar().then((d) => {
  if (!d) { app.innerHTML = '<div class="cat-top">Catálogo não encontrado.</div>'; return; }
  pintar(d); registrar('visita');
}).catch((e) => { console.warn(e); app.innerHTML = '<div class="cat-top">Não foi possível abrir o catálogo agora. Tente de novo em instantes.</div>'; });
