// src/app/api/webhooks/asaas/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";
import { sendPaymentConfirmationEmailToUser, sendPaymentNotificationToTHouse, sendPlanPaymentConfirmationEmail, sendPlanRenewalEmail } from "@/app/lib/sendEmail";

/**
 * Webhook do Asaas para notificações de pagamento
 * 
 * Eventos suportados:
 * - PAYMENT_CREATED: Pagamento criado
 * - PAYMENT_RECEIVED: Pagamento confirmado ✅
 * - PAYMENT_OVERDUE: Pagamento vencido
 * - PAYMENT_DELETED: Pagamento deletado
 */
export async function POST(req: Request) {
  try {
    // Ler como texto primeiro para debug
    const bodyText = await req.text();
    console.log("[Asaas Webhook] Body recebido (primeiros 500 chars):", bodyText.substring(0, 500));
    
    let body;
    try {
      body = JSON.parse(bodyText);
    } catch (parseError: any) {
      console.error("[Asaas Webhook] Erro ao parsear body:", parseError);
      console.error("[Asaas Webhook] Body completo:", bodyText);
      return NextResponse.json(
        { 
          received: true, 
          error: "Erro ao parsear body",
          details: parseError.message 
        },
        { status: 200 }
      );
    }
    
    console.log("[Asaas Webhook] Evento recebido:", JSON.stringify(body, null, 2));

    const { event, payment } = body;

    // Ignorar eventos que não são de pagamento (ex: ACCOUNT_STATUS_BANK_ACCOUNT_INFO_APPROVED)
    if (event && !event.startsWith("PAYMENT_")) {
      console.log(`[Asaas Webhook] Evento ignorado (não é de pagamento): ${event}`);
      return NextResponse.json({ received: true, message: `Evento ${event} ignorado` }, { status: 200 });
    }

    if (!event || !payment) {
      console.warn("[Asaas Webhook] Evento sem dados necessários");
      return NextResponse.json({ received: true }, { status: 200 });
    }

    const paymentId = payment.id;
    const status = payment.status; // PENDING, RECEIVED, OVERDUE, REFUNDED, etc.
    const value = payment.value;
    const customerId = payment.customer;
    const externalReference = payment.externalReference; // ID do usuário

    console.log("[Asaas Webhook] Processando:", {
      event,
      paymentId,
      status,
      value,
      customerId,
      externalReference,
      description: payment.description,
      metadata: payment.metadata,
    });

    // Processar apenas eventos de pagamento confirmado
    // Aceitar tanto RECEIVED quanto CONFIRMED
    console.log("[Asaas Webhook] Verificando condições:", {
      event,
      status,
      shouldProcess: event === "PAYMENT_RECEIVED" && (status === "RECEIVED" || status === "CONFIRMED"),
    });
    
    if (event === "PAYMENT_RECEIVED" && (status === "RECEIVED" || status === "CONFIRMED")) {
      console.log("[Asaas Webhook] ✅ Condições atendidas, processando pagamento...");
      try {
        // Buscar usuário pelo externalReference (userId)
        let userId = externalReference;
        
        // Se externalReference não existir, tentar buscar pelo customerId
        if (!userId && customerId) {
          console.log("[Asaas Webhook] Tentando buscar usuário por customerId:", customerId);
          // Buscar usuário pelo email do customer no Asaas
          try {
            const { getAsaasApiKey } = await import("@/app/lib/env");
            const apiKey = getAsaasApiKey();
            if (apiKey) {
              const isProduction = apiKey.startsWith('$aact_prod_');
              const apiUrl = isProduction ? "https://www.asaas.com/api/v3" : "https://sandbox.asaas.com/api/v3";
              
              const customerRes = await fetch(`${apiUrl}/customers/${customerId}`, {
                headers: { "access_token": apiKey },
              });
              
              if (customerRes.ok) {
                const customerData = await customerRes.json();
                const userByEmail = await prisma.user.findUnique({
                  where: { email: customerData.email },
                });
                if (userByEmail) {
                  userId = userByEmail.id;
                  console.log("[Asaas Webhook] Usuário encontrado por email do customer:", userId);
                }
              }
            }
          } catch (customerError: any) {
            console.error("[Asaas Webhook] Erro ao buscar customer:", customerError);
          }
        }

        if (!userId) {
          console.error("[Asaas Webhook] ❌ Não foi possível identificar o usuário");
          console.error("[Asaas Webhook] externalReference:", externalReference);
          console.error("[Asaas Webhook] customerId:", customerId);
          console.error("[Asaas Webhook] payment completo:", JSON.stringify(payment, null, 2));
          return NextResponse.json({ received: true, error: "Usuário não identificado" }, { status: 200 });
        }

        // Verificar se já existe um pagamento com este ID
        const existingPayment = await prisma.payment.findFirst({
          where: {
            OR: [
              { asaasId: paymentId },
              { mercadopagoId: paymentId }, // Fallback
            ],
          },
        });

        if (existingPayment) {
          console.log("[Asaas Webhook] Pagamento já processado:", paymentId);
          return NextResponse.json({ received: true }, { status: 200 });
        }

        // Determinar tipo de pagamento pela descrição
        const isPlano = payment.description?.includes("Plano") || payment.description?.includes("plano");
        const isAgendamento = payment.description?.includes("Agendamento") || payment.description?.includes("agendamento");
        
        // Criar registro de pagamento
        const newPayment = await prisma.payment.create({
          data: {
            userId: userId,
            amount: value,
            status: "approved", // Status do pagamento (approved, pending, failed)
            type: isPlano ? "plano" : (isAgendamento ? "agendamento" : "outro"),
            currency: "BRL",
            asaasId: paymentId,
            planId: isPlano ? payment.description?.match(/Plano (\w+)/)?.[1] || null : null,
          },
        });

        console.log("[Asaas Webhook] Pagamento registrado com sucesso:", newPayment.id);

        // Criar ou atualizar plano/agendamento baseado no tipo de pagamento
        // Os dados estão no metadata do pagamento ou no externalReference
        
        // O Asaas pode passar metadata de diferentes formas:
        // 1. Como objeto direto: payment.metadata
        // 2. Como string JSON no externalReference (formato: userId|JSON_METADATA)
        // 3. Na descrição do pagamento
        let metadata: Record<string, any> = {};
        
        try {
          // Tentar ler metadata direto do payment
          if (payment.metadata && typeof payment.metadata === 'object') {
            metadata = payment.metadata;
            console.log("[Asaas Webhook] Metadata encontrado diretamente no payment.metadata");
          } else if (typeof payment.metadata === 'string') {
            metadata = JSON.parse(payment.metadata);
            console.log("[Asaas Webhook] Metadata parseado de string");
          }
        } catch (e) {
          console.warn("[Asaas Webhook] Erro ao parsear payment.metadata:", e);
        }
        
        // Se metadata estiver vazio, tentar buscar do PaymentMetadata (armazenado antes de criar pagamento)
        if (Object.keys(metadata).length === 0 && userId) {
          try {
            console.log("[Asaas Webhook] Buscando PaymentMetadata para userId:", userId);
            
            // Primeiro tentar buscar metadata não expirado e sem asaasId (não processado ainda)
            let paymentMetadata = await prisma.paymentMetadata.findFirst({
              where: {
                userId: userId,
                expiresAt: { gt: new Date() },
                OR: [
                  { asaasId: null },
                  { asaasId: paymentId }, // Também aceitar se já foi associado a este pagamento
                ],
              },
              orderBy: { createdAt: 'desc' },
            });
            
            // Se não encontrou, buscar qualquer metadata recente (últimas 48 horas)
            if (!paymentMetadata) {
              const twoDaysAgo = new Date();
              twoDaysAgo.setHours(twoDaysAgo.getHours() - 48);
              
              paymentMetadata = await prisma.paymentMetadata.findFirst({
                where: {
                  userId: userId,
                  createdAt: { gte: twoDaysAgo },
                },
                orderBy: { createdAt: 'desc' },
              });
              
              if (paymentMetadata) {
                console.log("[Asaas Webhook] PaymentMetadata encontrado (últimas 48h):", paymentMetadata.id);
              }
            }
            
            // Se ainda não encontrou, buscar qualquer metadata do usuário (último recurso)
            if (!paymentMetadata) {
              paymentMetadata = await prisma.paymentMetadata.findFirst({
                where: {
                  userId: userId,
                },
                orderBy: { createdAt: 'desc' },
              });
              
              if (paymentMetadata) {
                console.log("[Asaas Webhook] PaymentMetadata encontrado (qualquer registro):", paymentMetadata.id);
              }
            }
            
            if (paymentMetadata) {
              console.log("[Asaas Webhook] PaymentMetadata encontrado:", {
                id: paymentMetadata.id,
                userId: paymentMetadata.userId,
                asaasId: paymentMetadata.asaasId,
                createdAt: paymentMetadata.createdAt,
                expiresAt: paymentMetadata.expiresAt,
                metadataLength: paymentMetadata.metadata.length,
                metadataPreview: paymentMetadata.metadata.substring(0, 200),
              });
              
              try {
                metadata = JSON.parse(paymentMetadata.metadata);
                // Atualizar asaasId no PaymentMetadata para referência futura
                await prisma.paymentMetadata.update({
                  where: { id: paymentMetadata.id },
                  data: { asaasId: paymentId },
                });
                console.log("[Asaas Webhook] ✅ Metadata encontrado no PaymentMetadata:", JSON.stringify(metadata, null, 2));
              } catch (parseError) {
                console.error("[Asaas Webhook] ❌ Erro ao parsear metadata:", parseError);
                console.error("[Asaas Webhook] Metadata raw:", paymentMetadata.metadata);
              }
            } else {
              console.warn("[Asaas Webhook] ⚠️ PaymentMetadata não encontrado para userId:", userId);
              console.warn("[Asaas Webhook] Tentando buscar todos os PaymentMetadata do usuário...");
              
              // Debug: listar todos os PaymentMetadata do usuário
              const allMetadata = await prisma.paymentMetadata.findMany({
                where: { userId: userId },
                orderBy: { createdAt: 'desc' },
                take: 5,
              });
              
              console.warn("[Asaas Webhook] PaymentMetadata encontrados:", allMetadata.length);
              allMetadata.forEach((pm, idx) => {
                console.warn(`[Asaas Webhook]   ${idx + 1}. ID: ${pm.id}, Created: ${pm.createdAt}, Expires: ${pm.expiresAt}, AsaasId: ${pm.asaasId || 'null'}`);
              });
            }
          } catch (e) {
            console.error("[Asaas Webhook] ❌ Erro ao buscar PaymentMetadata:", e);
            console.error("[Asaas Webhook] Stack:", e instanceof Error ? e.stack : 'N/A');
          }
        }
        
        // Se metadata ainda estiver vazio, tentar extrair do externalReference (formato antigo: userId|JSON_METADATA)
        if (Object.keys(metadata).length === 0 && externalReference && externalReference.includes('|')) {
          try {
            const parts = externalReference.split('|');
            if (parts.length >= 2) {
              const metadataJson = parts.slice(1).join('|'); // Rejuntar caso tenha | no JSON
              metadata = JSON.parse(metadataJson);
              console.log("[Asaas Webhook] Metadata extraído do externalReference (formato antigo)");
            }
          } catch (e) {
            console.warn("[Asaas Webhook] Erro ao parsear metadata do externalReference:", e);
          }
        }
        
        // Fallback: tentar extrair da descrição se metadata estiver vazio
        if (Object.keys(metadata).length === 0 && payment.description) {
          const descMatch = payment.description.match(/Plano (\w+)/i);
          if (descMatch) {
            metadata.tipo = "plano";
            metadata.planId = descMatch[1].toLowerCase();
            console.log("[Asaas Webhook] Metadata extraído da descrição");
          }
        }
        
        // Garantir que userId está no metadata
        if (!metadata.userId && userId) {
          metadata.userId = userId;
        }
        
        const tipo = metadata.tipo || newPayment.type || (isPlano ? "plano" : isAgendamento ? "agendamento" : "outro");
        
        console.log("[Asaas Webhook] 📦 Metadata processado:", JSON.stringify(metadata, null, 2));
        console.log("[Asaas Webhook] 📋 Tipo detectado:", tipo);
        
        if (tipo === "plano" || isPlano) {
          // Verificar se é pagamento de assinatura recorrente ou pagamento único
          const subscriptionId = payment.subscription; // ID da assinatura no Asaas (se existir)
          
          console.log("[Asaas Webhook] Processando pagamento de plano. subscriptionId:", subscriptionId);
          
          if (subscriptionId) {
            // É um pagamento de assinatura recorrente
            await processSubscriptionPayment(subscriptionId, userId, value, paymentId);
          } else {
            // É um pagamento único inicial - criar plano e assinatura recorrente
            const planId = metadata.planId;
            const modo = metadata.modo;
            const planName = metadata.planName;
            const amount = parseFloat(metadata.amount || value.toString() || "0");
            const billingDay = metadata.billingDay || new Date().getDate(); // Dia do mês para cobrança
            const paymentMethod = metadata.paymentMethod || "pix";
            
            console.log("[Asaas Webhook] Dados do plano:", {
              planId,
              modo,
              planName,
              amount,
              billingDay,
              paymentMethod,
            });
            
            // Atualizar planId e modo do metadata se necessário
            if (!planId || !modo) {
              console.error("[Asaas Webhook] ❌ Dados incompletos para criar plano:", {
                planId,
                modo,
                metadata: JSON.stringify(metadata),
                description: payment.description,
                externalReference: externalReference,
              });
              
              // Tentar extrair da descrição como último recurso
              const descMatch = payment.description?.match(/Plano (\w+)/i);
              if (descMatch && !planId) {
                metadata.planId = descMatch[1].toLowerCase();
                metadata.modo = payment.description?.includes("Mensal") || payment.description?.includes("mensal") ? "mensal" : "anual";
                console.log("[Asaas Webhook] Dados extraídos da descrição:", metadata);
              }
              
              // Se ainda não tiver planId ou modo, usar valores padrão para teste
              if (payment.description?.toLowerCase().includes("teste")) {
                metadata.planId = metadata.planId || "teste";
                metadata.modo = metadata.modo || "mensal";
                metadata.planName = metadata.planName || "Plano de Teste";
                console.log("[Asaas Webhook] Usando valores padrão para pagamento de teste:", metadata);
              }
            }
            
            // Atualizar planId e modo após processar metadata
            const finalPlanId = metadata.planId || planId;
            const finalModo = metadata.modo || modo;
            const finalPlanName = metadata.planName || planName;
            const finalAmount = parseFloat(metadata.amount || amount.toString() || value.toString() || "0");
            const finalBillingDay = metadata.billingDay || billingDay;
            const finalPaymentMethod = metadata.paymentMethod || paymentMethod;
            
            console.log("[Asaas Webhook] Dados finais do plano:", {
              planId: finalPlanId,
              modo: finalModo,
              planName: finalPlanName,
              amount: finalAmount,
              billingDay: finalBillingDay,
              paymentMethod: finalPaymentMethod,
            });
            
            if (finalPlanId && finalModo) {
              // Calcular data de término
              const startDate = new Date();
              const endDate = new Date(startDate); // Copiar startDate para garantir cálculo correto
              if (finalModo === "mensal") {
                // Adicionar 1 mês de forma segura
                const ano = startDate.getFullYear();
                const mes = startDate.getMonth();
                const dia = startDate.getDate();
                
                // Calcular próximo mês
                let novoMes = mes + 1;
                let novoAno = ano;
                
                if (novoMes > 11) {
                  novoMes = 0;
                  novoAno++;
                }
                
                // Criar nova data com o mesmo dia do mês seguinte
                // Se o dia não existir no mês seguinte (ex: 31/01 -> 31/02), usar o último dia do mês
                const ultimoDiaDoMes = new Date(novoAno, novoMes + 1, 0).getDate();
                const diaFinal = Math.min(dia, ultimoDiaDoMes);
                
                endDate.setFullYear(novoAno, novoMes, diaFinal);
                endDate.setHours(startDate.getHours(), startDate.getMinutes(), startDate.getSeconds(), startDate.getMilliseconds());
              } else {
                endDate.setFullYear(startDate.getFullYear() + 1);
              }

              // Verificar se já existe um plano ativo para este usuário e plano
              const existingPlan = await prisma.userPlan.findFirst({
                where: {
                  userId: userId,
                  planId: finalPlanId,
                  status: { in: ["active", "pending"] },
                },
                orderBy: { createdAt: "desc" },
              });

              let userPlan;
              
              if (existingPlan) {
                // Atualizar plano existente
                userPlan = await prisma.userPlan.update({
                  where: { id: existingPlan.id },
                  data: {
                    planName: finalPlanName || existingPlan.planName || `Plano ${finalPlanId}`,
                    modo: finalModo,
                    amount: finalAmount || existingPlan.amount,
                    status: "active",
                    startDate: startDate,
                    endDate: endDate,
                  },
                });
                console.log("[Asaas Webhook] Plano existente atualizado:", userPlan.id);
              } else {
                // Criar novo plano
                userPlan = await prisma.userPlan.create({
                  data: {
                    userId: userId,
                    planId: finalPlanId,
                    planName: finalPlanName || `Plano ${finalPlanId}`,
                    modo: finalModo,
                    amount: finalAmount || (finalModo === "mensal" ? 197.00 : 1970.00),
                    status: "active",
                    startDate,
                    endDate,
                  },
                });
                console.log("[Asaas Webhook] ✅ Novo plano criado e ativado:", userPlan.id, finalPlanId);
              }

              // Criar assinatura recorrente no Asaas
              try {
                const { createAsaasSubscription } = await import("@/app/lib/asaas-subscriptions");
                const { AsaasProvider } = await import("@/app/lib/payment-providers");
                const { getAsaasApiKey } = await import("@/app/lib/env");
                
                // Buscar ou criar cliente no Asaas
                const user = await prisma.user.findUnique({ where: { id: userId } });
                if (user) {
                  // Usar AsaasProvider para buscar/criar cliente
                  const provider = new AsaasProvider(getAsaasApiKey() || "", false);
                  const customerId = await provider.getOrCreateCustomer({
                    name: user.nomeArtistico,
                    email: user.email,
                    cpf: user.cpf || undefined,
                  });

                  // Mapear método de pagamento
                  const billingTypeMap: Record<string, "CREDIT_CARD" | "DEBIT_CARD" | "PIX" | "BOLETO"> = {
                    "cartao_credito": "CREDIT_CARD",
                    "cartao_debito": "DEBIT_CARD",
                    "pix": "PIX",
                    "boleto": "BOLETO",
                  };

                  const cycle = modo === "mensal" ? "MONTHLY" : "YEARLY";
                  const nextBillingDate = new Date();
                  nextBillingDate.setDate(billingDay);
                  if (nextBillingDate < new Date()) {
                    nextBillingDate.setMonth(nextBillingDate.getMonth() + 1);
                  }

                  const subscription = await createAsaasSubscription({
                    customerId,
                    billingType: billingTypeMap[finalPaymentMethod] || "PIX",
                    value: finalAmount,
                    cycle: cycle as any,
                    billingDay: Math.min(Math.max(finalBillingDay, 1), 28),
                    description: `Assinatura ${finalPlanName} - THouse Rec`,
                    externalReference: userId,
                    metadata: {
                      userId,
                      planId: finalPlanId,
                      userPlanId: userPlan.id,
                    },
                  });

                  // Criar registro de assinatura no banco
                  await prisma.subscription.create({
                    data: {
                      userId,
                      userPlanId: userPlan.id,
                      asaasSubscriptionId: subscription.id,
                      paymentMethod: paymentMethod,
                      billingDay: Math.min(Math.max(billingDay, 1), 28),
                      status: "active",
                      nextBillingDate: new Date(subscription.nextDueDate),
                    },
                  });

                  console.log("[Asaas Webhook] Assinatura recorrente criada:", subscription.id);
                }
              } catch (subError: any) {
                console.error("[Asaas Webhook] Erro ao criar assinatura recorrente (não crítico):", subError);
                // Não falhar o webhook por erro de assinatura
              }

              // Gerar cupons de serviços do plano (apenas após pagamento confirmado)
              let couponsCount = 0;
              try {
                const { generatePlanServiceCoupons } = await import("@/app/lib/plan-coupons");
                const coupons = await generatePlanServiceCoupons(
                  userId,
                  userPlan.id,
                  finalPlanId,
                  finalPlanName || `Plano ${finalPlanId}`,
                  finalModo
                );
                couponsCount = coupons.length;
                console.log(`[Asaas Webhook] ${couponsCount} cupons de serviços gerados para o plano ${planId}`);
              } catch (couponError: any) {
                console.error("[Asaas Webhook] Erro ao gerar cupons do plano (não crítico):", couponError);
                // Não falhar o webhook por erro de cupons
              }

              // Enviar email de confirmação de plano
              try {
                const user = await prisma.user.findUnique({ where: { id: userId } });
                if (user) {
                  await sendPlanPaymentConfirmationEmail(
                    user.email,
                    user.nomeArtistico || user.nomeCompleto || "Usuário",
                    finalPlanName || `Plano ${finalPlanId}`,
                    finalModo,
                    finalAmount || value,
                    endDate
                  );
                  console.log(`[Asaas Webhook] ✅ Email de confirmação de plano enviado para ${user.email}`);
                } else {
                  console.warn(`[Asaas Webhook] ⚠️ Usuário não encontrado para enviar email: ${userId}`);
                }
              } catch (emailError: any) {
                console.error("[Asaas Webhook] ❌ Erro ao enviar email de confirmação de plano (não crítico):", emailError);
              }
              
              // Log final de sucesso
              console.log(`[Asaas Webhook] ✅✅✅ PLANO CRIADO COM SUCESSO ✅✅✅`);
              console.log(`[Asaas Webhook] UserPlan ID: ${userPlan.id}`);
              console.log(`[Asaas Webhook] Plan ID: ${finalPlanId}`);
              console.log(`[Asaas Webhook] User ID: ${userId}`);
              console.log(`[Asaas Webhook] Status: ${userPlan.status}`);
            } else {
              console.error("[Asaas Webhook] ❌❌❌ FALHA AO CRIAR PLANO - DADOS INCOMPLETOS ❌❌❌");
              console.error("[Asaas Webhook] finalPlanId:", finalPlanId);
              console.error("[Asaas Webhook] finalModo:", finalModo);
              console.error("[Asaas Webhook] metadata completo:", JSON.stringify(metadata, null, 2));
              console.error("[Asaas Webhook] description:", payment.description);
            }
          }
        } else if (tipo === "agendamento" || isAgendamento) {
          // Atualizar agendamento existente ou criar novo após pagamento confirmado
          const appointmentId = metadata.appointmentId;
          const data = metadata.data;
          const hora = metadata.hora;
          const duracaoMinutos = parseInt(metadata.duracaoMinutos || "60");
          const tipoAgendamento = metadata.tipoAgendamento || metadata.tipo || "sessao";
          const observacoes = metadata.observacoes || null;
          
          let agendamentoFinalId: number | null = null;
          
          if (appointmentId) {
            // Se já existe um agendamento temporário, apenas confirmar que o pagamento foi recebido
            // O status já está como "pendente" e será mantido para admin aprovar
            const agendamento = await prisma.appointment.findUnique({
              where: { id: parseInt(appointmentId.toString()) },
            });
            
            if (agendamento) {
              // Agendamento já existe, associar pagamento ao agendamento
              agendamentoFinalId = agendamento.id;
              console.log("[Asaas Webhook] Agendamento confirmado após pagamento:", appointmentId);
            } else {
              console.warn("[Asaas Webhook] Agendamento não encontrado:", appointmentId);
            }
          } else if (data && hora) {
            // Criar novo agendamento se não existir (fallback para casos sem appointmentId)
            const dataHoraISO = new Date(`${data}T${hora}:00`);
            
            // Verificar conflitos antes de criar
            const conflito = await prisma.appointment.findFirst({
              where: {
                status: { not: "cancelado" },
                AND: [
                  { data: { lt: new Date(dataHoraISO.getTime() + (duracaoMinutos * 60000)) } },
                  { data: { gte: new Date(dataHoraISO.getTime() - (duracaoMinutos * 60000)) } },
                ],
              },
            });
            
            if (!conflito) {
              const novoAgendamento = await prisma.appointment.create({
                data: {
                  userId: userId,
                  data: dataHoraISO,
                  duracaoMinutos: duracaoMinutos,
                  tipo: tipoAgendamento,
                  observacoes: observacoes,
                  status: "pendente", // Pendente para admin aprovar
                },
              });
              agendamentoFinalId = novoAgendamento.id;
              console.log("[Asaas Webhook] Agendamento criado:", novoAgendamento.id);
            } else {
              console.warn("[Asaas Webhook] Conflito de horário detectado, agendamento não criado");
            }
          }
          
          // Processar cupom se foi usado
          const cupomCode = metadata.cupomCode;
          if (cupomCode && agendamentoFinalId) {
            try {
              const cupom = await prisma.coupon.findUnique({
                where: { code: cupomCode.toUpperCase() },
              });

              if (cupom && !cupom.used) {
                await prisma.coupon.update({
                  where: { id: cupom.id },
                  data: {
                    used: true,
                    usedAt: new Date(),
                    usedBy: userId,
                    appointmentId: agendamentoFinalId,
                  },
                });
                console.log(`[Asaas Webhook] Cupom ${cupomCode} marcado como usado para agendamento ${agendamentoFinalId}`);
              }
            } catch (cupomError: any) {
              console.error("[Asaas Webhook] Erro ao processar cupom (não crítico):", cupomError);
              // Não falhar o webhook por erro de cupom
            }
          }

          // Associar pagamento ao agendamento para prevenir fraudes
          if (agendamentoFinalId) {
            await prisma.payment.update({
              where: { id: newPayment.id },
              data: { appointmentId: agendamentoFinalId },
            });
            console.log("[Asaas Webhook] Pagamento associado ao agendamento:", agendamentoFinalId);

            // Enviar emails de confirmação de pagamento
            try {
              const appointment = await prisma.appointment.findUnique({
                where: { id: agendamentoFinalId },
                include: { user: true },
              });

              if (appointment) {
                const services = metadata.servicos ? JSON.parse(metadata.servicos) : [];
                const beats = metadata.beats ? JSON.parse(metadata.beats) : [];

                // Email para usuário
                await sendPaymentConfirmationEmailToUser(
                  appointment.user.email,
                  appointment.user.nomeArtistico,
                  appointment.data,
                  value
                );

                // Email para THouse
                await sendPaymentNotificationToTHouse(
                  appointment.user.email,
                  appointment.user.nomeArtistico,
                  appointment.user.telefone,
                  appointment.data,
                  appointment.tipo,
                  appointment.duracaoMinutos,
                  appointment.observacoes,
                  value,
                  metadata.paymentMethod || null,
                  services,
                  beats
                );

                console.log("[Asaas Webhook] Emails de confirmação enviados com sucesso");
              }
            } catch (emailError: any) {
              console.error("[Asaas Webhook] Erro ao enviar emails (não crítico):", emailError);
              // Não falhar o webhook por erro de email
            }
          }
        }

      } catch (dbError: any) {
        console.error("[Asaas Webhook] ❌ Erro ao processar pagamento no banco:", dbError);
        console.error("[Asaas Webhook] Stack:", dbError.stack);
        // Não retornar erro para o Asaas, apenas logar
      }
    } else {
      console.log("[Asaas Webhook] ⚠️ Evento não processado:", {
        event,
        status,
        reason: event !== "PAYMENT_RECEIVED" ? "Evento não é PAYMENT_RECEIVED" : "Status não é RECEIVED ou CONFIRMED",
      });
    }

    // Sempre retornar 200 para o Asaas não reenviar
    return NextResponse.json({ received: true }, { status: 200 });

  } catch (error: any) {
    console.error("[Asaas Webhook] Erro ao processar webhook:", error);
    // Sempre retornar 200 para o Asaas não reenviar
    return NextResponse.json({ received: true, error: error.message }, { status: 200 });
  }
}

/**
 * Processar pagamento de assinatura recorrente
 */
async function processSubscriptionPayment(
  subscriptionId: string,
  userId: string,
  value: number,
  paymentId: string
) {
  try {
    // Buscar assinatura no banco
    const subscription = await prisma.subscription.findUnique({
      where: { asaasSubscriptionId: subscriptionId },
      include: { userPlan: true },
    });

    if (!subscription) {
      console.warn(`[Asaas Webhook] Assinatura não encontrada: ${subscriptionId}`);
      return;
    }

    // Atualizar data da última cobrança e próxima cobrança
    const nextBillingDate = new Date(subscription.nextBillingDate);
    if (subscription.userPlan.modo === "mensal") {
      nextBillingDate.setMonth(nextBillingDate.getMonth() + 1);
    } else {
      nextBillingDate.setFullYear(nextBillingDate.getFullYear() + 1);
    }

    // Atualizar plano
    const newEndDate = new Date(subscription.userPlan.endDate || new Date());
    if (subscription.userPlan.modo === "mensal") {
      newEndDate.setMonth(newEndDate.getMonth() + 1);
    } else {
      newEndDate.setFullYear(newEndDate.getFullYear() + 1);
    }

    await prisma.userPlan.update({
      where: { id: subscription.userPlanId },
      data: {
        endDate: newEndDate,
        status: "active",
      },
    });

    // Atualizar assinatura
    await prisma.subscription.update({
      where: { id: subscription.id },
      data: {
        lastBillingDate: new Date(),
        nextBillingDate,
      },
    });

    console.log(`[Asaas Webhook] Pagamento de assinatura processado: ${subscriptionId}`);

    // Gerar novos cupons de serviços APENAS após pagamento confirmado
    let couponsCount = 0;
    try {
      const { generatePlanServiceCoupons } = await import("@/app/lib/plan-coupons");
      const coupons = await generatePlanServiceCoupons(
        userId,
        subscription.userPlan.id,
        subscription.userPlan.planId,
        subscription.userPlan.planName,
        subscription.userPlan.modo
      );
      couponsCount = coupons.length;
      console.log(`[Asaas Webhook] ${couponsCount} novos cupons gerados para renovação do plano ${subscription.userPlan.planId}`);
    } catch (couponError: any) {
      console.error("[Asaas Webhook] Erro ao gerar cupons na renovação (não crítico):", couponError);
    }

    // Enviar email de renovação de plano
    try {
      const user = await prisma.user.findUnique({ where: { id: userId } });
      if (user) {
        await sendPlanRenewalEmail(
          user.email,
          user.nomeArtistico,
          subscription.userPlan.planName,
          subscription.userPlan.modo,
          value,
          newEndDate,
          couponsCount
        );
        console.log(`[Asaas Webhook] Email de renovação de plano enviado para ${user.email}`);
      }
    } catch (emailError: any) {
      console.error("[Asaas Webhook] Erro ao enviar email de renovação de plano (não crítico):", emailError);
    }
  } catch (error: any) {
    console.error("[Asaas Webhook] Erro ao processar pagamento de assinatura:", error);
    throw error;
  }
}

// Permitir GET para verificação (alguns serviços fazem isso)
export async function GET() {
  return NextResponse.json({ 
    message: "Asaas webhook endpoint",
    status: "active"
  });
}
