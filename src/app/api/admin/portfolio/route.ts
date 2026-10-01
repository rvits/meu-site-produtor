import { NextResponse } from "next/server";
import { requireAdmin } from "@/app/lib/auth";
import { getAdminPortfolio } from "@/app/portfolio/portfolio-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function denied(error: unknown) {
  const message = error instanceof Error ? error.message : "";
  if (message === "Não autenticado") return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  if (message === "Acesso negado") return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
  return null;
}

export async function GET() {
  try {
    await requireAdmin();
    const snapshot = await getAdminPortfolio();
    return NextResponse.json(snapshot);
  } catch (error) {
    const response = denied(error);
    if (response) return response;
    console.error("[portfolio] admin read", error instanceof Error ? error.name : "error");
    return NextResponse.json({ error: "Não foi possível ler o rascunho." }, { status: 500 });
  }
}
