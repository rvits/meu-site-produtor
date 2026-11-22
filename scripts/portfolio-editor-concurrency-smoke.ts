/**
 * Smoke das escritas editoriais com optimistic locking.
 * Exercita savePortfolioDraft e publishPortfolioDraft reais.
 * O Prisma é falso e local. Não há Production, Blob nem R2.
 * O outro writer entra no início de updateMany, depois da leitura real.
 */
import { readFileSync } from "node:fs";
import { cloneDocument, samePortfolio, type PortfolioDocument, PUBLISHED_PORTFOLIO } from "../src/app/portfolio/portfolio-data";
import {
  CUTOVER_EXPECTED_DRAFT_UPDATED_AT,
  CUTOVER_EXPECTED_DRAFT_VERSION,
  CUTOVER_EXPECTED_PUBLISHED_AT,
  CUTOVER_EXPECTED_PUBLISHED_VERSION,
  CUTOVER_ROW_ID,
} from "../src/app/api/admin/portfolio/r2-cutover/execute";

const STALE_DRAFT_MESSAGE = "O rascunho foi atualizado em outro lugar. Recarregue antes de salvar.";

type Row = {
  id: string;
  draftDocument: unknown;
  publishedDocument: unknown;
  draftVersion: number;
  publishedVersion: number;
  draftUpdatedAt: Date;
  publishedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

type WriteCall = {
  where: Record<string, unknown>;
  count: number;
};

const calls: WriteCall[] = [];
let unconditionalUpdates = 0;
let row: Row | null = null;
let beforeUpdate: ((current: Row) => void) | null = null;

function must(condition: unknown, label: string): asserts condition {
  if (!condition) throw new Error(label);
}

function observedWrites() {
  return calls.length;
}

function observedCount(index: number) {
  return calls[index] ? calls[index].count : -1;
}

function observedDraftVersion() {
  return row ? row.draftVersion : -1;
}

function observedPublishedVersion() {
  return row ? row.publishedVersion : -1;
}

function withHeroBody(source: PortfolioDocument, body: string): PortfolioDocument {
  const next = cloneDocument(source);
  const item = next.sections.hero.find((block) => block.id === "hero-text");
  if (!item) throw new Error("hero-text ausente");
  item.body = body;
  return next;
}

function json(value: unknown) {
  return JSON.stringify(value);
}

function snapshotWhere(where: Record<string, unknown>) {
  const copy: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(where)) copy[key] = value;
  return copy;
}

function matches(current: Row, where: Record<string, unknown>) {
  if (where.id !== current.id) return false;
  if ("draftVersion" in where && where.draftVersion !== current.draftVersion) return false;
  if ("publishedVersion" in where && where.publishedVersion !== current.publishedVersion) return false;
  if ("draftUpdatedAt" in where) {
    const expected = where.draftUpdatedAt;
    if (!(expected instanceof Date) || expected.getTime() !== current.draftUpdatedAt.getTime()) return false;
  }
  if ("publishedAt" in where) {
    const expected = where.publishedAt;
    if (!(expected instanceof Date) || current.publishedAt?.getTime() !== expected.getTime()) return false;
  }
  return true;
}

function applyWrite(current: Row, data: Record<string, unknown>) {
  if ("draftDocument" in data) current.draftDocument = data.draftDocument;
  if ("publishedDocument" in data) current.publishedDocument = data.publishedDocument;
  if ("draftVersion" in data) {
    const version = data.draftVersion;
    if (version && typeof version === "object" && "increment" in version && typeof version.increment === "number") {
      current.draftVersion += version.increment;
    } else if (typeof version === "number") {
      current.draftVersion = version;
    } else {
      throw new Error("draftVersion inesperado");
    }
  }
  if ("publishedVersion" in data) {
    if (typeof data.publishedVersion !== "number") throw new Error("publishedVersion inesperado");
    current.publishedVersion = data.publishedVersion;
  }
  if ("draftUpdatedAt" in data) {
    if (!(data.draftUpdatedAt instanceof Date)) throw new Error("draftUpdatedAt inesperado");
    current.draftUpdatedAt = data.draftUpdatedAt;
  }
  if ("publishedAt" in data) {
    if (!(data.publishedAt instanceof Date)) throw new Error("publishedAt inesperado");
    current.publishedAt = data.publishedAt;
  }
  current.updatedAt = new Date();
}

type FakeTx = {
  portfolioState: {
    findUnique(args: { where: { id: string } }): Promise<Row | null>;
    create(): Promise<never>;
    update(): Promise<never>;
    updateMany(args: { where: Record<string, unknown>; data: Record<string, unknown> }): Promise<{ count: number }>;
  };
  $transaction<T>(fn: (tx: FakeTx) => Promise<T>): Promise<T>;
};

const fake: FakeTx = {
  portfolioState: {
    async findUnique(args: { where: { id: string } }) {
      if (!row || args.where.id !== row.id) return null;
      return structuredClone(row);
    },
    async create() {
      throw new Error("create não faz parte deste smoke");
    },
    async update() {
      unconditionalUpdates += 1;
      throw new Error("update incondicional não deve ser chamado");
    },
    async updateMany(args: { where: Record<string, unknown>; data: Record<string, unknown> }) {
      const writer = beforeUpdate;
      beforeUpdate = null;
      if (writer && row) writer(row);
      const count = row && matches(row, args.where) ? 1 : 0;
      if (count === 1 && row) applyWrite(row, args.data);
      calls.push({ where: snapshotWhere(args.where), count });
      return { count };
    },
  },
  async $transaction<T>(fn: (tx: FakeTx) => Promise<T>) {
    return fn(fake);
  },
};

function reset(next: Row) {
  row = next;
  calls.length = 0;
  unconditionalUpdates = 0;
  beforeUpdate = null;
}

function seed(input: Partial<Row> & Pick<Row, "draftDocument" | "publishedDocument" | "draftVersion" | "publishedVersion">) {
  reset({
    id: "default",
    draftUpdatedAt: new Date(CUTOVER_EXPECTED_DRAFT_UPDATED_AT),
    publishedAt: new Date(CUTOVER_EXPECTED_PUBLISHED_AT),
    createdAt: new Date("2026-11-01T00:00:00.000Z"),
    updatedAt: new Date(CUTOVER_EXPECTED_PUBLISHED_AT),
    ...input,
    draftDocument: structuredClone(input.draftDocument),
    publishedDocument: structuredClone(input.publishedDocument),
  });
}

function frozenCutoverWhereMatches(current: Row) {
  return current.id === CUTOVER_ROW_ID
    && current.draftVersion === CUTOVER_EXPECTED_DRAFT_VERSION
    && current.publishedVersion === CUTOVER_EXPECTED_PUBLISHED_VERSION
    && current.draftUpdatedAt.getTime() === CUTOVER_EXPECTED_DRAFT_UPDATED_AT.getTime()
    && current.publishedAt?.getTime() === CUTOVER_EXPECTED_PUBLISHED_AT.getTime();
}

async function main() {
  (globalThis as { prisma?: unknown }).prisma = fake;
  const prismaModule = await import("../src/app/lib/prisma");
  const installed: unknown = prismaModule.prisma;
  must(installed === fake, "Prisma real foi construído");
  const store = await import("../src/app/portfolio/portfolio-store");
  const { PortfolioConflict, publishPortfolioDraft, savePortfolioDraft } = store;

  async function staleConflict(run: () => Promise<unknown>) {
    try {
      await run();
    } catch (error) {
      must(error instanceof PortfolioConflict, "conflito de outra classe");
      must(error.message === STALE_DRAFT_MESSAGE, "mensagem stale diferente");
      return error;
    }
    throw new Error("escrita stale não conflitou");
  }

  const base = cloneDocument(PUBLISHED_PORTFOLIO);
  const edited = withHeroBody(base, "Rascunho concorrente do editor.");
  const preserved = withHeroBody(base, "Draft preservado na versao 11.");
  const preservedPublished = withHeroBody(base, "Published preservado na versao 11.");

  seed({ draftDocument: base, publishedDocument: base, draftVersion: 10, publishedVersion: 10 });
  const beforeSaveClock = Date.now();
  const saved = await savePortfolioDraft(edited, 10);
  must(saved.draftVersion === 11 && saved.publishedVersion === 10, "1 versoes do save");
  must(samePortfolio(saved.draft, edited) && samePortfolio(saved.published, base), "1 documentos do save");
  must(saved.documentsDiffer === true && saved.persisted === true && saved.unpersistedMedia === false, "1 snapshot");
  must(saved.draftUpdatedAt != null && Date.parse(saved.draftUpdatedAt) >= beforeSaveClock, "6 draftUpdatedAt");
  must(observedWrites() === 1 && observedCount(0) === 1, "1 um updateMany");
  must(calls[0].where.id === "default" && calls[0].where.draftVersion === 10, "1 where da versao esperada");
  must(!("draftUpdatedAt" in calls[0].where) && !("publishedVersion" in calls[0].where), "1 where minimo");
  must(observedDraftVersion() === 11, "5 incrementa exatamente 1");
  must(unconditionalUpdates === 0, "1 sem update incondicional");

  seed({ draftDocument: preserved, publishedDocument: base, draftVersion: 11, publishedVersion: 11 });
  const intactBefore = json(row?.draftDocument);
  await staleConflict(() => savePortfolioDraft(edited, 10));
  must(observedWrites() === 0 && json(row?.draftDocument) === intactBefore && observedDraftVersion() === 11, "2 save stale inicial");

  seed({ draftDocument: base, publishedDocument: base, draftVersion: 10, publishedVersion: 10 });
  beforeUpdate = (current) => {
    current.draftVersion = 11;
    current.publishedVersion = 11;
    current.draftDocument = structuredClone(preserved);
    current.draftUpdatedAt = new Date("2026-11-21T03:00:00.000Z");
  };
  await staleConflict(() => savePortfolioDraft(edited, 10));
  must(observedWrites() === 1 && observedCount(0) === 0 && calls[0].where.draftVersion === 10, "3 count 0 na escrita");
  must(observedDraftVersion() === 11 && row != null && json(row.draftDocument) === json(preserved), "4 draft 11 intacto");
  must(json(row?.publishedDocument) === json(base), "4 published nao mudou");

  seed({ draftDocument: edited, publishedDocument: base, draftVersion: 10, publishedVersion: 9 });
  const publishedBefore = row?.publishedAt?.toISOString();
  const draftUpdatedBefore = row?.draftUpdatedAt.toISOString();
  const published = await publishPortfolioDraft(10);
  must(published.draftVersion === 10 && published.publishedVersion === 10, "7 e 13 versoes");
  must(samePortfolio(published.published, edited) && published.documentsDiffer === false, "7 published igual ao draft");
  must(published.publishedAt != null && published.publishedAt !== publishedBefore, "14 publishedAt");
  must(published.draftUpdatedAt === draftUpdatedBefore, "7 draftUpdatedAt preservado");
  must(observedWrites() === 1 && observedCount(0) === 1, "7 um updateMany");
  must(calls[0].where.draftVersion === 10 && calls[0].where.publishedVersion === 9, "7 where lido");
  must(!("draftUpdatedAt" in calls[0].where) && !("publishedAt" in calls[0].where), "7 sem timestamps no where");

  seed({ draftDocument: edited, publishedDocument: base, draftVersion: 11, publishedVersion: 9 });
  const publishedIntact = json(row?.publishedDocument);
  await staleConflict(() => publishPortfolioDraft(10));
  must(observedWrites() === 0 && json(row?.publishedDocument) === publishedIntact && observedPublishedVersion() === 9, "8 publish stale inicial");

  seed({ draftDocument: edited, publishedDocument: base, draftVersion: 10, publishedVersion: 9 });
  beforeUpdate = (current) => {
    current.draftVersion = 11;
    current.publishedVersion = 11;
    current.publishedDocument = structuredClone(preservedPublished);
    current.publishedAt = new Date("2026-11-21T04:00:00.000Z");
  };
  await staleConflict(() => publishPortfolioDraft(10));
  must(observedWrites() === 1 && observedCount(0) === 0, "9 count 0 na escrita");
  must(calls[0].where.draftVersion === 10 && calls[0].where.publishedVersion === 9, "9 where antigo");
  must(observedPublishedVersion() === 11 && row != null && json(row.publishedDocument) === json(preservedPublished), "10 published intacto");

  seed({ draftDocument: edited, publishedDocument: base, draftVersion: 10, publishedVersion: 9 });
  const firstPublish = publishPortfolioDraft(10);
  const secondPublish = publishPortfolioDraft(10);
  const settled = await Promise.allSettled([firstPublish, secondPublish]);
  const wins = settled.filter((item) => item.status === "fulfilled");
  const losses = settled.filter((item) => item.status === "rejected");
  must(wins.length === 1 && losses.length === 1, "11 uma publicacao vence");
  must(losses[0].status === "rejected" && losses[0].reason instanceof PortfolioConflict, "12 segunda conflita");
  must(losses[0].status === "rejected" && losses[0].reason.message === STALE_DRAFT_MESSAGE, "12 mensagem stale");
  must(observedWrites() === 2 && calls.filter((call) => call.count === 1).length === 1, "11 uma escrita");
  must(calls.filter((call) => call.count === 0).length === 1, "12 segunda count 0");
  must(observedPublishedVersion() === 10 && observedDraftVersion() === 10, "11 publishedVersion final");
  must(row != null && samePortfolio(row.publishedDocument as PortfolioDocument, edited), "11 documento do vencedor");

  seed({ draftDocument: base, publishedDocument: base, draftVersion: 10, publishedVersion: 10 });
  must(row != null && frozenCutoverWhereMatches(row), "15 predicado casava");
  await savePortfolioDraft(edited, 10);
  must(observedDraftVersion() === 11 && row != null && row.draftUpdatedAt.getTime() !== CUTOVER_EXPECTED_DRAFT_UPDATED_AT.getTime(), "15 campos do save");
  must(row != null && !frozenCutoverWhereMatches(row), "15 predicado congelado nao casa");

  seed({ draftDocument: edited, publishedDocument: base, draftVersion: 10, publishedVersion: 9 });
  const publishedVersionBefore = row?.publishedVersion;
  const publishedAtBefore = row?.publishedAt?.getTime();
  await publishPortfolioDraft(10);
  must(publishedVersionBefore === 9 && observedPublishedVersion() === 10, "16 publishedVersion mudou");
  must(row?.publishedAt != null && row.publishedAt.getTime() !== publishedAtBefore, "16 publishedAt mudou");
  must(row != null && !frozenCutoverWhereMatches(row), "16 predicado congelado nao casa");

  seed({ draftDocument: preserved, publishedDocument: preserved, draftVersion: 11, publishedVersion: 11 });
  const versionElevenDraft = json(row?.draftDocument);
  await staleConflict(() => savePortfolioDraft(edited, 10));
  must(observedWrites() === 0 && observedDraftVersion() === 11 && row != null && json(row.draftDocument) === versionElevenDraft, "17 estado 11 bloqueia save 10");

  seed({ draftDocument: preservedPublished, publishedDocument: preservedPublished, draftVersion: 11, publishedVersion: 11 });
  const versionElevenPublished = json(row?.publishedDocument);
  await staleConflict(() => publishPortfolioDraft(10));
  must(observedWrites() === 0 && observedPublishedVersion() === 11 && row != null && json(row.publishedDocument) === versionElevenPublished, "18 estado 11 bloqueia publish 10");

  seed({ draftDocument: base, publishedDocument: base, draftVersion: 10, publishedVersion: 10 });
  beforeUpdate = (current) => {
    current.draftVersion = 11;
    current.draftDocument = structuredClone(preserved);
  };
  await staleConflict(() => savePortfolioDraft(edited, 10));
  must(observedWrites() === 1 && observedCount(0) === 0, "19 sem retry");

  const conflictKeys = ["persisted", "draft", "published", "draftVersion", "publishedVersion", "draftUpdatedAt", "publishedAt", "unpersistedMedia", "documentsDiffer"];
  must(conflictKeys.every((key) => key in saved), "20 shape do snapshot");
  must(unconditionalUpdates === 0, "20 sem update incondicional");
  const draftRoute = readFileSync("src/app/api/admin/portfolio/draft/route.ts", "utf8");
  const publishRoute = readFileSync("src/app/api/admin/portfolio/publish/route.ts", "utf8");
  const conflictMapping = "if (error instanceof PortfolioConflict) return NextResponse.json({ error: error.message }, { status: 409 });";
  must(draftRoute.includes(conflictMapping) && publishRoute.includes(conflictMapping), "20 rotas mapeiam 409");
  must(!draftRoute.includes("updateMany") && !publishRoute.includes("updateMany"), "20 rotas nao mudaram a escrita");

  console.log("[portfolio-editor-concurrency-smoke] PASS");
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "erro");
  process.exit(1);
});
