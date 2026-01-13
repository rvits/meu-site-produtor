import { NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";
import { z } from "zod";

const askFaqSchema = z.object({
  question: z.string().min(10, "Descreva sua dúvida com pelo menos 10 caracteres"),
  userName: z.string().min(1, "O nome é obrigatório"),
  userEmail: z.string().email("Email inválido").min(1, "O e-mail é obrigatório"),
});

export async function POST(req: Request) {
  try {
    const body = await req.json();
    
    // ✅ Validar entrada
    const validation = askFaqSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.errors[0]?.message || "Dados inválidos" },
        { status: 400 }
      );
    }

    const { question, userName, userEmail } = validation.data;

    const novaPergunta = await prisma.userQuestion.create({
      data: {
        question: question.trim(),
        userName: userName.trim(),
        userEmail: userEmail.trim(),
      },
    });

    return NextResponse.json({ ok: true, question: novaPergunta });
  } catch (e) {
    console.error("Erro ao registrar dúvida no FAQ:", e);
    return NextResponse.json(
      { error: "Erro ao enviar sua dúvida. Tente novamente em alguns instantes." },
      { status: 500 }
    );
  }
}
