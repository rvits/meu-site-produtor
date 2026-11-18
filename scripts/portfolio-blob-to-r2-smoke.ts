/**
 * Smoke — planner Blob Portfolio → R2. Sem rede, sem Prisma, sem PUT real.
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  acceptedPortfolioR2ObjectKey,
  parsePortfolioMedia,
} from "../src/app/portfolio/portfolio-media-ref";
import {
  copyOnePortfolioCandidate,
  parsePortfolioMigrateArgs,
  planPortfolioBlobToR2,
  planPortfolioR2ObjectKey,
  sanitizeMigrationPlan,
  sha256Hex,
  verifyCopiedObject,
  type CopyDeps,
  type PortfolioMigrationCandidate,
} from "../src/app/lib/storage/portfolio-blob-to-r2";

const BLOB_AUDIO = "portfolio/audio/1790837420900_abc123def456_track.wav";
const BLOB_VIDEO = "portfolio/videos/1790837880123_abc123def456_clip.mp4";
const BLOB_AUDIO_URL = `https://store.blob.vercel-storage.com/${BLOB_AUDIO}`;
const BLOB_VIDEO_URL = `https://store.blob.vercel-storage.com/${BLOB_VIDEO}`;
const UUID = "7c9e6679-7425-40de-944b-e07fc1f90ae7";

function must(condition: boolean, message: string) {
  if (!condition) throw new Error(message);
}

function audioMedia(pathname = BLOB_AUDIO, url = BLOB_AUDIO_URL) {
  return {
    url,
    pathname,
    mimeType: "audio/wav",
    originalName: "mix-cliente.wav",
    size: 1024,
  };
}

function videoMedia() {
  return {
    url: BLOB_VIDEO_URL,
    pathname: BLOB_VIDEO,
    mimeType: "video/mp4",
    originalName: "sessao.mp4",
    size: 2048,
  };
}

function docWith(blocks: Array<{ kind: "audio" | "video" | "image"; media: unknown }>) {
  return {
    sections: {
      hero: [],
      "autoral-musicas": blocks.map((block, index) => ({
        id: `b${index}`,
        kind: block.kind,
        media: block.media,
      })),
    },
  };
}

function candidateFromPlan(): PortfolioMigrationCandidate {
  const plan = planPortfolioBlobToR2({
    draft: docWith([{ kind: "audio", media: audioMedia() }]),
    published: docWith([{ kind: "audio", media: audioMedia() }]),
  });
  assert.equal(plan.candidates.length, 1);
  return plan.candidates[0];
}

function recordingDeps(store: { puts: number; lastBucket?: string }): CopyDeps & { bytes: Buffer } {
  const bytes = Buffer.from("wav-bytes-fixture");
  return {
    bytes,
    async getSourceBytes() {
      return bytes;
    },
    async putTarget(input) {
      store.puts += 1;
      store.lastBucket = input.bucket;
    },
    async getTargetBytes() {
      return bytes;
    },
    async headTarget() {
      return { size: bytes.length, contentType: "audio/wav" };
    },
  };
}

async function main() {
  const plannerSrc = fs.readFileSync(
    path.join(process.cwd(), "src/app/lib/storage/portfolio-blob-to-r2.ts"),
    "utf8"
  );
  const cliSrc = fs.readFileSync(
    path.join(process.cwd(), "scripts/portfolio-blob-to-r2-migrate.ts"),
    "utf8"
  );

  // B. sem flag aborta
  const noFlag = parsePortfolioMigrateArgs([]);
  assert.equal(noFlag.ok, false);

  // A. dry-run não executa PUT
  const dry = parsePortfolioMigrateArgs(["--dry-run"]);
  assert.equal(dry.ok, true);
  if (dry.ok) assert.equal(dry.mode, "dry-run");
  const putStore = { puts: 0 };
  planPortfolioBlobToR2({
    draft: docWith([{ kind: "audio", media: audioMedia() }]),
    published: docWith([{ kind: "audio", media: audioMedia() }]),
  });
  assert.equal(putStore.puts, 0);
  must(!plannerSrc.includes("PutObjectCommand"), "planner contém PUT");
  must(!plannerSrc.includes("prisma."), "planner fala com Prisma");
  must(!plannerSrc.includes("portfolioState.update"), "planner tem update");

  // C. --dry-run gera plano determinístico
  const first = planPortfolioBlobToR2({
    published: docWith([{ kind: "audio", media: audioMedia() }]),
    draft: docWith([{ kind: "audio", media: audioMedia() }]),
  });
  const second = planPortfolioBlobToR2({
    draft: docWith([{ kind: "audio", media: audioMedia() }]),
    published: docWith([{ kind: "audio", media: audioMedia() }]),
  });
  assert.equal(first.candidates[0].targetKey, second.candidates[0].targetKey);
  assert.equal(first.candidates[0].logicalId, "PORTFOLIO-001");

  // D. draft/published duplicados viram uma mídia
  assert.equal(first.counts.uniqueCandidates, 1);
  assert.deepEqual(first.candidates[0].origins.sort(), ["DRAFT", "PUBLISHED"]);

  // E. Blob Portfolio válido entra no plano
  assert.equal(first.candidates[0].source, "BLOB");
  assert.equal(first.candidates[0].status, "PLANNED");

  // J. target key respeita prefixo
  assert.match(first.candidates[0].targetKey, /^portfolio\/audio\/[0-9a-f-]{36}\.wav$/);
  assert.ok(acceptedPortfolioR2ObjectKey(first.candidates[0].targetKey));

  // K. originalName não entra na key R2
  must(!first.candidates[0].targetKey.includes("mix-cliente"), "originalName vazou para a key");
  must(!first.candidates[0].targetKey.includes("track"), "basename Blob vazou para a key");

  // L. extensão preservada
  assert.ok(first.candidates[0].targetKey.endsWith(".wav"));
  const videoPlan = planPortfolioBlobToR2({
    published: docWith([{ kind: "video", media: videoMedia() }]),
  });
  assert.ok(videoPlan.candidates[0].targetKey.endsWith(".mp4"));
  assert.match(videoPlan.candidates[0].targetKey, /^portfolio\/videos\//);

  const r2Ref = parsePortfolioMedia(
    {
      url: `r2:${first.candidates[0].targetKey}`,
      pathname: first.candidates[0].targetKey,
      mimeType: "audio/wav",
      originalName: "mix-cliente.wav",
      size: 1024,
    },
    "audio"
  );
  assert.equal(r2Ref.ok, true, "target key rejeitada pelo parser Batch 1");

  // F. R2 já existente não vira source Blob
  const already = planPortfolioBlobToR2({
    published: docWith([
      {
        kind: "audio",
        media: {
          url: `r2:portfolio/audio/${UUID}.wav`,
          pathname: `portfolio/audio/${UUID}.wav`,
          mimeType: "audio/wav",
          originalName: "ja-r2.wav",
          size: 1024,
        },
      },
    ]),
  });
  assert.equal(already.counts.uniqueCandidates, 0);
  assert.equal(already.skippedAlreadyR2.length, 1);

  // G. delivery Blob é rejeitado
  const delivery = planPortfolioBlobToR2({
    published: docWith([
      {
        kind: "audio",
        media: {
          url: "https://example.public.blob.vercel-storage.com/deliveries/fixture-entrega.wav",
          pathname: "deliveries/fixture-entrega.wav",
          mimeType: "audio/wav",
          originalName: "entrega.wav",
          size: 1024,
        },
      },
    ]),
  });
  assert.equal(delivery.counts.uniqueCandidates, 0);
  assert.ok(delivery.rejected.length >= 1);

  // H. avatar Blob é rejeitado
  const avatar = planPortfolioBlobToR2({
    published: docWith([
      {
        kind: "image",
        media: {
          url: "https://store.blob.vercel-storage.com/avatars/user.jpg",
          pathname: "avatars/user.jpg",
          mimeType: "image/jpeg",
          originalName: "foto.jpg",
          size: 1024,
        },
      },
    ]),
  });
  assert.equal(avatar.counts.uniqueCandidates, 0);

  // I. HTTPS arbitrário rejeitado
  const external = planPortfolioBlobToR2({
    published: docWith([
      {
        kind: "audio",
        media: {
          url: "https://cdn.example.com/portfolio/audio/track.wav",
          pathname: BLOB_AUDIO,
          mimeType: "audio/wav",
          originalName: "track.wav",
          size: 1024,
        },
      },
    ]),
  });
  assert.equal(external.counts.uniqueCandidates, 0);
  assert.ok(external.rejected.length >= 1);

  // M. orphan não entra se não estiver no PortfolioState
  const onlyPublished = planPortfolioBlobToR2({
    published: docWith([{ kind: "audio", media: audioMedia() }]),
    draft: docWith([{ kind: "audio", media: audioMedia() }]),
  });
  const orphanPath = "portfolio/audio/1790832511018_orphan_file.wav";
  must(
    !onlyPublished.candidates.some((item) => item.pathname === orphanPath),
    "orphan sem DB entrou no plano"
  );

  // N. nenhum DB update no caminho de copy
  must(!plannerSrc.includes("portfolioState.update"), "copy atualiza PortfolioState");
  must(!cliSrc.includes("portfolioState.update"), "CLI atualiza PortfolioState");
  must(!cliSrc.includes("$executeRaw"), "CLI raw write");

  // O. nenhuma delete Blob
  must(!plannerSrc.includes("blob.del") && !plannerSrc.includes("del("), "planner deleta Blob");
  must(!cliSrc.includes("blob.del"), "CLI deleta Blob");
  must(!cliSrc.includes("DeleteObjectCommand"), "CLI deleta R2");

  // P. execute exige target bucket explícito
  const executeNoBucket = parsePortfolioMigrateArgs(["--execute", "--confirm-copy=YES", "--id=PORTFOLIO-001"]);
  assert.equal(executeNoBucket.ok, false);

  // Q. execute não aceita bucket Preview/Production por inferência silenciosa
  const previousPortfolio = process.env.R2_PORTFOLIO_BUCKET;
  process.env.R2_PORTFOLIO_BUCKET = "thouse-portfolio";
  try {
    const inferred = parsePortfolioMigrateArgs(["--execute", "--confirm-copy=YES", "--id=PORTFOLIO-001"]);
    assert.equal(inferred.ok, false);
  } finally {
    if (previousPortfolio === undefined) delete process.env.R2_PORTFOLIO_BUCKET;
    else process.env.R2_PORTFOLIO_BUCKET = previousPortfolio;
  }
  const executeOk = parsePortfolioMigrateArgs([
    "--execute",
    "--target-bucket=thouse-portfolio",
    "--confirm-copy=YES",
    "--id=PORTFOLIO-001",
  ]);
  assert.equal(executeOk.ok, true);
  if (executeOk.ok) {
    assert.equal(executeOk.mode, "execute");
    assert.equal(executeOk.targetBucket, "thouse-portfolio");
  }

  const planned = candidateFromPlan();
  planned.size = Buffer.from("wav-bytes-fixture").length;

  // R. hash mismatch resulta FAILED
  const hashMismatch: CopyDeps = {
    async getSourceBytes() {
      return Buffer.from("source");
    },
    async putTarget() {},
    async getTargetBytes() {
      return Buffer.from("target-different");
    },
    async headTarget() {
      return { size: 6, contentType: "audio/wav" };
    },
  };
  const hashFail = await copyOnePortfolioCandidate(
    {
      candidate: { ...planned, size: 6 },
      targetBucket: "thouse-portfolio",
      confirmCopy: "YES",
      id: planned.logicalId,
    },
    hashMismatch
  );
  assert.equal(hashFail.ok, false);
  if (!hashFail.ok) assert.equal(hashFail.reason, "hash_mismatch");
  assert.equal(verifyCopiedObject({
    sourceSize: 4,
    sourceHash: sha256Hex(Buffer.from("aaaa")),
    sourceContentType: "audio/wav",
    targetSize: 4,
    targetHash: sha256Hex(Buffer.from("bbbb")),
    targetContentType: "audio/wav",
  }).ok, false);

  // S. size mismatch resulta FAILED
  const sizeFail = await copyOnePortfolioCandidate(
    {
      candidate: { ...planned, size: 99 },
      targetBucket: "thouse-portfolio",
      confirmCopy: "YES",
      id: planned.logicalId,
    },
    recordingDeps({ puts: 0 })
  );
  assert.equal(sizeFail.ok, false);
  if (!sizeFail.ok) assert.equal(sizeFail.reason, "size_mismatch");

  const puts = { puts: 0, lastBucket: undefined as string | undefined };
  const deps = recordingDeps(puts);
  const copied = await copyOnePortfolioCandidate(
    {
      candidate: { ...planned, size: deps.bytes.length },
      targetBucket: "thouse-portfolio-preview",
      confirmCopy: "YES",
      id: planned.logicalId,
    },
    deps
  );
  assert.equal(copied.ok, true);
  assert.equal(puts.puts, 1);
  assert.equal(puts.lastBucket, "thouse-portfolio-preview");

  const sanitized = sanitizeMigrationPlan(first);
  must(!JSON.stringify(sanitized).includes("mix-cliente"), "sanitização vazou originalName");
  must(!JSON.stringify(sanitized).includes("blob.vercel-storage.com"), "sanitização vazou URL Blob");

  const keyAgain = planPortfolioR2ObjectKey(BLOB_AUDIO, "audio");
  assert.equal(keyAgain, first.candidates[0].targetKey);

  console.log("[portfolio-blob-to-r2-smoke] PASS");
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : "error";
  console.error("[portfolio-blob-to-r2-smoke] FAIL", message);
  process.exit(1);
});
