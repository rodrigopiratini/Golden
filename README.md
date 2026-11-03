# Golden CRM

Plataforma de contatos e vendas da **Golden Artefatos de Madeira**: transforma a lista de clientes e de contatos de feiras em
vendas, com disparo pelo **WhatsApp oficial (Cloud API da Meta)**, catálogo com botão "Quero este", funil e painel de indicadores.

Feito a partir do molde da fábrica de apps EasyApp (`docs/FABRICA.md`): HTML/JS puro publicado no GitHub Pages e banco no
projeto Supabase **easyapp-fabrica**, pasta `golden`. Sem servidor próprio e sem Vercel.

| Tela | O que faz |
|---|---|
| **Painel** | Abordados, taxa de resposta, vendas e faturamento; funil (enviado → entregue → lido → respondeu → interessado → comprou); desempenho por segmento e por origem (qual feira vende mais); produtos mais clicados; quem espera resposta e quem precisa de follow-up |
| **Funil** | Arrastar e soltar entre as 9 etapas. Os contatos também andam sozinhos: leu → Lido, respondeu → Respondeu, clicou em produto → Interessado |
| **Contatos** | Importação de planilha (.xlsx/.csv) com reconhecimento das colunas, correção de telefones e união de repetidos; filtros; exportação; ficha com linha do tempo |
| **Campanhas** | Modelo + público (segmento, etapa, origem, sem quem recebeu há pouco) e envio **em ondas**, respeitando o limite diário da Meta |
| **Conversas** | Caixa de entrada; respeita a janela de 24h do WhatsApp (fora dela, só modelo aprovado) |
| **Catálogo** | Página pública (`/catalogo/`) com os produtos. Cada cliente recebe um link com código próprio; cliques entram na ficha e no painel |
| **Mensagens** | Modelos com prévia igual ao WhatsApp |
| **Opt-out automático** | "Não tenho interesse", "SAIR", "PARAR"… tiram o contato da lista e enviam uma resposta educada |

**Modo simulação:** enquanto o WhatsApp não estiver conectado, tudo funciona, mas nada sai de verdade. Em Conversas aparece
"Simular resposta do cliente". Para conectar: [`docs/WHATSAPP.md`](docs/WHATSAPP.md). Estratégia da campanha de Natal: [`docs/ESTRATEGIA.md`](docs/ESTRATEGIA.md).

Demonstração: `/gestao/?demo=1` (PIN `0000`) · catálogo de demonstração: `/catalogo/?demo=1`.
