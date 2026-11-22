/**
 * TEMPORARY CUTOVER TOOL
 * POST administrativo. Uma escrita condicional de PortfolioState.
 * Não chama Blob nem R2. Não implementa rollback. Será removida depois da validação.
 */

import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { requireAdmin } from "@/app/lib/auth";
import { prisma } from "@/app/lib/prisma";
import {
  CUTOVER_ROW_ID,
  readCutoverBody,
  runPortfolioR2Cutover,
  type CutoverDeps,
  type CutoverTx,
} from "./execute";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store" };

function liveDeps(): CutoverDeps {
  return {
    vercelEnv: process.env.VERCEL_ENV,
    async requireAdmin() {
      await requireAdmin();
    },
    async transaction(run) {
      await prisma.$transaction(async (tx) => {
        const adapter: CutoverTx = {
          async read() {
            const row = await tx.portfolioState.findUnique({ where: { id: CUTOVER_ROW_ID } });
            if (!row) return null;
            return {
              id: row.id,
              draftDocument: row.draftDocument,
              publishedDocument: row.publishedDocument,
              draftVersion: row.draftVersion,
              publishedVersion: row.publishedVersion,
              draftUpdatedAt: row.draftUpdatedAt,
              publishedAt: row.publishedAt,
            };
          },
          async updateMany(input) {
            const result = await tx.portfolioState.updateMany({
              where: {
                id: input.where.id,
                draftVersion: input.where.draftVersion,
                publishedVersion: input.where.publishedVersion,
                draftUpdatedAt: input.where.draftUpdatedAt,
                publishedAt: input.where.publishedAt,
              },
              data: {
                draftDocument: input.data.draftDocument as Prisma.InputJsonValue,
                publishedDocument: input.data.publishedDocument as Prisma.InputJsonValue,
                draftVersion: input.data.draftVersion,
                publishedVersion: input.data.publishedVersion,
                draftUpdatedAt: input.data.draftUpdatedAt,
                publishedAt: input.data.publishedAt,
              },
            });
            return { count: result.count };
          },
        };
        await run(adapter);
      });
    },
  };
}

export async function POST(request: Request) {
  const read = await readCutoverBody(request);
  if (!read.ok) {
    return NextResponse.json({ error: "INVALID_REQUEST", status: "INVALID_REQUEST" }, { status: 400, headers: NO_STORE });
  }
  try {
    const result = await runPortfolioR2Cutover(read.body, liveDeps());
    return NextResponse.json(result.body, { status: result.httpStatus, headers: NO_STORE });
  } catch {
    return NextResponse.json({ error: "INTERNAL_ERROR", status: "INTERNAL_ERROR" }, { status: 500, headers: NO_STORE });
  }
}
