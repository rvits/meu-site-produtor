import {
  MAX_BLOCK_HEIGHT,
  MAX_COLUMN_SPAN,
  MAX_IMAGE_ZOOM,
  MIN_IMAGE_ZOOM,
  SECTION_ORDER,
  normalizeTextHighlights,
  sizeFromSpan,
  type BlockKind,
  type PortfolioBlock,
  type PortfolioDocument,
  type PortfolioSectionId,
  type TextAlign,
  type TextColor,
  type TextHighlight,
  type TitleLevel,
} from "./portfolio-data";
import { parsePortfolioMedia } from "./portfolio-media-ref";

const MAX_BLOCKS = 30;
const MAX_TEXT = 4000;
const MAX_SHORT = 300;
const MAX_HIGHLIGHTS = 200;
const MAX_DOCUMENT_CHARS = 200_000;
const KINDS: BlockKind[] = ["title", "text", "image", "audio", "video"];
const LEVELS: TitleLevel[] = ["hero", "h1", "h2", "h3", "h4"];
const COLORS: TextColor[] = ["white", "red", "black"];

export type PortfolioValidation = { ok: true; document: PortfolioDocument } | { ok: false; error: string };

function fail(error: string): PortfolioValidation {
  return { ok: false, error };
}

function plainText(value: unknown, max: number, label: string): string | PortfolioValidation {
  if (typeof value !== "string") return fail(`${label} inválido.`);
  if (value.length > max) return fail(`${label} longo demais.`);
  if (/[<>]/.test(value) || /javascript\s*:/i.test(value)) return fail(`${label} não pode conter HTML.`);
  return value;
}

function highlights(value: unknown, length: number): TextHighlight[] | PortfolioValidation {
  if (value == null) return [];
  if (!Array.isArray(value)) return fail("Destaques inválidos.");
  if (value.length > MAX_HIGHLIGHTS) return fail("Destaques demais.");
  const ranges: TextHighlight[] = [];
  for (const item of value) {
    if (!item || typeof item !== "object") return fail("Destaque inválido.");
    const raw = item as { start?: unknown; end?: unknown; color?: unknown };
    if (raw.color !== "white" && raw.color !== "red" && raw.color !== "black") return fail("Cor de destaque inválida.");
    if (!Number.isInteger(raw.start) || !Number.isInteger(raw.end)) return fail("Intervalo de destaque inválido.");
    const start = raw.start as number;
    const end = raw.end as number;
    if (start < 0 || end > length || start >= end) return fail("Intervalo de destaque inválido.");
    ranges.push({ start, end, color: raw.color });
  }
  return normalizeTextHighlights(ranges, length);
}

function readBlock(raw: unknown, ids: Set<string>): PortfolioBlock | PortfolioValidation {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return fail("Bloco inválido.");
  const value = raw as Record<string, unknown>;
  if (typeof value.id !== "string" || !/^[A-Za-z0-9_-]{1,80}$/.test(value.id)) return fail("Identificador de bloco inválido.");
  if (ids.has(value.id)) return fail("Identificador de bloco repetido.");
  if (!KINDS.includes(value.kind as BlockKind)) return fail("Tipo de bloco inválido.");
  const kind = value.kind as BlockKind;
  const columnSpan = value.columnSpan;
  const columnStart = value.columnStart;
  const rowSpan = value.rowSpan;
  const minHeight = value.minHeight;
  if (!Number.isInteger(columnSpan) || (columnSpan as number) < 1 || (columnSpan as number) > MAX_COLUMN_SPAN) {
    return fail("Largura de coluna inválida.");
  }
  if (!Number.isInteger(columnStart) || (columnStart as number) < 1 || (columnStart as number) + (columnSpan as number) - 1 > MAX_COLUMN_SPAN) {
    return fail("Início de coluna inválido.");
  }
  if (!Number.isInteger(rowSpan) || (rowSpan as number) < 1 || (rowSpan as number) > 4) return fail("Altura em linhas inválida.");
  if (!Number.isInteger(minHeight) || (minHeight as number) < 0 || (minHeight as number) > MAX_BLOCK_HEIGHT) {
    return fail("Altura mínima inválida.");
  }
  const align = value.align === "center" || value.align === "right" || value.align === "left" ? value.align as TextAlign : null;
  if (!align) return fail("Alinhamento inválido.");
  if (typeof value.hidden !== "boolean") return fail("Visibilidade inválida.");
  if (typeof value.previewOnly !== "boolean") return fail("Estado de mídia inválido.");
  const text = plainText(value.text, MAX_TEXT, "Texto");
  if (typeof text !== "string") return text;
  const body = plainText(value.body, MAX_TEXT, "Texto");
  if (typeof body !== "string") return body;
  const alt = plainText(value.alt, MAX_SHORT, "Texto alternativo");
  if (typeof alt !== "string") return alt;
  const caption = plainText(value.caption, MAX_SHORT, "Legenda");
  if (typeof caption !== "string") return caption;
  if (!LEVELS.includes(value.titleLevel as TitleLevel)) return fail("Hierarquia inválida.");
  if (!COLORS.includes(value.textColor as TextColor)) return fail("Cor inválida.");
  const variant = value.variant === null ? null : value.variant === "hero-name" ? "hero-name" : undefined;
  if (variant === undefined || (variant === "hero-name" && kind !== "title")) return fail("Variante inválida.");
  const content = kind === "text" ? body : text;
  const marks = highlights(value.textHighlights, content.length);
  if (!Array.isArray(marks)) return marks;
  if (kind !== "title" && kind !== "text" && marks.length > 0) return fail("Destaque só existe em título e texto.");
  if (typeof value.imageZoom !== "number" || value.imageZoom < MIN_IMAGE_ZOOM || value.imageZoom > MAX_IMAGE_ZOOM) {
    return fail("Zoom inválido.");
  }
  if (typeof value.imagePositionX !== "number" || value.imagePositionX < -1 || value.imagePositionX > 1) return fail("Enquadramento inválido.");
  if (typeof value.imagePositionY !== "number" || value.imagePositionY < -1 || value.imagePositionY > 1) return fail("Enquadramento inválido.");
  const parsedMedia = parsePortfolioMedia(value.media, kind);
  if (!parsedMedia.ok) return fail(parsedMedia.error);
  const media = parsedMedia.media;
  if (value.src != null && value.src !== (media?.url ?? null)) return fail("Referência de mídia inválida.");
  ids.add(value.id);
  return {
    id: value.id,
    kind,
    size: sizeFromSpan(columnSpan as number),
    columnSpan: columnSpan as number,
    columnStart: columnStart as number,
    rowSpan: rowSpan as number,
    minHeight: minHeight as number,
    hidden: value.hidden,
    text,
    body,
    align,
    alt,
    caption,
    src: media?.url ?? null,
    media,
    previewOnly: value.previewOnly,
    variant,
    imageZoom: Math.round(value.imageZoom * 10) / 10,
    imagePositionX: value.imagePositionX,
    imagePositionY: value.imagePositionY,
    titleLevel: value.titleLevel as TitleLevel,
    textColor: value.textColor as TextColor,
    textHighlights: kind === "title" || kind === "text" ? marks : [],
  };
}

export function validatePortfolioDocument(value: unknown): PortfolioValidation {
  if (!value || typeof value !== "object" || Array.isArray(value)) return fail("Documento inválido.");
  let encoded = "";
  try {
    encoded = JSON.stringify(value);
  } catch {
    return fail("Documento inválido.");
  }
  if (encoded.length > MAX_DOCUMENT_CHARS) return fail("Documento grande demais.");
  const sections = (value as { sections?: unknown }).sections;
  if (!sections || typeof sections !== "object" || Array.isArray(sections)) return fail("Seções inválidas.");
  const source = sections as Record<string, unknown>;
  const known = new Set(SECTION_ORDER.map((section) => section.id));
  for (const key of Object.keys(source)) {
    if (!known.has(key as PortfolioSectionId)) return fail("Seção desconhecida.");
  }
  const ids = new Set<string>();
  const next = {} as PortfolioDocument["sections"];
  for (const section of SECTION_ORDER) {
    const list = source[section.id];
    if (!Array.isArray(list)) return fail("Seção inválida.");
    if (list.length > MAX_BLOCKS) return fail("Blocos demais.");
    const blocks: PortfolioBlock[] = [];
    for (const item of list) {
      const block = readBlock(item, ids);
      if (!("id" in block)) return block;
      blocks.push(block);
    }
    next[section.id] = blocks;
  }
  return { ok: true, document: { sections: next } };
}
