import { NextRequest, NextResponse } from "next/server";

const cache = new Map<string, { payload: { items: unknown[]; total: number }; expiresAt: number }>();
const TTL_MS = 15 * 60 * 1000;

function limparExpirados() {
  const agora = Date.now();
  for (const [k, v] of cache.entries()) {
    if (v.expiresAt < agora) cache.delete(k);
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const items = Array.isArray(body.items) ? body.items : [];
    const total = typeof body.total === "number" ? body.total : items.reduce((s: number, i: { total?: number }) => s + (Number(i?.total) || 0), 0);
    const id = `cart_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
    cache.set(id, { payload: { items, total }, expiresAt: Date.now() + TTL_MS });
    limparExpirados();
    return NextResponse.json({ id });
  } catch (err) {
    console.error("[carrinho-checkout] POST error:", err);
    return NextResponse.json({ error: "Erro ao salvar carrinho" }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    if (!id) {
      return NextResponse.json({ error: "ID obrigatório" }, { status: 400 });
    }
    const entry = cache.get(id);
    if (!entry || entry.expiresAt < Date.now()) {
      return NextResponse.json({ error: "Sessão expirada ou não encontrada" }, { status: 404 });
    }
    return NextResponse.json(entry.payload);
  } catch (err) {
    console.error("[carrinho-checkout] GET error:", err);
    return NextResponse.json({ error: "Erro ao buscar carrinho" }, { status: 500 });
  }
}
