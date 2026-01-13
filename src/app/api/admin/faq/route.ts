import { NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";
import { requireAdmin } from "@/app/lib/auth";
import { faqSchema } from "@/app/lib/validations";
import { z } from "zod";

const updateFaqSchema = z.object({
  question: z.string().optional(),
  answer: z.string().optional(),
});

const blockCommentSchema = z.object({
  blocked: z.boolean(),
});

export async function GET() {
  try {
    await requireAdmin();

    const faqs = await prisma.fAQ.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        userQuestions: {
          orderBy: { createdAt: "desc" },
        },
      },
    });

    return NextResponse.json({ faqs });
  } catch (err: any) {
    if (err.message === "Acesso negado" || err.message === "Não autenticado") {
      return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
    }
    return NextResponse.json({ error: "Erro ao buscar FAQs" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    await requireAdmin();

    const body = await req.json();
    const validation = faqSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json({ error: "Dados inválidos" }, { status: 400 });
    }

    const faq = await prisma.fAQ.create({
      data: validation.data,
    });

    return NextResponse.json({ faq });
  } catch (err: any) {
    if (err.message === "Acesso negado" || err.message === "Não autenticado") {
      return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
    }
    return NextResponse.json({ error: "Erro ao criar FAQ" }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    await requireAdmin();

    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "ID é obrigatório" }, { status: 400 });
    }

    const body = await req.json();
    const validation = updateFaqSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json({ error: "Dados inválidos" }, { status: 400 });
    }

    const faq = await prisma.fAQ.update({
      where: { id },
      data: validation.data,
    });

    return NextResponse.json({ faq });
  } catch (err: any) {
    if (err.message === "Acesso negado" || err.message === "Não autenticado") {
      return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
    }
    return NextResponse.json({ error: "Erro ao atualizar FAQ" }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    await requireAdmin();

    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "ID é obrigatório" }, { status: 400 });
    }

    await prisma.fAQ.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (err: any) {
    if (err.message === "Acesso negado" || err.message === "Não autenticado") {
      return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
    }
    return NextResponse.json({ error: "Erro ao deletar FAQ" }, { status: 500 });
  }
}

// Endpoint para bloquear/desbloquear comentários
export async function PUT(req: Request) {
  try {
    await requireAdmin();

    const { searchParams } = new URL(req.url);
    const commentId = searchParams.get("commentId");

    if (!commentId) {
      return NextResponse.json({ error: "ID do comentário é obrigatório" }, { status: 400 });
    }

    const body = await req.json();
    const validation = blockCommentSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json({ error: "Dados inválidos" }, { status: 400 });
    }

    const comment = await prisma.userQuestion.update({
      where: { id: commentId },
      data: { blocked: validation.data.blocked },
    });

    return NextResponse.json({ comment });
  } catch (err: any) {
    if (err.message === "Acesso negado" || err.message === "Não autenticado") {
      return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
    }
    return NextResponse.json({ error: "Erro ao atualizar comentário" }, { status: 500 });
  }
}
