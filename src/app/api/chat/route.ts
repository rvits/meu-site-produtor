import { NextResponse } from "next/server";
import { sendHumanSupportEmail } from "@/app/lib/sendEmail";
import { askAI } from "@/app/lib/ai";
import { requireAuth } from "@/app/lib/auth";
import { prisma } from "@/app/lib/prisma";
import { chatSchema } from "@/app/lib/validations";
import { getRAGContext, formatContextForPrompt } from "@/app/lib/rag";
import { getQuickAnswer } from "@/app/lib/quickAnswers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    // 🔒 Verificar autenticação
    const user = await requireAuth();

    const body = await req.json();
    
    // ✅ Validar entrada
    const validation = chatSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.errors[0]?.message || "Dados inválidos" },
        { status: 400 }
      );
    }

    const { message, sessionId, messages: bodyMessages } = validation.data;
    const messages = bodyMessages || body.messages || [];

    // ===============================
    // ÚLTIMA MENSAGEM
    // ===============================
    const ultimaMensagem =
      messages[messages.length - 1]?.content?.toLowerCase() || message?.toLowerCase() || "";

    // Buscar ou criar sessão de chat
    let chatSession;
    try {
      if (sessionId) {
        chatSession = await prisma.chatSession.findUnique({
          where: { id: sessionId },
        });
      }
      
      if (!chatSession) {
        chatSession = await prisma.chatSession.create({
          data: {
            userId: user.id,
            status: "open",
          },
        });
      }

      // Salvar mensagem do usuário
      await prisma.chatMessage.create({
        data: {
          chatSessionId: chatSession.id,
          senderType: "user",
          content: message || messages[messages.length - 1]?.content || "",
        },
      });
    } catch (e) {
      console.error("Erro ao criar sessão de chat:", e);
    }

    // ===============================
    // ESCALADA PARA HUMANO
    // ===============================
    if (
      ultimaMensagem.includes("humano") ||
      ultimaMensagem.includes("atendente")
    ) {
      // Atualizar sessão para solicitar humano
      try {
        if (chatSession) {
          await prisma.chatSession.update({
            where: { id: chatSession.id },
            data: {
              humanRequested: true,
              status: "pending_human",
            },
          });
        }
      } catch (e) {}

      // ⚠️ Email só envia se credenciais existirem
      if (
        process.env.SUPPORT_EMAIL &&
        process.env.SUPPORT_EMAIL_PASSWORD
      ) {
        await sendHumanSupportEmail(
          messages[messages.length - 1]?.content || message || ""
        );
      }

      const reply = "Vou chamar um atendente humano para te ajudar melhor com isso.";

      // Salvar resposta da AI
      try {
        if (chatSession) {
          await prisma.chatMessage.create({
            data: {
              chatSessionId: chatSession.id,
              senderType: "ai",
              content: reply,
            },
          });
        }
      } catch (e) {}

      return NextResponse.json({
        reply,
        sessionId: chatSession?.id,
      });
    }

    // ===============================
    // RESPOSTAS PRÉ-DEFINIDAS (PERGUNTAS CLÁSSICAS)
    // ===============================
    const quickAnswer = getQuickAnswer(ultimaMensagem);
    if (quickAnswer) {
      // Salvar resposta da AI
      try {
        if (chatSession) {
          await prisma.chatMessage.create({
            data: {
              chatSessionId: chatSession.id,
              senderType: "ai",
              content: quickAnswer,
            },
          });
        }
      } catch (e) {}

      return NextResponse.json({
        reply: quickAnswer,
        sessionId: chatSession?.id,
      });
    }

    // ===============================
    // SISTEMA RAG - BUSCAR CONTEXTO RELEVANTE
    // ===============================
    let ragContext;
    let contextPrompt = "";
    try {
      ragContext = await getRAGContext(ultimaMensagem);
      contextPrompt = formatContextForPrompt(ragContext);
      console.log("[Chat] Contexto RAG obtido:", contextPrompt.substring(0, 200));
    } catch (e) {
      console.error("Erro ao obter contexto RAG:", e);
    }

    // ===============================
    // IA INTELIGENTE COM CONTEXTO DO SITE
    // ===============================
    console.log("[Chat] Chamando IA...");
    const aiReply = await askAI(
      messages.map((m: any) => ({
        role: m.role === "ai" ? "assistant" : "user",
        content: m.content,
      })),
      { context: contextPrompt }
    );
    console.log("[Chat] Resposta da IA:", aiReply ? aiReply.substring(0, 100) : "null");

    const finalReply = aiReply ||
      "Não consegui entender completamente. Posso chamar um atendente humano para te ajudar melhor?";

    // Salvar resposta da AI
    try {
      if (chatSession) {
        await prisma.chatMessage.create({
          data: {
            chatSessionId: chatSession.id,
            senderType: "ai",
            content: finalReply,
          },
        });
      }
    } catch (e) {}

    return NextResponse.json({
      reply: finalReply,
      sessionId: chatSession?.id,
    });
  } catch (err: any) {
    console.error("Erro no chat:", err);
    if (err.message === "Não autenticado") {
      return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
    }
    return NextResponse.json(
      { error: "Erro ao processar mensagem" },
      { status: 500 }
    );
  }
}
