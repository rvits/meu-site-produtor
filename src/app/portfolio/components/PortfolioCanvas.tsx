"use client";

/**
 * Renderer único da geometria do Portfólio.
 * Edição, pré-visualização e público usam as mesmas boxes.
 * No modo edição, o painel administrativo fica no fluxo, acima da box e dentro da coluna.
 * Preview e público não renderizam esse painel. Os handles continuam na borda da box.
 */

import { useState, type PointerEvent, type SyntheticEvent } from "react";
import {
  BLOCK_SIZES,
  DEFAULT_IMAGE_FRAME,
  MAX_IMAGE_ZOOM,
  MIN_IMAGE_ZOOM,
  TITLE_LEVELS,
  TEXT_COLORS,
  applyBaseTextColor,
  applySizePreset,
  blockLayoutClass,
  clearHighlight,
  highlightSegments,
  nextContentHighlights,
  nudgeColumn,
  paintHighlight,
  stepImageZoom,
  textColorClass,
  titleLevelClass,
  type BlockSize,
  type PortfolioBlock,
  type PortfolioSectionId,
  type ResizeEdge,
  type TextAlign,
  type TextHighlight,
  type TitleLevel,
} from "../portfolio-data";
import {
  MediaDropSurface,
  MediaFileNote,
  PortfolioAudioPlayer,
  PortfolioImageFrame,
  PortfolioVideoFrame,
  mediaFrameClass,
  type LocalMediaFile,
  type MediaKind,
} from "./PortfolioMedia";

export type PortfolioCanvasMode = "edit" | "preview" | "public";

type MediaNote = { error: string | null; duration: number | null };

function alignClass(align: TextAlign): string {
  if (align === "center") return "text-center";
  if (align === "right") return "text-right";
  return "text-left";
}

function HighlightedText({ text, highlights }: { text: string; highlights: TextHighlight[] }) {
  const segments = highlightSegments(text, highlights);
  if (segments.length === 0) return null;
  return segments.map((segment, index) => (
    segment.color
      ? <span key={index} className={textColorClass(segment.color)}>{segment.text}</span>
      : <span key={index}>{segment.text}</span>
  ));
}

function PortfolioTitle({ block }: { block: PortfolioBlock }) {
  const className = `w-full max-w-full break-words ${titleLevelClass(block.titleLevel)} ${textColorClass(block.textColor)} ${alignClass(block.align)}`;
  const content = <HighlightedText text={block.text} highlights={block.textHighlights} />;
  if (block.titleLevel === "hero" || block.titleLevel === "h1") return <h1 className={className}>{content}</h1>;
  if (block.titleLevel === "h2") return <h2 className={className}>{content}</h2>;
  if (block.titleLevel === "h3") return <h3 className={className}>{content}</h3>;
  return <h4 className={className}>{content}</h4>;
}

function mediaKindOf(block: PortfolioBlock): MediaKind | null {
  if (block.kind === "image" || block.kind === "audio" || block.kind === "video") return block.kind;
  return null;
}

function againMessage(kind: MediaKind): string {
  if (kind === "image") return "Selecione a imagem novamente. O arquivo não foi salvo.";
  if (kind === "audio") return "Selecione o áudio novamente. O arquivo não foi salvo.";
  return "Selecione o vídeo novamente. O arquivo não foi salvo.";
}

function blockShellClass(block: PortfolioBlock): string {
  return [
    blockLayoutClass(block.columnSpan, block.columnStart, block.rowSpan),
    "flex w-full min-w-0 flex-col gap-3",
    block.rowSpan > 1 ? "md:h-full" : "",
  ].filter(Boolean).join(" ");
}

function blockBoxClass(block: PortfolioBlock): string {
  return [
    "relative flex w-full min-w-0 flex-col rounded-lg border border-red-500/80 bg-black p-4",
    block.minHeight > 0 ? "md:min-h-[var(--block-min-h)]" : "",
    block.rowSpan > 1 ? "md:min-h-0 md:flex-1" : "",
  ].filter(Boolean).join(" ");
}

function BlockContent({
  block,
  file,
  mode,
  onBrowse,
  onFile,
  onReady,
  onFail,
  onImagePosition,
}: {
  block: PortfolioBlock;
  file: LocalMediaFile | null;
  mode: PortfolioCanvasMode;
  onBrowse: () => void;
  onFile: (next: File) => void;
  onReady: (duration: number) => void;
  onFail: (message: string) => void;
  onImagePosition?: (x: number, y: number) => void;
}) {
  const align = alignClass(block.align);
  const editing = mode === "edit";
  const src = file?.url ?? block.media?.url ?? null;

  if (block.kind === "title") {
    return <PortfolioTitle block={block} />;
  }

  if (block.kind === "text") {
    return (
      <p className={`w-full max-w-full whitespace-pre-wrap break-words text-sm leading-relaxed sm:text-base ${textColorClass(block.textColor)} ${align}`}>
        {block.body ? <HighlightedText text={block.body} highlights={block.textHighlights} /> : (editing ? "Texto" : mode === "preview" ? "\u00a0" : "")}
      </p>
    );
  }

  if (block.kind === "audio") {
    return (
      <div className="w-full">
        <div className="relative h-[5.5rem] w-full">
          <MediaDropSurface kind="audio" editing={editing} hasMedia={Boolean(src)} onBrowse={onBrowse} onFile={onFile}>
            {src ? (
              <PortfolioAudioPlayer key={src} src={src} title={block.text || "Áudio"} playerId={block.id} onReady={onReady} onFail={onFail} />
            ) : (
              <div className="flex h-full min-w-0 items-center gap-3 rounded-lg border border-zinc-800 bg-zinc-950 px-3" role="group" aria-label={`Áudio de ${block.text || "Áudio"} ainda não publicado`}>
                <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-red-600 text-white" aria-hidden>▶</span>
                <div className="min-w-0">
                  {block.text ? <p className="truncate text-sm text-white">{block.text}</p> : null}
                  <p className="truncate text-xs text-zinc-400">Áudio será publicado aqui.</p>
                </div>
              </div>
            )}
          </MediaDropSurface>
        </div>
      </div>
    );
  }

  const visualKind = block.kind === "image" ? "image" : "video";
  const fillBox = block.rowSpan > 1 || block.minHeight > 0;
  const mediaShell = fillBox ? "relative flex w-full flex-col md:min-h-0 md:flex-1" : "relative w-full";
  const frameClass = `relative overflow-hidden rounded-lg border ${
    visualKind === "image" ? "border-zinc-700 bg-black" : "border-red-500 bg-zinc-950"
  } ${mediaFrameClass(block.minHeight, block.rowSpan > 1)}`;

  const frame = (
    <div className={frameClass}>
      <MediaDropSurface kind={visualKind} editing={editing} hasMedia={Boolean(src)} onBrowse={onBrowse} onFile={onFile}>
        {visualKind === "image" ? (
            <PortfolioImageFrame
              src={src}
              alt={block.alt || block.text || "Imagem do portfólio"}
              admin={editing}
              zoom={block.imageZoom}
              positionX={block.imagePositionX}
              positionY={block.imagePositionY}
              onPosition={editing ? onImagePosition : undefined}
              onFail={() => onFail("Não foi possível carregar esta imagem.")}
            />
        ) : (
          <PortfolioVideoFrame
            src={src}
            title={block.text || "Vídeo"}
            admin={editing}
            onReady={onReady}
            onFail={onFail}
          />
        )}
      </MediaDropSurface>
    </div>
  );

  if (visualKind === "image") {
    return (
      <figure className={mediaShell}>
        {frame}
        {block.caption ? <figcaption className={`mt-2 text-sm text-zinc-200 ${align}`}>{block.caption}</figcaption> : null}
      </figure>
    );
  }

  return (
    <div className={mediaShell}>
      {frame}
      {src && block.text ? <p className={`mt-2 text-base font-semibold text-zinc-100 ${align}`}>{block.text}</p> : null}
    </div>
  );
}

function HighlightEditor({
  block,
  onCommit,
}: {
  block: PortfolioBlock;
  onCommit: (value: string, highlights: TextHighlight[]) => void;
}) {
  const [range, setRange] = useState<{ start: number; end: number } | null>(null);
  const value = block.kind === "text" ? block.body : block.text;
  const multiline = block.kind === "text";

  function rememberSelection(event: SyntheticEvent<HTMLInputElement | HTMLTextAreaElement>) {
    const node = event.currentTarget;
    const start = node.selectionStart ?? 0;
    const end = node.selectionEnd ?? 0;
    setRange(start < end ? { start, end } : null);
  }

  function commitText(next: string) {
    onCommit(next, nextContentHighlights(block, next));
    setRange(null);
  }

  const selected = range ? value.slice(range.start, range.end) : "";

  return (
    <div className="space-y-2">
      <label className="block text-xs text-zinc-400">
        Texto
        {multiline ? (
          <textarea
            className="mt-1 min-h-24 w-full rounded border border-zinc-700 bg-black px-2 py-1 text-sm text-zinc-100"
            value={value}
            aria-label="Conteúdo do texto"
            onSelect={rememberSelection}
            onKeyUp={rememberSelection}
            onMouseUp={rememberSelection}
            onChange={(event) => commitText(event.target.value)}
          />
        ) : (
          <input
            className="mt-1 w-full rounded border border-zinc-700 bg-black px-2 py-1 text-sm text-zinc-100"
            value={value}
            aria-label="Conteúdo do título"
            onSelect={rememberSelection}
            onKeyUp={rememberSelection}
            onMouseUp={rememberSelection}
            onChange={(event) => commitText(event.target.value)}
          />
        )}
      </label>
      <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Destaque da seleção">
        <span className="text-xs text-zinc-400">Destaque da seleção</span>
        {TEXT_COLORS.map((color) => (
          <button
            key={color.id}
            type="button"
            className={`rounded border px-2 py-1 text-xs disabled:opacity-40 ${
              color.id === "red"
                ? "border-red-700 text-red-300"
                : color.id === "black"
                  ? "border-zinc-500 bg-zinc-200 text-black"
                  : "border-zinc-400 text-white"
            }`}
            disabled={!range}
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => {
              if (!range) return;
              onCommit(value, paintHighlight(block.textHighlights, range.start, range.end, color.id, value.length));
            }}
          >
            {color.label}
          </button>
        ))}
        <button
          type="button"
          className="rounded border border-zinc-600 px-2 py-1 text-xs text-zinc-200 disabled:opacity-40"
          disabled={!range}
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => {
            if (!range) return;
            onCommit(value, clearHighlight(block.textHighlights, range.start, range.end, value.length));
          }}
        >
          Remover destaque
        </button>
        <span className="min-w-0 text-xs text-zinc-500">{selected ? `Trecho: “${selected}”` : "Selecione um trecho no campo."}</span>
      </div>
    </div>
  );
}

const ALIGN_OPTIONS: Array<{ id: TextAlign; label: string }> = [
  { id: "left", label: "Esquerda" },
  { id: "center", label: "Centro" },
  { id: "right", label: "Direita" },
];

function dragHasFiles(event: { dataTransfer: DataTransfer }): boolean {
  return Array.from(event.dataTransfer.types).includes("Files");
}

export function PortfolioSection({
  sectionId,
  blocks,
  mode,
  localMedia,
  mediaNote,
  editingId,
  pendingRemove,
  dragId,
  resizingId,
  onMoveBlock,
  onShiftBlock,
  onPatchBlock,
  onResizeStart,
  onDragId,
  onEditingId,
  onPendingRemove,
  onRemoveBlock,
  onBrowse,
  onFile,
  onRetryFile,
  onClearFile,
  onMediaReady,
  onMediaFail,
}: {
  sectionId: PortfolioSectionId;
  blocks: PortfolioBlock[];
  mode: PortfolioCanvasMode;
  localMedia: Record<string, LocalMediaFile>;
  mediaNote: Record<string, MediaNote>;
  editingId: string | null;
  pendingRemove: string | null;
  dragId: string | null;
  resizingId: string | null;
  onMoveBlock: (sectionId: PortfolioSectionId, fromId: string, toId: string) => void;
  onShiftBlock: (sectionId: PortfolioSectionId, id: string, direction: -1 | 1) => void;
  onPatchBlock: (sectionId: PortfolioSectionId, id: string, patch: Partial<PortfolioBlock>) => void;
  onResizeStart: (sectionId: PortfolioSectionId, item: PortfolioBlock, edge: ResizeEdge, event: PointerEvent<HTMLButtonElement>) => void;
  onDragId: (id: string | null) => void;
  onEditingId: (id: string | null) => void;
  onPendingRemove: (id: string | null) => void;
  onRemoveBlock: (sectionId: PortfolioSectionId, id: string) => void;
  onBrowse: (sectionId: PortfolioSectionId, id: string, kind: MediaKind) => void;
  onFile: (sectionId: PortfolioSectionId, id: string, kind: MediaKind, file: File) => void;
  onRetryFile: (sectionId: PortfolioSectionId, id: string, kind: MediaKind) => void;
  onClearFile: (sectionId: PortfolioSectionId, id: string) => void;
  onMediaReady: (id: string, duration: number, type: string) => void;
  onMediaFail: (id: string, message: string, type: string) => void;
}) {
  const editing = mode === "edit";
  const visible = blocks.filter((item) => editing || !item.hidden);

  return (
    <div data-portfolio-grid className={editing ? "grid grid-cols-1 items-start gap-x-4 gap-y-8 md:grid-cols-12" : "grid grid-cols-1 items-start gap-4 md:grid-cols-12"}>
      {visible.map((item) => {
        const file = mode === "public" ? null : localMedia[item.id] ?? null;
        const note = mediaNote[item.id] ?? null;
        const kind = mediaKindOf(item);
        const hasFile = Boolean(file);
        const hasDurable = Boolean(item.media);
        return (
          <div
            key={item.id}
            data-edit-shell={editing ? "true" : undefined}
            className={blockShellClass(item)}
            onDragOver={(event) => {
              if (dragHasFiles(event)) {
                event.preventDefault();
                event.dataTransfer.dropEffect = "copy";
                return;
              }
              if (!editing || resizingId) return;
              event.preventDefault();
            }}
            onDrop={(event) => {
              if (dragHasFiles(event)) {
                event.preventDefault();
                const target = event.target;
                const insideSurface = target instanceof Element && Boolean(target.closest("[data-drop-kind]"));
                const file = event.dataTransfer.files?.[0];
                if (!insideSurface && kind && file) onFile(sectionId, item.id, kind, file);
                return;
              }
              if (!editing || !dragId || resizingId) return;
              event.preventDefault();
              onMoveBlock(sectionId, dragId, item.id);
            }}
          >
          {editing ? (
            <div className="w-full min-w-0 space-y-2">
              <div className="flex w-full min-w-0 flex-wrap items-center gap-2 rounded border border-zinc-800 bg-zinc-950/95 p-1 text-xs">
                    <div className="flex flex-wrap items-center gap-1">
                      <button
                        type="button"
                        draggable
                        aria-label="Arrastar bloco"
                        className="cursor-grab rounded border border-zinc-600 px-2 py-1 text-zinc-200"
                        onDragStart={(event) => {
                          if (resizingId) {
                            event.preventDefault();
                            return;
                          }
                          event.dataTransfer.setData("text/plain", item.id);
                          event.dataTransfer.effectAllowed = "move";
                          onDragId(item.id);
                        }}
                        onDragEnd={() => onDragId(null)}
                      >
                        Arrastar
                      </button>
                      <button type="button" className="rounded border border-zinc-600 px-2 py-1" onClick={() => onShiftBlock(sectionId, item.id, -1)}>Acima</button>
                      <button type="button" className="rounded border border-zinc-600 px-2 py-1" onClick={() => onShiftBlock(sectionId, item.id, 1)}>Abaixo</button>
                      <button
                        type="button"
                        className="rounded border border-zinc-600 px-2 py-1 disabled:opacity-40"
                        disabled={!nudgeColumn(item.columnStart, item.columnSpan, -1)}
                        onClick={() => {
                          const next = nudgeColumn(item.columnStart, item.columnSpan, -1);
                          if (next) onPatchBlock(sectionId, item.id, next);
                        }}
                      >
                        Esquerda
                      </button>
                      <button
                        type="button"
                        className="rounded border border-zinc-600 px-2 py-1 disabled:opacity-40"
                        disabled={!nudgeColumn(item.columnStart, item.columnSpan, 1)}
                        onClick={() => {
                          const next = nudgeColumn(item.columnStart, item.columnSpan, 1);
                          if (next) onPatchBlock(sectionId, item.id, next);
                        }}
                      >
                        Direita
                      </button>
                    </div>
                    <div className="flex flex-wrap items-center gap-1">
                      <button type="button" className="rounded border border-zinc-600 px-2 py-1" onClick={() => onEditingId(editingId === item.id ? null : item.id)}>Editar</button>
                      <label className="text-zinc-400">
                        Tamanho
                        <select
                          className="ml-2 rounded border border-zinc-600 bg-black px-2 py-1 text-zinc-100"
                          value={item.size}
                          aria-label={`Tamanho do bloco ${item.text || item.kind}`}
                          onChange={(event) => {
                            const value = event.target.value as BlockSize;
                            if (value === "custom") return;
                            onPatchBlock(sectionId, item.id, applySizePreset(item.columnStart, value));
                          }}
                        >
                          {BLOCK_SIZES.map((size) => (
                            <option key={size.id} value={size.id}>{size.label}</option>
                          ))}
                          {item.size === "custom" ? <option value="custom">Personalizado</option> : null}
                        </select>
                      </label>
                      <span className="text-zinc-500">{item.columnSpan} colunas{item.minHeight > 0 ? ` · ${item.minHeight}px` : ""}</span>
                    </div>
                    <div className="flex flex-wrap items-center gap-1">
                      <button type="button" className="rounded border border-zinc-600 px-2 py-1" onClick={() => onPatchBlock(sectionId, item.id, { hidden: !item.hidden })}>
                        {item.hidden ? "Mostrar" : "Ocultar"}
                      </button>
                      <button type="button" className="rounded border border-red-700 px-2 py-1 text-red-300" onClick={() => onPendingRemove(item.id)}>Remover</button>
                    </div>
                    {kind ? (
                      <div className="flex flex-wrap items-center gap-1">
                        <button type="button" className="rounded border border-zinc-600 px-2 py-1" onClick={() => onBrowse(sectionId, item.id, kind)}>
                          {hasFile || hasDurable ? (kind === "image" ? "Trocar imagem" : kind === "audio" ? "Trocar áudio" : "Trocar vídeo") : (kind === "image" ? "Selecionar imagem" : kind === "audio" ? "Selecionar áudio" : "Selecionar vídeo")}
                        </button>
                        <button
                          type="button"
                          className="rounded border border-zinc-600 px-2 py-1 disabled:opacity-40"
                          disabled={!hasFile && !hasDurable && !item.previewOnly}
                          onClick={() => onClearFile(sectionId, item.id)}
                        >
                          {kind === "image" ? "Remover imagem" : kind === "audio" ? "Remover áudio" : "Remover vídeo"}
                        </button>
                      </div>
                    ) : null}
                    {kind === "image" && (hasFile || hasDurable) ? (
                      <div className="flex flex-wrap items-center gap-1" role="group" aria-label="Enquadramento da foto">
                        <button
                          type="button"
                          className="rounded border border-zinc-600 px-2 py-1 disabled:opacity-40"
                          aria-label="Diminuir zoom"
                          disabled={item.imageZoom <= MIN_IMAGE_ZOOM}
                          onClick={() => onPatchBlock(sectionId, item.id, { imageZoom: stepImageZoom(item.imageZoom, -1) })}
                        >
                          −
                        </button>
                        <span className="text-zinc-300">Zoom {Math.round(item.imageZoom * 100)}%</span>
                        <button
                          type="button"
                          className="rounded border border-zinc-600 px-2 py-1 disabled:opacity-40"
                          aria-label="Aumentar zoom"
                          disabled={item.imageZoom >= MAX_IMAGE_ZOOM}
                          onClick={() => onPatchBlock(sectionId, item.id, { imageZoom: stepImageZoom(item.imageZoom, 1) })}
                        >
                          +
                        </button>
                        <button
                          type="button"
                          className="rounded border border-zinc-600 px-2 py-1"
                          onClick={() => onPatchBlock(sectionId, item.id, { ...DEFAULT_IMAGE_FRAME })}
                        >
                          Redefinir enquadramento
                        </button>
                      </div>
                    ) : null}
                    {item.hidden ? <span className="text-[11px] uppercase tracking-wide text-zinc-500">Oculto na versão publicada</span> : null}
                    {kind && file ? <MediaFileNote file={file} duration={kind === "image" ? null : note?.duration ?? null} /> : null}
                    {kind && file?.phase === "uploading" ? <p className="text-xs text-zinc-400">Enviando...</p> : null}
                    {kind && file?.phase === "done" ? <p className="text-xs text-zinc-400">Arquivo enviado</p> : null}
                    {kind && file?.phase === "error" ? (
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-xs text-red-300">{file.error || "Não foi possível enviar o arquivo."}</p>
                        <button type="button" className="text-xs text-zinc-200 underline" onClick={() => onRetryFile(sectionId, item.id, kind)}>Tentar novamente</button>
                        <button type="button" className="text-xs text-zinc-200 underline" onClick={() => onClearFile(sectionId, item.id)}>Remover mídia</button>
                      </div>
                    ) : null}
                    {kind && item.previewOnly && !file ? <p className="text-xs text-zinc-500">{againMessage(kind)}</p> : null}
                    {kind && note?.error ? <p className="text-xs text-red-300">{note.error}</p> : null}
              </div>
              {editingId === item.id && pendingRemove !== item.id ? (
                <div className="w-full min-w-0 space-y-2 rounded border border-zinc-800 bg-black p-3 text-sm">
                    {item.kind === "title" || item.kind === "text" ? (
                      <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Cor do texto">
                        <span className="text-xs text-zinc-400">Cor do texto</span>
                        {TEXT_COLORS.map((color) => (
                          <button
                            key={color.id}
                            type="button"
                            aria-pressed={item.textColor === color.id}
                            className={`rounded border px-2 py-1 text-xs ${
                              color.id === "red"
                                ? "border-red-700 text-red-300"
                                : color.id === "black"
                                  ? "border-zinc-500 bg-zinc-200 text-black"
                                  : "border-zinc-400 text-white"
                            } ${item.textColor === color.id ? "outline outline-1 outline-zinc-300" : ""}`}
                            onClick={() => onPatchBlock(sectionId, item.id, applyBaseTextColor(color.id))}
                          >
                            {color.label}
                          </button>
                        ))}
                      </div>
                    ) : null}
                    {item.kind === "title" || item.kind === "text" ? (
                      <HighlightEditor
                        block={item}
                        onCommit={(value, highlights) => onPatchBlock(
                          sectionId,
                          item.id,
                          item.kind === "text" ? { body: value, textHighlights: highlights } : { text: value, textHighlights: highlights }
                        )}
                      />
                    ) : null}
                    {item.kind === "title" ? (
                      <div className="flex flex-wrap items-center gap-2">
                        <label className="text-xs text-zinc-400">
                          Hierarquia
                          <select
                            className="ml-2 rounded border border-zinc-600 bg-black px-2 py-1 text-xs text-zinc-100"
                            value={item.titleLevel}
                            aria-label="Hierarquia do título"
                            onChange={(event) => onPatchBlock(sectionId, item.id, { titleLevel: event.target.value as TitleLevel })}
                          >
                            {TITLE_LEVELS.map((level) => (
                              <option key={level.id} value={level.id}>{level.label}</option>
                            ))}
                          </select>
                        </label>
                      </div>
                    ) : null}
                    {item.kind === "title" || item.kind === "text" ? (
                      <div className="flex flex-wrap gap-1" role="group" aria-label="Alinhamento">
                        {ALIGN_OPTIONS.map((option) => (
                          <button
                            key={option.id}
                            type="button"
                            aria-pressed={item.align === option.id}
                            className={`rounded border px-2 py-1 text-xs ${item.align === option.id ? "border-red-500 text-white" : "border-zinc-600 text-zinc-300"}`}
                            onClick={() => onPatchBlock(sectionId, item.id, { align: option.id })}
                          >
                            {option.label}
                          </button>
                        ))}
                      </div>
                    ) : null}
                    {item.variant === "hero-name" ? (
                      <p className="text-xs text-zinc-500">O nome publicado começa com o V e o t em vermelho. Cor do texto pinta o nome inteiro e remove esses destaques. Eles não voltam sozinhos; é preciso marcá-los de novo, ou sair desse texto e voltar exatamente a Victor Pereira Ramos.</p>
                    ) : null}
                    {item.kind === "image" ? (
                      <>
                        <input className="w-full rounded border border-zinc-700 bg-black px-2 py-1" value={item.alt} aria-label="Texto alternativo" placeholder="Texto alternativo" onChange={(event) => onPatchBlock(sectionId, item.id, { alt: event.target.value })} />
                        <input className="w-full rounded border border-zinc-700 bg-black px-2 py-1" value={item.caption} aria-label="Legenda" placeholder="Legenda" onChange={(event) => onPatchBlock(sectionId, item.id, { caption: event.target.value })} />
                      </>
                    ) : null}
                    {item.kind === "audio" || item.kind === "video" ? (
                      <input className="w-full rounded border border-zinc-700 bg-black px-2 py-1" value={item.text} aria-label="Informações" placeholder="Informações" onChange={(event) => onPatchBlock(sectionId, item.id, { text: event.target.value })} />
                    ) : null}
                  </div>
                ) : null}
              {pendingRemove === item.id ? (
                <div className="flex w-full min-w-0 flex-wrap gap-2 rounded border border-zinc-800 bg-black p-3 text-xs">
                    <span className="text-zinc-300">Remover este bloco do rascunho?</span>
                    <button type="button" className="text-red-300" onClick={() => onRemoveBlock(sectionId, item.id)}>Confirmar</button>
                    <button type="button" onClick={() => onPendingRemove(null)}>Cancelar</button>
                </div>
              ) : null}
            </div>
          ) : null}
          <article
            data-block-id={item.id}
            style={{ ["--block-min-h" as string]: `${item.minHeight}px` }}
            className={`${blockBoxClass(item)} ${item.hidden ? "opacity-50" : ""} ${
              dragId === item.id || resizingId === item.id ? "ring-2 ring-red-500" : ""
            }`}
          >
            <div className={item.kind === "image" || item.kind === "video" ? (item.rowSpan > 1 || item.minHeight > 0 ? "relative flex w-full flex-col md:min-h-0 md:flex-1" : "relative w-full") : "relative w-full"}>
              <BlockContent
                block={item}
                file={file}
                mode={mode}
                onBrowse={() => kind && onBrowse(sectionId, item.id, kind)}
                onFile={(next) => kind && onFile(sectionId, item.id, kind, next)}
                onReady={(duration) => onMediaReady(item.id, duration, file?.type ?? "")}
                onFail={(message) => onMediaFail(item.id, message, file?.type ?? "")}
                onImagePosition={(x, y) => onPatchBlock(sectionId, item.id, { imagePositionX: x, imagePositionY: y })}
              />
            </div>
            {editing ? (
              <>
                <button type="button" aria-label="Redimensionar pela parte superior" draggable={false} className="absolute left-1/2 top-1 z-20 hidden h-1.5 w-10 -translate-x-1/2 cursor-ns-resize rounded-full bg-red-500/80 md:block" onPointerDown={(event) => onResizeStart(sectionId, item, "top", event)} />
                <button type="button" aria-label="Redimensionar pela parte inferior" draggable={false} className="absolute bottom-1 left-1/2 z-20 hidden h-1.5 w-10 -translate-x-1/2 cursor-ns-resize rounded-full bg-red-500/80 md:block" onPointerDown={(event) => onResizeStart(sectionId, item, "bottom", event)} />
                <button type="button" aria-label="Redimensionar pela esquerda" draggable={false} className="absolute left-1 top-1/2 z-20 hidden h-10 w-1.5 -translate-y-1/2 cursor-ew-resize rounded-full bg-red-500/80 md:block" onPointerDown={(event) => onResizeStart(sectionId, item, "left", event)} />
                <button type="button" aria-label="Redimensionar pela direita" draggable={false} className="absolute right-1 top-1/2 z-20 hidden h-10 w-1.5 -translate-y-1/2 cursor-ew-resize rounded-full bg-red-500/80 md:block" onPointerDown={(event) => onResizeStart(sectionId, item, "right", event)} />
              </>
            ) : null}
          </article>
          </div>
        );
      })}
    </div>
  );
}
