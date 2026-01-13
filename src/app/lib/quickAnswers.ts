// Respostas pré-definidas para perguntas clássicas do chat
// Estas respostas são retornadas diretamente sem chamar a IA

export interface QuickAnswer {
  keywords: string[];
  resposta: string;
}

export const QUICK_ANSWERS: QuickAnswer[] = [
  {
    keywords: ["preços", "preço", "quais são os preços", "valor", "valores", "quanto custa"],
    resposta: `Aqui estão os preços dos serviços da THouse Rec:

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📌 SERVIÇOS DE ESTÚDIO

• Sessão: R$ 40,00/hora
• Captação: R$ 50,00/hora
• Mixagem: R$ 110,00
• Masterização: R$ 60,00
• Mix + Master: R$ 160,00
• Sonoplastia (a partir de): R$ 320,00

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🎵 BEATS E PACOTES

• 1 Beat: R$ 150,00
• 2 Beats: R$ 250,00
• 3 Beats: R$ 350,00
• 4 Beats: R$ 400,00
• Beat + Mix + Master: R$ 280,00
• Produção Completa (4h + beat + mix + master): R$ 400,00

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Para agendar ou mais informações, acesse a página de Agendamento.`,
  },
  {
    keywords: ["agendamento", "agendar", "como funciona o agendamento", "como agendar"],
    resposta: `Como fazer seu agendamento na THouse Rec:

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1️⃣ Acesse a página de Agendamento

2️⃣ Selecione os serviços ou pacotes desejados

3️⃣ Escolha uma data disponível no calendário

4️⃣ Selecione um horário
   (disponível das 10h às 22h)

5️⃣ Revise o resumo e aceite os termos de contrato

6️⃣ Confirme o pagamento via Mercado Pago

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

💳 Formas de pagamento: Cartão, Débito, Pix ou Boleto

O agendamento é confirmado após o pagamento.`,
  },
  {
    keywords: ["planos", "plano", "quais planos", "planos disponíveis", "assinatura"],
    resposta: `Planos de assinatura da THouse Rec:

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🥉 PLANO BRONZE
R$ 149,99/mês ou R$ 1.499,99/ano

✓ 2h de captação por mês
✓ 1 Mix & Master por mês
✓ 10% de desconto em serviços avulsos

Ideal para quem está começando.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🥈 PLANO PRATA
R$ 349,99/mês ou R$ 3.499,99/ano

✓ 2h de captação por mês
✓ 2 Mix & Master por mês
✓ 1 Beat por mês
✓ Acesso a descontos promocionais
✓ Prioridade intermediária na agenda

Para artistas que gravam regularmente.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🥇 PLANO OURO
R$ 549,99/mês ou R$ 5.499,99/ano

✓ 4 horas de captação por mês
✓ 2 mix & master por mês
✓ 2 Beat por mês
✓ 10% de desconto em serviços avulsos
✓ 10% de desconto em beats
✓ Acesso a descontos promocionais
✓ Acompanhamento artístico

Acompanhamento profissional contínuo.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Confira todos os detalhes na página de Planos!`,
  },
  {
    keywords: ["serviços", "quais serviços", "o que vocês fazem", "trabalhos"],
    resposta: `Serviços oferecidos pela THouse Rec:

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🎙️ SERVIÇOS DE ESTÚDIO

• Sessão - Gravação de áudio
• Captação - Captura de áudio profissional
• Mixagem - Ajuste e combinação de faixas
• Masterização - Processo final de polimento
• Mix + Master - Pacote combinado
• Sonoplastia - Produção de áudio para projetos audiovisuais

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🎵 BEATS E PRODUÇÃO

• Beats personalizados - Instrumentais exclusivos
• Produção completa - 4h + beat + mix + master
• Beat + Mix + Master - Pacote completo de produção

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Você pode contratar serviços avulsos ou combinar diferentes etapas da produção.

Para ver preços e agendar, acesse a página de Agendamento!`,
  },
];

/**
 * Busca resposta pré-definida baseada nas palavras-chave
 */
export function getQuickAnswer(message: string): string | null {
  const messageLower = message.toLowerCase().trim();
  
  for (const answer of QUICK_ANSWERS) {
    const match = answer.keywords.some((keyword) =>
      messageLower.includes(keyword.toLowerCase())
    );
    
    if (match) {
      return answer.resposta;
    }
  }
  
  return null;
}
