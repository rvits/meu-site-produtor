"use client";

import {
  checkPortfolioFile,
  PORTFOLIO_STORAGE_UNAVAILABLE,
  type PortfolioMediaKind,
  type PortfolioMediaRef,
} from "./portfolio-media-ref";

type PrepareResponse = {
  error?: string;
  reference?: string;
  mimeType?: string;
  originalName?: string;
  size?: number;
  upload?: {
    url?: string;
    method?: string;
    headers?: Record<string, string>;
  };
};

function publicError(error: unknown, fallback: string): string {
  if (typeof error === "string" && error && !/r2_|token|secret|account/i.test(error)) {
    if (error === PORTFOLIO_STORAGE_UNAVAILABLE) return PORTFOLIO_STORAGE_UNAVAILABLE;
    if (error.startsWith("Use ") || error === "Arquivo vazio." || error === "O arquivo excede o limite permitido.") {
      return error;
    }
    if (
      error === "Não foi possível enviar o arquivo. Tente novamente." ||
      error === "Não foi possível confirmar o arquivo enviado. Tente novamente." ||
      error === "Formato de arquivo não suportado."
    ) {
      return error;
    }
  }
  return fallback;
}

export async function uploadPortfolioFile(kind: PortfolioMediaKind, file: File): Promise<PortfolioMediaRef> {
  const problem = checkPortfolioFile(file, kind);
  if (problem) throw new Error(problem);

  const prepareRes = await fetch("/api/admin/portfolio/upload", {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      action: "prepare",
      kind,
      fileName: file.name,
      originalName: file.name.slice(0, 180),
      size: file.size,
      contentType: file.type,
    }),
  });
  const prepared = (await prepareRes.json().catch(() => null)) as PrepareResponse | null;
  if (
    !prepareRes.ok ||
    !prepared ||
    typeof prepared.reference !== "string" ||
    typeof prepared.mimeType !== "string" ||
    prepared.upload?.method !== "PUT" ||
    typeof prepared.upload.url !== "string" ||
    !prepared.upload.headers ||
    typeof prepared.upload.headers["Content-Type"] !== "string"
  ) {
    throw new Error(publicError(prepared?.error, "Não foi possível enviar o arquivo."));
  }

  const putRes = await fetch(prepared.upload.url, {
    method: "PUT",
    headers: prepared.upload.headers,
    body: file,
  });
  if (!putRes.ok) throw new Error("Não foi possível enviar o arquivo.");

  const confirmRes = await fetch("/api/admin/portfolio/upload", {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      action: "confirm",
      kind,
      reference: prepared.reference,
      originalName: prepared.originalName || file.name.slice(0, 180),
      size: file.size,
      contentType: prepared.mimeType,
    }),
  });
  const confirmed = (await confirmRes.json().catch(() => null)) as (Partial<PortfolioMediaRef> & { error?: string }) | null;
  if (
    !confirmRes.ok ||
    !confirmed ||
    typeof confirmed.url !== "string" ||
    typeof confirmed.pathname !== "string" ||
    typeof confirmed.mimeType !== "string" ||
    typeof confirmed.originalName !== "string" ||
    typeof confirmed.size !== "number"
  ) {
    throw new Error(publicError(confirmed?.error, "Não foi possível enviar o arquivo."));
  }
  return {
    url: confirmed.url,
    pathname: confirmed.pathname,
    mimeType: confirmed.mimeType,
    originalName: confirmed.originalName,
    size: confirmed.size,
  };
}
