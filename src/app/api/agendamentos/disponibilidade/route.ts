import { NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";

// API pública para verificar disponibilidade de horários (sem autenticação)
export async function GET() {
  try {
    // Buscar apenas agendamentos aceitos/confirmados futuros
    const agendamentos = await prisma.appointment.findMany({
      where: {
        status: { in: ["aceito", "confirmado"] },
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
