/**
 * PREPARE de um upload novo de entrega. Não recebe os bytes.
 */
import { NextResponse } from "next/server";
import { requireAdmin } from "@/app/lib/auth";
import { DELIVERY_UPLOAD_MESSAGES, prepareDeliveryUpload } from "@/app/lib/storage/delivery-upload";

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
    const body = (await req.json().catch(() => null)) as {
      fileName?: unknown;
      size?: unknown;
      contentType?: unknown;
    } | null;
    const fileName = typeof body?.fileName === "string" ? body.fileName : "";
    const size = typeof body?.size === "number" ? body.size : Number.NaN;
    const contentType =
      typeof body?.contentType === "string" && body.contentType.trim() ? body.contentType : undefined;
    const result = await prepareDeliveryUpload({ fileName, size, contentType });
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.code === "unconfigured" ? 503 : 400 });
    }
    return NextResponse.json({
      reference: result.reference,
      upload: {
        url: result.upload.url,
        method: result.upload.method,
        headers: result.upload.headers,
        expiresIn: result.upload.expiresIn,
      },
      uploadToken: result.uploadToken,
    });
  } catch (error) {
    const denied = authResponse(error);
    if (denied) return denied;
    console.error("[delivery-upload] prepare-failed");
    return NextResponse.json({ error: DELIVERY_UPLOAD_MESSAGES.upload_failed }, { status: 500 });
  }
}
