import { NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";

// API pública para verificar disponibilidade de horários (sem autenticação)
export async function GET() {
  try {
    // Alinha com enforcement de escrita: qualquer status operacional (exceto cancelado)
    // ocupa o slot — evita UI livre + 409 no checkout (SYNC-01A / A8).
    const agendamentos = await prisma.appointment.findMany({
      where: {
        status: { not: "cancelado" },
        data: { gte: new Date() },
      },
      select: {
        data: true,
        duracaoMinutos: true,
      },
      orderBy: {
        data: "asc",
      },
    });

    // Serializar datas para garantir formato correto
    const agendamentosSerializados = agendamentos.map((a) => ({
      data: a.data instanceof Date ? a.data.toISOString() : a.data,
      duracaoMinutos: a.duracaoMinutos || 60,
    }));

    return NextResponse.json({ agendamentos: agendamentosSerializados });
  } catch (err: any) {
    console.error("Erro ao buscar disponibilidade:", err);
    return NextResponse.json(
      { error: "Erro ao buscar disponibilidade" },
      { status: 500 }
    );
  }
}
