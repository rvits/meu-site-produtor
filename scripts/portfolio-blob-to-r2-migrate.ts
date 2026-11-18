/**
 * CLI Blob Portfolio → R2.
 * Sem flag: aborta.
 * --dry-run: lê PortfolioState e imprime plano sanitizado. Zero writes.
 * --execute: uma mídia, exige --target-bucket --confirm-copy=YES --id.
 * Não atualiza DB. Não apaga Blob.
 */
import { GetObjectCommand, HeadObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import { PrismaClient } from "@prisma/client";
import { get } from "@vercel/blob";
import {
  copyOnePortfolioCandidate,
  inspectProductionDatabaseUrl,
  parsePortfolioMigrateArgs,
  planPortfolioBlobToR2,
  sanitizeMigrationPlan,
  type CopyDeps,
} from "../src/app/lib/storage/portfolio-blob-to-r2";
import { createR2Client } from "../src/app/lib/storage/r2-client";
import { readR2SharedSettings } from "../src/app/lib/storage/r2-config";

const EXPECTED_UNIQUE = 14;

function print(value: unknown) {
  console.log(JSON.stringify(value));
}

function liveCopyDeps(): CopyDeps {
  return {
    async getSourceBytes(url) {
      const token = process.env.PORTFOLIO_BLOB_READ_WRITE_TOKEN;
      if (!token) throw new Error("source_unconfigured");
      const result = await get(url, { access: "public", token });
      if (!result || result.statusCode !== 200 || !result.stream) throw new Error("source_get_failed");
      return Buffer.from(await new Response(result.stream).arrayBuffer());
    },
    async putTarget(input) {
      const shared = readR2SharedSettings();
      if (!shared.ok) throw new Error("r2_unconfigured");
      const client = createR2Client(shared.settings);
      await client.send(
        new PutObjectCommand({
          Bucket: input.bucket,
          Key: input.objectKey,
          Body: input.bytes,
          ContentType: input.contentType,
        })
      );
    },
    async headTarget(input) {
      const shared = readR2SharedSettings();
      if (!shared.ok) throw new Error("r2_unconfigured");
      const client = createR2Client(shared.settings);
      const headed = await client.send(
        new HeadObjectCommand({
          Bucket: input.bucket,
          Key: input.objectKey,
        })
      );
      return {
        size: typeof headed.ContentLength === "number" ? headed.ContentLength : null,
        contentType: headed.ContentType || null,
      };
    },
    async getTargetBytes(input) {
      const shared = readR2SharedSettings();
      if (!shared.ok) throw new Error("r2_unconfigured");
      const client = createR2Client(shared.settings);
      const got = await client.send(
        new GetObjectCommand({
          Bucket: input.bucket,
          Key: input.objectKey,
        })
      );
      const bytes = await got.Body?.transformToByteArray();
      if (!bytes) throw new Error("empty_target");
      return Buffer.from(bytes);
    },
  };
}

async function loadProductionDocuments() {
  const gate = inspectProductionDatabaseUrl(process.env.DATABASE_URL);
  print({
    dbTarget: {
      host_prefix: gate.host_prefix,
      database: gate.database,
      production_match: gate.production_match,
      preview_match: gate.preview_match,
    },
  });
  if (gate.production_match !== "YES" || gate.preview_match !== "NO" || gate.database !== "neondb") {
    print({ blocked: "BLOCKED_ENV" });
    return null;
  }
  const prisma = new PrismaClient({
    datasources: { db: { url: process.env.DATABASE_URL } },
    log: [],
  });
  try {
    const row = await prisma.portfolioState.findUnique({
      where: { id: "default" },
      select: { draftDocument: true, publishedDocument: true },
    });
    return { draft: row?.draftDocument, published: row?.publishedDocument };
  } finally {
    await prisma.$disconnect().catch(() => {});
  }
}

async function main() {
  const parsed = parsePortfolioMigrateArgs(process.argv.slice(2));
  if (!parsed.ok) {
    print({ error: parsed.error });
    process.exit(2);
    return;
  }

  if (parsed.mode === "dry-run") {
    const documents = await loadProductionDocuments();
    if (!documents) {
      process.exit(2);
      return;
    }
    const plan = planPortfolioBlobToR2(documents);
    const sanitized = sanitizeMigrationPlan(plan);
    print({
      mode: "dry-run",
      writes: { database: 0, blob: 0, r2: 0 },
      counts: plan.counts,
      skippedAlreadyR2: plan.skippedAlreadyR2.length,
      rejected: plan.rejected.length,
      rows: sanitized,
    });
    if (plan.rejected.length > 0) {
      print({ stopped: "REJECTED_REFERENCE" });
      process.exit(3);
      return;
    }
    if (plan.counts.uniqueCandidates !== EXPECTED_UNIQUE) {
      print({ stopped: "UNEXPECTED_CANDIDATE_COUNT" });
      process.exit(3);
      return;
    }
    return;
  }

  const documents = await loadProductionDocuments();
  if (!documents) {
    process.exit(2);
    return;
  }
  const plan = planPortfolioBlobToR2(documents);
  const candidate = plan.candidates.find((item) => item.logicalId === parsed.id);
  if (!candidate) {
    print({ error: "id_not_in_plan" });
    process.exit(3);
    return;
  }
  const copied = await copyOnePortfolioCandidate(
    {
      candidate,
      targetBucket: parsed.targetBucket,
      confirmCopy: parsed.confirmCopy,
      id: parsed.id,
    },
    liveCopyDeps()
  );
  print({
    mode: "execute",
    id: parsed.id,
    targetBucket: parsed.targetBucket,
    result: copied.ok ? { ok: true, size: copied.size } : copied,
    dbWrites: 0,
  });
  if (!copied.ok) process.exit(4);
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : "error";
  print({ error: message.replace(/postgres(ql)?:\/\/\S+/gi, "[redacted]") });
  process.exit(1);
});
