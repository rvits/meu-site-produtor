import { NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";
import { requireAdmin } from "@/app/lib/auth";
import { sendAppointmentCancelledEmail } from "@/app/lib/sendEmail";

export async function POST(req: Request) {
  try {
    await requireAdmin();

    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "ID é obrigatório" }, { status: 400 });
    }

    // Justificativa é obrigatória para cancelamento pelo admin
    let cancellationComment: string | undefined;
    try {
      const bodyText = await req.text();
      if (bodyText && bodyText.trim()) {
        const body = JSON.parse(bodyText);
        cancellationComment = (body.cancellationComment || "").trim();
      }
    } catch (parseError: any) {
      console.warn("[Admin] Erro ao parsear body do cancelamento:", parseError);
    }
    if (!cancellationComment || cancellationComment.length < 3) {
      return NextResponse.json(
        { error: "Justificativa do cancelamento é obrigatória (mínimo 3 caracteres)." },
        { status: 400 }
      );
    }

    const agendamento = await prisma.appointment.findUnique({
      where: { id: parseInt(id) },
      include: {
        user: {
          select: {
            email: true,
            nomeArtistico: true,
          },
        },
      },
    });

    if (!agendamento) {
      return NextResponse.json({ error: "Agendamento não encontrado" }, { status: 404 });
    }

    // Pode cancelar agendamentos pendentes, aceitos ou confirmados
    // Agendamentos pendentes podem ser cancelados (especialmente os feitos com cupom)
    if (agendamento.status === "cancelado" || agendamento.status === "recusado") {
      return NextResponse.json(
        { error: "Este agendamento já foi cancelado ou recusado" },
        { status: 400 }
      );
    }

    // Liberar cupom se houver cupom associado (desfazer associação)
    // IMPORTANTE: Quando um agendamento é cancelado, SEMPRE liberar o cupom associado
    // Buscar cupom associado ao agendamento
    let cupomAssociado = await prisma.coupon.findFirst({
      where: { appointmentId: parseInt(id) },
    });
    
    // Se não encontrou pelo appointmentId, tentar buscar por usedBy e usado recentemente
    // (pode ser um cupom criado com código antigo que foi marcado como usado mas não tem appointmentId)
    // OU um cupom que foi usado diretamente sem passar pela aprovação
    if (!cupomAssociado) {
      console.log(`[Admin] 🔍 Cupom não encontrado pelo appointmentId, tentando buscar por usedBy...`);
      // Buscar cupons usados recentemente pelo mesmo usuário (últimas 48 horas)
      const cuponsUsados = await prisma.coupon.findMany({
        where: {
          usedBy: agendamento.userId,
          used: true,
          usedAt: {
            gte: new Date(Date.now() - 48 * 60 * 60 * 1000), // Últimas 48 horas
          },
        },
        orderBy: { usedAt: "desc" },
      });
      
      // Se encontrou cupons usados, verificar se algum pode estar relacionado a este agendamento
      // (por data/hora aproximada ou por ser o mais recente)
      if (cuponsUsados.length > 0) {
        // Pegar o cupom mais recente que foi usado
        cupomAssociado = cuponsUsados[0];
        console.log(`[Admin] 🔍 Cupom encontrado por usedBy (mais recente): ${cupomAssociado.code}, usado em: ${cupomAssociado.usedAt}`);
      }
    }

    if (cupomAssociado) {
      // Guardar o status ANTES de cancelar para verificar
      const statusAntesCancelamento = agendamento.status;
      
      console.log(`[Admin] 🔍 Cupom encontrado: ${cupomAssociado.code}, usado: ${cupomAssociado.used}, status agendamento: ${statusAntesCancelamento}`);
      
      // IMPORTANTE: Se o agendamento foi cancelado, SEMPRE liberar o cupom
      // Independente do status anterior (pendente, aceito, confirmado)
      // O cupom só deve ser consumido quando o agendamento é realmente realizado
      // Se foi cancelado, o cupom deve voltar a ficar disponível
      const deveLiberar = true; // Sempre liberar quando cancelar
      
      console.log(`[Admin] 🔍 Liberando cupom após cancelamento (status anterior: ${statusAntesCancelamento}, usado: ${cupomAssociado.used})`);
      
      if (deveLiberar) {
        const cupomAtualizado = await prisma.coupon.update({
          where: { id: cupomAssociado.id },
          data: {
            appointmentId: null, // Remover associação
            used: false, // Marcar como não usado
            usedAt: null, // Limpar data de uso
            usedBy: null, // Limpar usuário que usou
          },
        });
        console.log(`[Admin] ✅ Cupom ${cupomAssociado.code} liberado após cancelamento do agendamento (status anterior: ${statusAntesCancelamento})`);
        console.log(`[Admin] ✅ Cupom atualizado: usado=${cupomAtualizado.used}, appointmentId=${cupomAtualizado.appointmentId}`);
      }
    } else {
      console.log(`[Admin] ℹ️ Nenhum cupom associado ao agendamento ${id}`);
    }

    const cancelledAt = new Date();
    const updatePayload = {
      status: "cancelado" as const,
      cancelReason: cancellationComment,
      cancelledAt,
    };

    try {
      await prisma.appointment.update({
        where: { id: parseInt(id) },
        data: updatePayload,
      });
      // Atualizar serviços vinculados ao agendamento para "cancelado" (Serviços gerais)
      await prisma.service.updateMany({
        where: { appointmentId: parseInt(id) },
        data: { status: "cancelado" },
      });
    } catch (updateErr: any) {
      // Se falhar por coluna inexistente (banco desatualizado), tentar só status
      const msg = String(updateErr?.message || "").toLowerCase();
      if (msg.includes("invalid") || msg.includes("unknown column") || msg.includes("does not exist")) {
        try {
          await prisma.appointment.update({
            where: { id: parseInt(id) },
            data: { status: "cancelado" },
          });
          console.warn("[Admin] Cancelamento salvo só com status (colunas cancelReason/cancelledAt podem não existir no banco). Rode: npx prisma db push");
        } catch (fallbackErr: any) {
          console.error("[Admin] Erro no update (fallback):", fallbackErr);
          return NextResponse.json(
            { error: "Erro ao salvar cancelamento. Atualize o banco: no terminal rode 'npx prisma db push' e reinicie o servidor." },
            { status: 500 }
          );
        }
      } else {
        console.error("[Admin] Erro no update:", updateErr);
        return NextResponse.json(
          { error: "Erro ao salvar cancelamento. Tente novamente." },
          { status: 500 }
        );
      }
    }

    console.log(`[Admin] Agendamento ${id} cancelado. Justificativa salva. Usuário pode escolher reembolso ou cupom na Minha Conta.`);

    // Email informando cancelamento e que o usuário deve escolher reembolso ou cupom na Minha Conta
    try {
      await sendAppointmentCancelledEmail(
        agendamento.user.email,
        agendamento.user.nomeArtistico,
        agendamento.data,
        cancellationComment,
        undefined // sem cupom aqui; usuário escolhe na conta
      );
      console.log(`[Admin] Email de cancelamento enviado para ${agendamento.user.email}`);
    } catch (emailError: any) {
      console.error("[Admin] Erro ao enviar email (não crítico):", emailError);
    }

    return NextResponse.json({ 
      message: "Agendamento cancelado com sucesso",
      agendamento: {
        id: agendamento.id,
        status: "cancelado",
      },
    });
  } catch (err: any) {
    if (err.message === "Acesso negado" || err.message === "Não autenticado") {
      return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
    }
    console.error("[Admin] Erro ao cancelar agendamento:", err);
    const mensagem = err?.message && !String(err.message).includes("Invalid `prisma") 
      ? err.message 
      : "Erro ao cancelar agendamento. Se persistir, rode no terminal: npx prisma db push";
    return NextResponse.json({ error: mensagem }, { status: 500 });
  }
}
