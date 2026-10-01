import { parsePortfolioMedia, type PortfolioMediaRef } from "./portfolio-media-ref";

/**
 * Documento publicado do Portfólio.
 * A versão pública mora neste arquivo. Não há tabela, API nem arquivo permanente.
 * O que pode ir para uma revisão futura é ordem, columnSpan, columnStart e minHeight.
 * Coordenadas x/y em pixels não fazem parte do modelo.
 */

export const HERO_NAME_TEXT = "Victor Pereira Ramos";

export const PORTFOLIO_INTRO =
  "Victor Pereira Ramos, 23 anos, atua como produtor musical e produtor fonográfico, desenvolvendo trabalhos que percorrem diferentes etapas da criação e finalização sonora. Sua atuação reúne beatmaking, composição, mixagem, masterização e sonoplastia, conectando criação, produção e acabamento técnico em projetos musicais e audiovisuais.";

export const LOCAL_MEDIA_WARNING =
  "Fotos, vídeos e áudios selecionados localmente são apenas para pré-visualização. Os arquivos precisarão ser selecionados novamente após recarregar até que o armazenamento do Portfólio seja configurado.";

export type BlockKind = "title" | "text" | "image" | "audio" | "video";
export type BlockSize = "small" | "medium" | "large" | "full" | "custom";
export type TextAlign = "left" | "center" | "right";
export type TitleLevel = "hero" | "h1" | "h2" | "h3" | "h4";
export type TextColor = "white" | "red" | "black";
export type ResizeEdge = "left" | "right" | "top" | "bottom";

/** Intervalo [start, end) com cor própria. Não é HTML. */
export type TextHighlight = { start: number; end: number; color: TextColor };

/** V e t de "Victor Pereira Ramos". Índices no texto exato do hero. */
export const HERO_NAME_HIGHLIGHTS: TextHighlight[] = [
  { start: 0, end: 1, color: "red" },
  { start: 3, end: 4, color: "red" },
];

export const MIN_COLUMN_SPAN = 2;
export const MAX_COLUMN_SPAN = 12;
export const MIN_BLOCK_HEIGHT = 80;
export const MAX_BLOCK_HEIGHT = 720;
export const HEIGHT_STEP = 8;
export const MIN_IMAGE_ZOOM = 1;
export const MAX_IMAGE_ZOOM = 3;
export const IMAGE_ZOOM_STEP = 0.1;

export type PortfolioBlock = {
  id: string;
  kind: BlockKind;
  size: BlockSize;
  /** 1–12. No mobile o bloco ocupa a linha inteira. */
  columnSpan: number;
  /** 1–12. Início da coluna no desktop. No mobile é ignorado. */
  columnStart: number;
  /** Linhas ocupadas no desktop. No mobile é ignorado. */
  rowSpan: number;
  /** Altura mínima em px no desktop. 0 = altura do conteúdo. Não é coordenada Y. */
  minHeight: number;
  hidden: boolean;
  /** Título, ou rótulo curto de mídia. */
  text: string;
  body: string;
  align: TextAlign;
  alt: string;
  caption: string;
  /** URL de reprodução. Só existe quando `media` é uma referência durável. Nunca guarda blob:. */
  src: string | null;
  /** Arquivo permanente no Blob do Portfólio. A object URL local não entra aqui. */
  media: PortfolioMediaRef | null;
  /** Há um arquivo local desta sessão que ainda não substituiu a mídia durável. */
  previewOnly: boolean;
  /** Estilização V/t vermelhos, só no título principal do hero. */
  variant: "hero-name" | null;
  /** Zoom da foto dentro da box. 1 = 100%. Não altera o grid. */
  imageZoom: number;
  /** Pan horizontal normalizado, -1 a 1. 0 = centro. */
  imagePositionX: number;
  /** Pan vertical normalizado, -1 a 1. 0 = centro. */
  imagePositionY: number;
  /** Escala visual do título. Texto comum ignora este campo. */
  titleLevel: TitleLevel;
  /** Cor do conteúdo de título ou texto. Não colore a toolbar. */
  textColor: TextColor;
  /** Trechos coloridos por cima da cor base. Título usa `text`; texto usa `body`. */
  textHighlights: TextHighlight[];
};

export const TITLE_LEVELS: Array<{ id: TitleLevel; label: string }> = [
  { id: "hero", label: "Destaque" },
  { id: "h1", label: "Título principal" },
  { id: "h2", label: "Título de seção" },
  { id: "h3", label: "Subtítulo" },
  { id: "h4", label: "Título pequeno" },
];

export const TEXT_COLORS: Array<{ id: TextColor; label: string }> = [
  { id: "white", label: "Branco" },
  { id: "red", label: "Vermelho" },
  { id: "black", label: "Preto" },
];

export function normalizeTitleLevel(value: unknown, variant: "hero-name" | null): TitleLevel {
  if (value === "hero" || value === "h1" || value === "h2" || value === "h3" || value === "h4") return value;
  return variant === "hero-name" ? "hero" : "h2";
}

export function normalizeTextColor(value: unknown): TextColor {
  if (value === "white" || value === "red" || value === "black") return value;
  return "white";
}

/** Classes literais. O administrador não digita tamanho nem cor. */
export function titleLevelClass(level: TitleLevel): string {
  if (level === "hero") return "text-[44px] font-extrabold leading-tight tracking-tight sm:text-[64px] xl:text-[76px]";
  if (level === "h1") return "text-[36px] font-bold leading-tight sm:text-[48px] xl:text-[56px]";
  if (level === "h2") return "text-[28px] font-bold leading-tight sm:text-[32px] xl:text-[36px]";
  if (level === "h3") return "text-[22px] font-semibold leading-snug sm:text-[24px] xl:text-[28px]";
  return "text-[18px] font-semibold leading-snug";
}

export function textColorClass(color: TextColor): string {
  if (color === "red") return "text-red-500";
  if (color === "black") return "text-black";
  return "text-white";
}

function highlightColor(value: unknown): TextColor | null {
  if (value === "white" || value === "red" || value === "black") return value;
  return null;
}

/**
 * Descarta intervalos vazios ou fora do texto.
 * Um intervalo mais novo cobre o anterior na região em comum.
 * Vizinhos da mesma cor viram um intervalo só.
 */
export function normalizeTextHighlights(value: unknown, length: number): TextHighlight[] {
  if (!Array.isArray(value) || length <= 0) return [];
  const paint: Array<TextColor | null> = Array.from({ length }, () => null);
  for (const item of value) {
    if (!item || typeof item !== "object") continue;
    const raw = item as { start?: unknown; end?: unknown; color?: unknown };
    const color = highlightColor(raw.color);
    if (!color) continue;
    let start = Math.floor(Number(raw.start));
    let end = Math.floor(Number(raw.end));
    if (!Number.isFinite(start) || !Number.isFinite(end)) continue;
    if (end <= 0 || start >= length) continue;
    start = Math.max(0, start);
    end = Math.min(length, end);
    for (let index = start; index < end; index += 1) paint[index] = color;
  }
  const merged: TextHighlight[] = [];
  let index = 0;
  while (index < length) {
    const color = paint[index];
    if (!color) {
      index += 1;
      continue;
    }
    let end = index + 1;
    while (end < length && paint[end] === color) end += 1;
    merged.push({ start: index, end, color });
    index = end;
  }
  return merged;
}

/** Formato antigo `{ start, end }` vira destaque vermelho. */
export function migrateRedHighlights(value: unknown, length: number): TextHighlight[] {
  if (!Array.isArray(value)) return [];
  return normalizeTextHighlights(
    value.map((item) => {
      if (!item || typeof item !== "object") return item;
      return { ...(item as object), color: "red" };
    }),
    length
  );
}

function subtractHighlight(highlights: TextHighlight[], start: number, end: number): TextHighlight[] {
  const next: TextHighlight[] = [];
  for (const range of highlights) {
    if (range.end <= start || range.start >= end) {
      next.push(range);
      continue;
    }
    if (range.start < start) next.push({ ...range, end: start });
    if (range.end > end) next.push({ ...range, start: end });
  }
  return next;
}

/** A cor nova substitui qualquer destaque já existente na seleção. */
export function paintHighlight(
  highlights: TextHighlight[],
  start: number,
  end: number,
  color: TextColor,
  length: number
): TextHighlight[] {
  const current = normalizeTextHighlights(highlights, length);
  return normalizeTextHighlights([...subtractHighlight(current, start, end), { start, end, color }], length);
}

/** Tira o destaque só da seleção. O trecho volta à cor base. */
export function clearHighlight(highlights: TextHighlight[], start: number, end: number, length: number): TextHighlight[] {
  return normalizeTextHighlights(subtractHighlight(normalizeTextHighlights(highlights, length), start, end), length);
}

/** Cor de todo o bloco. Não cria um destaque 0–fim; apaga os destaques parciais. */
export function applyBaseTextColor(color: TextColor): { textColor: TextColor; textHighlights: TextHighlight[] } {
  return { textColor: color, textHighlights: [] };
}

/** Mantém só intervalos que continuam nas partes não editadas do texto. */
export function retargetHighlights(highlights: TextHighlight[], previous: string, next: string): TextHighlight[] {
  if (previous === next) return normalizeTextHighlights(highlights, next.length);
  let prefix = 0;
  const limit = Math.min(previous.length, next.length);
  while (prefix < limit && previous[prefix] === next[prefix]) prefix += 1;
  let suffix = 0;
  while (
    suffix < previous.length - prefix &&
    suffix < next.length - prefix &&
    previous[previous.length - 1 - suffix] === next[next.length - 1 - suffix]
  ) {
    suffix += 1;
  }
  const oldMidEnd = previous.length - suffix;
  const delta = next.length - previous.length;
  const kept: TextHighlight[] = [];
  for (const range of highlights) {
    if (range.end <= prefix) kept.push(range);
    else if (range.start >= oldMidEnd) kept.push({ ...range, start: range.start + delta, end: range.end + delta });
  }
  return normalizeTextHighlights(kept, next.length);
}

export function nextContentHighlights(
  block: Pick<PortfolioBlock, "kind" | "variant" | "text" | "body" | "textHighlights">,
  nextValue: string
): TextHighlight[] {
  const previous = block.kind === "text" ? block.body : block.text;
  let next = retargetHighlights(block.textHighlights, previous, nextValue);
  if (block.kind === "title" && block.variant === "hero-name" && nextValue === HERO_NAME_TEXT && previous !== nextValue) {
    next = normalizeTextHighlights([...next, ...HERO_NAME_HIGHLIGHTS], nextValue.length);
  }
  return next;
}

export function highlightSegments(text: string, highlights: TextHighlight[]): Array<{ text: string; color: TextColor | null }> {
  const ranges = normalizeTextHighlights(highlights, text.length);
  if (text.length === 0) return [];
  const segments: Array<{ text: string; color: TextColor | null }> = [];
  let cursor = 0;
  for (const range of ranges) {
    if (range.start > cursor) segments.push({ text: text.slice(cursor, range.start), color: null });
    segments.push({ text: text.slice(range.start, range.end), color: range.color });
    cursor = range.end;
  }
  if (cursor < text.length) segments.push({ text: text.slice(cursor), color: null });
  return segments;
}

/** Seções estruturais fixas. Blocos dentro delas são livres; uma seção nova exige ampliar este tipo e SECTION_ORDER. */
export type PortfolioSectionId =
  | "hero"
  | "autoral-musicas"
  | "autoral-beats"
  | "servico-beats"
  | "servico-mixagens"
  | "servico-masterizacoes"
  | "servico-captacoes"
  | "servico-sonoplastia";

export type PortfolioDocument = {
  sections: Record<PortfolioSectionId, PortfolioBlock[]>;
};

export const SECTION_ORDER: Array<{
  id: PortfolioSectionId;
  heading: string;
  group: "hero" | "autorais" | "servicos";
}> = [
  { id: "hero", heading: "Apresentação", group: "hero" },
  { id: "autoral-musicas", heading: "Músicas Autorais", group: "autorais" },
  { id: "autoral-beats", heading: "Beats Autorais", group: "autorais" },
  { id: "servico-beats", heading: "Beats", group: "servicos" },
  { id: "servico-mixagens", heading: "Mixagens", group: "servicos" },
  { id: "servico-masterizacoes", heading: "Masterizações", group: "servicos" },
  { id: "servico-captacoes", heading: "Captações", group: "servicos" },
  { id: "servico-sonoplastia", heading: "Sonoplastia", group: "servicos" },
];

export const BLOCK_SIZES: Array<{ id: Exclude<BlockSize, "custom">; label: string }> = [
  { id: "small", label: "Pequeno" },
  { id: "medium", label: "Médio" },
  { id: "large", label: "Grande" },
  { id: "full", label: "Largura inteira" },
];

const SPAN_CLASS: Record<number, string> = {
  1: "md:col-span-1",
  2: "md:col-span-2",
  3: "md:col-span-3",
  4: "md:col-span-4",
  5: "md:col-span-5",
  6: "md:col-span-6",
  7: "md:col-span-7",
  8: "md:col-span-8",
  9: "md:col-span-9",
  10: "md:col-span-10",
  11: "md:col-span-11",
  12: "md:col-span-12",
};

const ROW_CLASS: Record<number, string> = {
  1: "md:row-span-1",
  2: "md:row-span-2",
  3: "md:row-span-3",
  4: "md:row-span-4",
};

const START_CLASS: Record<number, string> = {
  1: "md:col-start-1",
  2: "md:col-start-2",
  3: "md:col-start-3",
  4: "md:col-start-4",
  5: "md:col-start-5",
  6: "md:col-start-6",
  7: "md:col-start-7",
  8: "md:col-start-8",
  9: "md:col-start-9",
  10: "md:col-start-10",
  11: "md:col-start-11",
  12: "md:col-start-12",
};

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function sizeFromSpan(span: number): BlockSize {
  if (span === 3) return "small";
  if (span === 6) return "medium";
  if (span === 9) return "large";
  if (span === 12) return "full";
  return "custom";
}

export function blockLayoutClass(columnSpan: number, columnStart: number, rowSpan = 1): string {
  const span = clamp(Math.round(columnSpan), 1, MAX_COLUMN_SPAN);
  const start = clamp(Math.round(columnStart), 1, MAX_COLUMN_SPAN - span + 1);
  const rows = clamp(Math.round(rowSpan) || 1, 1, 4);
  const fill = rows > 1 ? "md:self-stretch" : "";
  return `col-span-1 col-start-1 min-w-0 ${SPAN_CLASS[span]} ${START_CLASS[start]} ${ROW_CLASS[rows]} ${fill}`;
}

export function applySizePreset(
  columnStart: number,
  size: Exclude<BlockSize, "custom">
): Pick<PortfolioBlock, "size" | "columnSpan" | "columnStart"> {
  const columnSpan = size === "small" ? 3 : size === "medium" ? 6 : size === "large" ? 9 : 12;
  const start = size === "full" ? 1 : clamp(columnStart, 1, MAX_COLUMN_SPAN - columnSpan + 1);
  return { size, columnSpan, columnStart: start };
}

export function nudgeColumn(
  columnStart: number,
  columnSpan: number,
  direction: -1 | 1
): Pick<PortfolioBlock, "columnStart" | "size"> | null {
  const next = columnStart + direction;
  if (next < 1 || next + columnSpan > MAX_COLUMN_SPAN + 1) return null;
  return { columnStart: next, size: sizeFromSpan(columnSpan) };
}

export type ResizeOrigin = {
  edge: ResizeEdge;
  columnStart: number;
  columnSpan: number;
  gridLeft: number;
  columnWidth: number;
  gap: number;
  blockLeft: number;
  blockTop: number;
  blockBottom: number;
};

export function resizeColumns(
  origin: ResizeOrigin,
  clientX: number
): Pick<PortfolioBlock, "columnStart" | "columnSpan" | "size"> {
  const unit = origin.columnWidth + origin.gap;
  if (origin.edge === "right") {
    const width = clientX - origin.blockLeft;
    const columnSpan = clamp(
      Math.round((width + origin.gap) / unit),
      MIN_COLUMN_SPAN,
      MAX_COLUMN_SPAN - origin.columnStart + 1
    );
    return { columnStart: origin.columnStart, columnSpan, size: sizeFromSpan(columnSpan) };
  }
  const end = origin.columnStart + origin.columnSpan;
  const pointerColumn = Math.round((clientX - origin.gridLeft) / unit) + 1;
  const columnStart = clamp(pointerColumn, 1, end - MIN_COLUMN_SPAN);
  const columnSpan = end - columnStart;
  return { columnStart, columnSpan, size: sizeFromSpan(columnSpan) };
}

export function resizeHeight(origin: ResizeOrigin, clientY: number): number {
  const raw = origin.edge === "bottom" ? clientY - origin.blockTop : origin.blockBottom - clientY;
  const stepped = Math.round(raw / HEIGHT_STEP) * HEIGHT_STEP;
  return clamp(stepped, MIN_BLOCK_HEIGHT, MAX_BLOCK_HEIGHT);
}

function block(
  partial: Pick<PortfolioBlock, "id" | "kind"> & Partial<PortfolioBlock>
): PortfolioBlock {
  return {
    size: "medium",
    columnSpan: 6,
    columnStart: 1,
    rowSpan: 1,
    minHeight: 0,
    hidden: false,
    text: "",
    body: "",
    align: "left",
    alt: "",
    caption: "",
    src: null,
    media: null,
    previewOnly: false,
    variant: null,
    imageZoom: 1,
    imagePositionX: 0,
    imagePositionY: 0,
    titleLevel: "h2",
    textColor: "white",
    textHighlights: [],
    ...partial,
  };
}

export function clampImageZoom(value: number): number {
  const stepped = Math.round(value * 10) / 10;
  return clamp(Number.isFinite(stepped) ? stepped : MIN_IMAGE_ZOOM, MIN_IMAGE_ZOOM, MAX_IMAGE_ZOOM);
}

export function clampImagePosition(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return clamp(value, -1, 1);
}

export function stepImageZoom(current: number, direction: -1 | 1): number {
  return clampImageZoom(current + direction * IMAGE_ZOOM_STEP);
}

export const DEFAULT_IMAGE_FRAME = {
  imageZoom: 1,
  imagePositionX: 0,
  imagePositionY: 0,
} as const;

/** Tamanho e deslocamento da foto inteira dentro da moldura, já com cover e zoom. */
export function imageCoverLayout(input: {
  frameWidth: number;
  frameHeight: number;
  naturalWidth: number;
  naturalHeight: number;
  zoom: number;
  positionX: number;
  positionY: number;
}): { width: number; height: number; x: number; y: number } | null {
  const frameWidth = input.frameWidth;
  const frameHeight = input.frameHeight;
  const naturalWidth = input.naturalWidth;
  const naturalHeight = input.naturalHeight;
  if (frameWidth <= 0 || frameHeight <= 0 || naturalWidth <= 0 || naturalHeight <= 0) return null;
  const zoom = clampImageZoom(input.zoom);
  const cover = Math.max(frameWidth / naturalWidth, frameHeight / naturalHeight);
  const width = naturalWidth * cover * zoom;
  const height = naturalHeight * cover * zoom;
  const excessX = Math.max(0, width - frameWidth);
  const excessY = Math.max(0, height - frameHeight);
  const positionX = excessX === 0 ? 0 : clampImagePosition(input.positionX);
  const positionY = excessY === 0 ? 0 : clampImagePosition(input.positionY);
  return {
    width,
    height,
    x: -excessX / 2 + positionX * (excessX / 2),
    y: -excessY / 2 + positionY * (excessY / 2),
  };
}

export const PUBLISHED_PORTFOLIO: PortfolioDocument = {
  sections: {
    hero: [
      block({
        id: "hero-video",
        kind: "video",
        size: "medium",
        columnStart: 1,
        columnSpan: 6,
        rowSpan: 2,
        text: "Apresentação de Victor Pereira Ramos",
      }),
      block({
        id: "hero-title",
        kind: "title",
        variant: "hero-name",
        size: "medium",
        columnStart: 7,
        columnSpan: 6,
        text: HERO_NAME_TEXT,
        titleLevel: "hero",
        textColor: "white",
        textHighlights: HERO_NAME_HIGHLIGHTS,
      }),
      block({
        id: "hero-text",
        kind: "text",
        size: "medium",
        columnStart: 7,
        columnSpan: 6,
        body: PORTFOLIO_INTRO,
      }),
    ],
    "autoral-musicas": [
      block({ id: "autoral-musica-1", kind: "video", text: "Projeto autoral" }),
    ],
    "autoral-beats": [
      block({ id: "autoral-beat-1", kind: "audio", text: "Beat autoral" }),
    ],
    "servico-beats": [
      block({ id: "servico-beat-1", kind: "audio", text: "Projeto de beat" }),
    ],
    "servico-mixagens": [
      block({ id: "servico-mix-1", kind: "audio", text: "Projeto de mixagem" }),
    ],
    "servico-masterizacoes": [
      block({ id: "servico-master-1", kind: "audio", text: "Projeto de masterização" }),
    ],
    "servico-captacoes": [
      block({ id: "servico-captacao-1", kind: "video", text: "Projeto de captação" }),
    ],
    "servico-sonoplastia": [
      block({ id: "servico-sonoplastia-1", kind: "audio", text: "Projeto de sonoplastia" }),
    ],
  },
};

export function cloneDocument(doc: PortfolioDocument): PortfolioDocument {
  return structuredClone(doc);
}

export function documentHasUnpersistedMedia(doc: PortfolioDocument): boolean {
  for (const section of SECTION_ORDER) {
    for (const item of doc.sections[section.id]) {
      if (item.kind !== "image" && item.kind !== "audio" && item.kind !== "video") continue;
      if (item.previewOnly) return true;
      if (item.media && item.src !== item.media.url) return true;
    }
  }
  return false;
}

export function samePortfolio(left: PortfolioDocument, right: PortfolioDocument): boolean {
  return JSON.stringify(normalizeDocument(left)) === JSON.stringify(normalizeDocument(right));
}

function normalizeBlock(raw: unknown): PortfolioBlock | null {
  if (!raw || typeof raw !== "object") return null;
  const value = raw as Partial<PortfolioBlock> & { title?: string };
  const kind = value.kind;
  if (kind !== "title" && kind !== "text" && kind !== "image" && kind !== "audio" && kind !== "video") {
    return null;
  }
  const columnSpan = clamp(Number(value.columnSpan) || 6, 1, MAX_COLUMN_SPAN);
  const columnStart = clamp(Number(value.columnStart) || 1, 1, MAX_COLUMN_SPAN - columnSpan + 1);
  const rowSpan = clamp(Number(value.rowSpan) || 1, 1, 4);
  const minHeight = clamp(Number(value.minHeight) || 0, 0, MAX_BLOCK_HEIGHT);
  const align = value.align === "center" || value.align === "right" ? value.align : "left";
  const text = typeof value.text === "string" ? value.text : typeof value.title === "string" ? value.title : "";
  const body = typeof value.body === "string" ? value.body : "";
  const variant = value.variant === "hero-name" ? "hero-name" : null;
  const contentLength = kind === "text" ? body.length : text.length;
  const stored = value as { textHighlights?: unknown; redHighlights?: unknown };
  const heroSeed = kind === "title" && variant === "hero-name" && text === HERO_NAME_TEXT;
  // Array vazio é escolha do usuário. Só a ausência do campo recebe o destaque inicial do hero.
  const seeded = stored.textHighlights != null
    ? stored.textHighlights
    : stored.redHighlights != null
      ? migrateRedHighlights(stored.redHighlights, contentLength)
      : heroSeed
        ? HERO_NAME_HIGHLIGHTS
        : [];
  const textHighlights = kind === "title" || kind === "text"
    ? normalizeTextHighlights(seeded, contentLength)
    : [];
  const parsedMedia = parsePortfolioMedia(value.media, kind);
  const media = parsedMedia.ok ? parsedMedia.media : null;
  return block({
    id: typeof value.id === "string" && value.id ? value.id : `bloco-${kind}`,
    kind,
    size: sizeFromSpan(columnSpan),
    columnSpan,
    columnStart,
    rowSpan,
    minHeight,
    hidden: value.hidden === true,
    text,
    body,
    align,
    alt: typeof value.alt === "string" ? value.alt : "",
    caption: typeof value.caption === "string" ? value.caption : "",
    src: media?.url ?? null,
    media,
    previewOnly: value.previewOnly === true,
    variant,
    titleLevel: normalizeTitleLevel(value.titleLevel, variant),
    textColor: normalizeTextColor(value.textColor),
    textHighlights,
    imageZoom: clampImageZoom(Number(value.imageZoom ?? 1)),
    imagePositionX: clampImagePosition(Number(value.imagePositionX ?? 0)),
    imagePositionY: clampImagePosition(Number(value.imagePositionY ?? 0)),
  });
}

export function normalizeDocument(value: unknown): PortfolioDocument | null {
  if (!value || typeof value !== "object") return null;
  const sections = (value as { sections?: unknown }).sections;
  if (!sections || typeof sections !== "object") return null;
  const source = sections as Partial<Record<PortfolioSectionId, unknown>>;
  const next = {} as PortfolioDocument["sections"];
  for (const section of SECTION_ORDER) {
    const list = source[section.id];
    if (!Array.isArray(list)) return null;
    next[section.id] = list.map(normalizeBlock).filter((item): item is PortfolioBlock => item !== null);
  }
  return { sections: next };
}

export function createBlock(sectionId: PortfolioSectionId, kind: BlockKind): PortfolioBlock {
  const id = `${sectionId}-${kind}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
  if (kind === "title") return block({ id, kind, text: "Título", titleLevel: "h2", textColor: "white" });
  if (kind === "text") return block({ id, kind, body: "" });
  if (kind === "image") return block({ id, kind, text: "Foto", alt: "Imagem do portfólio" });
  if (kind === "audio") return block({ id, kind, text: "Áudio" });
  return block({ id, kind, text: "Vídeo" });
}
