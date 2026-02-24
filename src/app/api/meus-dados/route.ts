import { NextResponse } from "next/server";
import { requireAuth } from "@/app/lib/auth";
import { prisma } from "@/app/lib/prisma";
import { getDatabaseProvider } from "@/app/lib/db-utils";

export async function GET() {
  try {
    const user = await requireAuth();
    
    // Normalizar email do usuário para garantir correspondência
    const userEmailNormalizado = user.email.toLowerCase().trim();

    // Buscar agendamentos do usuário
    const agendamentos = await prisma.appointment.findMany({
      where: { userId: user.id },
      orderBy: { data: "desc" },
      include: {
        user: {
          select: {
            nomeArtistico: true,
            email: true,
          },
        },
      },
    });

    // Buscar pagamentos do usuário
    const pagamentos = await prisma.payment.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
    });

    // Buscar planos do usuário
    console.log("[API /meus-dados] Buscando planos para userId:", user.id);
    const planos = await prisma.userPlan.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
    });
    console.log("[API /meus-dados] Planos encontrados:", planos.length, planos.map(p => ({ id: p.id, planId: p.planId, status: p.status })));

    // Buscar TODOS os cupons do usuário (disponíveis, usados e expirados)
    const planosIds = planos.length > 0 ? planos.map(p => p.id) : [];
    const agendamentosIds = agendamentos.length > 0 ? agendamentos.map(a => a.id) : [];
    
    const todosCupons = await prisma.coupon.findMany({
      where: {
        OR: [
          { usedBy: user.id }, // Cupons gerados para este usuário
          ...(planosIds.length > 0 ? [{ userPlanId: { in: planosIds } }] : []), // Cupons gerados pelos planos do usuário
          ...(agendamentosIds.length > 0 ? [{ appointmentId: { in: agendamentosIds } }] : []), // Cupons de reembolso dos agendamentos do usuário
        ],
      },
      orderBy: { createdAt: "desc" },
    });

    // Buscar userPlans separadamente para os cupons que têm userPlanId
    const userPlanIds = todosCupons
      .filter(c => c.userPlanId)
      .map(c => c.userPlanId!)
      .filter((id, index, self) => self.indexOf(id) === index); // Remover duplicatas

    const userPlansMap = new Map();
    if (userPlanIds.length > 0) {
      const userPlans = await prisma.userPlan.findMany({
        where: { id: { in: userPlanIds } },
        select: {
          id: true,
          planId: true,
          planName: true,
          endDate: true,
        },
      });
      userPlans.forEach(up => userPlansMap.set(up.id, up));
    }

    // Classificar cupons por status
    const agora = new Date();
    const cupons = todosCupons.map(cupom => {
      let status: "disponivel" | "usado" | "expirado" = "disponivel";
      
      if (cupom.used) {
        status = "usado";
      } else {
        // Verificar se expirou pela data de expiração
        if (cupom.expiresAt && new Date(cupom.expiresAt) < agora) {
          status = "expirado";
        }
        
        // Verificar regra especial: cupons de plano (serviço ou percent) expiram 1 mês após expiração do plano
        if (cupom.userPlanId && (cupom.discountType === "service" || cupom.discountType === "percent")) {
          const userPlan = userPlansMap.get(cupom.userPlanId);
          if (userPlan && userPlan.endDate) {
            const umMesAposPlano = new Date(userPlan.endDate);
            umMesAposPlano.setMonth(umMesAposPlano.getMonth() + 1);
            
            if (agora > umMesAposPlano) {
              status = "expirado";
            }
          }
        }
      }

      const userPlan = cupom.userPlanId ? userPlansMap.get(cupom.userPlanId) : null;

      return {
        ...cupom,
        status,
        couponType: cupom.couponType || "plano", // Default para "plano" se não tiver (cupons antigos)
        discountValue: cupom.discountValue || 0,
        userPlan: userPlan ? {
          id: userPlan.id,
          planId: userPlan.planId,
          planName: userPlan.planName,
          endDate: userPlan.endDate instanceof Date ? userPlan.endDate.toISOString() : userPlan.endDate,
        } : null,
      };
    });

    // Buscar pagamentos associados aos agendamentos
    const agendamentosComPagamento = await Promise.all(
      agendamentos.map(async (agendamento) => {
        const pagamento = await prisma.payment.findFirst({
          where: { appointmentId: agendamento.id },
        });

        return {
          ...agendamento,
          pagamento: pagamento ? {
            id: pagamento.id,
            amount: pagamento.amount,
            status: pagamento.status,
            paymentMethod: pagamento.paymentMethod,
            createdAt: pagamento.createdAt,
          } : null,
        };
      })
    );

    // Buscar perguntas do FAQ do usuário
    // Buscar por userId OU userEmail (pode ter sido enviado sem estar logado ou com email diferente)
    // IMPORTANTE: Normalizar email para garantir correspondência (case-insensitive)
    // Incluir perguntas bloqueadas (recusadas) também para que o usuário veja o status
    const faqQuestions = await prisma.userQuestion.findMany({
      where: {
        OR: [
          { userId: user.id },
          { userEmail: user.email },
          { userEmail: userEmailNormalizado }, // Buscar também por email normalizado
        ],
      },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        question: true,
        answer: true,
        status: true,
        blocked: true,
        blockedReason: true,
        answeredAt: true,
        readAt: true, // Incluir readAt no select
        userId: true,
        userEmail: true,
        published: true,
        createdAt: true,
        faq: {
          select: {
            id: true,
            question: true,
          },
        },
      },
    });

    console.log(`[API /meus-dados] Perguntas FAQ encontradas para userId=${user.id}, email=${user.email}, emailNormalizado=${userEmailNormalizado}: ${faqQuestions.length}`);
    
    // Log detalhado das perguntas encontradas
    if (faqQuestions.length > 0) {
      console.log(`[API /meus-dados] Perguntas encontradas:`, faqQuestions.map(p => ({
        id: p.id,
        question: p.question.substring(0, 50),
        userId: p.userId,
        userEmail: p.userEmail,
        status: p.status,
      })));
    } else {
      // Se não encontrou, buscar todas as perguntas recentes para debug
      console.log(`[API /meus-dados] Nenhuma pergunta encontrada, buscando últimas 20 para debug...`);
      
      const todasPerguntas = await prisma.userQuestion.findMany({
        take: 20,
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          userId: true,
          userEmail: true,
          userName: true,
          question: true,
          status: true,
          createdAt: true,
        },
      });
      
      console.log(`[API /meus-dados] DEBUG - Últimas 20 perguntas no sistema:`, todasPerguntas.map(p => ({
        id: p.id,
        userId: p.userId,
        userEmail: p.userEmail,
        userName: p.userName,
        status: p.status,
        createdAt: p.createdAt,
      })));
      console.log(`[API /meus-dados] DEBUG - Buscando por userId=${user.id}, userEmail=${user.email}`);
    }

    // Serializar planos e buscar readAt
    const planosFormatados = await Promise.all(
      planos.map(async (plano) => {
        // Buscar readAt usando query raw adaptada para PostgreSQL
        let readAt: string | null = null;
        try {
          const provider = getDatabaseProvider();
          if (provider === 'postgresql') {
            const readData = await prisma.$queryRawUnsafe<Array<{ readAt: Date | null }>>(
              `SELECT "readAt" FROM "UserPlan" WHERE id = $1`,
              plano.id
            );
            readAt = readData[0]?.readAt ? new Date(readData[0].readAt).toISOString() : null;
          } else {
            const readData = await prisma.$queryRawUnsafe<Array<{ readAt: string | null }>>(
              `SELECT readAt FROM UserPlan WHERE id = ?`,
              plano.id
            );
            readAt = readData[0]?.readAt || null;
          }
        } catch (e: any) {
          if (!e.message?.includes("no such column") && !e.message?.includes("does not exist")) {
            console.error(`[API /meus-dados] Erro ao buscar readAt para plano ${plano.id}:`, e.message);
          }
        }
        
        // Serializar datas para evitar erros de JSON
        return {
          ...plano,
          startDate: plano.startDate instanceof Date ? plano.startDate.toISOString() : plano.startDate,
          endDate: plano.endDate instanceof Date ? plano.endDate.toISOString() : plano.endDate,
          createdAt: plano.createdAt instanceof Date ? plano.createdAt.toISOString() : plano.createdAt,
          ativo: plano.status === "active" && (!plano.endDate || new Date(plano.endDate) > new Date()),
          expiraEm: plano.endDate instanceof Date ? plano.endDate.toISOString() : plano.endDate,
          readAt: readAt,
        };
      })
    );

    console.log("[API /meus-dados] Retornando:", {
      userId: user.id,
      totalPlanos: planos.length,
      planosFormatados: planosFormatados.map(p => ({
        id: p.id,
        planId: p.planId,
        status: p.status,
        ativo: p.ativo,
      })),
    });

    // Serializar agendamentos e buscar readAt usando query raw adaptada para PostgreSQL
    const agendamentosSerializados = await Promise.all(
      agendamentosComPagamento.map(async (a) => {
        // Buscar readAt usando query raw adaptada para PostgreSQL
        let readAt: string | null = null;
        try {
          const provider = getDatabaseProvider();
          if (provider === 'postgresql') {
            const readData = await prisma.$queryRawUnsafe<Array<{ readAt: Date | null }>>(
              `SELECT "readAt" FROM "Appointment" WHERE id = $1`,
              a.id
            );
            readAt = readData[0]?.readAt ? new Date(readData[0].readAt).toISOString() : null;
          } else {
            const readData = await prisma.$queryRawUnsafe<Array<{ readAt: string | null }>>(
              `SELECT readAt FROM Appointment WHERE id = ?`,
              a.id
            );
            readAt = readData[0]?.readAt || null;
          }
        } catch (e: any) {
          // Se a coluna não existir, readAt será null
          if (!e.message?.includes("no such column") && !e.message?.includes("does not exist")) {
            console.error(`[API /meus-dados] Erro ao buscar readAt para agendamento ${a.id}:`, e.message);
          }
        }
        
        return {
          ...a,
          data: a.data instanceof Date ? a.data.toISOString() : a.data,
          createdAt: a.createdAt instanceof Date ? a.createdAt.toISOString() : a.createdAt,
          readAt: readAt,
          pagamento: a.pagamento ? {
            ...a.pagamento,
            createdAt: a.pagamento.createdAt instanceof Date ? a.pagamento.createdAt.toISOString() : a.pagamento.createdAt,
          } : null,
        };
      })
    );

    const pagamentosSerializados = pagamentos.map(p => ({
      ...p,
      createdAt: p.createdAt instanceof Date ? p.createdAt.toISOString() : p.createdAt,
    }));

    const cuponsSerializados = cupons.map(c => ({
      ...c,
      createdAt: c.createdAt instanceof Date ? c.createdAt.toISOString() : c.createdAt,
      expiresAt: c.expiresAt instanceof Date ? c.expiresAt.toISOString() : c.expiresAt,
      usedAt: c.usedAt instanceof Date ? c.usedAt.toISOString() : c.usedAt,
    }));

    // Serializar perguntas FAQ e buscar readAt usando query raw adaptada para PostgreSQL
    const faqSerializados = await Promise.all(
      faqQuestions.map(async (f) => {
        // Buscar readAt usando query raw adaptada para PostgreSQL
        let readAt: string | null = null;
        try {
          const provider = getDatabaseProvider();
          if (provider === 'postgresql') {
            const readData = await prisma.$queryRawUnsafe<Array<{ readAt: Date | null }>>(
              `SELECT "readAt" FROM "UserQuestion" WHERE id = $1`,
              f.id
            );
            readAt = readData[0]?.readAt ? new Date(readData[0].readAt).toISOString() : null;
          } else {
            const readData = await prisma.$queryRawUnsafe<Array<{ readAt: string | null }>>(
              `SELECT readAt FROM UserQuestion WHERE id = ?`,
              f.id
            );
            readAt = readData[0]?.readAt || null;
          }
        } catch (e: any) {
          // Se a coluna não existir, readAt será null
          if (!e.message?.includes("no such column") && !e.message?.includes("does not exist")) {
            console.error(`[API /meus-dados] Erro ao buscar readAt para pergunta ${f.id}:`, e.message);
          }
        }
        
        return {
          id: f.id,
          question: f.question,
          answer: f.answer,
          status: f.blocked ? "recusada" : f.status, // Se bloqueada, status é "recusada"
          blocked: f.blocked, // Incluir campo blocked para referência
          blockedReason: f.blockedReason || null, // Motivo da recusa
          published: f.published,
          answeredAt: f.answeredAt instanceof Date ? f.answeredAt.toISOString() : f.answeredAt,
          readAt: readAt,
          createdAt: f.createdAt instanceof Date ? f.createdAt.toISOString() : f.createdAt,
          faq: f.faq,
        };
      })
    );

    console.log(`[API /meus-dados] Retornando ${faqSerializados.length} pergunta(s) FAQ serializada(s)`);

    return NextResponse.json({
      agendamentos: agendamentosSerializados,
      pagamentos: pagamentosSerializados,
      planos: planosFormatados,
      cupons: cuponsSerializados,
      faqQuestions: faqSerializados,
    });
  } catch (err: any) {
    if (err.message === "Não autenticado") {
      return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
    }
    console.error("[API] Erro ao buscar dados do usuário:", err);
    console.error("[API] Stack trace:", err.stack);
    console.error("[API] Detalhes do erro:", {
      message: err.message,
      name: err.name,
      cause: err.cause,
    });
    return NextResponse.json({ 
      error: "Erro ao buscar dados",
      details: process.env.NODE_ENV === "development" ? err.message : undefined
    }, { status: 500 });
  }
}
