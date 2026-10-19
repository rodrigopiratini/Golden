# Golden CRM

Plataforma de gestão de contatos da **Golden Artefatos de Madeira**: transforma a lista de clientes e contatos de feiras em leads, com disparo pelo **WhatsApp oficial (Cloud API da Meta)**, catálogo com botão "Quero este", funil em kanban e dashboard de indicadores.

## O que tem

| Módulo | O que faz |
|---|---|
| **Dashboard** | Contatos, abordados, taxa de resposta, vendas e faturamento; funil (enviado → entregue → lido → respondeu → interessado → comprou); desempenho por segmento e por origem (qual feira vende mais); produtos mais clicados; quem está esperando resposta e quem precisa de follow-up |
| **Funil (Kanban)** | Arrastar e soltar entre etapas. Os contatos também andam sozinhos: leu a mensagem → *Lido*, respondeu → *Respondeu*, clicou em produto → *Interessado* |
| **Contatos** | Importação de planilha (.xlsx/.csv) com reconhecimento automático das colunas, normalização de telefones, deduplicação, filtros, exportação e ficha com linha do tempo |
| **Campanhas** | Escolhe o modelo de mensagem e o público (segmento, etapa, origem) e dispara **em ondas** (ex.: 100 por vez), respeitando o limite diário da Meta |
| **Conversas** | Caixa de entrada para responder os clientes. Respeita a janela de 24h do WhatsApp; fora dela, oferece enviar um modelo aprovado |
| **Catálogo** | Página pública com os 26 produtos do site (fotos, preços, promoções). Cada cliente recebe um link com código próprio: os cliques ficam registrados na ficha e no dashboard. Botões **Quero este** (abre o WhatsApp da Golden com a mensagem pronta) e **Comprar no site** |
| **Mensagens** | Modelos (templates) com pré-visualização igual ao WhatsApp. Já vêm 4 prontos: clientes, feiras, empresas/lojistas e follow-up |
| **Opt-out automático** | "Não tenho interesse", "SAIR", "PARAR" etc. tiram o contato da lista e enviam uma resposta educada (LGPD + reputação do número) |

**Modo simulação:** enquanto o WhatsApp não estiver conectado, tudo funciona, mas nada é enviado de verdade. Na tela de conversa aparece o botão "Simular resposta do cliente" para testar o fluxo inteiro.

## Tecnologia

Next.js 15 (App Router) · TypeScript · Tailwind CSS 4 · Prisma · PostgreSQL · dnd-kit.

## Rodar localmente

```bash
cp .env.example .env          # ajuste DATABASE_URL, AUTH_SECRET, ADMIN_EMAIL/ADMIN_PASSWORD
npm install
npx prisma migrate deploy     # cria as tabelas
npm run seed                  # usuário admin + produtos do site + modelos de mensagem
npm run seed:demo             # (opcional) 120 contatos fictícios para ver o dashboard
npm run dev                   # http://localhost:3000
```

Para remover os contatos de demonstração: `npm run seed:demo -- --clean`.

## Publicar (Vercel + Supabase)

1. **Banco (Supabase):** em *Connect → ORMs → Prisma*, copie as duas URLs. Acrescente `&schema=golden_crm` (ou `?schema=golden_crm`) nas duas. As tabelas ficam isoladas nesse schema, então dá para usar um projeto Supabase que já existe.
   - `DATABASE_URL` = pooler de transação (porta 6543, com `pgbouncer=true`)
   - `DIRECT_URL` = pooler de sessão (porta 5432)
2. **App (Vercel):** importe o repositório e cadastre as variáveis do `.env.example`. `APP_URL` é opcional: sem ela, usa o domínio da Vercel.
3. O build da Vercel (`npm run vercel-build`) cria/atualiza as tabelas e roda o seed sozinho.
4. Entre com `ADMIN_EMAIL` / `ADMIN_PASSWORD` e troque a senha em **Configurações**.

## Conectar o WhatsApp (Cloud API oficial)

1. Em [business.facebook.com](https://business.facebook.com), crie ou verifique o **Business Manager** da Golden (CNPJ 32.383.152/0001-07).
2. Em [developers.facebook.com](https://developers.facebook.com) → *Criar app* → tipo **Empresa** → adicione o produto **WhatsApp**.
3. Adicione o **número** que fará os disparos. Ele não pode estar ativo no app do WhatsApp; use um chip novo ou migre o número atual.
4. Gere um **token permanente** (Usuário do sistema no Business Manager, com as permissões `whatsapp_business_messaging` e `whatsapp_business_management`).
5. Preencha no ambiente: `WHATSAPP_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_BUSINESS_ACCOUNT_ID`, `WHATSAPP_APP_SECRET` (*Configurações do app → Básico → Chave secreta*) e `WHATSAPP_VERIFY_TOKEN` (qualquer texto).
6. Em *WhatsApp → Configuração → Webhook*, use a URL `APP_URL/api/webhooks/whatsapp` e o mesmo verify token. Assine o campo **messages**.
7. Crie os **modelos de mensagem** no WhatsApp Manager com os mesmos nomes da tela *Mensagens* (veja [docs/ESTRATEGIA.md](docs/ESTRATEGIA.md)).

A tela **Configurações** mostra o que já está preenchido.

## Estrutura

```
prisma/            schema, migrations, seed (produtos do site e modelos)
src/app/(app)/     telas internas (dashboard, kanban, contatos, conversas, campanhas…)
src/app/catalogo   catálogo público
src/app/r/p/[id]   link rastreado "Quero este" / "Comprar no site"
src/app/api/       webhook do WhatsApp, exportação de contatos
src/lib/           WhatsApp, funil, campanhas, importação, métricas
```
