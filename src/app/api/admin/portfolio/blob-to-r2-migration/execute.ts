/**
 * TEMPORARY MIGRATION TOOL
 * Cópia Blob → R2 de um único id do manifest fixo.
 * Será removida depois da migração.
 * Não grava PortfolioState, não publica e não apaga Blob nem R2.
 */

import type { PortfolioMediaKind } from "@/app/portfolio/portfolio-media-ref";
import { planPortfolioR2ObjectKey, sha256Hex } from "@/app/lib/storage/portfolio-blob-to-r2";

export const MIGRATION_BUCKET = "thouse-portfolio";
export const MIGRATION_EXPECTED_BYTES = 293320519;

export type MigrationMediaKind = Extract<PortfolioMediaKind, "audio" | "video">;

export type MigrationManifestItem = {
  id: string;
  pathname: string;
  plannedKey: string;
  size: number;
  contentType: string;
  originalName: string;
  mediaKind: MigrationMediaKind;
};

export const BLOB_TO_R2_MIGRATION_MANIFEST: readonly MigrationManifestItem[] = [
  {
    id: "01",
    mediaKind: "video",
    pathname:
      "portfolio/videos/1790833743137_00d5b30e04cd4485_YTDown.com_YouTube_Media_M5opUqvobpU_Emo-X014pA9AwM4gPTRylNHHqgOXvfwUNb.mp4",
    plannedKey: "portfolio/videos/ea8bebf7-7346-523e-a47a-b1eaa5d6d136.mp4",
    size: 8493862,
    contentType: "video/mp4",
    originalName: "YTDown.com_YouTube_Media_M5opUqvobpU_Emoção_001_1080p.mp4",
  },
  {
    id: "02",
    mediaKind: "video",
    pathname:
      "portfolio/videos/1790837880123_c857b2c063234d28_YTDown.com_YouTube_Media_Q7IqnqYmi60_PRO-CJBZffUXhS8F7v8fYgSL3Y46g7FYvE.mp4",
    plannedKey: "portfolio/videos/577cc100-ca54-5396-9e12-4e02dafc91c8.mp4",
    size: 30024232,
    contentType: "video/mp4",
    originalName:
      "YTDown.com_YouTube_Media_Q7IqnqYmi60_PROBLEMAS-D-TremV-Official-Visualizer_001_1080p.mp4",
  },
  {
    id: "03",
    mediaKind: "audio",
    pathname:
      "portfolio/audio/1790837420900_49b8fb9eefe3485d_BEAT_348_-_HODD_Aminor_154BPM-Dyvx7nRGkMoZjqzAKrzKBd6bsVMXJi.wav",
    plannedKey: "portfolio/audio/b99638b0-b299-5b4e-bff1-f21c3291517a.wav",
    size: 39636086,
    contentType: "audio/wav",
    originalName: "BEAT 348 - HODD Aminor 154BPM.wav",
  },
  {
    id: "04",
    mediaKind: "audio",
    pathname:
      "portfolio/audio/1790833878825_fb08f7a622414fce_BEAT_280_-_Boombap_Eminor_98_BPM-bnod9Af3KTVggo06rLh70FO8SVj67J.mp3",
    plannedKey: "portfolio/audio/882a181e-1171-5f91-8534-6efbd383bc2f.mp3",
    size: 3292740,
    contentType: "audio/mpeg",
    originalName: "BEAT 280 - Boombap Eminor 98 BPM.mp3",
  },
  {
    id: "05",
    mediaKind: "audio",
    pathname:
      "portfolio/audio/1790833912922_554c7f20a8fb493c_DRILL_-_Cminor_140BPM-AF87HFljHyBOCcLBJZ5YiF7XfGgXLh.mp3",
    plannedKey: "portfolio/audio/90efdca9-eca4-5c2d-9bb4-95aef850d629.mp3",
    size: 3475806,
    contentType: "audio/mpeg",
    originalName: "DRILL - Cminor 140BPM.mp3",
  },
  {
    id: "06",
    mediaKind: "audio",
    pathname:
      "portfolio/audio/1790837265402_d0b183d7b2544d2d_BEAT_330_-_RNB_Eminor_94-2jHcgMzbWAlIbPavwBKQ0w0Enf54SL.mp3",
    plannedKey: "portfolio/audio/67ad055e-5310-5f60-a1f3-4e2bc82f5291.mp3",
    size: 4772942,
    contentType: "audio/mpeg",
    originalName: "BEAT 330 - RNB Eminor 94.mp3",
  },
  {
    id: "07",
    mediaKind: "audio",
    pathname:
      "portfolio/audio/1790837282737_a20b2bf4e5474d44_BEAT_276_-_TRAP_TOMA-ZhUfjxfbmDiz8ylWGesZ08d3AhfJnS.mp3",
    plannedKey: "portfolio/audio/98c4ecd1-7dbd-5886-a84e-6c53ceb13882.mp3",
    size: 4023749,
    contentType: "audio/mpeg",
    originalName: "BEAT 276 - TRAP TOMA.mp3",
  },
  {
    id: "08",
    mediaKind: "audio",
    pathname:
      "portfolio/audio/1790837336625_ba257841306c4e38_BEAT_318_-_TRAP_POP_120BPM_G_MINOR_MIXED-QJfC46MNixZfCXFfSZEYIbhsDQAc3l.wav",
    plannedKey: "portfolio/audio/046c7f52-4e29-52d7-baa3-542ef1184ffa.wav",
    size: 42380006,
    contentType: "audio/wav",
    originalName: "BEAT 318 - TRAP POP 120BPM G#MINOR MIXED BY @tremv021.wav",
  },
  {
    id: "09",
    mediaKind: "audio",
    pathname:
      "portfolio/audio/1790838884935_e8e8f8a689be4486__VC_N_ME_CONHECE_-_BEAT-dJOos5UZXQMndByRWGtVhzxkayCnBL.mp3",
    plannedKey: "portfolio/audio/c9e43e2d-0348-55ff-b843-a7785d82382e.mp3",
    size: 3737240,
    contentType: "audio/mpeg",
    originalName: "''VC N ME CONHECE!'' - BEAT.mp3",
  },
  {
    id: "10",
    mediaKind: "audio",
    pathname:
      "portfolio/audio/1790839982364_c0123bd0b3944997__Reprograma_o_-_Dizzy_beat-TBlJrfJdLP3wKobUBjx62LKiUVMAUK.mp3",
    plannedKey: "portfolio/audio/2b4aa1b2-1c82-54fd-a7a9-922a22ea1d65.mp3",
    size: 3721566,
    contentType: "audio/mpeg",
    originalName: "''Reprogramação''- Dizzy beat.mp3",
  },
  {
    id: "11",
    mediaKind: "audio",
    pathname:
      "portfolio/audio/1790832985283_a412af4967ff4c16__Genesis_da_Contradi_o_-_Dom_Smoking_MAS-s2Ex0pVwdFXGP5xGBDRNk9IMSybW3u.wav",
    plannedKey: "portfolio/audio/eb59fb87-3190-5c31-8594-87fbe273f26e.wav",
    size: 39356118,
    contentType: "audio/wav",
    originalName: "''Genesis da Contradição'' - Dom Smoking MASTER 3 sem final ocioso.wav",
  },
  {
    id: "12",
    mediaKind: "audio",
    pathname:
      "portfolio/audio/1790837519212_cc3fb3ac846b4e38_DEMENTADOR_-_LEO_CID_BENI_Prod._TremV_x_-dqFTqS77z0hP51gySrS2OHhHZLbSkJ.wav",
    plannedKey: "portfolio/audio/bebe81c4-b713-5aec-b4c5-4c7df692140e.wav",
    size: 43576534,
    contentType: "audio/wav",
    originalName: "DEMENTADOR - LEO CID & BENI (Prod. TremV x Tauan7) - MASTER 2.wav",
  },
  {
    id: "13",
    mediaKind: "audio",
    pathname:
      "portfolio/audio/1790837573957_3332fe8e888a4992__O_ASSUNTO_CHEGOU_-_Rafz_master_2.0_-_16-FUK0xPWjzAyxZsYqa3By7h5FcMEYHD.wav",
    plannedKey: "portfolio/audio/2e93b7dc-f124-5375-8865-c3eb32ec817b.wav",
    size: 62364522,
    contentType: "audio/wav",
    originalName: "''O ASSUNTO CHEGOU'- Rafz master 2.0 - 16-08-2026.wav",
  },
  {
    id: "14",
    mediaKind: "audio",
    pathname:
      "portfolio/audio/1790837632611_cfc7e847302740bc__TIRA_ONDA_-_Araga_TremV_MP3-vDN0f2FiRsHG3oLAr5cveGZ9a7fIOp.mp3",
    plannedKey: "portfolio/audio/a12c7236-98c4-5c08-9f6c-7ad6b5f1c6f0.mp3",
    size: 4465116,
    contentType: "audio/mpeg",
    originalName: "''TIRA ONDA''- Araga & TremV MP3.mp3",
  },
];

for (const item of BLOB_TO_R2_MIGRATION_MANIFEST) Object.freeze(item);
Object.freeze(BLOB_TO_R2_MIGRATION_MANIFEST);

export const MIGRATION_MAX_BODY_BYTES = 1024;

const ALLOWED_BODY_KEYS = new Set(["operation", "confirm", "id"]);

export class MigrationCreateConflict extends Error {
  constructor() {
    super("create_conflict");
    this.name = "MigrationCreateConflict";
  }
}

export type DestinationHead =
  | { exists: false }
  | { exists: true; size: number | null; contentType: string | null };

export type MigrationDeps = {
  vercelEnv: string | undefined;
  requireAdmin: () => Promise<void>;
  headSource: (pathname: string) => Promise<{ size: number; contentType: string }>;
  getSourceBytes: (pathname: string) => Promise<Buffer>;
  headTarget: (objectKey: string) => Promise<DestinationHead>;
  getTargetBytes: (objectKey: string) => Promise<Buffer>;
  /** Create-only. Lança MigrationCreateConflict se a key já existir. Não sobrescreve. */
  putTarget: (input: { objectKey: string; bytes: Buffer; contentType: string }) => Promise<void>;
  planKey?: (pathname: string, mediaKind: MigrationMediaKind) => string | null;
};

export type MigrationResponse = {
  httpStatus: number;
  body: {
    error?: string;
    id?: string;
    originalName?: string;
    sourceSize?: number;
    sourceSha256?: string;
    r2Key?: string;
    destinationSize?: number | null;
    destinationSha256?: string | null;
    hashMatch?: boolean;
    status?: string;
  };
};

export function inspectMigrationManifest() {
  const ids = new Set(BLOB_TO_R2_MIGRATION_MANIFEST.map((item) => item.id));
  const pathnames = new Set(BLOB_TO_R2_MIGRATION_MANIFEST.map((item) => item.pathname));
  const keys = new Set(BLOB_TO_R2_MIGRATION_MANIFEST.map((item) => item.plannedKey));
  const bytes = BLOB_TO_R2_MIGRATION_MANIFEST.reduce((sum, item) => sum + item.size, 0);
  const keysMatch = BLOB_TO_R2_MIGRATION_MANIFEST.every(
    (item) => planPortfolioR2ObjectKey(item.pathname, item.mediaKind) === item.plannedKey
  );
  return {
    items: BLOB_TO_R2_MIGRATION_MANIFEST.length,
    audio: BLOB_TO_R2_MIGRATION_MANIFEST.filter((item) => item.mediaKind === "audio").length,
    video: BLOB_TO_R2_MIGRATION_MANIFEST.filter((item) => item.mediaKind === "video").length,
    bytes,
    uniqueIds: ids.size,
    uniquePathnames: pathnames.size,
    uniqueKeys: keys.size,
    keysMatch,
  };
}

function normalizeMime(value: string): string {
  return value.split(";")[0].trim().toLowerCase();
}

function fail(httpStatus: number, error: string, status?: string): MigrationResponse {
  return { httpStatus, body: status ? { error, status } : { error } };
}

export async function readMigrationBody(
  request: Request
): Promise<{ ok: true; body: unknown } | { ok: false }> {
  const type = (request.headers.get("content-type") || "").split(";")[0].trim().toLowerCase();
  if (type !== "application/json") return { ok: false };
  const declared = request.headers.get("content-length");
  if (declared !== null && (!/^\d+$/.test(declared) || Number(declared) > MIGRATION_MAX_BODY_BYTES)) {
    return { ok: false };
  }
  if (!request.body) return { ok: false };
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let received = 0;
  try {
    while (true) {
      const step = await reader.read();
      if (step.done) break;
      if (!step.value) continue;
      received += step.value.byteLength;
      if (received > MIGRATION_MAX_BODY_BYTES) {
        await reader.cancel().catch(() => undefined);
        return { ok: false };
      }
      chunks.push(step.value);
    }
  } catch {
    return { ok: false };
  }
  try {
    const text = new TextDecoder("utf-8", { fatal: true }).decode(concatBytes(chunks));
    return { ok: true, body: JSON.parse(text) as unknown };
  } catch {
    return { ok: false };
  }
}

function concatBytes(chunks: Uint8Array[]): Uint8Array {
  const total = chunks.reduce((sum, chunk) => sum + chunk.byteLength, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return out;
}

function parseCopyRequest(body: unknown): { ok: true; id: string } | { ok: false } {
  if (!body || typeof body !== "object" || Array.isArray(body)) return { ok: false };
  const record = body as Record<string, unknown>;
  const keys = Object.keys(record);
  if (keys.length !== ALLOWED_BODY_KEYS.size || keys.some((key) => !ALLOWED_BODY_KEYS.has(key))) {
    return { ok: false };
  }
  if (record.operation !== "copy" || record.confirm !== "YES") return { ok: false };
  if (typeof record.id !== "string" || !/^([0-9]{2})$/.test(record.id)) return { ok: false };
  return { ok: true, id: record.id };
}

function report(
  item: MigrationManifestItem,
  input: {
    httpStatus: number;
    status: string;
    sourceSize?: number;
    sourceSha256?: string;
    destinationSize?: number | null;
    destinationSha256?: string | null;
    hashMatch?: boolean;
  }
): MigrationResponse {
  return {
    httpStatus: input.httpStatus,
    body: {
      id: item.id,
      originalName: item.originalName,
      sourceSize: input.sourceSize ?? item.size,
      sourceSha256: input.sourceSha256,
      r2Key: item.plannedKey,
      destinationSize: input.destinationSize,
      destinationSha256: input.destinationSha256,
      hashMatch: input.hashMatch ?? false,
      status: input.status,
    },
  };
}

export async function runTemporaryBlobToR2Migration(
  body: unknown,
  deps: MigrationDeps
): Promise<MigrationResponse> {
  const manifest = inspectMigrationManifest();
  if (
    manifest.items !== 14 ||
    manifest.audio !== 12 ||
    manifest.video !== 2 ||
    manifest.bytes !== MIGRATION_EXPECTED_BYTES ||
    manifest.uniqueIds !== 14 ||
    manifest.uniquePathnames !== 14 ||
    manifest.uniqueKeys !== 14 ||
    !manifest.keysMatch
  ) {
    return fail(500, "INTERNAL_ERROR", "INTERNAL_ERROR");
  }

  if (deps.vercelEnv !== "production") {
    return fail(403, "NOT_PRODUCTION", "NOT_PRODUCTION");
  }

  try {
    await deps.requireAdmin();
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message === "Acesso negado") return fail(403, "AUTH_FAILURE", "AUTH_FAILURE");
    return fail(401, "AUTH_FAILURE", "AUTH_FAILURE");
  }

  const parsed = parseCopyRequest(body);
  if (!parsed.ok) return fail(400, "invalid_request", "INVALID_REQUEST");

  const item = BLOB_TO_R2_MIGRATION_MANIFEST.find((entry) => entry.id === parsed.id);
  if (!item) return fail(400, "unknown_id", "UNKNOWN_ID");

  const planKey = deps.planKey ?? planPortfolioR2ObjectKey;
  const calculated = planKey(item.pathname, item.mediaKind);
  if (!calculated || calculated !== item.plannedKey) {
    return report(item, { httpStatus: 409, status: "KEY_MISMATCH" });
  }

  let sourceHead: { size: number; contentType: string };
  try {
    sourceHead = await deps.headSource(item.pathname);
  } catch {
    return report(item, { httpStatus: 409, status: "SOURCE_UNAVAILABLE" });
  }
  if (sourceHead.size !== item.size) {
    return report(item, {
      httpStatus: 409,
      status: "SOURCE_MISMATCH",
      sourceSize: sourceHead.size,
    });
  }
  if (normalizeMime(sourceHead.contentType) !== normalizeMime(item.contentType)) {
    return report(item, { httpStatus: 409, status: "SOURCE_MISMATCH", sourceSize: sourceHead.size });
  }

  let sourceBytes: Buffer;
  try {
    sourceBytes = await deps.getSourceBytes(item.pathname);
  } catch {
    return report(item, { httpStatus: 409, status: "SOURCE_UNAVAILABLE", sourceSize: sourceHead.size });
  }
  if (sourceBytes.length !== item.size) {
    return report(item, {
      httpStatus: 409,
      status: "SOURCE_MISMATCH",
      sourceSize: sourceBytes.length,
    });
  }
  const sourceSha256 = sha256Hex(sourceBytes);

  let destination: DestinationHead;
  try {
    destination = await deps.headTarget(item.plannedKey);
  } catch {
    return report(item, {
      httpStatus: 409,
      status: "DESTINATION_UNAVAILABLE",
      sourceSize: sourceBytes.length,
      sourceSha256,
    });
  }

  if (destination.exists) {
    return classifyExistingDestination(item, deps, sourceBytes.length, sourceSha256, destination);
  }

  let putDone = false;
  try {
    await deps.putTarget({
      objectKey: item.plannedKey,
      bytes: sourceBytes,
      contentType: item.contentType,
    });
    putDone = true;
    const verifiedHead = await deps.headTarget(item.plannedKey);
    if (!verifiedHead.exists || verifiedHead.size !== item.size) {
      return report(item, {
        httpStatus: 500,
        status: "PUT_COMPLETED_BUT_VERIFICATION_FAILED",
        sourceSize: sourceBytes.length,
        sourceSha256,
        destinationSize: verifiedHead.exists ? verifiedHead.size : null,
        hashMatch: false,
      });
    }
    const destinationBytes = await deps.getTargetBytes(item.plannedKey);
    const destinationSha256 = sha256Hex(destinationBytes);
    if (destinationBytes.length !== item.size || destinationSha256 !== sourceSha256) {
      return report(item, {
        httpStatus: 500,
        status: "PUT_COMPLETED_BUT_VERIFICATION_FAILED",
        sourceSize: sourceBytes.length,
        sourceSha256,
        destinationSize: destinationBytes.length,
        destinationSha256,
        hashMatch: false,
      });
    }
    return report(item, {
      httpStatus: 200,
      status: "VERIFIED",
      sourceSize: sourceBytes.length,
      sourceSha256,
      destinationSize: destinationBytes.length,
      destinationSha256,
      hashMatch: true,
    });
  } catch (error) {
    if (!putDone && error instanceof MigrationCreateConflict) {
      try {
        const raced = await deps.headTarget(item.plannedKey);
        if (!raced.exists) {
          return report(item, {
            httpStatus: 409,
            status: "DESTINATION_UNAVAILABLE",
            sourceSize: sourceBytes.length,
            sourceSha256,
            hashMatch: false,
          });
        }
        return classifyExistingDestination(item, deps, sourceBytes.length, sourceSha256, raced);
      } catch {
        return report(item, {
          httpStatus: 409,
          status: "DESTINATION_UNAVAILABLE",
          sourceSize: sourceBytes.length,
          sourceSha256,
          hashMatch: false,
        });
      }
    }
    if (putDone) {
      return report(item, {
        httpStatus: 500,
        status: "PUT_COMPLETED_BUT_VERIFICATION_FAILED",
        sourceSize: sourceBytes.length,
        sourceSha256,
        hashMatch: false,
      });
    }
    return report(item, {
      httpStatus: 500,
      status: "INTERNAL_ERROR",
      sourceSize: sourceBytes.length,
      sourceSha256,
      hashMatch: false,
    });
  }
}

async function classifyExistingDestination(
  item: MigrationManifestItem,
  deps: MigrationDeps,
  sourceSize: number,
  sourceSha256: string,
  destination: Extract<DestinationHead, { exists: true }>
): Promise<MigrationResponse> {
  if (destination.size !== item.size) {
    return report(item, {
      httpStatus: 409,
      status: "DESTINATION_CONFLICT_SIZE",
      sourceSize,
      sourceSha256,
      destinationSize: destination.size,
      hashMatch: false,
    });
  }
  let destinationBytes: Buffer;
  try {
    destinationBytes = await deps.getTargetBytes(item.plannedKey);
  } catch {
    return report(item, {
      httpStatus: 409,
      status: "DESTINATION_UNAVAILABLE",
      sourceSize,
      sourceSha256,
      destinationSize: destination.size,
    });
  }
  const destinationSha256 = sha256Hex(destinationBytes);
  if (destinationBytes.length !== item.size || destinationSha256 !== sourceSha256) {
    return report(item, {
      httpStatus: 409,
      status: destinationBytes.length === item.size ? "DESTINATION_CONFLICT_HASH" : "DESTINATION_CONFLICT_SIZE",
      sourceSize,
      sourceSha256,
      destinationSize: destinationBytes.length,
      destinationSha256,
      hashMatch: false,
    });
  }
  return report(item, {
    httpStatus: 200,
    status: "SKIPPED_ALREADY_VERIFIED",
    sourceSize,
    sourceSha256,
    destinationSize: destinationBytes.length,
    destinationSha256,
    hashMatch: true,
  });
}
