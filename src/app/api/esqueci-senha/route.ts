import { NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";
import { z } from "zod";
import { sendPasswordResetEmail } from "@/app/lib/sendEmail";

const esqueciSenhaSchema = z.object({
  email: z.string().email("Email inválido"),
});

function generateResetCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

function allowPasswordResetDebug(): boolean {
  return (
    process.env.NODE_ENV === "development" &&
    process.env.ALLOW_PASSWORD_RESET_DEBUG === "true"
  );
}

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const validation = esqueciSenhaSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.errors[0]?.message || "Dados inválidos" },
        { status: 400 }
      );
    }

    const { email } = validation.data;

    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      return NextResponse.json(
        {
          error: "email_nao_cadastrado",
          message:
            "Este email não possui cadastro em nosso sistema. Verifique se o email está correto ou crie uma conta.",
        },
        { status: 404 }
      );
    }

    const code = generateResetCode();
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

    await prisma.passwordResetCode.updateMany({
      where: {
        email,
        used: false,
      },
      data: {
        used: true,
      },
    });

    await prisma.passwordResetCode.create({
      data: {
        email,
        code,
        expiresAt,
      },
    });

    let emailEnviado = false;
    let emailErrorMessage: string | null = null;

    try {
      await sendPasswordResetEmail(email, code);
      emailEnviado = true;
    } catch (emailError: unknown) {
      emailErrorMessage =
        emailError instanceof Error ? emailError.message : "Falha no envio";
      console.error("[esqueci-senha] Falha ao enviar email de recuperação");
    }

    if (!emailEnviado) {
      return NextResponse.json(
        {
          error: "Erro ao enviar email de recuperação. Tente novamente em instantes.",
          ...(allowPasswordResetDebug()
            ? { debug: { emailEnviado: false, erro: { message: emailErrorMessage } } }
            : {}),
        },
        { status: 502 }
      );
    }

    return NextResponse.json({
      message: "Se o email existir, você receberá instruções para redefinir sua senha.",
      ...(allowPasswordResetDebug()
        ? { debug: { emailEnviado: true, timestamp: new Date().toISOString() } }
        : {}),
    });
  } catch (err) {
    console.error("Erro ao processar recuperação de senha:", err);
    return NextResponse.json(
      { error: "Erro ao processar solicitação" },
      { status: 500 }
    );
  }
}
