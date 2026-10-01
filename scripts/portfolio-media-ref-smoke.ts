/**
 * Smoke — allowlist e ausência de teto interno de tamanho no Portfólio.
 * Sem Blob real, sem Prisma.
 */
import assert from "node:assert/strict";
import {
  checkPortfolioFile,
  inspectPortfolioPathname,
  parsePortfolioMedia,
  proposePortfolioPathname,
  portfolioAccept,
  portfolioFormatHint,
} from "../src/app/portfolio/portfolio-media-ref";

function mustAllow(kind: "image" | "audio" | "video", name: string, type: string, size: number) {
  assert.equal(checkPortfolioFile({ name, type, size }, kind), null, `permitir ${name} ${type}`);
}

function mustReject(kind: "image" | "audio" | "video", name: string, type: string, size = 1024) {
  const err = checkPortfolioFile({ name, type, size }, kind);
  assert.ok(err, `rejeitar ${name} ${type}`);
  assert.match(err as string, /^Use /);
}

mustAllow("image", "foto.png", "image/png", 1024);
mustAllow("image", "foto.jpg", "image/jpeg", 1024);
mustAllow("image", "foto.jpeg", "image/jpeg", 1024);
mustAllow("audio", "track.mp3", "audio/mpeg", 1024);
mustAllow("audio", "track.wav", "audio/wav", 1024);
mustAllow("audio", "track.wav", "audio/x-wav", 1024);
mustAllow("audio", "track.wav", "audio/wave", 1024);
mustAllow("video", "clip.mp4", "video/mp4", 1024);
mustAllow("video", "clip.mov", "video/quicktime", 1024);
mustAllow("video", "clip.MOV", "video/quicktime", 2048);
mustAllow("image", "foto.png", "image/png; charset=binary", 2048);

mustReject("image", "icon.svg", "image/svg+xml");
mustReject("video", "clip.webm", "video/webm");
mustReject("audio", "song.m4a", "audio/mp4");
mustReject("audio", "song.m4a", "audio/x-m4a");
mustReject("audio", "pack.zip", "application/zip");
mustReject("video", "clip.mp4", "application/octet-stream");
mustReject("image", "foto.webp", "image/webp");
mustReject("video", "clip.mov", "video/mp4");
mustReject("image", "foto.png", "image/*");
mustReject("video", "clip.mp4", "video/*");

assert.equal(
  checkPortfolioFile({ name: "huge.png", type: "image/png", size: 9 * 1024 * 1024 }, "image"),
  null,
  "imagem > 8 MB não rejeitada pelo teto antigo"
);
assert.equal(
  checkPortfolioFile({ name: "huge.mp3", type: "audio/mpeg", size: 41 * 1024 * 1024 }, "audio"),
  null,
  "áudio > 40 MB não rejeitado pelo teto antigo"
);
assert.equal(
  checkPortfolioFile({ name: "huge.mp4", type: "video/mp4", size: 81 * 1024 * 1024 }, "video"),
  null,
  "vídeo > 80 MB não rejeitado pelo teto antigo"
);
assert.equal(
  checkPortfolioFile({ name: "huge.mov", type: "video/quicktime", size: 81 * 1024 * 1024 }, "video"),
  null,
  "MOV grande não rejeitado por teto interno"
);

assert.equal(checkPortfolioFile({ name: "a.png", type: "image/png", size: 0 }, "image"), "Arquivo vazio.");

const movPath = proposePortfolioPathname("video", "demo.mov", "abc123def456xyz");
assert.ok(movPath && movPath.startsWith("portfolio/videos/") && movPath.endsWith(".mov"));
const movInspect = inspectPortfolioPathname(movPath!);
assert.ok(movInspect);
assert.equal(movInspect!.kind, "video");
assert.deepEqual(movInspect!.contentTypes, ["video/quicktime"]);
assert.equal("maxBytes" in movInspect!, false);

assert.ok(portfolioAccept("video").includes(".mov"));
assert.ok(portfolioAccept("video").includes("video/quicktime"));
assert.ok(!portfolioAccept("image").includes("webp"));
assert.equal(portfolioFormatHint("video"), "MP4 ou MOV");

const parsed = parsePortfolioMedia(
  {
    url: `https://store.blob.vercel-storage.com/${movPath}`,
    pathname: movPath,
    mimeType: "video/quicktime",
    originalName: "demo.mov",
    size: 81 * 1024 * 1024,
  },
  "video"
);
assert.equal(parsed.ok, true, "MOV persistido grande continua válido");

const webpPath = "portfolio/images/1_abc_old.webp";
assert.equal(inspectPortfolioPathname(webpPath), null, "webp fora da allowlist");

const octet = parsePortfolioMedia(
  {
    url: "https://store.blob.vercel-storage.com/portfolio/videos/1_abc_clip.mp4",
    pathname: "portfolio/videos/1_abc_clip.mp4",
    mimeType: "application/octet-stream",
    originalName: "clip.mp4",
    size: 1024,
  },
  "video"
);
assert.equal(octet.ok, false, "octet-stream persistido rejeitado");

console.log("[portfolio-media-ref-smoke] PASS");
