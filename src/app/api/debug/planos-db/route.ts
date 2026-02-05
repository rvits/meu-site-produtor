import { NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";

// Endpoint de debug - SEM autenticação (apenas para desenvolvimento local)
export async function GET() {
  try {
    // Verificar se está em desenvolvimento
    if (process.env.NODE_ENV === "production") {
      return NextResponse.json({ error: "Não disponível em produção" }, { status: 403 });
    }

    // Buscar todos os planos
    const todosPlanos = await prisma.userPlan.findMany({
      take: 20,
      orderBy: { createdAt: "desc" },
      include: {
        user: {
          select: {
            id: true,
            nomeArtistico: true,
            email: true,
          },
        },
      },
    });

    // Buscar o plano mais recente
    const planoMaisRecente = todosPlanos[0] || null;

    return NextResponse.json({
      totalPlanos: todosPlanos.length,
      planos: todosPlanos.map(p => ({
        id: p.id,
        planId: p.planId,
        planName: p.planName,
        status: p.status,
        userId: p.userId,
        userEmail: p.user?.email,
        userName: p.user?.nomeArtistico,
        startDate: p.startDate instanceof Date ? p.startDate.toISOString() : p.startDate,
        endDate: p.endDate instanceof Date ? p.endDate.toISOString() : p.endDate,
        createdAt: p.createdAt instanceof Date ? p.createdAt.toISOString() : p.createdAt,
      })),
      planoMaisRecente: planoMaisRecente ? {
        id: planoMaisRecente.id,
        planId: planoMaisRecente.planId,
        planName: planoMaisRecente.planName,
        status: planoMaisRecente.status,
        userId: planoMaisRecente.userId,
        userEmail: planoMaisRecente.user?.email,
        userName: planoMaisRecente.user?.nomeArtistico,
        startDate: planoMaisRecente.startDate instanceof Date ? planoMaisRecente.startDate.toISOString() : planoMaisRecente.startDate,
        endDate: planoMaisRecente.endDate instanceof Date ? planoMaisRecente.endDate.toISOString() : planoMaisRecente.endDate,
      } : null,
    });
  } catch (err: any) {
    console.error("[Debug Planos DB] Erro:", err);
    return NextResponse.json(
      { 
        error: err.message || "Erro ao buscar planos",
        stack: err.stack
      },
      { status: 500 }
    );
  }
}
