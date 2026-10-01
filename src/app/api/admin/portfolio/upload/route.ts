import { NextResponse } from "next/server";
import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { requireAdmin } from "@/app/lib/auth";
import { decidePortfolioUpload, inspectPortfolioPathname, PORTFOLIO_STORAGE_UNAVAILABLE } from "@/app/portfolio/portfolio-media-ref";

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
    const body = await request.json().catch(() => null) as HandleUploadBody | null;
    if (!body || typeof body !== "object" || !("type" in body)) {
      return NextResponse.json({ error: "Pedido de upload inválido." }, { status: 400 });
    }
    const token = process.env.PORTFOLIO_BLOB_READ_WRITE_TOKEN;
    if (body.type === "blob.generate-client-token") {
      await requireAdmin();
      const decision = decidePortfolioUpload({
        type: body.type,
        role: "admin",
        hasBlobToken: Boolean(token),
      });
      if (!decision.ok) return NextResponse.json({ error: decision.error }, { status: decision.status });
    }
    if (!token) {
      return NextResponse.json({ error: PORTFOLIO_STORAGE_UNAVAILABLE }, { status: 503 });
    }
    const result = await handleUpload({
      token,
      request,
      body,
      onBeforeGenerateToken: async (pathname) => {
        const inspected = inspectPortfolioPathname(pathname);
        if (!inspected) throw new Error("Caminho de mídia inválido.");
        return {
          maximumSizeInBytes: inspected.maxBytes,
          allowedContentTypes: inspected.contentTypes,
          addRandomSuffix: true,
          tokenPayload: JSON.stringify({ kind: inspected.kind }),
        };
      },
      onUploadCompleted: async () => {
        // A referência só entra no rascunho quando o admin salva o documento.
      },
    });
    return NextResponse.json(result);
  } catch (error) {
    const response = denied(error);
    if (response) return response;
    const message = error instanceof Error ? error.message : "Não foi possível autorizar o envio.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
