// =====================================================================
// SEGMENTO — Golden CRM: contatos, funil e campanhas de WhatsApp da Golden Artefatos de Madeira.
// Este arquivo é lido pelo navegador E pelo supabase/gerar.mjs: só dados, sem importar nada.
// =====================================================================
export const SEGMENTO = {
  id: 'golden-crm',
  schema: 'golden',                      // pasta deste app no banco (projeto easyapp-fabrica)
  nome: 'Golden CRM',
  slogan: 'Contatos de clientes e feiras viram vendas: WhatsApp oficial, catálogo rastreado e funil de vendas.',
  icone: 'whatsapp',
  logo: 'assets/brand/logo-white.png',
  simbolo: 'assets/brand/symbol-white.png',      // ícone do app: o símbolo da marca do cliente
  exclusivo: true,                       // app de um cliente só: sem cadastro livre, teste nem planos

  suporte: { nome: 'EasyApp', whatsapp: '', email: '' },
  plataforma: { admins: [] },
  planos: [],
  diasTeste: 365,

  gestao: { nome: 'Golden CRM', curto: 'CRM', descricao: 'Contatos, funil, campanhas pelo WhatsApp, conversas e catálogo.' },
  usuario: null,                          // sem app de campo: a equipe entra pela Gestão (convite de gestor)

  // Assistente (IA): o que ele precisa saber deste negócio
  assistente: {
    instrucoes: [
      'Golden Artefatos de Madeira: CRM de contatos, funil de vendas, campanhas de WhatsApp e catálogo de produtos.',
      'Contato: nome, telefone no formato do WhatsApp (só dígitos: 55 + DDD + número, ex.: 5554999991234; não repita telefone que já existe), email, cidade, uf,',
      'segmento cliente | feira | b2b | outro, origem (texto), valorNegocio, ultimaCompra, obs, tags (lista). Contato novo: etapa "novo", naoContatar false, tags [] e token = 10 letras/números minúsculos aleatórios.',
      'Etapas do funil: novo, enviado, lido, respondeu, interessado, negociando, ganho (vendido), perdido, nao_contatar. Ao mudar a etapa: atualize etapa e ultimaInteracao (data e hora ISO),',
      'naoContatar = (etapa == nao_contatar), e crie em atividades { contatoId, tipo: "etapa", texto: "Etapa antiga → Etapa nova (assistente)", em: data e hora ISO }. Nota no contato: atividades { contatoId, tipo: "nota", texto, em }.',
      'Nunca proponha contatar quem está em nao_contatar ou naoContatar true. Você NÃO envia mensagens de WhatsApp: para isso o usuário usa a conversa ou as campanhas; você pode sugerir o texto.',
      'Produto (catálogo): nome, categoria (Mesa Posta | Petiscar | Churrasco | Iluminar | Organize | Personalize), selo (NOVO | OFERTA | MAIS VENDIDO), preco, precoPromo, imagem, urlSite, ordem, ativo.',
      'Indicadores do funil por contato (enviado, entregue, lido, respondeu, clicou) estão na coleção calculada marcos_contatos.',
    ].join(' '),
  },

  colecoes: {
    contatos: { nome: 'Contatos' },
    mensagens: { nome: 'Mensagens' },
    modelos: { nome: 'Modelos de mensagem' },
    campanhas: { nome: 'Campanhas' },
    produtos: { nome: 'Catálogo' },
    cliques: { nome: 'Cliques no catálogo' },
    atividades: { nome: 'Linha do tempo' },
  },

  campos: { nome: 'nome', telefone: 'telefone', etapa: 'etapa', segmento: 'segmento', origem: 'origem', valorNegocio: 'valor do negócio', naoContatar: 'não contatar',
    tags: 'etiquetas', obs: 'observações', preco: 'preço', precoPromo: 'preço promocional', ativo: 'ativo', corpo: 'texto', status: 'situação' },
};
