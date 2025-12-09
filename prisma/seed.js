// prisma/seed.js
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

const faqs = [
  // ==========================
  // GER AIS: AGENDAMENTO
  // ==========================
  {
    question: "Não consigo selecionar horário na agenda, o botão não responde.",
    answer:
      "Verifique se você selecionou primeiro uma data no calendário. Os horários só são habilitados depois de escolher um dia válido. Caso o problema continue, limpe o cache do navegador ou teste em aba anônima, pois configurações antigas podem estar interferindo."
  },
  {
    question: "Meu agendamento some depois que eu clico em confirmar.",
    answer:
      "Após confirmar o agendamento, você é redirecionado para a área de planos/pagamentos. O agendamento só é considerado válido depois que essa etapa é concluída. Confira na sua área de usuário se o agendamento aparece na lista e, se não aparecer, refaça o processo confirmando também o pagamento."
  },
  {
    question: "A agenda está toda vazia, não aparecem dias ou horários.",
    answer:
      "Isso pode acontecer quando o navegador bloqueia scripts ou quando há um erro de conexão temporário. Atualize a página, garanta que o JavaScript esteja habilitado e teste em outro navegador ou dispositivo. Se o problema persistir, tire um print e envie para o suporte."
  },
  {
    question: "O site diz que não há horários disponíveis, mas eu vejo dias livres.",
    answer:
      "Os horários são liberados conforme a configuração interna do estúdio. Se aparecer que não há horários, provavelmente esse dia foi bloqueado pelo estúdio ou os horários disponíveis já foram ocupados. Experimente escolher outro dia ou horário, ou entre em contato para confirmar a disponibilidade."
  },
  {
    question: "Eu confirmei a data, mas os horários aparecem em vermelho.",
    answer:
      "Horários em vermelho indicam que já estão ocupados por outros agendamentos. Escolha um horário em verde. Caso todos os horários de um dia estejam em vermelho, selecione outra data na agenda."
  },

  // ==========================
  // PAGAMENTOS / MERCADO PAGO
  // ==========================
  {
    question: "Meu pagamento ficou pendente e não liberou o plano.",
    answer:
      "Pagamentos pendentes geralmente são análises do banco ou do próprio Mercado Pago. Aguarde alguns minutos e atualize a página. Se o status continuar pendente por mais de 30 minutos, verifique no seu extrato do Mercado Pago ou do cartão. Se aparecer como recusado ou cancelado, será necessário tentar novamente."
  },
  {
    question: "O pagamento foi recusado, mas o limite do cartão está ok.",
    answer:
      "A recusa pode ocorrer por regras de segurança do banco emissor ou do Mercado Pago. Tente novamente usando outro cartão, outra forma de pagamento (como Pix ou boleto) ou entre em contato com o seu banco para liberar a transação online."
  },
  {
    question: "Eu paguei, mas não fui redirecionado de volta para o site.",
    answer:
      "Alguns navegadores bloqueiam o redirecionamento automático ou o usuário fecha a aba antes do retorno. Verifique no seu e-mail se o pagamento foi confirmado e depois faça login novamente no site. Se o pagamento estiver aprovado, seu plano ou agendamento deverá aparecer como ativo. Caso contrário, entre em contato com o suporte enviando o comprovante."
  },
  {
    question: "Paguei o plano, mas ele ainda aparece como inativo no site.",
    answer:
      "A ativação do plano depende da confirmação do pagamento e do processamento interno do sistema. Em geral, isso ocorre em poucos minutos. Se já se passaram mais de 30 minutos e nada mudou, atualize a página, faça logout e login novamente. Persistindo o problema, envie o comprovante para o suporte para ativação manual."
  },
  {
    question: "O valor cobrado pelo Mercado Pago foi diferente do valor exibido no site.",
    answer:
      "Diferenças podem ocorrer por taxas de IOF, parcelamento, variação de bandeira ou arredondamento. Verifique o detalhamento da transação no extrato do Mercado Pago ou do cartão. Se a diferença for relevante e não estiver justificada por parcelamento ou taxas, entre em contato com o suporte informando o valor exibido no site e o valor cobrado."
  },
  {
    question: "Não aparece o botão para pagar, apenas uma mensagem de erro.",
    answer:
      "Isso pode ser causado por bloqueio de scripts de terceiros (como bloqueador de anúncios) ou falha ao carregar o SDK do Mercado Pago. Desative bloqueadores de anúncios, atualize a página e teste em outro navegador. Se o erro continuar, envie o print da tela para o suporte."
  },
  {
    question: "Meu pagamento foi cobrado duas vezes.",
    answer:
      "Antes de tudo, verifique se realmente há duas transações aprovadas no extrato. Em alguns casos, uma delas aparece como pendente ou cancelada. Se houver duas cobranças aprovadas para o mesmo serviço ou plano, entre em contato imediatamente com o suporte e com o Mercado Pago, anexando o comprovante das duas operações."
  },
  {
    question: "Não consigo finalizar o pagamento com Pix.",
    answer:
      "Confirme se o seu aplicativo bancário está atualizado e se o QR Code ou link Pix não está expirado. Alguns métodos de Pix têm tempo limite de pagamento. Caso o banco não reconheça o QR Code ou o link, tente gerar um novo pagamento no site ou use outro método, como cartão."
  },
  {
    question: "O site mostra erro ao tentar criar o pagamento.",
    answer:
      "Isso pode ser um erro temporário de comunicação com o Mercado Pago. Feche a página de pagamento, volte para a página de planos ou agendamentos e tente novamente. Se o erro persistir, limpe o cache do navegador ou experimente outro dispositivo."
  },

  // ==========================
  // LOGIN / CONTA
  // ==========================
  {
    question: "Não consigo fazer login na minha conta.",
    answer:
      "Verifique se o e-mail está digitado corretamente e se você está usando a mesma forma de login com que criou a conta (por exemplo, e-mail e senha ou login social). Se esqueceu a senha, utilize a opção de recuperação. Caso não receba e-mail de recuperação, confira a caixa de spam ou tente outro endereço de e-mail."
  },
  {
    question: "Esqueci minha senha e não recebi o e-mail para redefinir.",
    answer:
      "Confira se o e-mail cadastrado está correto e veja também a pasta de spam ou lixo eletrônico. Alguns provedores demoram alguns minutos para entregar o e-mail. Se mesmo assim não receber, tente novamente mais tarde ou entre em contato com o suporte informando o e-mail usado no cadastro."
  },
  {
    question: "Eu consigo acessar pelo computador, mas não pelo celular.",
    answer:
      "Isso pode ser causado por cache ou cookies antigos no celular. Tente limpar os dados do navegador ou usar o modo anônimo. Garanta também que você está acessando o mesmo endereço (URL) em ambos os dispositivos."
  },
  {
    question: "Minha sessão cai toda hora e eu sou deslogado.",
    answer:
      "Por segurança, algumas sessões expiram após um período sem uso. Se isso estiver acontecendo com frequência durante o uso, pode ser bloqueio de cookies pelo navegador. Verifique se o navegador está permitindo cookies para o site e se não está em modo de navegação restrita."
  },
  {
    question: "Não consigo atualizar meus dados de perfil.",
    answer:
      "Alguns campos, como e-mail usado para login ou CPF/CNPJ, podem ter restrições de edição. Se o campo não estiver habilitado, entre em contato com o suporte para solicitar a alteração manual, informando os dados corretos."
  },

  // ==========================
  // AGENDAMENTO + PLANOS
  // ==========================
  {
    question: "Selecionei serviços e pacotes, mas o total estimado não aparece.",
    answer:
      "O total estimado é calculado com base nas quantidades selecionadas. Se estiver aparecendo zerado, verifique se todos os campos de quantidade estão preenchidos com números válidos (0 ou mais) e se não há erro de conexão. Atualize a página e tente selecionar novamente."
  },
  {
    question: "Consigo agendar sem escolher nenhum serviço ou pacote?",
    answer:
      "Não. Para evitar confusão no processo, é necessário selecionar pelo menos um serviço ou pacote antes de confirmar o agendamento. Isso ajuda o estúdio a entender o tipo de sessão que você precisa e a reservar o tempo adequado."
  },
  {
    question: "Como sei se o meu agendamento foi realmente confirmado?",
    answer:
      "Após finalizar o agendamento e a etapa de pagamentos, você receberá uma confirmação na tela e, em alguns casos, por e-mail. Você também poderá visualizar seus agendamentos confirmados na área de usuário. Se não encontrar o agendamento lá, é provável que o processo não tenha sido concluído."
  },
  {
    question: "Posso remarcar ou cancelar um agendamento pelo site?",
    answer:
      "As regras de remarcação ou cancelamento variam conforme o tipo de sessão e o prazo. Em geral, você deve solicitar a remarcação com antecedência mínima, conforme previsto nos termos de uso. Em breve, a plataforma poderá permitir remarcações diretamente pelo painel. Até lá, entre em contato com o estúdio para reorganizar sua sessão."
  },
  {
    question: "Não encontrei um horário que encaixa com a minha agenda.",
    answer:
      "Os horários disponíveis exibidos no site refletem a agenda oficial do estúdio. Se você precisar de um horário especial ou fora do padrão, entre em contato direto com o estúdio para verificar a possibilidade de um encaixe ou horário alternativo."
  },

  // ==========================
  // TÉCNICO / ÁUDIO / ESTÚDIO
  // ==========================
  {
    question: "Preciso levar meus próprios arquivos de beat ou playback?",
    answer:
      "Sim, se você já tiver beats, playback ou bases prontas, leve os arquivos em boa qualidade (de preferência WAV ou AIFF). Caso não tenha, é possível contratar beats e produções diretamente com o estúdio, conforme os pacotes disponíveis."
  },
  {
    question: "O que eu devo preparar antes de ir gravar no estúdio?",
    answer:
      "Treine a letra, respiração e interpretação com antecedência. Se possível, ensaie com o beat ou playback que será usado na gravação. Também é importante organizar referências de som ou artistas que você gosta para ajudar na direção de produção e mix."
  },
  {
    question: "Quanto tempo dura, em média, uma sessão de gravação?",
    answer:
      "Depende da complexidade do projeto e da sua preparação, mas muitas sessões usam blocos de 1 a 4 horas. Você pode contratar o tempo por hora ou dentro de pacotes e planos que já incluem uma carga horária mensal."
  },
  {
    question: "Posso ir com outras pessoas para a sessão de estúdio?",
    answer:
      "Em geral, é possível levar um número limitado de acompanhantes, desde que isso seja combinado com antecedência. O ideal é evitar muitas pessoas na sala para não atrapalhar a concentração e o fluxo da gravação."
  },
  {
    question: "A mix e master estão inclusas na captação?",
    answer:
      "Não necessariamente. Em muitos casos, captação, mix e master são serviços separados, mas você pode contratar combos ou planos que incluam tudo. Verifique na descrição dos serviços e planos disponíveis no site quais etapas estão incluídas."
  },

  // ==========================
  // PLANOS MENSAIS / ASSINATURA
  // ==========================
  {
    question: "Qual a diferença entre contratar avulso e assinar um plano?",
    answer:
      "Nos serviços avulsos você paga por sessão ou por faixa, enquanto os planos oferecem um pacote de horas e serviços com melhor custo-benefício e prioridade na agenda. Planos são ideais para quem quer manter uma rotina de lançamentos ou projetos recorrentes."
  },
  {
    question: "O que acontece se eu não usar todas as horas do meu plano no mês?",
    answer:
      "As regras podem variar conforme o plano, mas em muitos casos as horas não utilizadas não são acumuladas para o próximo mês. Por isso, é importante organizar sua agenda para aproveitar bem os créditos de cada ciclo. Consulte os termos do plano antes de contratar."
  },
  {
    question: "Posso alterar de plano Bronze para Prata ou Ouro depois?",
    answer:
      "Sim, em geral é possível fazer upgrade de plano, ajustando o valor proporcional. Entre em contato com o suporte ou consulte a área de planos para verificar as condições específicas de mudança de plano."
  },
  {
    question: "Meu plano foi cobrado automaticamente e eu não queria renovar.",
    answer:
      "Se o plano é recorrente, a cobrança é feita automaticamente enquanto estiver ativo. Verifique na sua área de usuário ou entre em contato com o suporte para solicitar o cancelamento futuro. Dependendo da data da cobrança, pode não ser possível estornar o mês já iniciado."
  },

  // ==========================
  // SUPORTE / FAQ / CONTATO
  // ==========================
  {
    question: "Não encontrei minha dúvida aqui no FAQ, o que faço?",
    answer:
      "Você pode usar a área de envio de dúvidas para registrar sua pergunta. Ela será analisada pela equipe e, quando respondida, poderá ser incorporada ao FAQ para ajudar outras pessoas com a mesma questão."
  },
  {
    question: "Quanto tempo leva para uma dúvida enviada ser respondida?",
    answer:
      "O tempo de resposta pode variar conforme a demanda, mas a equipe busca responder o mais rápido possível dentro do horário de atendimento. Dúvidas urgentes relacionadas a sessões próximas podem ser priorizadas."
  },
  {
    question: "Minhas dúvidas antigas continuam disponíveis no sistema?",
    answer:
      "Sim, as perguntas e respostas ficam registradas para que você possa consultar mais tarde. Além disso, perguntas parecidas podem ser associadas a respostas já existentes, tornando o suporte cada vez mais completo."
  },
  {
    question: "Posso sugerir melhorias ou novas funções para o site?",
    answer:
      "Sim! Use a área de comentários ou a seção de ouvidoria para enviar suas sugestões. Feedbacks ajudam a melhorar tanto a plataforma quanto a experiência no estúdio."
  },
  {
    question: "Posso usar o FAQ para tratar assuntos de contrato e direitos autorais?",
    answer:
      "O FAQ traz orientações gerais, mas questões específicas de contrato, direitos autorais e divisão de royalties devem ser tratadas diretamente com o estúdio e, se necessário, com assessoria jurídica. Use o FAQ como guia inicial, mas sempre confira os termos oficiais e contratos."
  },

  // ==========================
  // TÉCNICO / ERROS DE SITE
  // ==========================
  {
    question: "O site não abre ou fica travando na minha internet.",
    answer:
      "Verifique se sua conexão está estável e teste em outro navegador (como Chrome ou Firefox). Fechar outras abas pesadas e reiniciar o roteador também pode ajudar. Se o problema ocorrer apenas neste site e em vários dispositivos, entre em contato com o suporte enviando prints."
  },
  {
    question: "Recebo uma mensagem de erro desconhecido ao tentar usar o site.",
    answer:
      "Erros desconhecidos podem ser falhas temporárias do servidor ou alguma condição não tratada pelo sistema. Anote (ou fotografe) a mensagem exata que aparece na tela e envie para o suporte, informando também o horário aproximado em que o erro ocorreu."
  },
  {
    question: "A página demora muito para carregar as seções.",
    answer:
      "Isso pode acontecer em conexões mais lentas ou quando o navegador está com muitos recursos em uso. Tente fechar outros aplicativos e abas, usar uma conexão mais estável ou acessar em outro horário. A equipe também monitora a performance para otimizar o site sempre que possível."
  }
];

async function main() {
  console.log("🌱 Iniciando seed de FAQ...");

  await prisma.fAQ.createMany({
    data: faqs,
  });

  console.log("✅ Seed de FAQ concluído com sucesso!");
}

main()
  .catch((e) => {
    console.error("Erro ao executar seed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
