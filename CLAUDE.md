# Golden CRM — instruções para o Claude

- App de segmento criado a partir do molde `easyapp-base` (veja `docs/FABRICA.md`); banco no projeto Supabase easyapp-fabrica, pasta `golden`.
  **Não edite o núcleo aqui** (`src/js/core/`, `supabase/base.sql`, `sw.js`, `.github/workflows/pages.yml`, `scripts/`): mude no `easyapp-base`
  e traga com `bash scripts/atualizar-base.sh ../Golden` (rodado a partir do easyapp-base).
- O que é da Golden: `src/js/segmento.js`, `src/js/dominio.js`, `src/js/gestao/app.js`, `src/js/catalogo.js` + `catalogo/`, `src/js/seed.js`,
  `src/js/produtos.js`, `src/css/segmento.css`, `supabase/segmento.sql` (catálogo público) e `supabase/functions/golden-whatsapp/` (WhatsApp oficial).
- Banco: depois de mudar `segmento.sql` ou as coleções, rode `node supabase/gerar.mjs` (gera `supabase/instalar.sql`, que o dono cola no SQL Editor; é idempotente).
- **Sempre publicar**: commit, push na branch de trabalho e na `main` (o GitHub Pages publica a partir da `main`).
- Nunca coloque token da Meta, e-mail, telefone ou chave secreta em arquivo do repositório (segredos da Meta ficam nos Secrets da Edge Function).
