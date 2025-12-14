import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/app/lib/prisma";

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const {
      id,
      nomeArtistico,
      email,
      telefone,
      pais,
      estado,
      cidade,
      bairro,
      dataNascimento,
      estilosMusicais,
      nacionalidade,
      foto,
      senhaAtual,
    } = body;

    if (!id) {
      return NextResponse.json(
        { error: "Usuário não identificado." },
        { status: 400 }
      );
    }

    const user = await prisma.user.findUnique({
      where: { id },
    });

    if (!user) {
      return NextResponse.json(
        { error: "Usuário não encontrado." },
        { status: 404 }
      );
    }

    /* 🔐 SE O EMAIL MUDOU → VALIDAR SENHA */
    if (email !== user.email) {
      if (!senhaAtual) {
        return NextResponse.json(
          { error: "Senha atual obrigatória para alterar o email." },
          { status: 400 }
        );
      }

      const senhaOk = await bcrypt.compare(senhaAtual, user.senha);

      if (!senhaOk) {
        return NextResponse.json(
          { error: "Senha atual incorreta." },
          { status: 401 }
        );
      }

      // verificar se novo email já existe
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

    /* ✅ UPDATE */
    const updated = await prisma.user.update({
      where: { id },
      data: {
        nomeArtistico,
        email,
        telefone,
        pais,
        estado,
        cidade,
        bairro,
        dataNascimento: new Date(dataNascimento),
        estilosMusicais,
        nacionalidade,
        foto,
      },
    });

    return NextResponse.json({
      ok: true,
      user: {
        id: updated.id,
        nomeArtistico: updated.nomeArtistico,
        email: updated.email,
      },
    });
  } catch (err) {
    console.error("Erro update conta:", err);
    return NextResponse.json(
      { error: "Erro interno no servidor." },
      { status: 500 }
    );
  }
}
