import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/app/lib/prisma";
import { requireAuth } from "@/app/lib/auth";
import { updateContaSchema } from "@/app/lib/validations";

export async function POST(req: Request) {
  try {
    const user = await requireAuth();
    const body = await req.json();

    // ✅ Validar entrada
    const validation = updateContaSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.errors[0]?.message || "Dados inválidos" },
        { status: 400 }
      );
    }

    const {
      nomeArtistico,
      email,
      telefone,
      senha,
      senhaAtual,
    } = validation.data;

    const userData = await prisma.user.findUnique({
      where: { id: user.id },
    });

    if (!userData) {
      return NextResponse.json(
        { error: "Usuário não encontrado." },
        { status: 404 }
      );
    }

    // 🔐 SE MUDOU EMAIL OU SENHA → VALIDAR SENHA ATUAL
    if ((email && email !== userData.email) || senha) {
      if (!senhaAtual) {
        return NextResponse.json(
          { error: "Senha atual obrigatória para alterar dados sensíveis." },
          { status: 400 }
        );
      }

      const senhaOk = await bcrypt.compare(senhaAtual, userData.senha);

      if (!senhaOk) {
        return NextResponse.json(
          { error: "Senha atual incorreta." },
          { status: 401 }
        );
      }
    }

    // Verificar se novo email já existe
    if (email && email !== userData.email) {
      const emailEmUso = await prisma.user.findUnique({
        where: { email },
      });

      if (emailEmUso) {
        return NextResponse.json(
          { error: "Este email já está em uso." },
          { status: 400 }
        );
      }
    }

    // Preparar dados para atualização
    const updateData: any = {};
    if (nomeArtistico) updateData.nomeArtistico = nomeArtistico;
    if (email) updateData.email = email;
    if (telefone) updateData.telefone = telefone;
    if (senha) {
      updateData.senha = await bcrypt.hash(senha, 10);
    }

    /* ✅ UPDATE */
    const updated = await prisma.user.update({
      where: { id: user.id },
      data: updateData,
    });

    return NextResponse.json({
      ok: true,
      user: {
        id: updated.id,
        nomeArtistico: updated.nomeArtistico,
        email: updated.email,
      },
    });
  } catch (err: any) {
    console.error("Erro update conta:", err);
    if (err.message === "Não autenticado") {
      return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
    }
    return NextResponse.json(
      { error: "Erro interno no servidor." },
      { status: 500 }
    );
  }
}
