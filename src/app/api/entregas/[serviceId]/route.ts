/**
 * GET /api/entregas/[serviceId]
 * Owner ou ADMIN. Blob e local continuam neste processo.
 * R2: HeadObject e, no GET real, redirect 302 para um presigned GET de 120 s.
 * A URL assinada não entra em JSON, log nem banco.
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
  deliveryBlobFailureLog,
  inspectDeliveryBlob,
  legacyBlobClientError,
  openDeliveryBlobStream,
  releaseUnreadBody,
} from "@/app/lib/delivery-storage";
import { contentDispositionAttachment } from "@/app/lib/delivery-filename";
import type { DeliveryDownloadDisposition } from "@/app/lib/delivery-disposition";
import { createDeliveryDownloadUrl, headDeliveryObject } from "@/app/lib/storage/r2-delivery";
import {
  deliveryDownloadFileName,
  deliveryDownloadResponse,
  parseDeliveryDisposition,
  resolveDeliveryDownload,
} from "@/app/lib/storage/delivery-download";

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

function logDelivery(serviceId: string, code: string, blobStatus?: number) {
  console.error("[entregas/proxy]", {
    serviceId,
    ...deliveryBlobFailureLog(code, blobStatus),
  });
}

function legacyErrorResponse(
  failure: Parameters<typeof legacyBlobClientError>[0],
  method: "GET" | "HEAD"
): Response {
  const body = legacyBlobClientError(failure, method);
  if (!body.json) return new NextResponse(null, { status: body.status });
  return NextResponse.json(body.json, { status: body.status });
}

function legacyDownloadHeader(input: {
  stored: string;
  format: string | null;
  tipo: string | null;
  originalName: string | null;
  disposition: DeliveryDownloadDisposition;
}): string {
  const fromStored = safeDownloadName(input.stored.split("?")[0] || "entrega");
  if (input.disposition !== "attachment") return `inline; filename="${fromStored}"`;
  const storedName = String(input.originalName || "")
    .replace(/[\u0000-\u001F\u007F\u2028\u2029]/g, "")
    .trim();
  const usable =
    storedName && !storedName.includes("/") && !storedName.includes("\\") && !storedName.includes("..")
      ? storedName
      : "";
  const ext = input.format === "wav" || input.format === "mp3" || input.format === "zip" ? input.format : null;
  return contentDispositionAttachment(usable || (ext ? deliveryDownloadFileName(input.tipo, ext) : fromStored));
}

async function serveLegacy(input: {
  serviceId: string;
  stored: string;
  format: string | null;
  tipo: string | null;
  originalName: string | null;
  disposition: DeliveryDownloadDisposition;
  probe: boolean;
  method: "GET" | "HEAD";
}): Promise<Response> {
  const fileName = safeDownloadName(input.stored.split("?")[0] || "entrega");
  const contentType = mimeFromName(input.format ? `x.${input.format}` : fileName);
  const contentDisposition = legacyDownloadHeader(input);
  const availabilityOnly = input.probe || input.method === "HEAD";

  if (isLocalDeliveryPath(input.stored) || (!input.stored.startsWith("http") && !isVercelBlobUrl(input.stored))) {
    const abs = localDeliveryAbs(input.stored);
    if (!abs) {
      logDelivery(input.serviceId, "missing");
      if (input.method === "HEAD") return new NextResponse(null, { status: 404 });
      return NextResponse.json({ error: DELIVERY_NOT_FOUND }, { status: 404 });
    }
    if (availabilityOnly) {
      if (input.method === "HEAD") return new NextResponse(null, { status: 200 });
      return NextResponse.json({ ok: true });
    }
    const nodeStream = createReadStream(abs);
    const webStream = Readable.toWeb(nodeStream) as unknown as ReadableStream;
    return new NextResponse(webStream, {
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": contentDisposition,
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  }

  if (isVercelBlobUrl(input.stored)) {
    const inspected = await inspectDeliveryBlob(input.stored);
    if (!inspected.ok) {
      logDelivery(input.serviceId, inspected.code, inspected.blobStatus);
      return legacyErrorResponse(inspected, input.method);
    }
    if (availabilityOnly) {
      if (input.method === "HEAD") return new NextResponse(null, { status: 200 });
      return NextResponse.json({ ok: true });
    }
    const opened = await openDeliveryBlobStream(inspected.pathname || "");
    if (!opened.ok) {
      logDelivery(input.serviceId, opened.code, opened.blobStatus);
      return legacyErrorResponse(opened, input.method);
    }
    return new NextResponse(opened.stream, {
      headers: {
        "Content-Type": opened.contentType || contentType,
        "Content-Disposition": contentDisposition,
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  }

  const upstream = await fetch(input.stored, {
    method: "GET",
    headers: { Range: "bytes=0-0" },
    redirect: "manual",
  });
  await releaseUnreadBody(upstream.body);
  const classified = classifyHttpStatus(upstream.status);
  if (!classified.ok) {
    logDelivery(input.serviceId, classified.code, classified.blobStatus);
    if (input.method === "HEAD") return new NextResponse(null, { status: classified.httpStatus });
    return NextResponse.json({ error: classified.clientMessage }, { status: classified.httpStatus });
  }
  if (availabilityOnly) {
    if (input.method === "HEAD") return new NextResponse(null, { status: 200 });
    return NextResponse.json({ ok: true });
  }
  const full = await fetch(input.stored, { redirect: "manual" });
  if (!full.ok || !full.body) {
    const again = classifyHttpStatus(full.status);
    const failure = again.ok
      ? {
          httpStatus: 502 as const,
          clientMessage: DELIVERY_UNAVAILABLE,
          code: "blob_unexpected",
          blobStatus: full.status,
        }
      : again;
    logDelivery(input.serviceId, failure.code, failure.blobStatus);
    return NextResponse.json({ error: failure.clientMessage }, { status: failure.httpStatus });
  }
  return new NextResponse(full.body, {
    headers: {
      "Content-Type": full.headers.get("content-type") || contentType,
      "Content-Disposition": contentDisposition,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

async function handle(req: Request, ctx: { params: Promise<{ serviceId: string }> }, method: "GET" | "HEAD") {
  try {
    const user = await getSessionUser();
    if (!user) {
      return deliveryDownloadResponse({ type: "json", status: 401, body: { error: "Não autenticado" } });
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
        tipo: true,
        deliveryAudioUrl: true,
        deliveryAudioFormat: true,
        deliveryAudioOriginalName: true,
      },
    });

    const command = await resolveDeliveryDownload({
      user: { id: user.id, role: user.role },
      service: service
        ? {
            userId: service.userId,
            deliveryAudioUrl: service.deliveryAudioUrl,
            deliveryAudioFormat: service.deliveryAudioFormat,
            deliveryAudioOriginalName: service.deliveryAudioOriginalName,
            tipo: service.tipo,
          }
        : null,
      method,
      probe: req.headers.get("x-delivery-probe") === "1",
      disposition: parseDeliveryDisposition(new URL(req.url).searchParams.get("disposition")),
      deps: { headObject: headDeliveryObject, createDownloadUrl: createDeliveryDownloadUrl },
    });
    if (command.type !== "legacy") return deliveryDownloadResponse(command);
    return serveLegacy({
      serviceId,
      stored: command.stored,
      format: service?.deliveryAudioFormat ?? null,
      tipo: service?.tipo ?? null,
      originalName: service?.deliveryAudioOriginalName ?? null,
      disposition: parseDeliveryDisposition(new URL(req.url).searchParams.get("disposition")),
      probe: req.headers.get("x-delivery-probe") === "1",
      method,
    });
  } catch {
    console.error("[entregas/proxy]", { category: "unexpected" });
    return NextResponse.json({ error: DELIVERY_UNAVAILABLE }, { status: 503 });
  }
}

export async function GET(req: Request, ctx: { params: Promise<{ serviceId: string }> }) {
  return handle(req, ctx, "GET");
}

export async function HEAD(req: Request, ctx: { params: Promise<{ serviceId: string }> }) {
  return handle(req, ctx, "HEAD");
}
