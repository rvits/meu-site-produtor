import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/app/lib/prisma";
import { z } from "zod";
import { sendPasswordResetEmail } from "@/app/lib/sendEmail";

const esqueciSenhaSchema = z.object({
  email: z.string().email("Email inválido"),
  novaSenha: z.string().min(6, "Senha deve ter no mínimo 6 caracteres").optional(),
});

// Gerar código aleatório de 6 dígitos
function generateResetCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

export async function POST(req: Request) {
  try {
    console.error("\n\n🔵 ========================================");
    console.error("🔵 [API] RECEBENDO REQUISIÇÃO DE RECUPERAÇÃO");
    console.error("🔵 ========================================\n");
    
    const body = await req.json();
    console.error("🔵 [API] Body recebido:", JSON.stringify(body));
    
    const validation = esqueciSenhaSchema.safeParse(body);
    if (!validation.success) {
      console.error("❌ [API] Validação falhou:", validation.error);
      return NextResponse.json(
        { error: validation.error.errors[0]?.message || "Dados inválidos" },
        { status: 400 }
      );
    }

    const { email, novaSenha } = validation.data;
    console.error("🔵 [API] Email extraído:", email);
    console.error("🔵 [API] Nova senha (modo admin):", novaSenha ? "SIM" : "NÃO");

    console.error("🔵 [API] Buscando usuário no banco de dados...");
    console.error("🔵 [API] Email buscado:", email);
    
    // Buscar com email exato (SQLite não suporta case-insensitive diretamente)
    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      console.error("⚠️ [API] Usuário não encontrado para o email:", email);
      return NextResponse.json({
        error: "email_nao_cadastrado",
        message: "Este email não possui cadastro em nosso sistema. Verifique se o email está correto ou crie uma conta.",
      }, { status: 404 });
    }
    
    console.error("✅ [API] Usuário encontrado:", user.email);

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

    // Modo normal: gerar código e enviar email
    const code = generateResetCode();
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutos

    // Invalidar códigos anteriores não usados do mesmo email
    await prisma.passwordResetCode.updateMany({
      where: {
        email,
        used: false,
      },
      data: {
        used: true,
      },
    });

    // Criar novo código
    await prisma.passwordResetCode.create({
      data: {
        email,
        code,
        expiresAt,
      },
    });

    // Enviar email
    console.error("\n\n==========================================");
    console.error("📧 [API] INICIANDO ENVIO DE EMAIL");
    console.error("📧 [API] Email destino:", email);
    console.error("📧 [API] Código gerado:", code);
    console.error("==========================================\n");
    
    let emailEnviado = false;
    let erroEmail: any = null;
    
    try {
      console.error("📧 [API] Chamando sendPasswordResetEmail...");
      await sendPasswordResetEmail(email, code);
      emailEnviado = true;
      console.error("\n✅ [API] Email enviado com SUCESSO!");
      console.error("✅ [API] Código:", code);
      console.error("✅ [API] Para:", email);
    } catch (emailError: any) {
      erroEmail = emailError;
      console.error("\n❌ ========================================");
      console.error("❌ [API] ERRO AO ENVIAR EMAIL:");
      console.error("❌ [API] Tipo:", emailError?.constructor?.name || "Desconhecido");
      console.error("❌ [API] Mensagem:", emailError?.message || "Sem mensagem");
      console.error("❌ [API] Code:", emailError?.code || "Sem código");
      console.error("❌ [API] Response:", emailError?.response || "Sem resposta");
      if (emailError?.stack) {
        console.error("❌ [API] Stack:", emailError.stack);
      }
      console.error("❌ ========================================\n");
    }
    
    console.error("\n==========================================");
    console.error("📧 [API] RESULTADO DO ENVIO");
    console.error("📧 [API] Email enviado:", emailEnviado ? "SIM" : "NÃO");
    if (erroEmail) {
      console.error("📧 [API] Erro:", erroEmail.message);
    }
    console.error("==========================================\n\n");
    
    return NextResponse.json({
      message: "Se o email existir, você receberá instruções para redefinir sua senha.",
      debug: {
        codigoGerado: code,
        emailEnviado,
        timestamp: new Date().toISOString(),
        erro: erroEmail ? {
          message: erroEmail?.message,
          code: erroEmail?.code,
          response: erroEmail?.response,
        } : null,
      },
    });
  } catch (err) {
    console.error("Erro ao processar recuperação de senha:", err);
    return NextResponse.json(
      { error: "Erro ao processar solicitação" },
      { status: 500 }
    );
  }
}
