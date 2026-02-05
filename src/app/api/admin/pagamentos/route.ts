import { NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";
import { requireAdmin } from "@/app/lib/auth";

export async function GET() {
  try {
    await requireAdmin();

    const pagamentos = await prisma.payment.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        user: {
          select: {
            id: true,
            nomeArtistico: true,
            nomeSocial: true,
            email: true,
            telefone: true,
            cpf: true,
            pais: true,
            estado: true,
            cidade: true,
            bairro: true,
            cep: true,
            dataNascimento: true,
            sexo: true,
            genero: true,
            generoOutro: true,
            nacionalidade: true,
            createdAt: true,
          },
        },
      },
    });

    return NextResponse.json({ pagamentos });
  } catch (err: any) {
    if (err.message === "Acesso negado" || err.message === "Não autenticado") {
      return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
    }
    console.error("Erro ao buscar pagamentos:", err);
    return NextResponse.json({ error: "Erro ao buscar pagamentos" }, { status: 500 });
  }
}
