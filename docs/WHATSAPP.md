# Conectar o WhatsApp oficial (Cloud API da Meta)

Enquanto isso não for feito, o Golden CRM fica em **modo simulação** (tudo funciona, nada sai de verdade).

1. **Meta**: no Meta for Developers, crie o app (tipo *Business*), adicione o produto **WhatsApp** e cadastre o número da Golden.
   Anote o **Phone number ID** e gere um **token permanente** (usuário do sistema no Business Manager, permissão `whatsapp_business_messaging`).
2. **Modelos**: cadastre no WhatsApp Manager os modelos com os mesmos nomes da tela *Mensagens* (passo a passo em `docs/ESTRATEGIA.md`).
   Botão de URL dinâmica: `https://rodrigopiratini.github.io/Golden/catalogo/?c={{1}}`.
3. **Função no Supabase** (projeto easyapp-fabrica › *Edge Functions*):
   - crie a função `golden-whatsapp` com o código de `supabase/functions/golden-whatsapp/index.ts` e **desligue "Verify JWT"**;
   - em *Secrets*, cadastre `WHATSAPP_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_APP_SECRET` (App › Configurações › Básico) e `WHATSAPP_VERIFY_TOKEN` (uma senha que você inventa).
4. **Webhook na Meta**: URL `https://sizbmkvzcqiukprdlxxr.supabase.co/functions/v1/golden-whatsapp`, token de verificação = `WHATSAPP_VERIFY_TOKEN`, assine o campo **messages**.
5. **Ligar no app**: no SQL Editor, rode
   `update golden.docs set data = data || '{"whatsappAtivo": true}' where colecao = 'config' and id = 'geral';`
   A partir daí as campanhas, respostas e modelos avulsos passam pela função (e o botão "Simular resposta" some).

A função ainda não foi testada contra a Meta: faça o primeiro envio para o seu próprio número antes de disparar uma campanha.
