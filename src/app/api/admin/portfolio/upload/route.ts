import { NextResponse } from "next/server";
import { requireAdmin } from "@/app/lib/auth";
import {
  confirmPortfolioUpload,
  preparePortfolioUpload,
  type PortfolioUploadCode,
} from "@/app/lib/storage/portfolio-r2-upload";
import { decidePortfolioUpload } from "@/app/portfolio/portfolio-media-ref";
import { readR2PortfolioSettings } from "@/app/lib/storage/r2-config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function denied(error: unknown) {
  const message = error instanceof Error ? error.message : "";
  if (message === "Não autenticado") return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  if (message === "Acesso negado") return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
  return null;
}

function statusFor(code: PortfolioUploadCode): number {
  if (code === "unconfigured") return 503;
  if (code === "too_large" || code === "invalid_format") return 400;
  return 400;
}

function configured(): boolean {
  return readR2PortfolioSettings().ok;
}

export async function POST(request: Request) {
  try {
    await requireAdmin();
    const body = await request.json().catch(() => null) as Record<string, unknown> | null;
    if (!body || typeof body !== "object" || typeof body.action !== "string") {
      return NextResponse.json({ error: "Pedido de upload inválido." }, { status: 400 });
    }
    const decision = decidePortfolioUpload({
      action: body.action,
      role: "admin",
      configured: configured(),
    });
    if (!decision.ok) return NextResponse.json({ error: decision.error }, { status: decision.status });

    if (body.action === "prepare") {
      const prepared = await preparePortfolioUpload({
        kind: body.kind,
        fileName: body.fileName,
        size: body.size,
        contentType: body.contentType,
        originalName: body.originalName ?? body.fileName,
      });
      if (!prepared.ok) {
        return NextResponse.json({ error: prepared.error, code: prepared.code }, { status: statusFor(prepared.code) });
      }
      return NextResponse.json({
        reference: prepared.reference,
        mimeType: prepared.mimeType,
        originalName: prepared.originalName,
        size: prepared.size,
        upload: prepared.upload,
      });
    }

    const confirmed = await confirmPortfolioUpload({
      reference: body.reference,
      originalName: body.originalName,
      size: body.size,
      contentType: body.contentType,
      kind: body.kind,
    });
    if (!confirmed.ok) {
      return NextResponse.json({ error: confirmed.error, code: confirmed.code }, { status: statusFor(confirmed.code) });
    }
    return NextResponse.json(confirmed.media);
  } catch (error) {
    const response = denied(error);
    if (response) return response;
    return NextResponse.json({ error: "Não foi possível autorizar o envio." }, { status: 400 });
  }
}
