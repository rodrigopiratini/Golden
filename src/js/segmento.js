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

  suporte: { nome: 'EasyApp', whatsapp: '', email: '' },
  plataforma: { admins: [] },
  planos: [],
  diasTeste: 365,

  gestao: { nome: 'Golden CRM', curto: 'CRM', descricao: 'Contatos, funil, campanhas pelo WhatsApp, conversas e catálogo.' },
  usuario: null,                          // sem app de campo: a equipe entra pela Gestão (convite de gestor)

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
