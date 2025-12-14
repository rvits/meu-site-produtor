import { NextResponse } from "next/server";
import { sendHumanSupportEmail } from "@/app/lib/sendEmail";
import { askAI } from "@/app/lib/ai";

export async function POST(req: Request) {
  try {
    const { messages } = await req.json();

    // ===============================
    // FAQ SIMPLES (SEM BANCO)
    // ===============================
    const faq = [
      {
        keywords: ["agendamento", "agenda", "marcar"],
        resposta:
          "O agendamento funciona pela página de agendamento. Você escolhe os serviços, a data e o horário disponíveis.",
      },
      {
        keywords: ["preço", "preços", "valor", "valores"],
        resposta:
          "Os valores variam conforme o serviço. Você pode ver todos os preços na página de agendamento.",
      },
      {
        keywords: ["planos", "plano", "mensal", "anual"],
        resposta:
          "A THouse Rec oferece planos mensais e anuais. Confira todos os detalhes na página de planos.",
      },
      {
        keywords: ["serviços", "oferecem", "trabalham"],
        resposta:
          "Oferecemos sessão de estúdio, captação, mixagem, masterização, mix + master e sonoplastia e produção de beats.",
      },
    ];

    // ===============================
    // ÚLTIMA MENSAGEM
    // ===============================
    const ultimaMensagem =
      messages[messages.length - 1]?.content?.toLowerCase() || "";

    // ===============================
    // ESCALADA PARA HUMANO
    // ===============================
    if (
      ultimaMensagem.includes("humano") ||
      ultimaMensagem.includes("atendente")
    ) {
      // ⚠️ Email só envia se credenciais existirem
      if (
        process.env.SUPPORT_EMAIL &&
        process.env.SUPPORT_EMAIL_PASSWORD
      ) {
        await sendHumanSupportEmail(
          messages[messages.length - 1]?.content || ""
        );
      }

      return NextResponse.json({
        reply: "Vou chamar um atendente humano para te ajudar melhor com isso.",
      });
    }

    // ===============================
    // MATCH COM FAQ
    // ===============================
    for (const item of faq) {
      if (item.keywords.some((k) => ultimaMensagem.includes(k))) {
        return NextResponse.json({ reply: item.resposta });
      }
    }

    // ===============================
    // IA REAL (OPENAI) — FALLBACK FINAL
    // ===============================
    const aiReply = await askAI(
      messages.map((m: any) => ({
        role: m.role === "ai" ? "assistant" : "user",
        content: m.content,
      }))
    );

    return NextResponse.json({
      reply:
        aiReply ||
        "Não consegui entender completamente. Posso chamar um atendente humano?",
    });
  } catch (err) {
    console.error("Erro no chat:", err);
    return NextResponse.json(
      { error: "Erro ao processar mensagem" },
      { status: 500 }
    );
  }
}
