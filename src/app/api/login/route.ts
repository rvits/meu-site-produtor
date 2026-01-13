import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/app/lib/prisma";
import { cookies } from "next/headers";
import { loginSchema } from "@/app/lib/validations";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    
    // ✅ Validar entrada
    const validation = loginSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.errors[0]?.message || "Dados inválidos" },
        { status: 400 }
      );
    }

    const { email, senha } = validation.data;

    const user = await prisma.user.findUnique({ where: { email } });

    if (!user) {
      // Registrar tentativa de login falhada (sem userId)
      try {
        await prisma.loginLog.create({
          data: {
            userId: null,
            ipAddress: req.headers.get("x-forwarded-for") || "unknown",
            userAgent: req.headers.get("user-agent") || "unknown",
            success: false,
          },
        });
      } catch (e) {}

      return NextResponse.json(
        { error: "Usuário ou senha inválidos." },
        { status: 401 }
      );
    }

    const senhaValida = await bcrypt.compare(senha, user.senha);

    // Registrar tentativa de login (sucesso ou falha)
    try {
      await prisma.loginLog.create({
        data: {
          userId: user.id,
          ipAddress: req.headers.get("x-forwarded-for") || "unknown",
          userAgent: req.headers.get("user-agent") || "unknown",
          success: senhaValida,
        },
      });
    } catch (e) {}

    if (!senhaValida) {
      return NextResponse.json(
        { error: "Usuário ou senha inválidos." },
        { status: 401 }
      );
    }

    // Verificar se usuário está bloqueado
    if (user.blocked) {
      return NextResponse.json(
        { error: "Conta bloqueada. Entre em contato com o suporte." },
        { status: 403 }
      );
    }

    // 🔐 CRIA SESSÃO
    const session = await prisma.session.create({
      data: {
        userId: user.id,
        expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 7), // 7 dias
      },
    });

    // 🍪 COOKIE HTTPONLY
    const cookieStore = await cookies();
    cookieStore.set("session_id", session.id, {
      httpOnly: true,
      path: "/",
      sameSite: "lax",
    });

    return NextResponse.json({
      user: {
        id: user.id,
        nomeArtistico: user.nomeArtistico,
        email: user.email,
        role: user.role,
      },
    });
  } catch (err) {
    console.error("Erro no login:", err);
    return NextResponse.json(
      { error: "Erro interno no login." },
      { status: 500 }
    );
  }
}
