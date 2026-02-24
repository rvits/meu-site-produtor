import { NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";

/**
 * Endpoint para renovar/expirar planos automaticamente
 * Deve ser chamado diariamente via cron job ou agendador de tarefas
 */
export async function GET(req: Request) {
  try {
    // Verificar autenticação via header (cron secret)
    const authHeader = req.headers.get("authorization");
    const cronSecret = process.env.CRON_SECRET;

    if (process.env.NODE_ENV === "production" && !cronSecret) {
      console.error("[Cron] CRON_SECRET não configurado em produção");
      return NextResponse.json({ error: "CRON_SECRET não configurado" }, { status: 500 });
    }
    const expectedSecret = cronSecret || "default-secret-change-in-production";
    if (authHeader !== `Bearer ${expectedSecret}`) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }

    const agora = new Date();
    const planosExpirados: string[] = [];
    const planosRenovados: string[] = [];

    // Buscar planos ativos que expiraram
    const planosExpiradosList = await prisma.userPlan.findMany({
      where: {
        status: "active",
        endDate: {
          lte: agora,
        },
      },
    });

    // Marcar planos como inativos
    for (const plano of planosExpiradosList) {
      await prisma.userPlan.update({
        where: { id: plano.id },
        data: { status: "inactive" },
      });
      planosExpirados.push(plano.id);
      console.log(`[Cron] Plano ${plano.id} expirado e marcado como inativo`);
    }

    // Buscar planos que estão próximos de expirar (opcional: enviar notificação)
    const planosProximosExpirar = await prisma.userPlan.findMany({
      where: {
        status: "active",
        endDate: {
          gte: agora,
          lte: new Date(agora.getTime() + 7 * 24 * 60 * 60 * 1000), // 7 dias
        },
      },
    });

    console.log(`[Cron] ${planosExpirados.length} planos expirados, ${planosProximosExpirar.length} próximos de expirar`);

    return NextResponse.json({
      success: true,
      planosExpirados: planosExpirados.length,
      planosProximosExpirar: planosProximosExpirar.length,
      message: "Processamento concluído",
    });
  } catch (error: any) {
    console.error("[Cron] Erro ao processar renovações:", error);
    return NextResponse.json(
      { error: "Erro ao processar renovações" },
      { status: 500 }
    );
  }
}
