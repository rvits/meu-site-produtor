/**
 * Download privado de entrega R2.
 * A URL assinada só nasce depois da autenticação, da autorização e do HeadObject.
 * O player recebe essa URL no Location do 302. O prepare de download a devolve
 * uma vez no JSON, com Cache-Control private/no-store. Ela não é gravada nem logada.
 * O arquivo não passa por esta função.
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
  deliveryAudioOriginalName?: string | null;
  tipo?: string | null;
};

export type { DeliveryDownloadDisposition } from "../delivery-disposition";
export { parseDeliveryDisposition, withAttachmentDisposition } from "../delivery-disposition";

export type DeliveryDownloadCommand =
  | {
      type: "json";
      status: number;
      body: { error: string } | { ok: true; downloadUrl?: string };
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
  body: { error: string } | { ok: true; downloadUrl?: string }
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
  prepare?: boolean;
  disposition: DeliveryDownloadDisposition;
  deps?: DownloadDeps;
}): Promise<DeliveryDownloadCommand> {
  if (!input.user) return jsonCommand(401, { error: UNAUTHENTICATED });
  const service = input.service;
  const stored = String(service?.deliveryAudioUrl || "").trim();
  if (!service || !stored) return jsonCommand(404, { error: DELIVERY_NOT_FOUND });
  if (input.user.role !== "ADMIN" && service.userId !== input.user.id) {
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
  if (input.prepare) {
    const signed = await signDeliveryGet(service, input.deps, classified.objectKey, classified.extension, "attachment");
    if (signed.type !== "signed") return signed.command;
    return jsonCommand(200, { ok: true, downloadUrl: signed.url });
  }
  if (input.probe) return jsonCommand(200, { ok: true });

  const signed = await signDeliveryGet(service, input.deps, classified.objectKey, classified.extension, input.disposition);
  if (signed.type !== "signed") return signed.command;
  return { type: "redirect", status: 302, location: signed.url };
}

async function signDeliveryGet(
  service: DeliveryAccessService,
  deps: DownloadDeps | undefined,
  objectKey: string,
  extension: DeliveryAudioExtension,
  disposition: DeliveryDownloadDisposition
): Promise<{ type: "signed"; url: string } | { type: "failed"; command: DeliveryDownloadCommand }> {
  const createDownloadUrl = deps?.createDownloadUrl ?? createDeliveryDownloadUrl;
  const storedName = String(service.deliveryAudioOriginalName || "").trim();
  try {
    const signed = await createDownloadUrl({
      objectKey,
      responseContentType: DELIVERY_CANONICAL_CONTENT_TYPE[extension],
      responseContentDisposition: disposition,
      fileName: storedName || deliveryDownloadFileName(service.tipo, extension),
    });
    if (!signed.ok) return { type: "failed", command: headFailure(signed) };
    return { type: "signed", url: signed.url };
  } catch {
    return { type: "failed", command: jsonCommand(503, { error: DELIVERY_UNAVAILABLE }) };
  }
}
