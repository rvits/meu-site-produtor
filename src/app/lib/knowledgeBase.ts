// Base de conhecimento estruturada do site THouse Rec
// Esta base é usada pelo sistema RAG para fornecer contexto à IA

export interface KnowledgeItem {
  id: string;
  category: string;
  content: string;
  metadata?: Record<string, any>;
}

// Serviços do Estúdio
const SERVICOS_ESTUDIO = [
  { id: "sessao", nome: "Sessão", preco: 40 },
  { id: "captacao", nome: "Captação", preco: 50 },
  { id: "sonoplastia", nome: "Sonoplastia (a partir de)", preco: 320 },
  { id: "mix", nome: "Mixagem", preco: 110 },
  { id: "master", nome: "Masterização", preco: 60 },
  { id: "mix_master", nome: "Mix + Master", preco: 160 },
];

// Beats e Pacotes
const BEATS_PACOTES = [
  { id: "beat1", nome: "1 Beat", preco: 150 },
  { id: "beat2", nome: "2 Beats", preco: 250 },
  { id: "beat3", nome: "3 Beats", preco: 350 },
  { id: "beat4", nome: "4 Beats", preco: 400 },
  { id: "beat_mix_master", nome: "Beat + Mix + Master", preco: 280 },
  {
    id: "producao_completa",
    nome: "Produção Completa (4h + beat + mix + master)",
    preco: 400,
  },
];

// Planos
const PLANOS = [
  {
    id: "bronze",
    nome: "Plano Bronze",
    mensal: 149.99,
    anual: 1499.99,
    descricao: "Para quem está começando a gravar com frequência.",
    beneficios: [
      "2h de captação por mês",
      "1 Mix & Master",
      "10% de desconto em serviços avulsos",
    ],
    naoInclui: [
      "Sem beats personalizados",
      "Sem acesso a descontos promocionais",
      "Não possui acompanhamento artístico",
    ],
  },
  {
    id: "prata",
    nome: "Plano Prata",
    mensal: 349.99,
    anual: 3499.99,
    descricao: "Para artistas que gravam com regularidade e já possuem músicas próprias.",
    beneficios: [
      "2h de captação por mês",
      "2 Mix & Master por mês",
      "1 Beat por mês",
      "Acesso a descontos promocionais do site",
      "Prioridade intermediária",
    ],
    naoInclui: [
      "Não tem desconto em serviços ou beats",
      "Não tem acompanhamento artístico",
    ],
  },
  {
    id: "ouro",
    nome: "Plano Ouro",
    mensal: 549.99,
    anual: 5499.99,
    descricao: "Acompanhamento profissional contínuo com TremV e 1 Produção completa por mês.",
    beneficios: [
      "4 horas de captação por mês",
      "2 mix & master por mês",
      "2 Beat",
      "Desconto de 10% em serviços avulsos",
      "Desconto de 10% em beats",
      "Acesso a descontos promocionais do site",
      "Acompanhamento artístico",
    ],
  },
];

// Horários disponíveis
const HORARIOS_PADRAO = [
  "10:00", "11:00", "12:00", "13:00", "14:00", "15:00",
  "16:00", "17:00", "18:00", "19:00", "20:00", "21:00", "22:00",
];

// Função para construir a base de conhecimento
export function buildKnowledgeBase(): KnowledgeItem[] {
  const items: KnowledgeItem[] = [];

  // Informações gerais do site
  items.push({
    id: "info-geral-1",
    category: "sobre",
    content: `THouse Rec é um estúdio musical profissional que oferece serviços de gravação, produção, mixagem, masterização e criação de beats. O estúdio trabalha com diferentes planos de assinatura e serviços avulsos.`,
  });

  items.push({
    id: "info-geral-2",
    category: "sobre",
    content: `O estúdio oferece agendamento online através do site, onde os clientes podem selecionar serviços, escolher data e horário disponíveis. Os horários disponíveis são: ${HORARIOS_PADRAO.join(", ")}.`,
  });

  items.push({
    id: "sobre-1",
    category: "sobre",
    content: `THouse Rec é o estúdio independente criado por Victor Pereira Ramos (Tremv), produtor musical, artista e engenheiro de áudio nascido em Botafogo, no Rio de Janeiro. A trajetória começou nas batalhas de rima, rodas de freestyle e na cena independente.`,
  });

  items.push({
    id: "sobre-2",
    category: "sobre",
    content: `Victor (Tremv) está cursando Produção Fonográfica (bacharelado) na Estácio, atualmente no 5º período, com previsão de formatura para dezembro de 2026. Essa formação acadêmica se soma à experiência de estúdio.`,
  });

  items.push({
    id: "sobre-3",
    category: "sobre",
    content: `A THouse Rec reúne produções lançadas no YouTube, Spotify e SoundCloud, direção de shows, trabalhos como mestre de cerimônia e consultorias musicais. O estúdio nasceu para ser um espaço criativo, acessível e profissional, onde cada artista é tratado com atenção e cuidado.`,
  });

  // Serviços do Estúdio
  SERVICOS_ESTUDIO.forEach((servico) => {
    items.push({
      id: `servico-${servico.id}`,
      category: "servicos-estudio",
      content: `Serviço: ${servico.nome}. Preço: R$ ${servico.preco.toFixed(2)}.`,
      metadata: { tipo: "estudio", nome: servico.nome, preco: servico.preco },
    });
  });

  // Beats e Pacotes
  BEATS_PACOTES.forEach((beat) => {
    items.push({
      id: `beat-${beat.id}`,
      category: "beats-pacotes",
      content: `Pacote: ${beat.nome}. Preço: R$ ${beat.preco.toFixed(2)}.`,
      metadata: { tipo: "beat", nome: beat.nome, preco: beat.preco },
    });
  });

  // Planos
  PLANOS.forEach((plano) => {
    const beneficiosTexto = plano.beneficios.join(", ");
    const naoIncluiTexto = plano.naoInclui ? plano.naoInclui.join(", ") : "";
    
    items.push({
      id: `plano-${plano.id}`,
      category: "planos",
      content: `${plano.nome}: ${plano.descricao} Preço mensal: R$ ${plano.mensal.toFixed(2)}. Preço anual: R$ ${plano.anual.toFixed(2)}. Benefícios incluídos: ${beneficiosTexto}.${naoIncluiTexto ? ` Não inclui: ${naoIncluiTexto}.` : ""}`,
      metadata: {
        id: plano.id,
        nome: plano.nome,
        mensal: plano.mensal,
        anual: plano.anual,
        descricao: plano.descricao,
      },
    });
  });

  // Informações sobre agendamento
  items.push({
    id: "agendamento-1",
    category: "agendamento",
    content: `Para agendar, é necessário selecionar pelo menos um serviço ou pacote, escolher uma data disponível no calendário e selecionar um horário. É possível combinar múltiplos serviços em um único agendamento.`,
  });

  items.push({
    id: "agendamento-2",
    category: "agendamento",
    content: `Os agendamentos são confirmados após o pagamento via Mercado Pago. O site aceita pagamento por cartão de crédito, débito, Pix e boleto.`,
  });

  // Informações sobre planos
  items.push({
    id: "planos-1",
    category: "planos",
    content: `Existem três planos disponíveis: Bronze (R$ 149,99/mês ou R$ 1.499,99/ano), Prata (R$ 349,99/mês ou R$ 3.499,99/ano) e Ouro (R$ 549,99/mês ou R$ 5.499,99/ano). Todos os planos oferecem benefícios mensais.`,
  });

  items.push({
    id: "planos-2",
    category: "planos",
    content: `Os planos podem ser assinados de forma mensal ou anual. O plano anual oferece desconto comparado ao pagamento mensal ao longo do ano.`,
  });

  // Informações de contato
  items.push({
    id: "contato-1",
    category: "contato",
    content: `Informações de contato da THouse Rec: E-mail: thouse.rec.tremv@gmail.com. WhatsApp: +55 (21) 99129-2544. Localização: Rio de Janeiro (RJ) — Botafogo.`,
  });

  items.push({
    id: "contato-2",
    category: "contato",
    content: `Para assuntos de privacidade e proteção de dados (LGPD), o contato é: thouse.rec.tremv@gmail.com — Rio de Janeiro – RJ.`,
  });

  // Informações sobre termos e contratos
  items.push({
    id: "termos-1",
    category: "termos",
    content: `A THouse Rec possui uma página completa de Termos de Contrato (/termos-contratos) que inclui: Termos de Uso da Plataforma, Política de Privacidade (LGPD), Contrato de Prestação de Serviços de Estúdio, Contrato dos Planos Mensais/Assinaturas, Política de Cancelamento/Remarcação/Reembolso, Autorização de Uso de Imagem/Voz/Obras Musicais, Direitos Autorais e Propriedade Intelectual, Termo de Responsabilidade/Conduta/Uso do Estúdio, e Política de Segurança/Backup/Entrega de Arquivos.`,
  });

  items.push({
    id: "termos-2",
    category: "termos",
    content: `Todos os usuários devem aceitar os Termos de Contrato ao fazer agendamentos ou assinar planos. Os termos estão disponíveis na página /termos-contratos do site.`,
  });

  items.push({
    id: "termos-3",
    category: "termos",
    content: `A política de privacidade (LGPD) explica como a THouse Rec coleta, usa, armazena e protege dados pessoais. Para questões sobre privacidade, o contato é thouse.rec.tremv@gmail.com.`,
  });

  items.push({
    id: "termos-4",
    category: "termos",
    content: `A política de cancelamento define regras para cancelamentos, remarcações, faltas (no-show) e devoluções. Os planos têm regras específicas de renovação e cancelamento.`,
  });

  return items;
}

// Função para buscar itens por categoria
export function getKnowledgeByCategory(category: string): KnowledgeItem[] {
  return buildKnowledgeBase().filter((item) => item.category === category);
}

// Função para buscar itens por termo (busca simples por conteúdo)
export function searchKnowledge(term: string): KnowledgeItem[] {
  const termLower = term.toLowerCase();
  return buildKnowledgeBase().filter((item) =>
    item.content.toLowerCase().includes(termLower)
  );
}
