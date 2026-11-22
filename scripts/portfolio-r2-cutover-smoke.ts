/**
 * Smoke da ferramenta temporária de cutover R2. Sem rede, sem Production, sem storage.
 */
import fs from "node:fs";
import path from "node:path";
import { BLOB_TO_R2_MIGRATION_MANIFEST, type MigrationManifestItem } from "../src/app/api/admin/portfolio/blob-to-r2-migration/execute";
import {
  CUTOVER_EXPECTED_DRAFT_UPDATED_AT,
  CUTOVER_EXPECTED_DRAFT_VERSION,
  CUTOVER_EXPECTED_PUBLISHED_AT,
  CUTOVER_EXPECTED_PUBLISHED_VERSION,
  CUTOVER_MAX_BODY_BYTES,
  CUTOVER_NEXT_VERSION,
  CUTOVER_ROW_ID,
  canonicalCutoverSnapshotSha256,
  canonicalJson,
  readCutoverBody,
  runPortfolioR2Cutover,
  type CutoverDeps,
  type CutoverRow,
  type CutoverWriteWhere,
} from "../src/app/api/admin/portfolio/r2-cutover/execute";
import type { PortfolioSectionId } from "../src/app/portfolio/portfolio-data";

const BLOB_HOST = "https://u3z8ab7xbluuucwz.public.blob.vercel-storage.com";
const CUTOVER_AT = new Date("2026-11-22T12:00:00.000Z");

function must(condition: boolean, message: string) {
  if (!condition) throw new Error(message);
}

function blobUrl(pathname: string): string {
  return `${BLOB_HOST}/${pathname}`;
}

function mediaBlock(item: MigrationManifestItem, extra: Record<string, unknown> = {}) {
  const url = blobUrl(item.pathname);
  return {
    id: `media-${item.id}`,
    kind: item.mediaKind,
    size: "medium",
    columnSpan: 6,
    columnStart: 1,
    rowSpan: 1,
    minHeight: 0,
    hidden: false,
    previewOnly: false,
    text: `Peca ${item.id}`,
    body: "",
    align: "left",
    alt: "",
    caption: item.id === "04" ? "corte-preservado" : "",
    titleLevel: "h2",
    textColor: "white",
    variant: null,
    textHighlights: [],
    imageZoom: 1,
    imagePositionX: 0,
    imagePositionY: 0,
    src: url,
    media: {
      url,
      pathname: item.pathname,
      mimeType: item.contentType,
      originalName: item.originalName,
      size: item.size,
    },
    editorNote: item.id === "04" ? "nao-apagar" : "nota",
    ...extra,
  };
}

function baseDocument() {
  const sections: Record<PortfolioSectionId, unknown[]> = {
    hero: [
      {
        id: "hero-title",
        kind: "title",
        size: "medium",
        columnSpan: 6,
        columnStart: 1,
        rowSpan: 1,
        minHeight: 0,
        hidden: false,
        previewOnly: false,
        text: "Victor Pereira Ramos",
        body: "",
        align: "left",
        alt: "",
        caption: "",
        titleLevel: "hero",
        textColor: "white",
        variant: "hero-name",
        textHighlights: [
          { start: 0, end: 1, color: "red" },
          { start: 7, end: 8, color: "red" },
        ],
        imageZoom: 1,
        imagePositionX: 0,
        imagePositionY: 0,
        src: null,
        media: null,
      },
    ],
    "autoral-musicas": [],
    "autoral-beats": [],
    "servico-beats": [],
    "servico-mixagens": [
      {
        id: "mix-vazio",
        kind: "audio",
        size: "medium",
        columnSpan: 6,
        columnStart: 1,
        rowSpan: 1,
        minHeight: 0,
        hidden: false,
        previewOnly: false,
        text: "Mix",
        body: "",
        align: "left",
        alt: "",
        caption: "",
        titleLevel: "h2",
        textColor: "white",
        variant: null,
        textHighlights: [],
        imageZoom: 1,
        imagePositionX: 0,
        imagePositionY: 0,
        src: null,
        media: null,
      },
    ],
    "servico-masterizacoes": [],
    "servico-captacoes": [],
    "servico-sonoplastia": [],
  };
  const placement: Record<string, PortfolioSectionId> = {
    "01": "autoral-musicas",
    "02": "autoral-musicas",
    "03": "autoral-beats",
    "04": "autoral-beats",
    "05": "autoral-beats",
    "06": "autoral-beats",
    "07": "autoral-beats",
    "08": "autoral-beats",
    "09": "servico-beats",
    "10": "servico-beats",
    "11": "servico-masterizacoes",
    "12": "servico-masterizacoes",
    "13": "servico-masterizacoes",
    "14": "servico-masterizacoes",
  };
  for (const item of BLOB_TO_R2_MIGRATION_MANIFEST) {
    sections[placement[item.id]].push(mediaBlock(item));
  }
  const beats = sections["autoral-beats"];
  const fourth = beats[1];
  const fifth = beats[2];
  beats[1] = fifth;
  beats[2] = fourth;
  return { sections };
}

function rowFrom(draft: unknown, published: unknown, patch: Partial<CutoverRow> = {}): CutoverRow {
  return {
    id: CUTOVER_ROW_ID,
    draftDocument: draft,
    publishedDocument: published,
    draftVersion: CUTOVER_EXPECTED_DRAFT_VERSION,
    publishedVersion: CUTOVER_EXPECTED_PUBLISHED_VERSION,
    draftUpdatedAt: new Date(CUTOVER_EXPECTED_DRAFT_UPDATED_AT),
    publishedAt: new Date(CUTOVER_EXPECTED_PUBLISHED_AT),
    ...patch,
  };
}

function harness(options: {
  env?: string;
  admin?: "ok" | "anonymous" | "forbidden" | "secret";
  row?: CutoverRow | null;
  manifest?: CutoverDeps["manifest"];
  planKey?: CutoverDeps["planKey"];
  updateCount?: number;
  tamperReread?: boolean;
  explode?: boolean;
} = {}) {
  const initial = options.row === undefined ? rowFrom(baseDocument(), baseDocument()) : options.row;
  let committed = structuredClone(initial);
  const updateWheres: CutoverWriteWhere[] = [];
  let nowCalls = 0;
  const deps: CutoverDeps = {
    vercelEnv: options.env ?? "production",
    manifest: options.manifest,
    planKey: options.planKey,
    now() {
      nowCalls += 1;
      return new Date(CUTOVER_AT);
    },
    async requireAdmin() {
      if (options.admin === "anonymous") throw new Error("Não autenticado");
      if (options.admin === "forbidden") throw new Error("Acesso negado");
      if (options.admin === "secret") throw new Error("DATABASE_URL=postgres://user:pass@host/db");
    },
    async transaction(run) {
      if (options.explode) throw new Error("postgres://secret-host/neondb");
      const snapshot = structuredClone(committed);
      let working = structuredClone(committed);
      let reads = 0;
      try {
        await run({
          async read() {
            reads += 1;
            if (!working) return null;
            if (reads > 1 && options.tamperReread) {
              return { ...structuredClone(working), draftVersion: 99 };
            }
            return structuredClone(working);
          },
          async updateMany(input) {
            updateWheres.push(input.where);
            if (options.updateCount === 0) return { count: 0 };
            const current = working;
            const matches =
              current &&
              current.id === input.where.id &&
              current.draftVersion === input.where.draftVersion &&
              current.publishedVersion === input.where.publishedVersion &&
              current.draftUpdatedAt.getTime() === input.where.draftUpdatedAt.getTime() &&
              current.publishedAt?.getTime() === input.where.publishedAt.getTime();
            if (!matches || !current) return { count: 0 };
            working = {
              ...current,
              draftDocument: input.data.draftDocument,
              publishedDocument: input.data.publishedDocument,
              draftVersion: input.data.draftVersion,
              publishedVersion: input.data.publishedVersion,
              draftUpdatedAt: input.data.draftUpdatedAt,
              publishedAt: input.data.publishedAt,
            };
            return { count: 1 };
          },
        });
        committed = working;
      } catch (error) {
        committed = snapshot;
        throw error;
      }
    },
  };
  return {
    deps,
    updateWheres,
    nowCalls: () => nowCalls,
    committed: () => committed,
  };
}

function cutoverBody(extra: Record<string, unknown> = {}) {
  return { operation: "cutover", confirm: "YES", ...extra };
}

async function run(body: unknown, options: Parameters<typeof harness>[0] = {}) {
  const state = harness(options);
  const result = await runPortfolioR2Cutover(body, state.deps);
  return { ...state, result };
}

function statusOf(body: { status?: string; error?: string }): string | undefined {
  return body.status || body.error;
}

function jsonRequest(body: string, contentType = "application/json") {
  return new Request("https://example.invalid/r2-cutover", {
    method: "POST",
    headers: { "content-type": contentType, "content-length": String(Buffer.byteLength(body)) },
    body,
  });
}

function findBlock(doc: unknown, id: string): Record<string, unknown> | null {
  const sections = (doc as { sections: Record<string, unknown[]> }).sections;
  for (const blocks of Object.values(sections)) {
    for (const block of blocks) {
      if (block && typeof block === "object" && (block as { id?: string }).id === id) return block as Record<string, unknown>;
    }
  }
  return null;
}

async function main() {
  const source = fs.readFileSync(path.join(process.cwd(), "src/app/api/admin/portfolio/r2-cutover/execute.ts"), "utf8");
  const routeSource = fs.readFileSync(path.join(process.cwd(), "src/app/api/admin/portfolio/r2-cutover/route.ts"), "utf8");
  must(!source.includes("@vercel/blob") && !source.includes("@aws-sdk"), "40 execute storage import");
  must(!routeSource.includes("@vercel/blob") && !routeSource.includes("@aws-sdk"), "41 route storage import");
  must(!source.includes("DeleteObject") && !routeSource.includes("DeleteObject"), "40 delete");
  must(!source.includes('"rollback"') && !source.includes('"restore"') && !source.includes('"revert"'), "16 no rollback operation");
  must(source.indexOf("requireAdmin") < source.indexOf("deps.transaction"), "auth before state");
  must(source.indexOf("vercelEnv") < source.indexOf("deps.transaction"), "production gate before state");
  must(source.split("updateMany").length - 1 === 2, "39 single updateMany");
  must(!/export async function (GET|PUT|PATCH|DELETE)/.test(routeSource), "post only");
  must(routeSource.includes("export async function POST"), "post");

  const preview = await run(cutoverBody(), { env: "preview" });
  must(statusOf(preview.result.body) === "NON_PRODUCTION" && preview.result.httpStatus === 403, "1 non-production");
  must(preview.updateWheres.length === 0, "1 no write");

  const anonymous = await run(cutoverBody(), { admin: "anonymous" });
  must(statusOf(anonymous.result.body) === "UNAUTHORIZED" && anonymous.result.httpStatus === 401, "2 anonymous");
  must(anonymous.updateWheres.length === 0, "2 no write");

  const forbidden = await run(cutoverBody(), { admin: "forbidden" });
  must(statusOf(forbidden.result.body) === "FORBIDDEN" && forbidden.result.httpStatus === 403, "3 non-admin");
  must(forbidden.updateWheres.length === 0, "3 no write");

  const wrongType = await readCutoverBody(jsonRequest("{}", "text/plain"));
  must(!wrongType.ok, "4 content-type");
  const malformed = await readCutoverBody(jsonRequest("{"));
  must(!malformed.ok, "5 malformed");
  const missingOperation = await run({ confirm: "YES" });
  must(statusOf(missingOperation.result.body) === "INVALID_REQUEST" && missingOperation.updateWheres.length === 0, "6 missing operation");
  const wrongOperation = await run({ operation: "rollback", confirm: "YES" });
  must(statusOf(wrongOperation.result.body) === "INVALID_REQUEST" && wrongOperation.updateWheres.length === 0, "7 wrong operation");
  const missingConfirm = await run({ operation: "cutover" });
  must(statusOf(missingConfirm.result.body) === "INVALID_REQUEST", "8 missing confirm");
  const wrongConfirm = await run({ operation: "cutover", confirm: "yes" });
  must(statusOf(wrongConfirm.result.body) === "INVALID_REQUEST", "9 wrong confirm");
  const extra = await run(cutoverBody({ pathname: BLOB_TO_R2_MIGRATION_MANIFEST[0].pathname }));
  must(statusOf(extra.result.body) === "INVALID_REQUEST" && extra.updateWheres.length === 0, "10 extra");
  const oversized = await readCutoverBody(jsonRequest("x".repeat(CUTOVER_MAX_BODY_BYTES + 20)));
  must(!oversized.ok, "11 body size");
  const parsedArray = await readCutoverBody(jsonRequest('[{"operation":"cutover","confirm":"YES"}]'));
  must(parsedArray.ok, "array parsed");
  if (parsedArray.ok) {
    const rejected = await runPortfolioR2Cutover(parsedArray.body, harness().deps);
    must(statusOf(rejected.body) === "INVALID_REQUEST", "array rejected");
  }

  const shortManifest = await run(cutoverBody(), { manifest: BLOB_TO_R2_MIGRATION_MANIFEST.slice(0, 13) });
  must(statusOf(shortManifest.result.body) === "MANIFEST_MISMATCH" && shortManifest.updateWheres.length === 0, "12 manifest count");
  const badKey = await run(cutoverBody(), { planKey: () => "portfolio/audio/00000000-0000-5000-8000-000000000000.mp3" });
  must(statusOf(badKey.result.body) === "MANIFEST_MISMATCH" && badKey.updateWheres.length === 0, "13 key mismatch");

  const draftVersion = await run(cutoverBody(), { row: rowFrom(baseDocument(), baseDocument(), { draftVersion: 11 }) });
  must(statusOf(draftVersion.result.body) === "STATE_DRIFT" && draftVersion.updateWheres.length === 0, "14 draftVersion");
  const publishedVersion = await run(cutoverBody(), { row: rowFrom(baseDocument(), baseDocument(), { publishedVersion: 9 }) });
  must(statusOf(publishedVersion.result.body) === "STATE_DRIFT" && publishedVersion.updateWheres.length === 0, "15 publishedVersion");
  const draftTime = await run(cutoverBody(), {
    row: rowFrom(baseDocument(), baseDocument(), { draftUpdatedAt: new Date("2026-11-20T20:27:58.235Z") }),
  });
  must(statusOf(draftTime.result.body) === "STATE_DRIFT" && draftTime.updateWheres.length === 0, "16 draftUpdatedAt");
  const publishedTime = await run(cutoverBody(), {
    row: rowFrom(baseDocument(), baseDocument(), { publishedAt: new Date("2026-11-20T20:28:01.796Z") }),
  });
  must(statusOf(publishedTime.result.body) === "STATE_DRIFT", "17 publishedAt");

  const driftedDraft = baseDocument();
  (driftedDraft.sections["autoral-musicas"][0] as { text: string }).text = "Outro titulo";
  const differ = await run(cutoverBody(), { row: rowFrom(driftedDraft, baseDocument()) });
  must(statusOf(differ.result.body) === "STATE_DRIFT" && differ.updateWheres.length === 0, "18 documents differ");

  const previewOnly = baseDocument();
  (previewOnly.sections["autoral-beats"][0] as { previewOnly: boolean }).previewOnly = true;
  const unpersisted = await run(cutoverBody(), { row: rowFrom(previewOnly, previewOnly) });
  must(statusOf(unpersisted.result.body) === "STATE_DRIFT" && unpersisted.updateWheres.length === 0, "19 previewOnly");

  const missing = baseDocument();
  missing.sections["servico-masterizacoes"].pop();
  const missingCase = await run(cutoverBody(), { row: rowFrom(missing, missing) });
  must(statusOf(missingCase.result.body) === "MEDIA_INVENTORY_MISMATCH" && missingCase.updateWheres.length === 0, "20 missing");

  const duplicate = baseDocument();
  const cloned = structuredClone(duplicate.sections["autoral-beats"][0]) as { id: string };
  cloned.id = "media-04-copia";
  duplicate.sections["autoral-beats"].push(cloned);
  const duplicateCase = await run(cutoverBody(), { row: rowFrom(duplicate, duplicate) });
  must(statusOf(duplicateCase.result.body) === "MEDIA_INVENTORY_MISMATCH", "21 duplicate");

  const unexpected = baseDocument();
  const swapped = unexpected.sections["servico-beats"][0] as { media: { pathname: string; url: string }; src: string };
  const foreign = "portfolio/audio/1790000000000_aaaaaaaaaaaaaaaa_extra-track-xxxxxxxxxxxxxxxxxxxxxx.mp3";
  swapped.media.pathname = foreign;
  swapped.media.url = blobUrl(foreign);
  swapped.src = swapped.media.url;
  const unexpectedCase = await run(cutoverBody(), { row: rowFrom(unexpected, unexpected) });
  must(statusOf(unexpectedCase.result.body) === "MEDIA_INVENTORY_MISMATCH", "22 unexpected");

  const preexisting = baseDocument();
  const target = BLOB_TO_R2_MIGRATION_MANIFEST[3];
  const preexistingBlock = preexisting.sections["autoral-beats"].find((block) => (block as { id: string }).id === "media-04") as {
    src: string;
    media: { url: string; pathname: string };
  };
  preexistingBlock.media.url = `r2:${target.plannedKey}`;
  preexistingBlock.media.pathname = target.plannedKey;
  preexistingBlock.src = preexistingBlock.media.url;
  const preexistingCase = await run(cutoverBody(), { row: rowFrom(preexisting, preexisting) });
  must(statusOf(preexistingCase.result.body) === "MEDIA_INVENTORY_MISMATCH" && preexistingCase.updateWheres.length === 0, "23 preexisting r2");

  const srcDrift = baseDocument();
  (srcDrift.sections["autoral-musicas"][0] as { src: string }).src = blobUrl(BLOB_TO_R2_MIGRATION_MANIFEST[1].pathname);
  const srcCase = await run(cutoverBody(), { row: rowFrom(srcDrift, srcDrift) });
  must(statusOf(srcCase.result.body) === "MEDIA_INVENTORY_MISMATCH", "24 src");

  const kindDrift = baseDocument();
  (kindDrift.sections["autoral-beats"][0] as { kind: string }).kind = "video";
  const kindCase = await run(cutoverBody(), { row: rowFrom(kindDrift, kindDrift) });
  must(statusOf(kindCase.result.body) === "MEDIA_INVENTORY_MISMATCH", "25 kind");

  const invalidDraft = baseDocument();
  (invalidDraft.sections.hero[0] as { text: string }).text = "Victor <Pereira>";
  const invalidDraftCase = await run(cutoverBody(), { row: rowFrom(invalidDraft, baseDocument()) });
  must(statusOf(invalidDraftCase.result.body) === "DOCUMENT_INVALID" && invalidDraftCase.updateWheres.length === 0, "26 invalid draft");
  const invalidPublished = baseDocument();
  (invalidPublished.sections.hero[0] as { text: string }).text = "Victor <Pereira>";
  const invalidPublishedCase = await run(cutoverBody(), { row: rowFrom(baseDocument(), invalidPublished) });
  must(statusOf(invalidPublishedCase.result.body) === "DOCUMENT_INVALID", "27 invalid published");

  const semantic = baseDocument();
  (semantic.sections["servico-beats"][0] as { caption: string }).caption = "lado publicado";
  const semanticCase = await run(cutoverBody(), { row: rowFrom(baseDocument(), semantic) });
  must(statusOf(semanticCase.result.body) === "STATE_DRIFT" && semanticCase.updateWheres.length === 0, "28 semantic");

  const ok = await run(cutoverBody());
  must(ok.result.httpStatus === 200 && statusOf(ok.result.body) === "CUTOVER_VERIFIED", "35 status");
  const success = ok.result.body as {
    oldDraftVersion: number;
    newDraftVersion: number;
    oldPublishedVersion: number;
    newPublishedVersion: number;
    newDraftUpdatedAt: string;
    newPublishedAt: string;
    draftSubstitutions: number;
    publishedSubstitutions: number;
    draftLegacyRemaining: number;
    publishedLegacyRemaining: number;
    draftR2Present: number;
    publishedR2Present: number;
    documentsDiffer: boolean;
    previousSnapshotSha256: string;
  };
  must(success.oldDraftVersion === 10 && success.newDraftVersion === CUTOVER_NEXT_VERSION, "35 draft version");
  must(success.oldPublishedVersion === 10 && success.newPublishedVersion === CUTOVER_NEXT_VERSION, "35 published version");
  must(success.draftSubstitutions === 14 && success.publishedSubstitutions === 14, "29 30 substitutions");
  must(success.draftLegacyRemaining === 0 && success.publishedLegacyRemaining === 0, "32 legacy remaining");
  must(success.draftR2Present === 14 && success.publishedR2Present === 14, "33 r2 present");
  must(success.documentsDiffer === false, "documents equal");
  must(success.newDraftUpdatedAt === CUTOVER_AT.toISOString() && success.newPublishedAt === CUTOVER_AT.toISOString(), "36 same cutoverAt");
  must(ok.nowCalls() === 1, "36 single clock");
  must(ok.updateWheres.length === 1, "39 one update");
  const where = ok.updateWheres[0];
  must(where.id === "default" && where.draftVersion === 10 && where.publishedVersion === 10, "where versions");
  must(where.draftUpdatedAt.getTime() === CUTOVER_EXPECTED_DRAFT_UPDATED_AT.getTime(), "where draft time");
  must(where.publishedAt.getTime() === CUTOVER_EXPECTED_PUBLISHED_AT.getTime(), "where published time");

  const committed = ok.committed();
  must(committed !== null && committed.draftVersion === 11 && committed.publishedVersion === 11, "committed versions");
  must(committed?.draftUpdatedAt.getTime() === CUTOVER_AT.getTime() && committed.publishedAt?.getTime() === CUTOVER_AT.getTime(), "committed time");
  const kept = findBlock(committed?.draftDocument, "media-04");
  const keptMedia = kept?.media as { pathname: string; url: string; originalName: string; size: number; mimeType: string };
  must(kept?.caption === "corte-preservado" && kept?.editorNote === "nao-apagar", "31 metadata");
  must(kept?.text === "Peca 04" && kept?.kind === "audio", "31 text kind");
  must(keptMedia.originalName === target.originalName && keptMedia.size === target.size && keptMedia.mimeType === target.contentType, "31 media metadata");
  must(keptMedia.pathname === target.plannedKey && keptMedia.url === `r2:${target.plannedKey}` && kept?.src === keptMedia.url, "31 r2 fields");
  const empty = findBlock(committed?.draftDocument, "mix-vazio");
  must(empty?.media === null && empty?.src === null && empty?.text === "Mix", "31 empty block");
  const hero = findBlock(committed?.draftDocument, "hero-title");
  must(JSON.stringify(hero?.textHighlights) === JSON.stringify([
    { start: 0, end: 1, color: "red" },
    { start: 7, end: 8, color: "red" },
  ]), "31 highlights");
  const responseText = JSON.stringify(ok.result.body);
  must(!responseText.includes("corte-preservado") && !responseText.includes("nao-apagar"), "42 no document");
  must(!responseText.includes("blob.vercel-storage.com") && !responseText.includes("postgres"), "42 no secret");
  must(/^[a-f0-9]{64}$/.test(success.previousSnapshotSha256), "42 hash shape");

  const concurrent = await run(cutoverBody(), { updateCount: 0 });
  must(statusOf(concurrent.result.body) === "CONCURRENT_UPDATE" && concurrent.result.httpStatus === 409, "34 count 0");
  must(concurrent.updateWheres.length === 1, "34 single attempt");
  must(concurrent.committed()?.draftVersion === 10, "34 unchanged");
  const concurrentMedia = findBlock(concurrent.committed()?.draftDocument, "media-04")?.media as { pathname: string };
  must(concurrentMedia.pathname === target.pathname, "34 blob remains");

  const tampered = await run(cutoverBody(), { tamperReread: true });
  must(statusOf(tampered.result.body) === "POST_WRITE_VERIFICATION_FAILED", "37 post-write");
  must(tampered.committed()?.draftVersion === 10, "37 rolled back");
  must(tampered.updateWheres.length === 1, "38 no second update");
  const rolledMedia = findBlock(tampered.committed()?.draftDocument, "media-01")?.media as { url: string };
  must(rolledMedia.url.startsWith("https://"), "38 blob restored");

  const secret = await run(cutoverBody(), { admin: "secret" });
  must(statusOf(secret.result.body) === "UNAUTHORIZED", "43 auth code");
  must(!JSON.stringify(secret.result.body).includes("postgres"), "43 no database url");
  const exploded = await run(cutoverBody(), { explode: true });
  must(statusOf(exploded.result.body) === "INTERNAL_ERROR", "43 internal");
  must(!JSON.stringify(exploded.result.body).includes("secret-host"), "43 no stack");

  const original = baseDocument();
  const fingerprint = canonicalCutoverSnapshotSha256({
    draftDocument: original,
    publishedDocument: original,
    draftVersion: 10,
    publishedVersion: 10,
    draftUpdatedAt: CUTOVER_EXPECTED_DRAFT_UPDATED_AT.toISOString(),
    publishedAt: CUTOVER_EXPECTED_PUBLISHED_AT.toISOString(),
  });
  const again = canonicalCutoverSnapshotSha256({
    publishedVersion: 10,
    publishedAt: CUTOVER_EXPECTED_PUBLISHED_AT.toISOString(),
    draftVersion: 10,
    draftUpdatedAt: CUTOVER_EXPECTED_DRAFT_UPDATED_AT.toISOString(),
    publishedDocument: original,
    draftDocument: original,
  });
  must(fingerprint === again && fingerprint === success.previousSnapshotSha256, "44 deterministic");
  const reordered = JSON.parse(canonicalJson(original)) as typeof original;
  const reorderedHash = canonicalCutoverSnapshotSha256({
    draftDocument: reordered,
    publishedDocument: reordered,
    draftVersion: 10,
    publishedVersion: 10,
    draftUpdatedAt: CUTOVER_EXPECTED_DRAFT_UPDATED_AT.toISOString(),
    publishedAt: CUTOVER_EXPECTED_PUBLISHED_AT.toISOString(),
  });
  must(reorderedHash === fingerprint, "44 key order");
  const changed = baseDocument();
  (changed.sections.hero[0] as { text: string }).text = "Outro nome";
  const changedHash = canonicalCutoverSnapshotSha256({
    draftDocument: changed,
    publishedDocument: changed,
    draftVersion: 10,
    publishedVersion: 10,
    draftUpdatedAt: CUTOVER_EXPECTED_DRAFT_UPDATED_AT.toISOString(),
    publishedAt: CUTOVER_EXPECTED_PUBLISHED_AT.toISOString(),
  });
  must(changedHash !== fingerprint, "44 changes");

  console.log("[portfolio-r2-cutover-smoke] PASS");
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : "error";
  console.error("[portfolio-r2-cutover-smoke] FAIL", message);
  process.exit(1);
});
