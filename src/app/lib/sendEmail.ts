import nodemailer from "nodemailer";

/**
 * Envia email de solicitação de atendimento humano.
 * Se as credenciais não existirem, apenas loga no console
 * (não quebra o chat nem o backend).
 */
export async function sendHumanSupportEmail(userMessage: string) {
  const user = process.env.SUPPORT_EMAIL;
  const pass = process.env.SUPPORT_EMAIL_PASSWORD;

  // 🔒 Se ainda não houver email configurado, apenas registra
  if (!user || !pass) {
    console.warn("📧 Email de suporte NÃO configurado.");
    console.warn("Mensagem do usuário:", userMessage);
    return;
  }

  const transporter = nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 587,
    secure: false,
    auth: {
      user,
      pass,
    },
  });

  const destEmail = process.env.SUPPORT_DEST_EMAIL || "tremv03021@gmail.com";

  await transporter.sendMail({
    from: `"THouse Rec — Suporte" <${user}>`,
    to: destEmail,
    subject: "👤 Atendimento humano solicitado no chat",
    html: `
      <h2>Atendimento humano solicitado</h2>
      <p><strong>Mensagem do usuário:</strong></p>
      <p>${userMessage}</p>
      <hr />
      <p>Acesse o painel admin para responder o cliente.</p>
    `,
  });
}
