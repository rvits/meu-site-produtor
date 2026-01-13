import { NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";
import { requireAuth } from "@/app/lib/auth";

export async function GET() {
  try {
    const user = await requireAuth();

    const userData = await prisma.user.findUnique({
      where: { id: user.id },
      select: {
        id: true,
        nomeArtistico: true,
        email: true,
        telefone: true,
        pais: true,
        estado: true,
        cidade: true,
        bairro: true,
        dataNascimento: true,
        estilosMusicais: true,
        nacionalidade: true,
        role: true,
        createdAt: true,
      },
    });

    if (!userData) {
      return NextResponse.json(
        { error: "Usuário não encontrado" },
        { status: 404 }
      );
    }

    return NextResponse.json(userData);
  } catch (err: any) {
    console.error("Erro /api/conta:", err);
    if (err.message === "Não autenticado") {
      return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
    }
    return NextResponse.json(
      { error: "Erro interno" },
      { status: 500 }
    );
  }
}
