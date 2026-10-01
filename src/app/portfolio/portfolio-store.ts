import { Prisma } from "@prisma/client";
import { prisma } from "@/app/lib/prisma";
import {
  PUBLISHED_PORTFOLIO,
  cloneDocument,
  documentHasUnpersistedMedia,
  samePortfolio,
  type PortfolioDocument,
} from "./portfolio-data";
import { validatePortfolioDocument } from "./portfolio-validate";

export const PORTFOLIO_ROW_ID = "default";
export const UNPERSISTED_MEDIA_MESSAGE =
  "Existem arquivos de mídia que ainda não foram enviados para armazenamento permanente.";

export class PortfolioConflict extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PortfolioConflict";
  }
}

export type AdminPortfolioSnapshot = {
  persisted: boolean;
  draft: PortfolioDocument;
  published: PortfolioDocument;
  draftVersion: number;
  publishedVersion: number;
  draftUpdatedAt: string | null;
  publishedAt: string | null;
  unpersistedMedia: boolean;
  documentsDiffer: boolean;
};

function fallbackDocument(): PortfolioDocument {
  const parsed = validatePortfolioDocument(PUBLISHED_PORTFOLIO);
  if (!parsed.ok) return cloneDocument(PUBLISHED_PORTFOLIO);
  return parsed.document;
}

function readStored(value: unknown): PortfolioDocument | null {
  const parsed = validatePortfolioDocument(value);
  return parsed.ok ? parsed.document : null;
}

export function assertDraftVersion(current: number | null, expected: number) {
  const actual = current ?? 0;
  if (!Number.isInteger(expected) || actual !== expected) {
    throw new PortfolioConflict("O rascunho foi atualizado em outro lugar. Recarregue antes de salvar.");
  }
}

function snapshotFromRow(row: {
  draftDocument: unknown;
  publishedDocument: unknown;
  draftVersion: number;
  publishedVersion: number;
  draftUpdatedAt: Date;
  publishedAt: Date | null;
} | null): AdminPortfolioSnapshot {
  const fallback = fallbackDocument();
  if (!row) {
    return {
      persisted: false,
      draft: fallback,
      published: fallback,
      draftVersion: 0,
      publishedVersion: 0,
      draftUpdatedAt: null,
      publishedAt: null,
      unpersistedMedia: false,
      documentsDiffer: false,
    };
  }
  const draft = readStored(row.draftDocument) ?? fallback;
  const published = readStored(row.publishedDocument) ?? fallback;
  return {
    persisted: true,
    draft,
    published,
    draftVersion: row.draftVersion,
    publishedVersion: row.publishedVersion,
    draftUpdatedAt: row.draftUpdatedAt.toISOString(),
    publishedAt: row.publishedAt ? row.publishedAt.toISOString() : null,
    unpersistedMedia: documentHasUnpersistedMedia(draft),
    documentsDiffer: !samePortfolio(draft, published),
  };
}

export async function getPublishedPortfolio(): Promise<PortfolioDocument> {
  try {
    const row = await prisma.portfolioState.findUnique({ where: { id: PORTFOLIO_ROW_ID } });
    if (!row) return fallbackDocument();
    return readStored(row.publishedDocument) ?? fallbackDocument();
  } catch (error) {
    console.error("[portfolio] published fallback", error instanceof Error ? error.name : "error");
    return fallbackDocument();
  }
}

export async function getAdminPortfolio(): Promise<AdminPortfolioSnapshot> {
  const row = await prisma.portfolioState.findUnique({ where: { id: PORTFOLIO_ROW_ID } });
  return snapshotFromRow(row);
}

export async function savePortfolioDraft(document: PortfolioDocument, expectedVersion: number): Promise<AdminPortfolioSnapshot> {
  const row = await prisma.$transaction(async (tx) => {
    const current = await tx.portfolioState.findUnique({ where: { id: PORTFOLIO_ROW_ID } });
    assertDraftVersion(current ? current.draftVersion : null, expectedVersion);
    const json = document as unknown as Prisma.InputJsonValue;
    if (!current) {
      const published = fallbackDocument() as unknown as Prisma.InputJsonValue;
      return tx.portfolioState.create({
        data: {
          id: PORTFOLIO_ROW_ID,
          draftDocument: json,
          publishedDocument: published,
          draftVersion: 1,
          publishedVersion: 0,
          draftUpdatedAt: new Date(),
        },
      });
    }
    return tx.portfolioState.update({
      where: { id: PORTFOLIO_ROW_ID },
      data: {
        draftDocument: json,
        draftVersion: { increment: 1 },
        draftUpdatedAt: new Date(),
      },
    });
  });
  return snapshotFromRow(row);
}

export async function publishPortfolioDraft(expectedVersion: number): Promise<AdminPortfolioSnapshot> {
  const row = await prisma.$transaction(async (tx) => {
    const current = await tx.portfolioState.findUnique({ where: { id: PORTFOLIO_ROW_ID } });
    if (!current) throw new PortfolioConflict("Não há rascunho salvo para publicar.");
    assertDraftVersion(current.draftVersion, expectedVersion);
    const draft = readStored(current.draftDocument);
    if (!draft) throw new PortfolioConflict("O rascunho salvo é inválido.");
    if (documentHasUnpersistedMedia(draft)) throw new PortfolioConflict(UNPERSISTED_MEDIA_MESSAGE);
    const published = readStored(current.publishedDocument);
    if (published && samePortfolio(draft, published)) {
      throw new PortfolioConflict("Não há alterações salvas para publicar.");
    }
    return tx.portfolioState.update({
      where: { id: PORTFOLIO_ROW_ID },
      data: {
        publishedDocument: draft as unknown as Prisma.InputJsonValue,
        publishedVersion: current.draftVersion,
        publishedAt: new Date(),
      },
    });
  });
  return snapshotFromRow(row);
}
