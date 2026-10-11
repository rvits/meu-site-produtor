/**
 * CONFIRM de um upload novo. A key sai do token, não do body.
 * Não grava o Service. O PATCH só aceita a referência com a prova emitida aqui.
 */
import { NextResponse } from "next/server";
import { requireAdmin } from "@/app/lib/auth";
import { confirmDeliveryUpload, DELIVERY_UPLOAD_MESSAGES } from "@/app/lib/storage/delivery-upload";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function authResponse(error: unknown): NextResponse | null {
  const message = error instanceof Error ? error.message : "";
  if (message === "Não autenticado") return NextResponse.json({ error: "Acesso negado" }, { status: 401 });
  if (message === "Acesso negado") return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
  return null;
}

export async function POST(req: Request) {
  try {
    await requireAdmin();
    const body = (await req.json().catch(() => null)) as { uploadToken?: unknown } | null;
    const uploadToken = typeof body?.uploadToken === "string" ? body.uploadToken : "";
    const result = await confirmDeliveryUpload(uploadToken);
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.code === "unconfigured" ? 503 : 400 });
    }
    return NextResponse.json({
      ok: true,
      deliveryAudioUrl: result.deliveryAudioUrl,
      deliveryAudioFormat: result.deliveryAudioFormat,
      commitToken: result.commitToken,
    });
  } catch (error) {
    const denied = authResponse(error);
    if (denied) return denied;
    console.error("[delivery-upload] confirm-failed");
    return NextResponse.json({ error: DELIVERY_UPLOAD_MESSAGES.confirm_failed }, { status: 500 });
  }
}
