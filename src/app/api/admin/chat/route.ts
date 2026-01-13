import { NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";
import { requireAdmin } from "@/app/lib/auth";
import { z } from "zod";

const messageSchema = z.object({
  chatSessionId: z.string(),
  content: z.string().min(1),
});

const acceptSchema = z.object({
  chatSessionId: z.string(),
});

export async function GET() {
  try {
    await requireAdmin();

    const sessions = await prisma.chatSession.findMany({
      orderBy: { updatedAt: "desc" },
      include: {
        user: {
          select: {
            nomeArtistico: true,
            email: true,
          },
        },
        messages: {
          orderBy: { createdAt: "asc" },
        },
      },
    });

    return NextResponse.json({ sessions });
  } catch (err: any) {
    if (err.message === "Acesso negado" || err.message === "Não autenticado") {
      return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
    }
    return NextResponse.json({ error: "Erro ao buscar sessões" }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const admin = await requireAdmin();

    const { searchParams } = new URL(req.url);
    const action = searchParams.get("action");

    if (action === "accept") {
      const body = await req.json();
      const validation = acceptSchema.safeParse(body);

      if (!validation.success) {
        return NextResponse.json({ error: "Dados inválidos" }, { status: 400 });
      }

      const session = await prisma.chatSession.update({
        where: { id: validation.data.chatSessionId },
        data: {
          adminAccepted: true,
          adminId: admin.id,
          status: "open",
        },
      });

      return NextResponse.json({ session });
    }

    return NextResponse.json({ error: "Ação inválida" }, { status: 400 });
  } catch (err: any) {
    if (err.message === "Acesso negado" || err.message === "Não autenticado") {
      return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
    }
    return NextResponse.json({ error: "Erro ao processar" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const admin = await requireAdmin();

    const body = await req.json();
    const validation = messageSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json({ error: "Dados inválidos" }, { status: 400 });
    }

    const message = await prisma.chatMessage.create({
      data: {
        chatSessionId: validation.data.chatSessionId,
        senderType: "admin",
        content: validation.data.content,
      },
    });

    // Atualizar sessão
    await prisma.chatSession.update({
      where: { id: validation.data.chatSessionId },
      data: { updatedAt: new Date() },
    });

    return NextResponse.json({ message });
  } catch (err: any) {
    if (err.message === "Acesso negado" || err.message === "Não autenticado") {
      return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
    }
    return NextResponse.json({ error: "Erro ao enviar mensagem" }, { status: 500 });
  }
}
