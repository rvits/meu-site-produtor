import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/app/lib/prisma";
import { registroSchema } from "@/app/lib/validations";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const body = await req.json();

    // ✅ Validar entrada
    const validation = registroSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.errors[0]?.message || "Dados inválidos" },
        { status: 400 }
      );
    }

    const {
      nomeArtistico,
      email,
      senha,
      telefone,
      pais,
      estado,
      cidade,
      bairro,
      dataNascimento,
      estilosMusicais,
      nacionalidade,
    } = body;

    const existe = await prisma.user.findUnique({
      where: { email },
    });

    if (existe) {
      return NextResponse.json(
        { error: "Email já registrado." },
        { status: 400 }
      );
    }

    const hash = await bcrypt.hash(senha, 10);

    const user = await prisma.user.create({
      data: {
        nomeArtistico,
        email,
        senha: hash,
        telefone,
        pais,
        estado,
        cidade,
        bairro,
        dataNascimento: new Date(dataNascimento),
        estilosMusicais: estilosMusicais || null,
        nacionalidade: nacionalidade || null,
        role: "USER",
      },
    });

    // 🔥 PADRÃO ÚNICO
    return NextResponse.json({
      user: {
        id: user.id,
        nomeArtistico: user.nomeArtistico,
        email: user.email,
        role: user.role,
      },
    });
  } catch (err) {
    console.error("❌ ERRO REGISTRO:", err);
    return NextResponse.json(
      { error: "Erro interno no servidor." },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json(
    { error: "Método não permitido" },
    { status: 405 }
  );
}
