import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/app/lib/prisma";
import { z } from "zod";

const esqueciSenhaSchema = z.object({
  email: z.string().email("Email inválido"),
  novaSenha: z.string().min(6, "Senha deve ter no mínimo 6 caracteres").optional(),
});

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

    const { email, novaSenha } = validation.data;

    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      // Por segurança, não revelamos se o email existe
      return NextResponse.json({
        message: "Se o email existir, você receberá instruções para redefinir sua senha.",
      });
    }

    // Se novaSenha foi fornecida (modo admin), resetar diretamente
    if (novaSenha) {
      const hash = await bcrypt.hash(novaSenha, 10);
      
      await prisma.user.update({
        where: { id: user.id },
        data: { senha: hash },
      });

      return NextResponse.json({
        message: "Senha alterada com sucesso!",
      });
    }

    // Modo normal: enviar email (por enquanto apenas retorna mensagem)
    // TODO: Implementar envio de email com token de recuperação
    
    return NextResponse.json({
      message: "Se o email existir, você receberá instruções para redefinir sua senha.",
    });
  } catch (err) {
    console.error("Erro ao processar recuperação de senha:", err);
    return NextResponse.json(
      { error: "Erro ao processar solicitação" },
      { status: 500 }
    );
  }
}
