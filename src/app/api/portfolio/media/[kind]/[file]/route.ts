/**
 * GET /api/portfolio/media/[kind]/[file]
 * Leitura pública de mídia canônica do Portfólio no R2.
 * Só keys portfolio/{images|audio|videos}/<uuid>.<ext>.
 * 302 para signed GET curto. Sem PUT/DELETE. Sem credencial na resposta.
 */
import { NextResponse } from "next/server";
import {
  buildPortfolioMediaObjectKey,
  PORTFOLIO_STORAGE_UNAVAILABLE,
} from "@/app/portfolio/portfolio-media-ref";
import { createPortfolioReadUrl, headPortfolioObject } from "@/app/lib/storage/r2-portfolio";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CACHE = "private, no-store";

function notFound() {
  return NextResponse.json({ error: "Arquivo não encontrado." }, { status: 404, headers: { "Cache-Control": CACHE } });
}

function unavailable(message: string) {
  return NextResponse.json({ error: message }, { status: 503, headers: { "Cache-Control": CACHE } });
}

async function handle(
  ctx: { params: Promise<{ kind: string; file: string }> },
  method: "GET" | "HEAD"
): Promise<Response> {
  const { kind, file } = await ctx.params;
  const objectKey = buildPortfolioMediaObjectKey(kind, file);
  if (!objectKey) return notFound();

  const headed = await headPortfolioObject(objectKey);
  if (!headed.ok) {
    if (headed.code === "unconfigured") return unavailable(PORTFOLIO_STORAGE_UNAVAILABLE);
    if (headed.code === "missing" || headed.code === "invalid_reference") return notFound();
    return unavailable("Arquivo temporariamente indisponível. Tente novamente mais tarde.");
  }
  if (method === "HEAD") {
    return new Response(null, { status: 200, headers: { "Cache-Control": CACHE } });
  }

  const signed = await createPortfolioReadUrl({ objectKey });
  if (!signed.ok) {
    if (signed.code === "unconfigured") return unavailable(PORTFOLIO_STORAGE_UNAVAILABLE);
    if (signed.code === "missing" || signed.code === "invalid_reference") return notFound();
    return unavailable("Arquivo temporariamente indisponível. Tente novamente mais tarde.");
  }
  return new Response(null, {
    status: 302,
    headers: {
      Location: signed.url,
      "Cache-Control": CACHE,
    },
  });
}

export async function GET(_request: Request, ctx: { params: Promise<{ kind: string; file: string }> }) {
  return handle(ctx, "GET");
}

export async function HEAD(_request: Request, ctx: { params: Promise<{ kind: string; file: string }> }) {
  return handle(ctx, "HEAD");
}
