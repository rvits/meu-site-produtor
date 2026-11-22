/**
 * TEMPORARY MIGRATION TOOL
 * POST administrativo, um id por vez. Será removida depois da migração.
 * Não grava PortfolioState, não publica e não apaga Blob nem R2.
 */

import { GetObjectCommand, HeadObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import { get, head } from "@vercel/blob";
import { NextResponse } from "next/server";
import { requireAdmin } from "@/app/lib/auth";
import { classifyR2SdkError } from "@/app/lib/storage/r2-delivery";
import { createR2Client } from "@/app/lib/storage/r2-client";
import { portfolioWriteBucketAllowed, readR2SharedSettings } from "@/app/lib/storage/r2-config";
import {
  BLOB_TO_R2_MIGRATION_MANIFEST,
  MIGRATION_BUCKET,
  MigrationCreateConflict,
  readMigrationBody,
  runTemporaryBlobToR2Migration,
  type MigrationDeps,
} from "./execute";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const NO_STORE = { "Cache-Control": "no-store" };

const BLOB_HOST = "https://u3z8ab7xbluuucwz.public.blob.vercel-storage.com";

function blobUrl(pathname: string): string {
  return `${BLOB_HOST}/${pathname}`;
}

function assertManifestKey(objectKey: string) {
  if (!BLOB_TO_R2_MIGRATION_MANIFEST.some((item) => item.plannedKey === objectKey)) {
    throw new Error("key_not_allowed");
  }
}

function liveDeps(): MigrationDeps {
  let client: ReturnType<typeof createR2Client> | null = null;

  function r2() {
    const shared = readR2SharedSettings();
    if (!shared.ok || !portfolioWriteBucketAllowed(MIGRATION_BUCKET)) {
      throw new Error("storage_unconfigured");
    }
    if (!client) client = createR2Client(shared.settings);
    return client;
  }

  return {
    vercelEnv: process.env.VERCEL_ENV,
    async requireAdmin() {
      await requireAdmin();
    },
    async headSource(pathname) {
      const token = process.env.PORTFOLIO_BLOB_READ_WRITE_TOKEN;
      if (!token) throw new Error("storage_unconfigured");
      const meta = await head(blobUrl(pathname), { token });
      return { size: meta.size, contentType: meta.contentType || "" };
    },
    async getSourceBytes(pathname) {
      const token = process.env.PORTFOLIO_BLOB_READ_WRITE_TOKEN;
      if (!token) throw new Error("storage_unconfigured");
      const result = await get(blobUrl(pathname), { access: "public", token });
      if (!result || result.statusCode !== 200 || !result.stream) throw new Error("source_get_failed");
      return Buffer.from(await new Response(result.stream).arrayBuffer());
    },
    async headTarget(objectKey) {
      assertManifestKey(objectKey);
      try {
        const headed = await r2().send(new HeadObjectCommand({ Bucket: MIGRATION_BUCKET, Key: objectKey }));
        return {
          exists: true as const,
          size: typeof headed.ContentLength === "number" ? headed.ContentLength : null,
          contentType: headed.ContentType || null,
        };
      } catch (error) {
        if (classifyR2SdkError(error) === "missing") return { exists: false as const };
        throw error;
      }
    },
    async getTargetBytes(objectKey) {
      assertManifestKey(objectKey);
      const got = await r2().send(new GetObjectCommand({ Bucket: MIGRATION_BUCKET, Key: objectKey }));
      const bytes = await got.Body?.transformToByteArray();
      if (!bytes) throw new Error("empty_target");
      return Buffer.from(bytes);
    },
    async putTarget(input) {
      assertManifestKey(input.objectKey);
      try {
        await r2().send(
          new PutObjectCommand({
            Bucket: MIGRATION_BUCKET,
            Key: input.objectKey,
            Body: input.bytes,
            ContentType: input.contentType,
            IfNoneMatch: "*",
          })
        );
      } catch (error) {
        if (isCreateConflict(error)) throw new MigrationCreateConflict();
        throw new Error("put_failed");
      }
    },
  };
}

function isCreateConflict(error: unknown): boolean {
  const name = error instanceof Error ? error.name : "";
  const status =
    error && typeof error === "object" && "$metadata" in error
      ? Number((error as { $metadata?: { httpStatusCode?: number } }).$metadata?.httpStatusCode || 0)
      : 0;
  return status === 412 || status === 409 || name === "PreconditionFailed" || name === "ConditionalRequestConflict";
}

export async function POST(request: Request) {
  const read = await readMigrationBody(request);
  if (!read.ok) {
    return NextResponse.json({ error: "INVALID_REQUEST", status: "INVALID_REQUEST" }, { status: 400, headers: NO_STORE });
  }
  try {
    const result = await runTemporaryBlobToR2Migration(read.body, liveDeps());
    return NextResponse.json(result.body, { status: result.httpStatus, headers: NO_STORE });
  } catch {
    return NextResponse.json({ error: "INTERNAL_ERROR", status: "INTERNAL_ERROR" }, { status: 500, headers: NO_STORE });
  }
}
