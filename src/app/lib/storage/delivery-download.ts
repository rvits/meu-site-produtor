/**
 * Download privado de entrega R2.
 * A URL assinada só nasce depois da autenticação e da autorização,
 * e só segue no header Location. O arquivo não passa por esta função.
 * Range fica entre o navegador e o R2, depois do redirect.
 */

import { type DeliveryDownloadDisposition } from "../delivery-disposition";
import {
  classifyDeliveryStorageReference,
  DELIVERY_CANONICAL_CONTENT_TYPE,
  type DeliveryAudioExtension,
} from "../delivery-access";
import { DELIVERY_NOT_FOUND, DELIVERY_UNAVAILABLE, localDeliveryReferenceAllowed } from "../delivery-storage";
import {
  createDeliveryDownloadUrl,
  headDeliveryObject,
  type R2Failure,
  type R2HeadSuccess,
} from "./r2-delivery";

if (typeof window !== "undefined") {
  throw new Error("delivery-download só pode ser usado no servidor.");
}

export const DELIVERY_DOWNLOAD_CACHE = "private, no-store";

const UNAUTHENTICATED = "Não autenticado";
const FORBIDDEN = "Acesso negado";

export type DeliveryAccessUser = { id: string; role: string };

export type DeliveryAccessService = {
  userId: string;
  deliveryAudioUrl: string | null;
  deliveryAudioFormat?: string | null;
  tipo?: string | null;
};

export type { DeliveryDownloadDisposition } from "../delivery-disposition";
export { parseDeliveryDisposition, withAttachmentDisposition } from "../delivery-disposition";

export type DeliveryDownloadCommand =
  | {
      type: "json";
      status: number;
      body: { error: string } | { ok: true };
    }
  | { type: "redirect"; status: 302; location: string }
  | { type: "head"; status: number }
  | { type: "legacy"; stored: string };

type DownloadDeps = {
  headObject?: (objectKey: string) => Promise<R2HeadSuccess | R2Failure>;
  createDownloadUrl?: typeof createDeliveryDownloadUrl;
  localAllowed?: () => boolean;
};

/** Nome amigável a partir do tipo de serviço. Não usa key, cliente nem path interno. */
export function deliveryDownloadFileName(
  tipo: string | null | undefined,
  extension: DeliveryAudioExtension
): string {
  const slug = String(tipo || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
  return `thouse-${slug || "entrega"}.${extension}`;
}

function jsonCommand(
  status: number,
  body: { error: string } | { ok: true }
): Extract<DeliveryDownloadCommand, { type: "json" }> {
  return { type: "json", status, body };
}

function headFailure(result: R2Failure): Extract<DeliveryDownloadCommand, { type: "json" }> {
  if (result.code === "missing" || result.code === "invalid_reference") {
    return jsonCommand(404, { error: DELIVERY_NOT_FOUND });
  }
  return jsonCommand(503, { error: DELIVERY_UNAVAILABLE });
}

export function deliveryDownloadResponse(command: Exclude<DeliveryDownloadCommand, { type: "legacy" }>): Response {
  if (command.type === "redirect") {
    return new Response(null, {
      status: 302,
      headers: {
        Location: command.location,
        "Cache-Control": DELIVERY_DOWNLOAD_CACHE,
      },
    });
  }
  if (command.type === "head") {
    return new Response(null, {
      status: command.status,
      headers: { "Cache-Control": DELIVERY_DOWNLOAD_CACHE },
    });
  }
  return Response.json(command.body, {
    status: command.status,
    headers: { "Cache-Control": DELIVERY_DOWNLOAD_CACHE },
  });
}

export async function resolveDeliveryDownload(input: {
  user: DeliveryAccessUser | null;
  service: DeliveryAccessService | null;
  method: "GET" | "HEAD";
  probe: boolean;
  disposition: DeliveryDownloadDisposition;
  deps?: DownloadDeps;
}): Promise<DeliveryDownloadCommand> {
  if (!input.user) return jsonCommand(401, { error: UNAUTHENTICATED });
  const stored = String(input.service?.deliveryAudioUrl || "").trim();
  if (!input.service || !stored) return jsonCommand(404, { error: DELIVERY_NOT_FOUND });
  if (input.user.role !== "ADMIN" && input.service.userId !== input.user.id) {
    return jsonCommand(403, { error: FORBIDDEN });
  }

  const classified = classifyDeliveryStorageReference(stored);
  if (stored.toLowerCase().startsWith("r2:") && classified.kind !== "r2") {
    return jsonCommand(404, { error: DELIVERY_NOT_FOUND });
  }
  if (classified.kind === "local") {
    const allowed = input.deps?.localAllowed ?? localDeliveryReferenceAllowed;
    if (!allowed()) return jsonCommand(404, { error: DELIVERY_NOT_FOUND });
  }
  if (classified.kind !== "r2") return { type: "legacy", stored };

  const headObject = input.deps?.headObject ?? headDeliveryObject;
  let headed: R2HeadSuccess | R2Failure;
  try {
    headed = await headObject(classified.objectKey);
  } catch {
    return jsonCommand(503, { error: DELIVERY_UNAVAILABLE });
  }
  if (!headed.ok) {
    const failure = headFailure(headed);
    if (input.method === "HEAD") return { type: "head", status: failure.status };
    return failure;
  }
  if (input.method === "HEAD") return { type: "head", status: 200 };
  if (input.probe) return jsonCommand(200, { ok: true });

  const createDownloadUrl = input.deps?.createDownloadUrl ?? createDeliveryDownloadUrl;
  let signed: Awaited<ReturnType<typeof createDeliveryDownloadUrl>>;
  try {
    signed = await createDownloadUrl({
      objectKey: classified.objectKey,
      responseContentType: DELIVERY_CANONICAL_CONTENT_TYPE[classified.extension],
      responseContentDisposition: input.disposition,
      fileName: deliveryDownloadFileName(input.service.tipo, classified.extension),
    });
  } catch {
    return jsonCommand(503, { error: DELIVERY_UNAVAILABLE });
  }
  if (!signed.ok) return headFailure(signed);
  return { type: "redirect", status: 302, location: signed.url };
}
