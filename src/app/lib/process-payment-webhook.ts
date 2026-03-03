// src/app/lib/process-payment-webhook.ts
// Função para processar pagamento diretamente (sem HTTP)
import { prisma } from "@/app/lib/prisma";
import { sendPaymentConfirmationEmailToUser, sendPaymentNotificationToTHouse, sendPlanPaymentConfirmationEmail, sendPlanRenewalEmail } from "@/app/lib/sendEmail";

export async function processPaymentWebhook(body: { event: string; payment: any }) {
  try {
    const { event, payment } = body;

    if (!event || !payment) {
      console.warn("[Process Payment Webhook] Evento sem dados necessários");
      return { received: true };
    }

    const paymentId = payment.id;
    const status = payment.status;
    const value = payment.value;
    const customerId = payment.customer;
    const externalReference = payment.externalReference;

    console.log("[Process Payment Webhook] Processando:", {
      event,
      paymentId,
      status,
      value,
      customerId,
      externalReference,
      description: payment.description,
    });

    // Processar apenas eventos de pagamento confirmado
    if (event === "PAYMENT_RECEIVED" && (status === "RECEIVED" || status === "CONFIRMED")) {
      try {
        let userId = externalReference;

        if (!userId) {
          console.error("[Process Payment Webhook] ❌ Não foi possível identificar o usuário");
          return { received: true, error: "Usuário não identificado" };
        }

        // Verificar se já existe um pagamento com este ID
        const existingPayment = await prisma.payment.findFirst({
          where: {
            OR: [
              { asaasId: paymentId },
              { mercadopagoId: paymentId },
            ],
          },
        });

        const isPlano = payment.description?.includes("Plano") || payment.description?.includes("plano");
        const isAgendamento = payment.description?.includes("Agendamento") || payment.description?.includes("agendamento");

        let newPayment: { id: string; userId: string; type: string } | null = null;
        if (existingPayment) {
          console.log("[Process Payment Webhook] Pagamento já no banco:", paymentId, "- verificando se plano/cupons existem");
          newPayment = { id: existingPayment.id, userId: existingPayment.userId, type: existingPayment.type };
          userId = existingPayment.userId;
        } else {
          // Criar registro de pagamento
          const created = await prisma.payment.create({
            data: {
              userId: userId,
              amount: value,
              status: "approved",
              type: isPlano ? "plano" : (isAgendamento ? "agendamento" : "outro"),
              currency: "BRL",
              asaasId: paymentId,
              planId: isPlano ? payment.description?.match(/Plano (\w+)/)?.[1] || null : null,
            },
          });
          newPayment = { id: created.id, userId: created.userId, type: created.type };
          console.log("[Process Payment Webhook] Pagamento registrado com sucesso:", newPayment.id);
        }

        // Buscar metadata
        let metadata: Record<string, any> = {};

        try {
          if (payment.metadata && typeof payment.metadata === 'object') {
            metadata = payment.metadata;
          } else if (typeof payment.metadata === 'string') {
            metadata = JSON.parse(payment.metadata);
          }
        } catch (e) {
          console.warn("[Process Payment Webhook] Erro ao parsear payment.metadata:", e);
        }

        // Buscar do PaymentMetadata
        if (Object.keys(metadata).length === 0 && userId) {
          try {
            let paymentMetadata = await prisma.paymentMetadata.findFirst({
              where: {
                userId: userId,
                expiresAt: { gt: new Date() },
                OR: [
                  { asaasId: null },
                  { asaasId: paymentId },
                ],
              },
              orderBy: { createdAt: 'desc' },
            });

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
            }

            if (!paymentMetadata) {
              paymentMetadata = await prisma.paymentMetadata.findFirst({
                where: { userId: userId },
                orderBy: { createdAt: 'desc' },
              });
            }

            if (paymentMetadata) {
              metadata = JSON.parse(paymentMetadata.metadata);
              await prisma.paymentMetadata.update({
                where: { id: paymentMetadata.id },
                data: { asaasId: paymentId },
              });
              console.log("[Process Payment Webhook] ✅ Metadata encontrado no PaymentMetadata");
            }
          } catch (e) {
            console.error("[Process Payment Webhook] Erro ao buscar PaymentMetadata:", e);
          }
        }

        // Fallback: extrair da descrição
        if (Object.keys(metadata).length === 0 && payment.description) {
          const descMatch = payment.description.match(/Plano (\w+)/i);
          if (descMatch) {
            metadata.tipo = "plano";
            metadata.planId = descMatch[1].toLowerCase();
          }
        }

        if (!metadata.userId && userId) {
          metadata.userId = userId;
        }

        const tipo = metadata.tipo || newPayment.type || (isPlano ? "plano" : isAgendamento ? "agendamento" : "outro");

        console.log("[Process Payment Webhook] 📦 Metadata processado:", JSON.stringify(metadata, null, 2));
        console.log("[Process Payment Webhook] 📋 Tipo detectado:", tipo);

        if (tipo === "plano" || isPlano) {
          const subscriptionId = payment.subscription;

          if (subscriptionId) {
            // Assinatura recorrente - processar depois
            console.log("[Process Payment Webhook] É assinatura recorrente, pulando criação de plano");
          } else {
            // Pagamento único inicial
            let planId = metadata.planId;
            let modo = metadata.modo;
            let planName = metadata.planName;
            const amount = parseFloat(metadata.amount || value.toString() || "0");
            const billingDay = metadata.billingDay || new Date().getDate();
            const paymentMethod = metadata.paymentMethod || "pix";

            // Usar valores padrão para teste se necessário
            if (payment.description?.toLowerCase().includes("teste")) {
              planId = planId || "teste";
              modo = modo || "mensal";
              planName = planName || "Plano de Teste";
            }

            console.log("[Process Payment Webhook] Dados do plano:", {
              userId,
              planId,
              modo,
              planName,
              amount,
              billingDay,
              paymentMethod,
            });

            if (planId && modo) {
              const startDate = new Date();
              const endDate = new Date(startDate); // Copiar startDate para garantir cálculo correto
              if (modo === "mensal") {
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

              const existingPlan = await prisma.userPlan.findFirst({
                where: {
                  userId: userId,
                  planId: planId,
                  status: { in: ["active", "pending"] },
                },
                orderBy: { createdAt: "desc" },
              });

              let userPlan;

              if (existingPlan) {
                userPlan = await prisma.userPlan.update({
                  where: { id: existingPlan.id },
                  data: {
                    planName: planName || existingPlan.planName || `Plano ${planId}`,
                    modo: modo,
                    amount: amount || existingPlan.amount,
                    status: "active",
                    startDate: startDate,
                    endDate: endDate,
                  },
                });
                console.log("[Process Payment Webhook] Plano existente atualizado:", userPlan.id);
              } else {
                userPlan = await prisma.userPlan.create({
                  data: {
                    userId: userId,
                    planId: planId,
                    planName: planName || `Plano ${planId}`,
                    modo: modo,
                    amount: amount || (modo === "mensal" ? 197.00 : 1970.00),
                    status: "active",
                    startDate,
                    endDate,
                  },
                });
                console.log("[Process Payment Webhook] ✅ Novo plano criado e ativado:", userPlan.id, planId);
              }

              // Gerar cupons
              try {
                const { generatePlanServiceCoupons } = await import("@/app/lib/plan-coupons");
                const coupons = await generatePlanServiceCoupons(
                  userId,
                  userPlan.id,
                  planId,
                  planName || `Plano ${planId}`,
                  modo
                );
                console.log(`[Process Payment Webhook] ${coupons.length} cupons gerados`);
              } catch (couponError: any) {
                console.error("[Process Payment Webhook] Erro ao gerar cupons:", couponError);
              }

              // Enviar email
              try {
                const user = await prisma.user.findUnique({ where: { id: userId } });
                if (user) {
                  await sendPlanPaymentConfirmationEmail(
                    user.email,
                    user.nomeArtistico || user.nomeCompleto || "Usuário",
                    planName || `Plano ${planId}`,
                    modo,
                    amount || value,
                    endDate
                  );
                  console.log(`[Process Payment Webhook] ✅ Email enviado para ${user.email}`);
                }
              } catch (emailError: any) {
                console.error("[Process Payment Webhook] Erro ao enviar email:", emailError);
              }

              console.log(`[Process Payment Webhook] ✅✅✅ PLANO CRIADO COM SUCESSO ✅✅✅`);
              return {
                received: true,
                success: true,
                userPlanId: userPlan.id,
                userPlan: { id: userPlan.id, planId: userPlan.planId, planName: userPlan.planName, status: userPlan.status },
              };
            } else {
              console.error("[Process Payment Webhook] ❌ FALHA AO CRIAR PLANO - DADOS INCOMPLETOS");
              console.error("[Process Payment Webhook] planId:", planId);
              console.error("[Process Payment Webhook] modo:", modo);
            }
          }
        }
      } catch (dbError: any) {
        console.error("[Process Payment Webhook] ❌ Erro ao processar pagamento:", dbError);
        console.error("[Process Payment Webhook] Stack:", dbError.stack);
        return { received: true, error: dbError.message };
      }
    }

    return { received: true };
  } catch (error: any) {
    console.error("[Process Payment Webhook] Erro geral:", error);
    return { received: true, error: error.message };
  }
}
