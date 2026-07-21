/**
 * POST /api/admin/servicos/upload-entrega
 * Upload de arquivo de entrega (WAV/MP3/ZIP).
 *
 * Dois modos:
 * - JSON (client upload Vercel Blob): emite token para o navegador enviar o
 *   arquivo direto ao Blob, contornando o limite de 4,5MB de body das
 *   functions Vercel (413 FUNCTION_PAYLOAD_TOO_LARGE).
 * - multipart/form-data (legado/dev): grava via StorageProvider local.
 */
import { NextResponse } from "next/server";
import path from "path";
import { requireAdmin } from "@/app/lib/auth";
import { randomUUID } from "crypto";
import { getStorageProvider } from "@/app/lib/storage";
import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ALLOWED_EXT = new Set([".wav", ".mp3", ".zip"]);
const MAX_BYTES = 80 * 1024 * 1024; // 80 MB
const BLOB_PATH_PREFIX = "deliveries/";

function formatFromExt(ext: string): "wav" | "mp3" | "zip" {
  if (ext === ".mp3") return "mp3";
  if (ext === ".zip") return "zip";
  return "wav";
}

async function handleBlobClientUpload(req: Request) {
  const body = (await req.json()) as HandleUploadBody;

  // Só admin pode pedir token de upload. O callback blob.upload-completed é
  // assinado pela Vercel e validado dentro de handleUpload (sem sessão).
  if (body.type === "blob.generate-client-token") {
    await requireAdmin();
  }

  const result = await handleUpload({
    request: req,
    body,
    onBeforeGenerateToken: async (pathname) => {
      const ext = path.extname(pathname).toLowerCase();
      if (!pathname.startsWith(BLOB_PATH_PREFIX) || !ALLOWED_EXT.has(ext)) {
        throw new Error("Formato não permitido. Use WAV, MP3 ou ZIP.");
      }
      return {
        maximumSizeInBytes: MAX_BYTES,
        addRandomSuffix: true,
      };
    },
    // Persistência no domínio continua pelo PATCH /api/admin/servicos
    // (completeService) — nenhuma escrita de banco aqui.
    onUploadCompleted: async () => {},
  });

  return NextResponse.json(result);
}

export async function POST(req: Request) {
  try {
    const contentType = req.headers.get("content-type") || "";
    if (contentType.includes("application/json")) {
      return await handleBlobClientUpload(req);
    }

    await requireAdmin();

    const form = await req.formData();
    const file = form.get("file");
    const serviceId = String(form.get("serviceId") || "").trim();

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Arquivo obrigatório." }, { status: 400 });
    }
    if (!serviceId) {
      return NextResponse.json({ error: "serviceId obrigatório." }, { status: 400 });
    }
    if (file.size <= 0 || file.size > MAX_BYTES) {
      return NextResponse.json(
        { error: `Arquivo inválido ou maior que ${MAX_BYTES / (1024 * 1024)}MB.` },
        { status: 400 }
      );
    }

    const originalName = file.name || "entrega";
    const ext = path.extname(originalName).toLowerCase();
    if (!ALLOWED_EXT.has(ext)) {
      return NextResponse.json(
        { error: "Formato não permitido. Use WAV, MP3 ou ZIP." },
        { status: 400 }
      );
    }

    const safeBase = originalName
      .replace(ext, "")
      .replace(/[^a-zA-Z0-9._-]+/g, "_")
      .slice(0, 80);
    const storedName = `${serviceId.slice(0, 8)}_${Date.now()}_${randomUUID().slice(0, 8)}_${safeBase}${ext}`;

    const buffer = Buffer.from(await file.arrayBuffer());
    const stored = await getStorageProvider().writeDelivery({
      storedName,
      bytes: buffer,
    });
    const format = formatFromExt(ext);

    return NextResponse.json({
      ok: true,
      deliveryAudioUrl: stored.publicPath,
      deliveryAudioFormat: format,
      fileName: originalName,
      storedName: stored.storedName,
      bytes: stored.bytes,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Erro no upload";
    if (message === "Não autenticado" || message === "Acesso negado") {
      return NextResponse.json({ error: message }, { status: 401 });
    }
    console.error("[upload-entrega]", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
