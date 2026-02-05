import { NextResponse } from "next/server";

// Planos básicos (mesmos valores do checkout)
const PLANOS = [
  {
    id: "bronze",
    nome: "Plano Bronze",
    mensal: 149.99,
    anual: 1499.99,
  },
  {
    id: "prata",
    nome: "Plano Prata",
    mensal: 349.99,
    anual: 3799.99,
  },
  {
    id: "ouro",
    nome: "Plano Ouro",
    mensal: 549.99,
    anual: 5499.99,
  },
] as const;

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const planId = searchParams.get("planId");
    const modo = searchParams.get("modo");

    if (!planId || !modo) {
      return NextResponse.json(
        { error: "planId e modo são obrigatórios" },
        { status: 400 }
      );
    }

    const plano = PLANOS.find((p) => p.id === planId);
    if (!plano) {
      return NextResponse.json(
        { error: "Plano não encontrado" },
        { status: 404 }
      );
    }

    const valor = modo === "mensal" ? plano.mensal : plano.anual;

    return NextResponse.json({
      nome: plano.nome,
      valor,
      modo,
    });
  } catch (err: any) {
    console.error("Erro ao buscar plano:", err);
    return NextResponse.json(
      { error: "Erro ao buscar plano" },
      { status: 500 }
    );
  }
}
