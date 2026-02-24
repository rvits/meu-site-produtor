import { NextResponse } from "next/server";
import nodemailer from "nodemailer";
import { requireAdmin } from "@/app/lib/auth";

export async function GET() {
  try {
    await requireAdmin();
    const user = process.env.SUPPORT_EMAIL;
    const pass = process.env.SUPPORT_EMAIL_PASSWORD;

    console.error("🧪 [TESTE] Verificando configuração de email...");
    console.error("🧪 [TESTE] SUPPORT_EMAIL:", user || "❌ NÃO CONFIGURADO");
    console.error("🧪 [TESTE] SUPPORT_EMAIL_PASSWORD:", pass ? "✅ Configurado" : "❌ NÃO CONFIGURADO");

    if (!user || !pass) {
      return NextResponse.json({
        error: "Email não configurado",
        details: {
          hasEmail: !!user,
          hasPassword: !!pass,
        },
      }, { status: 400 });
    }

    // Testar conexão SMTP
    const transporter = nodemailer.createTransport({
      host: "smtp.gmail.com",
      port: 587,
      secure: false,
      auth: {
        user,
        pass,
      },
      tls: {
        rejectUnauthorized: false, // Ignorar certificados não confiáveis (apenas para desenvolvimento)
      },
      debug: true,
      logger: true,
    });

    // Verificar conexão
    console.error("🧪 [TESTE] Verificando conexão SMTP...");
    await transporter.verify();
    console.error("✅ [TESTE] Conexão SMTP verificada com sucesso!");

    // Tentar enviar email de teste
    const testCode = "123456";
    const testEmail = user; // Enviar para o próprio email de origem para testar

    const info = await transporter.sendMail({
      from: `"THouse Rec - Teste" <${user}>`,
      to: testEmail,
      subject: "🧪 Teste de Email - THouse Rec",
      text: `Este é um email de teste. Se você recebeu isso, o sistema de email está funcionando!\n\nCódigo de teste: ${testCode}`,
      html: `
        <div style="font-family: Arial, sans-serif; padding: 20px; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #dc2626;">🧪 Teste de Email - THouse Rec</h2>
          <p>Este é um email de teste. Se você recebeu isso, o sistema de email está funcionando!</p>
          <div style="background-color: #f9fafb; border: 2px solid #dc2626; border-radius: 8px; padding: 20px; text-align: center; margin: 20px 0;">
            <p style="font-size: 32px; font-weight: bold; color: #1f2937; font-family: monospace;">${testCode}</p>
          </div>
          <p style="color: #6b7280; font-size: 14px;">Se você recebeu este email, o sistema está funcionando corretamente!</p>
        </div>
      `,
    });

    console.error("✅ [TESTE] Email de teste enviado!");
    console.error("📧 [TESTE] MessageId:", info.messageId);
    console.error("📧 [TESTE] Response:", info.response);

    return NextResponse.json({
      success: true,
      message: "Email de teste enviado com sucesso!",
      messageId: info.messageId,
      sentTo: testEmail,
      details: {
        from: user,
        to: testEmail,
        subject: "🧪 Teste de Email - THouse Rec",
      },
    });
  } catch (error: any) {
    if (error.message === "Acesso negado" || error.message === "Não autenticado") {
      return NextResponse.json({ error: "Acesso negado. Apenas administradores podem testar o email." }, { status: 403 });
    }
    console.error("❌ [TESTE] Erro ao testar email:");
    console.error("❌ [TESTE] Tipo:", error.constructor.name);
    console.error("❌ [TESTE] Mensagem:", error.message);
    console.error("❌ [TESTE] Code:", error.code);
    console.error("❌ [TESTE] Response:", error.response);
    console.error("❌ [TESTE] Stack:", error.stack);

    return NextResponse.json({
      success: false,
      error: "Erro ao enviar email de teste",
      details: {
        message: error.message,
        code: error.code,
        response: error.response,
      },
    }, { status: 500 });
  }
}
