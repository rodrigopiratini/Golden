# Situação — Golden CRM (03/11/2026)

- **Refeito no molde EasyAPP-Base** em 03/11/2026 (o app antigo em Next.js/Vercel fica no histórico do Git). Sem servidor próprio.
- **No ar:** https://rodrigopiratini.github.io/Golden/gestao/ · catálogo público `/catalogo/` · demo `/gestao/?demo=1` (PIN 0000)
- **Banco:** Supabase › EasyAPP › **EasyAPP-Fábrica** (`sizbmkvzcqiukprdlxxr`), pasta **`golden`** (Exposed schemas: golden). Teste de 365 dias.
- **WhatsApp:** modo simulação. A função `supabase/functions/golden-whatsapp` está escrita mas **não testada** contra a Meta (docs/WHATSAPP.md).
- **Publicação:** push na `main` (GitHub Pages por Actions).

## Pendências
- Primeira entrada: Criar conta › Criar minha empresa "Golden Artefatos de Madeira" (o catálogo e os 4 modelos entram sozinhos).
- Apagar o projeto `golden-crm` na Vercel e o projeto pausado Golden-CRM / organização Golden no Supabase.
- Conectar a Cloud API da Meta e testar a função com o próprio número.
