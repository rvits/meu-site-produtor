import type { BlockKind } from "./portfolio-data";

export type PortfolioMediaKind = "image" | "audio" | "video";

export type PortfolioMediaRef = {
  url: string;
  pathname: string;
  mimeType: string;
  originalName: string;
  size: number;
};

export const PORTFOLIO_STORAGE_UNAVAILABLE =
  "Armazenamento permanente de mídia não está configurado neste ambiente.";

const PREFIX: Record<PortfolioMediaKind, string> = {
  image: "portfolio/images/",
  audio: "portfolio/audio/",
  video: "portfolio/videos/",
};

const RULES: Array<{ kind: PortfolioMediaKind; mime: string; ext: string }> = [
  { kind: "image", mime: "image/jpeg", ext: ".jpg" },
  { kind: "image", mime: "image/jpeg", ext: ".jpeg" },
  { kind: "image", mime: "image/png", ext: ".png" },
  { kind: "video", mime: "video/mp4", ext: ".mp4" },
  { kind: "video", mime: "video/quicktime", ext: ".mov" },
  { kind: "audio", mime: "audio/mpeg", ext: ".mp3" },
  { kind: "audio", mime: "audio/wav", ext: ".wav" },
  { kind: "audio", mime: "audio/x-wav", ext: ".wav" },
  { kind: "audio", mime: "audio/wave", ext: ".wav" },
];

export function portfolioMediaKind(kind: BlockKind): PortfolioMediaKind | null {
  if (kind === "image" || kind === "audio" || kind === "video") return kind;
  return null;
}

export function portfolioAccept(kind: PortfolioMediaKind): string {
  const rules = RULES.filter((rule) => rule.kind === kind);
  return [...new Set([...rules.map((rule) => rule.ext), ...rules.map((rule) => rule.mime)])].join(",");
}

export function portfolioFormatHint(kind: PortfolioMediaKind): string {
  if (kind === "image") return "PNG, JPG ou JPEG";
  if (kind === "audio") return "MP3 ou WAV";
  return "MP4 ou MOV";
}

function extensionOf(name: string): string {
  const match = /\.[A-Za-z0-9]+$/.exec(name.trim());
  return match ? match[0].toLowerCase() : "";
}

function normalizeMime(raw: string): string {
  return String(raw || "")
    .split(";")[0]
    .trim()
    .toLowerCase();
}

export function isVercelBlobHost(hostname: string): boolean {
  const host = hostname.toLowerCase();
  return host === "blob.vercel-storage.com" || host.endsWith(".blob.vercel-storage.com");
}

export function inspectPortfolioPathname(pathname: string): {
  kind: PortfolioMediaKind;
  contentTypes: string[];
} | null {
  if (!pathname || pathname.includes("..") || pathname.includes("\\")) return null;
  const folder = pathname.startsWith(PREFIX.image)
    ? "image"
    : pathname.startsWith(PREFIX.video)
      ? "video"
      : pathname.startsWith(PREFIX.audio)
        ? "audio"
        : null;
  if (!folder) return null;
  const rest = pathname.slice(PREFIX[folder].length);
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]{0,160}$/.test(rest)) return null;
  const ext = extensionOf(rest);
  const matches = RULES.filter((rule) => rule.kind === folder && rule.ext === ext);
  if (matches.length === 0) return null;
  return {
    kind: folder,
    contentTypes: [...new Set(matches.map((rule) => rule.mime))],
  };
}

export function checkPortfolioFile(file: { name: string; type: string; size: number }, kind: PortfolioMediaKind): string | null {
  const ext = extensionOf(file.name);
  const mime = normalizeMime(file.type);
  const rule = RULES.find((item) => item.kind === kind && item.ext === ext && item.mime === mime);
  if (!rule) return `Use ${portfolioFormatHint(kind)}.`;
  if (!Number.isFinite(file.size) || file.size <= 0) return "Arquivo vazio.";
  return null;
}

export function proposePortfolioPathname(kind: PortfolioMediaKind, fileName: string, unique: string): string | null {
  const ext = extensionOf(fileName);
  if (!RULES.some((rule) => rule.kind === kind && rule.ext === ext)) return null;
  const base = fileName
    .slice(0, Math.max(0, fileName.length - ext.length))
    .replace(/[^A-Za-z0-9._-]+/g, "_")
    .replace(/^\.+/, "")
    .slice(0, 40) || "arquivo";
  const id = unique.replace(/[^A-Za-z0-9]/g, "").slice(0, 16);
  if (!id) return null;
  return `${PREFIX[kind]}${Date.now()}_${id}_${base}${ext}`;
}

export function parsePortfolioMedia(
  value: unknown,
  kind: BlockKind
): { ok: true; media: PortfolioMediaRef | null } | { ok: false; error: string } {
  const mediaKind = portfolioMediaKind(kind);
  if (!mediaKind) {
    if (value == null) return { ok: true, media: null };
    return { ok: false, error: "Este bloco não aceita mídia." };
  }
  if (value == null) return { ok: true, media: null };
  if (!value || typeof value !== "object" || Array.isArray(value)) return { ok: false, error: "Referência de mídia inválida." };
  const raw = value as Partial<PortfolioMediaRef>;
  if (typeof raw.pathname !== "string" || typeof raw.url !== "string" || typeof raw.mimeType !== "string") {
    return { ok: false, error: "Referência de mídia inválida." };
  }
  if (
    typeof raw.originalName !== "string"
    || raw.originalName.length === 0
    || raw.originalName.length > 180
    || /[<>\\]/.test(raw.originalName)
    || /^(blob:|data:|file:|javascript:)/i.test(raw.originalName)
    || /^[A-Za-z]:/.test(raw.originalName)
  ) {
    return { ok: false, error: "Nome de arquivo inválido." };
  }
  if (!Number.isInteger(raw.size) || (raw.size as number) <= 0) return { ok: false, error: "Tamanho de arquivo inválido." };
  const inspected = inspectPortfolioPathname(raw.pathname);
  if (!inspected || inspected.kind !== mediaKind) return { ok: false, error: "Caminho de mídia inválido." };
  if (!inspected.contentTypes.includes(normalizeMime(raw.mimeType))) {
    return { ok: false, error: "Tipo de arquivo inválido." };
  }
  let parsed: URL;
  try {
    parsed = new URL(raw.url);
  } catch {
    return { ok: false, error: "Referência de mídia inválida." };
  }
  if (parsed.protocol !== "https:" || !isVercelBlobHost(parsed.hostname)) {
    return { ok: false, error: "A mídia precisa estar no armazenamento do Portfólio." };
  }
  const path = decodeURIComponent(parsed.pathname).replace(/^\//, "");
  if (path !== raw.pathname) return { ok: false, error: "Referência de mídia inválida." };
  return {
    ok: true,
    media: {
      url: raw.url,
      pathname: raw.pathname,
      mimeType: raw.mimeType,
      originalName: raw.originalName,
      size: raw.size as number,
    },
  };
}

export function decidePortfolioUpload(input: {
  type: string;
  role: "admin" | "user" | "visitor";
  hasBlobToken: boolean;
}): { ok: true } | { ok: false; status: number; error: string } {
  if (input.type !== "blob.generate-client-token") return { ok: true };
  if (input.role === "visitor") return { ok: false, status: 401, error: "Não autenticado" };
  if (input.role === "user") return { ok: false, status: 403, error: "Acesso negado" };
  if (!input.hasBlobToken) return { ok: false, status: 503, error: PORTFOLIO_STORAGE_UNAVAILABLE };
  return { ok: true };
}

export function localMediaBlocksPublish(files: Array<{ phase: "uploading" | "done" | "error" }>): boolean {
  return files.some((file) => file.phase !== "done");
}
