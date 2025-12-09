import { NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma"; // MESMA importação que você usa em outras rotas

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q") || "";

  // se não tiver termo de busca, devolve alguns FAQs padrão (recentes)
  if (!q.trim()) {
    const faqs = await prisma.fAQ.findMany({
      orderBy: { createdAt: "desc" },
      take: 30,
    });

    return NextResponse.json({ faqs });
  }

  // com busca: filtra por pergunta ou resposta
  const faqs = await prisma.fAQ.findMany({
    where: {
      OR: [
        {
          question: {
            contains: q,
          },
        },
        {
          answer: {
            contains: q,
          },
        },
      ],
    },
    orderBy: {
      createdAt: "desc",
    },
    take: 30,
  });

  return NextResponse.json({ faqs });
}
