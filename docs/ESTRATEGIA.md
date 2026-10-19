# Estratégia de abordagem: campanha de Natal

## Segmentos e ordem dos disparos

| Onda | Segmento | Por quê | Modelo |
|---|---|---|---|
| 1 | **Já compraram** | Já conhecem a qualidade e são os que mais respondem | `golden_reativacao_cliente` |
| 2 | **Feira/Evento** | Lembram de ter visto as peças ao vivo | `golden_feira_natal` |
| 3 | **Empresas/Lojistas** | Ticket alto: kits de fim de ano com gravação de logo | `golden_b2b_kits` |
| +3 a 4 dias | Quem **leu e não respondeu** | Um único lembrete, sem insistir | `golden_followup` |

**Ritmo:** primeiro 50 a 100 contatos do segmento 1. Espere de 24 a 48h, olhe a taxa de resposta no dashboard, ajuste o texto se precisar e só então aumente. Números novos na Meta começam com cerca de 250 conversas iniciadas por dia, e o limite sobe conforme a reputação.

## Modelos para cadastrar na Meta

No WhatsApp Manager → *Modelos de mensagem* → *Criar*: categoria **Marketing**, idioma **Português (BR)**, nome **idêntico** ao abaixo.

Em todos:
- Variável `{{1}}` = primeiro nome. A Meta pede um exemplo; use "Maria".
- Botão 1: **Visitar site**, tipo **Dinâmico**, texto "Ver catálogo", URL `https://SEU-DOMINIO/catalogo?c={{1}}`, exemplo `abc123`.
- Botão 2: **Resposta rápida** "Não tenho interesse". A plataforma entende essa resposta e remove o contato da lista.

### golden_reativacao_cliente
```
Oi, {{1}}! Aqui é da Golden Artefatos de Madeira, de Flores da Cunha 🌳

Você já tem uma peça nossa em casa, por isso quisemos mostrar as novidades de Natal primeiro para você: tábuas, petisqueiras, bandejas e peças com gravação personalizada.

Frete grátis acima de R$ 150 para o Sul e o Sudeste.

Toque no botão abaixo para ver o catálogo 👇
```

### golden_feira_natal
```
Oi, {{1}}, tudo bem? Aqui é da Golden Artefatos de Madeira. Nos conhecemos em uma feira e você deixou seu contato com a gente 😊

O Natal está chegando e montamos um catálogo com nossas peças de madeira para presentear (ou para deixar a sua mesa mais bonita): petisqueiras, tábuas de churrasco, bandejas e luminárias.

Veja os modelos e peça direto pelo WhatsApp 👇
```

### golden_b2b_kits
Respostas rápidas: "Quero uma proposta" (move o contato para *Interessado*) e "Não tenho interesse".
```
Olá, {{1}}! Aqui é da Golden Artefatos de Madeira, fábrica em Flores da Cunha (RS).

Estamos fechando pedidos de kits de fim de ano para empresas e lojistas: tábuas, petisqueiras e bandejas de madeira, com gravação da sua marca.

Quer ver o catálogo e receber uma proposta com preço de atacado?
```

### golden_followup
Respostas rápidas: "Quero ajuda" e "Não tenho interesse".
```
Oi, {{1}}! Passando só para saber se você conseguiu ver o nosso catálogo de Natal 🎄

Se quiser, te ajudo a escolher um presente ou montar um kit. É só responder aqui.
```

> Dica: um modelo com **imagem no cabeçalho** (foto bonita de uma mesa posta com as peças) costuma ter mais leitura. Cadastre a imagem na Meta e informe a URL em *Mensagens → Imagem do cabeçalho*.

## Como responder (roteiro rápido)

1. **Responda rápido.** Quem responde em até 1h vende muito mais. Use a tela *Conversas* e o filtro "Só não lidas".
2. **Pergunte para quem é o presente** e sugira de 2 a 3 peças com foto e preço.
3. **Feche com uma ação:** link do produto no site ou pedido pelo WhatsApp com Pix.
4. **Registre:** mova o card para *Negociando* com o valor e depois para *Vendido*. É isso que alimenta o faturamento do dashboard.

## Boas práticas (para não perder o número)

- Nunca envie para quem pediu para sair. A plataforma já bloqueia.
- Não dispare a base inteira de uma vez; prefira ondas.
- Se a taxa de bloqueio subir (a Meta avisa a "qualidade" do número no WhatsApp Manager), pause e revise o texto.
- Custo aproximado: cerca de US$ 0,06 por mensagem de marketing no Brasil. Confirme o valor atual na tabela da Meta.
