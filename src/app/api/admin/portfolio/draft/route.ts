import { NextResponse } from "next/server";
import { requireAdmin } from "@/app/lib/auth";
import { PortfolioConflict, savePortfolioDraft } from "@/app/portfolio/portfolio-store";
import { validatePortfolioDocument } from "@/app/portfolio/portfolio-validate";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function denied(error: unknown) {
  const message = error instanceof Error ? error.message : "";
  if (message === "Não autenticado") return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  if (message === "Acesso negado") return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
  return null;
}

export async function PUT(request: Request) {
  try {
    await requireAdmin();
    const body = await request.json().catch(() => null) as { document?: unknown; draftVersion?: unknown } | null;
    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "Documento inválido." }, { status: 400 });
    }
    const parsed = validatePortfolioDocument(body.document);
    if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });
    if (!Number.isInteger(body.draftVersion)) {
      return NextResponse.json({ error: "Versão do rascunho inválida." }, { status: 400 });
    }
    const snapshot = await savePortfolioDraft(parsed.document, body.draftVersion as number);
    return NextResponse.json(snapshot);
  } catch (error) {
    const response = denied(error);
    if (response) return response;
    if (error instanceof PortfolioConflict) return NextResponse.json({ error: error.message }, { status: 409 });
    console.error("[portfolio] save", error instanceof Error ? error.name : "error");
    return NextResponse.json({ error: "Não foi possível salvar as alterações." }, { status: 500 });
  }
}
