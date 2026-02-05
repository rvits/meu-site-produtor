import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/app/lib/prisma";
import { registroSchema } from "@/app/lib/validations";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    console.error("\n🔵 ========================================");
    console.error("🔵 [REGISTRO] Recebendo requisição de registro");
    console.error("🔵 ========================================\n");
    
    const body = await req.json();
    console.error("🔵 [REGISTRO] Body recebido:", JSON.stringify(body, null, 2));

    // ✅ Validar entrada
    const validation = registroSchema.safeParse(body);
    if (!validation.success) {
      console.error("❌ [REGISTRO] Validação falhou:", validation.error.errors);
      return NextResponse.json(
        { error: validation.error.errors[0]?.message || "Dados inválidos" },
        { status: 400 }
      );
    }
    
    console.error("✅ [REGISTRO] Validação passou");

    const {
      nomeCompleto,
      nomeArtistico,
      nomeSocial,
      email,
      senha,
      telefone,
      cpf,
      pais,
      estado,
      cidade,
      bairro,
      dataNascimento,
      sexo,
      genero,
      generoOutro,
      estilosMusicais,
      nacionalidade,
    } = validation.data;

    console.error("🔵 [REGISTRO] Verificando se email já existe:", email);
    
    // Buscar com email exato (SQLite não suporta case-insensitive diretamente)
    const existe = await prisma.user.findUnique({
      where: { email },
    });

    if (existe) {
      console.error("❌ [REGISTRO] Email já registrado:", email);
      console.error("❌ [REGISTRO] Usuário existente:", {
        id: existe.id,
        email: existe.email,
        nomeArtistico: existe.nomeArtistico,
        nomeCompleto: existe.nomeCompleto,
      });
      return NextResponse.json(
        { error: "Email já registrado." },
        { status: 400 }
      );
    }
    
    console.error("✅ [REGISTRO] Email não existe, pode criar conta");

    const hash = await bcrypt.hash(senha, 10);

    const user = await prisma.user.create({
      data: {
        nomeCompleto,
        nomeArtistico,
        nomeSocial: nomeSocial || null,
        email,
        senha: hash,
        telefone,
        cpf: cpf || null,
        pais,
        estado,
        cidade,
        bairro,
        dataNascimento: new Date(dataNascimento),
        sexo: sexo || null,
        genero: genero || null,
        generoOutro: generoOutro || null,
        estilosMusicais: estilosMusicais || null,
        nacionalidade: nacionalidade || null,
        role: "USER",
      },
    });
    
    console.error("✅ [REGISTRO] Usuário criado com sucesso!");
    console.error("✅ [REGISTRO] ID do usuário:", user.id);
    console.error("✅ [REGISTRO] Email:", user.email);
    console.error("✅ [REGISTRO] Nome Completo:", user.nomeCompleto);
    console.error("✅ [REGISTRO] Nome Artístico:", user.nomeArtistico);

    // 🔥 PADRÃO ÚNICO
    return NextResponse.json({
      user: {
        id: user.id,
        nomeArtistico: user.nomeArtistico,
        email: user.email,
        role: user.role,
      },
    });
  } catch (err: any) {
    console.error("\n❌ ========================================");
    console.error("❌ [REGISTRO] ERRO AO REGISTRAR:");
    console.error("❌ [REGISTRO] Tipo:", err?.constructor?.name || "Desconhecido");
    console.error("❌ [REGISTRO] Mensagem:", err?.message || "Sem mensagem");
    console.error("❌ [REGISTRO] Code:", err?.code || "Sem código");
    if (err?.stack) {
      console.error("❌ [REGISTRO] Stack:", err.stack);
    }
    console.error("❌ ========================================\n");
    
    // Se for erro de constraint único (email duplicado)
    if (err?.code === 'P2002' || err?.message?.includes('Unique constraint') || err?.message?.includes('UNIQUE constraint')) {
      return NextResponse.json(
        { error: "Email já registrado." },
        { status: 400 }
      );
    }
    
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
