import { NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";
import { requireAdmin } from "@/app/lib/auth";
import { z } from "zod";
import { sendAppointmentAcceptedEmail, sendAppointmentRejectedEmail } from "@/app/lib/sendEmail";
import { generateCouponCode } from "@/app/lib/coupons";

const updateSchema = z.object({
  status: z.string().optional(),
  blocked: z.boolean().optional(),
  blockedReason: z.string().optional(),
  rejectionComment: z.string().optional(), // Comentário editável para recusa
});

export async function GET() {
  try {
    await requireAdmin();

    // Buscar apenas agendamentos com pagamento confirmado (status "pendente" significa que o pagamento foi confirmado e está aguardando aprovação do admin)
    const agendamentos = await prisma.appointment.findMany({
      where: {
        status: {
          in: ["pendente", "aceito", "recusado", "confirmado", "cancelado"]
        }
      },
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

    // Buscar pagamentos confirmados e cupons para cada agendamento
    const agendamentosComPagamento = await Promise.all(
      agendamentos.map(async (agendamento) => {
        // Buscar pagamento confirmado associado a este agendamento
        const pagamento = await prisma.payment.findFirst({
          where: {
            OR: [
              { appointmentId: agendamento.id }, // Pagamento associado diretamente
              {
                // Fallback: buscar por userId, tipo e status (para agendamentos antigos sem appointmentId)
                userId: agendamento.userId,
                type: "agendamento",
                status: "approved",
                asaasId: { not: null }, // Deve ter sido confirmado pelo webhook
              },
            ],
          },
          orderBy: { createdAt: "desc" }, // Pegar o mais recente
        });

        // Buscar cupom associado a este agendamento
        const cupom = await prisma.coupon.findFirst({
          where: { appointmentId: agendamento.id },
        });

        return {
          ...agendamento,
          pagamentoConfirmado: pagamento ? {
            id: pagamento.id,
            amount: pagamento.amount,
            status: pagamento.status,
            paymentMethod: pagamento.paymentMethod,
            asaasId: pagamento.asaasId,
            createdAt: pagamento.createdAt,
          } : null,
          cupomAssociado: cupom ? {
            code: cupom.code,
            serviceType: cupom.serviceType,
            discountType: cupom.discountType,
            used: cupom.used,
          } : null,
        };
      })
    );

    return NextResponse.json({ agendamentos: agendamentosComPagamento });
  } catch (err: any) {
    if (err.message === "Acesso negado" || err.message === "Não autenticado") {
      return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
    }
    return NextResponse.json({ error: "Erro ao buscar agendamentos" }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    await requireAdmin();

    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "ID é obrigatório" }, { status: 400 });
    }

    const body = await req.json();
    const validation = updateSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json({ error: "Dados inválidos" }, { status: 400 });
    }

    // Buscar agendamento antes de atualizar para enviar emails
    const agendamentoAntes = await prisma.appointment.findUnique({
      where: { id: parseInt(id) },
      include: {
        user: {
          select: {
            nomeArtistico: true,
            email: true,
          },
        },
      },
    });

    if (!agendamentoAntes) {
      return NextResponse.json({ error: "Agendamento não encontrado" }, { status: 404 });
    }

    const updateData: any = {};
    if (validation.data.status !== undefined) {
      updateData.status = validation.data.status;
    }
    if (validation.data.blocked !== undefined) {
      updateData.blocked = validation.data.blocked;
      if (validation.data.blocked) {
        updateData.blockedAt = new Date();
        updateData.blockedReason = validation.data.blockedReason || "Bloqueado pelo admin";
      } else {
        updateData.blockedAt = null;
        updateData.blockedReason = null;
      }
    }

    const agendamento = await prisma.appointment.update({
      where: { id: parseInt(id) },
      data: updateData,
      include: {
        user: {
          select: {
            nomeArtistico: true,
            email: true,
          },
        },
      },
    });

    // Enviar emails baseado na mudança de status
    try {
      const statusAnterior = agendamentoAntes.status;
      const statusNovo = agendamento.status;

      // Se foi aceito ou confirmado
      if ((statusNovo === "aceito" || statusNovo === "confirmado") && statusAnterior !== statusNovo) {
        // Marcar cupom como usado se houver cupom associado ao agendamento
        const cupomAssociado = await prisma.coupon.findFirst({
          where: { appointmentId: parseInt(id) },
        });

        if (cupomAssociado && !cupomAssociado.used) {
          await prisma.coupon.update({
            where: { id: cupomAssociado.id },
            data: {
              used: true,
              usedAt: new Date(),
              usedBy: agendamento.userId,
            },
          });
          console.log(`[Admin] Cupom ${cupomAssociado.code} marcado como usado após confirmação do agendamento`);
        }

        await sendAppointmentAcceptedEmail(
          agendamento.user.email,
          agendamento.user.nomeArtistico,
          agendamento.data,
          agendamento.tipo
        );
        console.log(`[Admin] Email de aceitação enviado para ${agendamento.user.email}`);
      }

      // Se foi recusado
      if (statusNovo === "recusado" && statusAnterior !== statusNovo) {
        // Liberar cupom se houver cupom associado (desfazer associação)
        const cupomAssociado = await prisma.coupon.findFirst({
          where: { appointmentId: parseInt(id) },
        });

        if (cupomAssociado) {
          await prisma.coupon.update({
            where: { id: cupomAssociado.id },
            data: {
              appointmentId: null, // Remover associação
              // Cupom volta a ficar disponível para uso
            },
          });
          console.log(`[Admin] Cupom ${cupomAssociado.code} liberado após recusa do agendamento`);
        }

        // Buscar pagamento associado para gerar cupom no valor correto (se houver pagamento)
        const payment = await prisma.payment.findFirst({
          where: { appointmentId: parseInt(id) },
        });

        const rejectionComment = validation.data.rejectionComment || "Agendamento recusado.";

        // Gerar cupom de desconto apenas se houver pagamento (não para cupons de serviço)
        let couponCode: string | undefined;
        if (payment) {
          try {
            const coupon = await prisma.coupon.create({
              data: {
                code: generateCouponCode(),
                couponType: "reembolso", // Cupom de reembolso
                discountType: "fixed",
                discountValue: payment.amount,
                appointmentId: parseInt(id),
                expiresAt: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000), // 90 dias
              },
            });
            couponCode = coupon.code;
            console.log(`[Admin] Cupom gerado para agendamento recusado: ${couponCode}`);
          } catch (couponError: any) {
            console.error("[Admin] Erro ao gerar cupom (não crítico):", couponError);
          }
        }

        await sendAppointmentRejectedEmail(
          agendamento.user.email,
          agendamento.user.nomeArtistico,
          rejectionComment,
          couponCode
        );
        console.log(`[Admin] Email de recusa enviado para ${agendamento.user.email}`);
      }
    } catch (emailError: any) {
      console.error("[Admin] Erro ao enviar emails (não crítico):", emailError);
      // Não falhar a atualização por erro de email
    }

    return NextResponse.json({ agendamento });
  } catch (err: any) {
    if (err.message === "Acesso negado" || err.message === "Não autenticado") {
      return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
    }
    return NextResponse.json({ error: "Erro ao atualizar agendamento" }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    await requireAdmin();

    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "ID é obrigatório" }, { status: 400 });
    }

    const agendamento = await prisma.appointment.findUnique({
      where: { id: parseInt(id) },
    });

    if (!agendamento) {
      return NextResponse.json({ error: "Agendamento não encontrado" }, { status: 404 });
    }

    // Só permite excluir agendamentos recusados ou cancelados
    if (agendamento.status !== "recusado" && agendamento.status !== "cancelado") {
      return NextResponse.json(
        { error: "Apenas agendamentos recusados ou cancelados podem ser excluídos" },
        { status: 400 }
      );
    }

    await prisma.appointment.delete({
      where: { id: parseInt(id) },
    });

    return NextResponse.json({ message: "Agendamento excluído com sucesso" });
  } catch (err: any) {
    if (err.message === "Acesso negado" || err.message === "Não autenticado") {
      return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
    }
    return NextResponse.json({ error: "Erro ao excluir agendamento" }, { status: 500 });
  }
}
