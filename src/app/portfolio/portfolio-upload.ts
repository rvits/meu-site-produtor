"use client";

import { upload } from "@vercel/blob/client";
import {
  checkPortfolioFile,
  proposePortfolioPathname,
  type PortfolioMediaKind,
  type PortfolioMediaRef,
} from "./portfolio-media-ref";

export async function uploadPortfolioFile(kind: PortfolioMediaKind, file: File): Promise<PortfolioMediaRef> {
  const problem = checkPortfolioFile(file, kind);
  if (problem) throw new Error(problem);
  const unique = crypto.randomUUID();
  const pathname = proposePortfolioPathname(kind, file.name, unique);
  if (!pathname) throw new Error("Caminho de mídia inválido.");
  const blob = await upload(pathname, file, {
    access: "public",
    handleUploadUrl: "/api/admin/portfolio/upload",
    contentType: file.type,
    multipart: false,
  });
  return {
    url: blob.url,
    pathname: blob.pathname,
    mimeType: file.type,
    originalName: file.name.slice(0, 180),
    size: file.size,
  };
}
