/**
 * POST /api/admin/servicos/upload-entrega
 * Upload de arquivo de entrega (WAV/MP3/ZIP) → public/uploads/deliveries/
 */
import { NextResponse } from "next/server";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import { requireAdmin } from "@/app/lib/auth";
import { randomUUID } from "crypto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ALLOWED_EXT = new Set([".wav", ".mp3", ".zip"]);
const MAX_BYTES = 80 * 1024 * 1024; // 80 MB

function formatFromExt(ext: string): "wav" | "mp3" | "zip" {
  if (ext === ".mp3") return "mp3";
  if (ext === ".zip") return "zip";
  return "wav";
}

export async function POST(req: Request) {
  try {
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

    const dir = path.join(process.cwd(), "public", "uploads", "deliveries");
    await mkdir(dir, { recursive: true });
    const abs = path.join(dir, storedName);
    const buffer = Buffer.from(await file.arrayBuffer());
    await writeFile(abs, buffer);

    const publicPath = `/uploads/deliveries/${storedName}`;
    const format = formatFromExt(ext);

    return NextResponse.json({
      ok: true,
      deliveryAudioUrl: publicPath,
      deliveryAudioFormat: format === "zip" ? "wav" : format,
      fileName: originalName,
      storedName,
      bytes: file.size,
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
