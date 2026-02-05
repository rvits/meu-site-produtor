import { NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";
import { requireAdmin } from "@/app/lib/auth";

/**
 * Endpoint para corrigir cupons antigos que foram marcados como usados
 * mas estão associados a agendamentos pendentes ou cancelados
 */
export async function POST() {
  try {
    await requireAdmin();

    // Buscar cupons que estão marcados como usados mas têm appointmentId
    const cuponsComProblema = await prisma.coupon.findMany({
      where: {
        used: true,
        appointmentId: { not: null },
      },
    });

    console.log(`[Corrigir Cupons] Encontrados ${cuponsComProblema.length} cupons com possível problema`);

    // Buscar appointments manualmente
    const appointmentIds = cuponsComProblema
      .map(c => c.appointmentId)
      .filter((id): id is number => id !== null);
    
    const appointments = appointmentIds.length > 0 ? await prisma.appointment.findMany({
      where: { id: { in: appointmentIds } },
      select: {
        id: true,
        status: true,
      },
    }) : [];

    const appointmentsMap = new Map(appointments.map(a => [a.id, a]));

    let corrigidos = 0;
    let liberados = 0;

    for (const cupom of cuponsComProblema) {
      if (!cupom.appointmentId || !appointmentsMap.has(cupom.appointmentId)) continue;

      const agendamento = appointmentsMap.get(cupom.appointmentId)!;

      // Se o agendamento está pendente ou cancelado, liberar o cupom
      if (agendamento.status === "pendente" || agendamento.status === "cancelado" || agendamento.status === "recusado") {
        await prisma.coupon.update({
          where: { id: cupom.id },
          data: {
            used: false,
            usedAt: null,
            usedBy: null,
            appointmentId: agendamento.status === "cancelado" || agendamento.status === "recusado" ? null : cupom.appointmentId,
          },
        });
        liberados++;
        console.log(`[Corrigir Cupons] ✅ Cupom ${cupom.code} liberado (agendamento ${agendamento.status})`);
      } else if (agendamento.status === "aceito" || agendamento.status === "confirmado") {
        // Se o agendamento foi confirmado, o cupom deve estar usado - está correto
        corrigidos++;
        console.log(`[Corrigir Cupons] ✓ Cupom ${cupom.code} está correto (agendamento ${agendamento.status})`);
      }
    }

    return NextResponse.json({
      success: true,
      message: `Correção concluída: ${liberados} cupons liberados, ${corrigidos} cupons verificados como corretos`,
      liberados,
      corrigidos,
      total: cuponsComProblema.length,
    });
  } catch (err: any) {
    if (err.message === "Acesso negado" || err.message === "Não autenticado") {
      return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
    }
    console.error("[Corrigir Cupons] Erro:", err);
    return NextResponse.json({ error: "Erro ao corrigir cupons" }, { status: 500 });
  }
}
