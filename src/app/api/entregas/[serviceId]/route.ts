/**
 * GET /api/entregas/[serviceId]
 * Proxy autenticado de arquivos de entrega (owner ou ADMIN).
 * 404 é ausência real. 403/store suspenso é 503, não "arquivo ausente".
 */
import { NextResponse } from "next/server";
import { createReadStream, existsSync } from "fs";
import path from "path";
import { Readable } from "stream";
import { getSessionUser } from "@/app/lib/auth";
import { prisma } from "@/app/lib/prisma";
import { isLocalDeliveryPath, isVercelBlobUrl } from "@/app/lib/delivery-access";
import {
  DELIVERY_NOT_FOUND,
  DELIVERY_UNAVAILABLE,
  classifyHttpStatus,
  inspectDeliveryBlob,
  openDeliveryBlobStream,
  releaseUnreadBody,
  type DeliveryReadFailure,
} from "@/app/lib/delivery-storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function safeDownloadName(name: string): string {
  const base = path.basename(name).replace(/[\r\n"\\]/g, "").slice(0, 180);
  return base || "entrega";
}

function mimeFromName(name: string): string {
  const ext = path.extname(name).toLowerCase();
  if (ext === ".mp3") return "audio/mpeg";
  if (ext === ".zip") return "application/zip";
  if (ext === ".wav") return "audio/wav";
  return "application/octet-stream";
}

function localDeliveryAbs(urlOrPath: string): string | null {
  const raw = String(urlOrPath || "").trim();
  let name = raw;
  const marker = "/uploads/deliveries/";
  const idx = raw.indexOf(marker);
  if (idx >= 0) name = raw.slice(idx + marker.length);
  else if (raw.startsWith("uploads/deliveries/")) name = raw.slice("uploads/deliveries/".length);
  name = path.basename(name);
  if (!name || name.includes("..")) return null;

  const candidates = [
    path.join(process.cwd(), "storage", "deliveries", name),
    path.join(process.cwd(), "public", "uploads", "deliveries", name),
  ];
  for (const abs of candidates) {
    if (existsSync(abs)) return abs;
  }
  return null;
}

function jsonError(failure: DeliveryReadFailure) {
  return NextResponse.json({ error: failure.clientMessage }, { status: failure.httpStatus });
}

function logDelivery(serviceId: string, failure: DeliveryReadFailure) {
  console.error("[entregas/proxy]", {
    serviceId,
    category: failure.code,
    blobStatus: failure.blobStatus ?? null,
  });
}

export async function GET(
  req: Request,
  ctx: { params: Promise<{ serviceId: string }> }
) {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
    }

    const { serviceId } = await ctx.params;
    if (!serviceId) {
      return NextResponse.json({ error: "serviceId obrigatório" }, { status: 400 });
    }

    const service = await prisma.service.findUnique({
      where: { id: serviceId },
      select: {
        id: true,
        userId: true,
        deliveryAudioUrl: true,
        deliveryAudioFormat: true,
      },
    });

    if (!service?.deliveryAudioUrl) {
      return NextResponse.json({ error: DELIVERY_NOT_FOUND }, { status: 404 });
    }

    if (user.role !== "ADMIN" && service.userId !== user.id) {
      return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
    }

    const stored = service.deliveryAudioUrl.trim();
    const fileName = safeDownloadName(stored.split("?")[0] || "entrega");
    const contentType = mimeFromName(
      service.deliveryAudioFormat ? `x.${service.deliveryAudioFormat}` : fileName
    );
    const probe = req.headers.get("x-delivery-probe") === "1";

    if (isLocalDeliveryPath(stored) || (!stored.startsWith("http") && !isVercelBlobUrl(stored))) {
      const abs = localDeliveryAbs(stored);
      if (!abs) {
        const failure: DeliveryReadFailure = {
          ok: false,
          httpStatus: 404,
          clientMessage: DELIVERY_NOT_FOUND,
          adminMessage: DELIVERY_NOT_FOUND,
          code: "missing",
        };
        logDelivery(serviceId, failure);
        return jsonError(failure);
      }
      if (probe) return NextResponse.json({ ok: true });
      const nodeStream = createReadStream(abs);
      const webStream = Readable.toWeb(nodeStream) as unknown as ReadableStream;
      return new NextResponse(webStream, {
        headers: {
          "Content-Type": contentType,
          "Content-Disposition": `inline; filename="${fileName}"`,
          "Cache-Control": "private, no-store",
          "X-Content-Type-Options": "nosniff",
        },
      });
    }

    if (isVercelBlobUrl(stored)) {
      const inspected = await inspectDeliveryBlob(stored);
      if (!inspected.ok) {
        logDelivery(serviceId, inspected);
        return jsonError(inspected);
      }
      if (probe) return NextResponse.json({ ok: true });
      const opened = await openDeliveryBlobStream(inspected.pathname || "");
      if (!opened.ok) {
        logDelivery(serviceId, opened);
        return jsonError(opened);
      }
      return new NextResponse(opened.stream, {
        headers: {
          "Content-Type": opened.contentType || contentType,
          "Content-Disposition": `inline; filename="${fileName}"`,
          "Cache-Control": "private, no-store",
          "X-Content-Type-Options": "nosniff",
        },
      });
    }

    const upstream = await fetch(stored, {
      method: "GET",
      headers: { Range: "bytes=0-0" },
      redirect: "manual",
    });
    await releaseUnreadBody(upstream.body);
    const classified = classifyHttpStatus(upstream.status);
    if (!classified.ok) {
      logDelivery(serviceId, classified);
      return jsonError(classified);
    }
    if (probe) return NextResponse.json({ ok: true });
    const full = await fetch(stored, { redirect: "manual" });
    if (!full.ok || !full.body) {
      const again = classifyHttpStatus(full.status);
      const failure = again.ok
        ? ({
            ok: false as const,
            httpStatus: 502 as const,
            clientMessage: DELIVERY_UNAVAILABLE,
            adminMessage: DELIVERY_UNAVAILABLE,
            code: "blob_unexpected" as const,
            blobStatus: full.status,
          })
        : again;
      logDelivery(serviceId, failure);
      return jsonError(failure);
    }
    return new NextResponse(full.body, {
      headers: {
        "Content-Type": full.headers.get("content-type") || contentType,
        "Content-Disposition": `inline; filename="${fileName}"`,
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    console.error("[entregas/proxy]", { category: "unexpected" });
    return NextResponse.json({ error: DELIVERY_UNAVAILABLE }, { status: 503 });
  }
}
