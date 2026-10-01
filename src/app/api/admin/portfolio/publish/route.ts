import { NextResponse } from "next/server";
import { requireAdmin } from "@/app/lib/auth";
import { PortfolioConflict, publishPortfolioDraft } from "@/app/portfolio/portfolio-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function denied(error: unknown) {
  const message = error instanceof Error ? error.message : "";
  if (message === "Não autenticado") return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  if (message === "Acesso negado") return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
  return null;
}

export async function POST(request: Request) {
  try {
    await requireAdmin();
    const body = await request.json().catch(() => null) as { draftVersion?: unknown } | null;
    if (!body || !Number.isInteger(body.draftVersion)) {
      return NextResponse.json({ error: "Versão do rascunho inválida." }, { status: 400 });
    }
    const snapshot = await publishPortfolioDraft(body.draftVersion as number);
    return NextResponse.json(snapshot);
  } catch (error) {
    const response = denied(error);
    if (response) return response;
    if (error instanceof PortfolioConflict) return NextResponse.json({ error: error.message }, { status: 409 });
    console.error("[portfolio] publish", error instanceof Error ? error.name : "error");
    return NextResponse.json({ error: "Não foi possível publicar." }, { status: 500 });
  }
}
