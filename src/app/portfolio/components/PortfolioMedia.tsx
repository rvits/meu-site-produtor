"use client";

/**
 * controlsList="nodownload" só esconde o controle de download do player.
 * Não impede a captura do arquivo. A limitação de uso está no aviso do Portfólio.
 *
 * A URL blob: precisa estar em img-src e media-src. Sem isso o navegador
 * desenha a tag e recusa o arquivo: imagem quebrada, vídeo em 0:00, áudio mudo.
 */

import { useEffect, useRef, useState, type DragEvent, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";
import { clampImagePosition, imageCoverLayout } from "../portfolio-data";
import { checkPortfolioFile, portfolioFormatHint } from "../portfolio-media-ref";

export type MediaKind = "image" | "audio" | "video";

export type LocalMediaFile = {
  url: string;
  name: string;
  type: string;
  size: number;
  file: File;
  phase: "uploading" | "done" | "error";
  error: string | null;
};

const EMPTY_COPY: Record<MediaKind, { drop: string; release: string; select: string }> = {
  image: { drop: "Arraste uma foto até aqui", release: "Solte a imagem aqui", select: "Selecionar imagem" },
  audio: { drop: "Arraste um áudio até aqui", release: "Solte o áudio aqui", select: "Selecionar áudio" },
  video: { drop: "Arraste um vídeo até aqui", release: "Solte o vídeo aqui", select: "Selecionar vídeo" },
};

export function formatFileSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function fileMatchesKind(file: File, kind: MediaKind): boolean {
  return checkPortfolioFile(file, kind) === null;
}

export function rejectMessage(kind: MediaKind): string {
  return `Use ${portfolioFormatHint(kind)}.`;
}

export function canPlayHint(kind: "audio" | "video", mime: string): string {
  if (typeof document === "undefined" || !mime) return "";
  const probe = document.createElement(kind);
  return probe.canPlayType(mime);
}

/**
 * A box do bloco define a geometria. aspect-video só existe quando não há
 * altura manual nem rowSpan: no desktop esses dois substituem a proporção.
 * No mobile a altura manual e o rowSpan não se aplicam, então a proporção
 * permanece para a box não colapsar.
 */
export function mediaFrameClass(minHeight: number, fill = false): string {
  if (minHeight > 0 || fill) return "aspect-video w-full min-h-0 md:aspect-auto md:h-full md:min-h-0 md:flex-1";
  return "aspect-video w-full";
}

function dragHasFiles(event: DragEvent): boolean {
  return Array.from(event.dataTransfer.types).includes("Files");
}

export function MediaDropSurface({
  kind,
  editing,
  hasMedia,
  compact = false,
  onBrowse,
  onFile,
  children,
}: {
  kind: MediaKind;
  editing: boolean;
  hasMedia: boolean;
  compact?: boolean;
  onBrowse: () => void;
  onFile: (file: File) => void;
  children: ReactNode;
}) {
  const [over, setOver] = useState(false);
  const [reject, setReject] = useState<string | null>(null);
  const depth = useRef(0);
  const copy = EMPTY_COPY[kind];

  if (!editing) return <div className="absolute inset-0">{children}</div>;

  function takeFile(file: File | undefined) {
    if (!file) return;
    const problem = checkPortfolioFile(file, kind);
    if (problem) {
      setReject(problem);
      return;
    }
    setReject(null);
    onFile(file);
  }

  return (
    <div
      data-drop-kind={kind}
      className={`absolute inset-0 flex h-full w-full flex-col ${over ? "bg-red-950/30 ring-2 ring-inset ring-red-500" : ""}`}
      onDragEnter={(event) => {
        if (!dragHasFiles(event)) return;
        event.preventDefault();
        event.stopPropagation();
        depth.current += 1;
        setOver(true);
      }}
      onDragOver={(event) => {
        if (!dragHasFiles(event)) return;
        event.preventDefault();
        event.stopPropagation();
        event.dataTransfer.dropEffect = "copy";
      }}
      onDragLeave={(event) => {
        if (!dragHasFiles(event)) return;
        event.preventDefault();
        event.stopPropagation();
        depth.current = Math.max(0, depth.current - 1);
        if (depth.current === 0) setOver(false);
      }}
      onDrop={(event) => {
        if (!dragHasFiles(event)) return;
        event.preventDefault();
        event.stopPropagation();
        depth.current = 0;
        setOver(false);
        takeFile(event.dataTransfer.files?.[0]);
      }}
    >
      {hasMedia ? children : compact ? (
        <div className="flex h-full items-center justify-center gap-2 px-2 text-center">
          <p className="truncate text-xs text-zinc-200">{over ? copy.release : copy.drop}</p>
          <button type="button" className="shrink-0 rounded-full border border-zinc-600 px-2 py-0.5 text-[11px] text-zinc-100" onClick={onBrowse}>
            {copy.select}
          </button>
        </div>
      ) : (
        <div className="flex h-full flex-1 flex-col items-center justify-center gap-3 px-4 text-center">
          <p className="text-sm text-zinc-200">{over ? copy.release : copy.drop}</p>
          <p className="text-xs uppercase tracking-[0.16em] text-zinc-500">ou</p>
          <button type="button" className="rounded-full border border-zinc-600 px-3 py-1 text-xs text-zinc-100" onClick={onBrowse}>
            {copy.select}
          </button>
        </div>
      )}
      {hasMedia && over ? (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/70 text-sm text-white">
          {copy.release}
        </div>
      ) : null}
      {reject ? <p className="px-3 pb-2 text-center text-xs text-red-300">{reject}</p> : null}
    </div>
  );
}

export function MediaFileNote({
  file,
  duration,
}: {
  file: LocalMediaFile;
  duration: number | null;
}) {
  const seconds = duration != null && Number.isFinite(duration) ? duration : null;
  const clock = seconds == null ? null : `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, "0")}`;
  return (
    <p className="text-[11px] text-zinc-500">
      {file.name || "Arquivo local"} · {file.type || "sem MIME"} · {formatFileSize(file.size)}
      {clock ? ` · ${clock}` : ""}
    </p>
  );
}

const AUDIO_PLAY_EVENT = "thouse-portfolio-audio-play";

function formatPlayback(seconds: number): string {
  const total = Math.floor(seconds);
  const secs = total % 60;
  const mins = Math.floor(total / 60) % 60;
  const hours = Math.floor(total / 3600);
  const pad = (value: number) => String(value).padStart(2, "0");
  if (hours > 0) return `${hours}:${pad(mins)}:${pad(secs)}`;
  return `${mins}:${pad(secs)}`;
}

function formatDuration(seconds: number | null): string {
  if (seconds == null || !Number.isFinite(seconds) || seconds < 0) return "--:--";
  return formatPlayback(seconds);
}

function PlayIcon() {
  return (
    <svg viewBox="0 0 20 20" className="ml-0.5 h-4 w-4 fill-current" aria-hidden>
      <path d="M6 4.2v11.6L16 10 6 4.2z" />
    </svg>
  );
}

function PauseIcon() {
  return (
    <svg viewBox="0 0 20 20" className="h-4 w-4 fill-current" aria-hidden>
      <path d="M5 4h3.2v12H5V4zm6.8 0H15v12h-3.2V4z" />
    </svg>
  );
}

function VolumeIcon({ muted }: { muted: boolean }) {
  return (
    <svg viewBox="0 0 20 20" className="h-4 w-4 fill-current" aria-hidden>
      <path d="M4 8h2.2L10 4.8v10.4L6.2 12H4V8z" />
      {muted ? <path d="M13 8.2l4 3.6m0-3.6l-4 3.6" stroke="currentColor" strokeWidth="1.4" fill="none" /> : <path d="M13 7.2a3.2 3.2 0 010 5.6M14.8 5.2a6 6 0 010 9.6" stroke="currentColor" strokeWidth="1.3" fill="none" />}
    </svg>
  );
}

export function PortfolioAudioPlayer({
  src,
  title,
  playerId,
  onReady,
  onFail,
}: {
  src: string | null;
  title: string;
  playerId: string;
  onReady?: (duration: number) => void;
  onFail?: (message: string) => void;
}) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const previousVolume = useRef(1);
  const [playing, setPlaying] = useState(false);
  const [current, setCurrent] = useState(0);
  const [duration, setDuration] = useState<number | null>(null);
  const [volume, setVolume] = useState(1);
  const [muted, setMuted] = useState(false);
  const knownDuration = duration != null && Number.isFinite(duration) && duration > 0;

  useEffect(() => {
    function onOther(event: Event) {
      const otherId = (event as CustomEvent<string>).detail;
      if (otherId !== playerId) audioRef.current?.pause();
    }
    window.addEventListener(AUDIO_PLAY_EVENT, onOther);
    return () => window.removeEventListener(AUDIO_PLAY_EVENT, onOther);
  }, [playerId]);

  if (!src) return null;

  function togglePlay() {
    const audio = audioRef.current;
    if (!audio) return;
    if (audio.paused) {
      window.dispatchEvent(new CustomEvent(AUDIO_PLAY_EVENT, { detail: playerId }));
      void audio.play().catch(() => setPlaying(false));
      return;
    }
    audio.pause();
  }

  function toggleMute() {
    const audio = audioRef.current;
    if (!audio) return;
    if (audio.muted || audio.volume === 0) {
      const restored = previousVolume.current > 0 ? previousVolume.current : 1;
      audio.muted = false;
      audio.volume = restored;
      setVolume(restored);
      setMuted(false);
      return;
    }
    previousVolume.current = audio.volume || previousVolume.current || 1;
    audio.muted = true;
    setMuted(true);
  }

  return (
    <div draggable={false} className="flex h-full w-full min-w-0 items-center gap-2 overflow-hidden rounded-lg border border-zinc-800 bg-zinc-950 px-2 py-2 sm:gap-3 sm:px-3">
      <audio
        ref={audioRef}
        key={src}
        src={src}
        preload="metadata"
        controlsList="nodownload"
        className="sr-only"
        aria-hidden
        onContextMenu={(event) => event.preventDefault()}
        onLoadedMetadata={(event) => {
          const next = event.currentTarget.duration;
          const safe = Number.isFinite(next) && next > 0 ? next : null;
          setDuration(safe);
          if (safe != null) onReady?.(safe);
        }}
        onTimeUpdate={(event) => {
          const next = event.currentTarget.currentTime;
          setCurrent(Number.isFinite(next) && next >= 0 ? next : 0);
        }}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => setPlaying(false)}
        onError={(event) => {
          const code = event.currentTarget.error?.code ?? 0;
          if (process.env.NODE_ENV === "development") {
            console.info("[portfolio-media] audio error", { code });
          }
          onFail?.("Este áudio não pôde ser reproduzido pelo navegador.");
        }}
      />
      <button
        type="button"
        className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-red-600 text-white"
        aria-label={playing ? "Pausar" : "Reproduzir"}
        onClick={togglePlay}
      >
        {playing ? <PauseIcon /> : <PlayIcon />}
      </button>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-white">{title || "Áudio"}</p>
        <input
          type="range"
          className="mt-1 h-1 w-full cursor-pointer accent-red-600 disabled:cursor-default disabled:opacity-40"
          min={0}
          max={knownDuration ? duration : 0}
          step={0.1}
          value={knownDuration ? Math.min(current, duration) : 0}
          disabled={!knownDuration}
          draggable={false}
          aria-label="Posição do áudio"
          onChange={(event) => {
            const audio = audioRef.current;
            const next = Number(event.currentTarget.value);
            if (!audio || !Number.isFinite(next)) return;
            audio.currentTime = next;
            setCurrent(next);
          }}
        />
        <div className="mt-1 flex items-center justify-between gap-2">
          <span className="shrink-0 text-[11px] tabular-nums text-zinc-400">
            {formatPlayback(Number.isFinite(current) ? current : 0)} / {formatDuration(duration)}
          </span>
          <div className="flex min-w-0 items-center gap-1">
            <button type="button" className="shrink-0 text-zinc-300" aria-label={muted ? "Ativar som" : "Silenciar"} onClick={toggleMute}>
              <VolumeIcon muted={muted || volume === 0} />
            </button>
            <input
              type="range"
              className="h-1 w-14 max-w-[28vw] cursor-pointer accent-red-600 sm:w-16"
              min={0}
              max={1}
              step={0.01}
              value={muted ? 0 : volume}
              draggable={false}
              aria-label="Volume"
              onChange={(event) => {
                const audio = audioRef.current;
                const next = Number(event.currentTarget.value);
                if (!audio || !Number.isFinite(next)) return;
                const level = Math.min(1, Math.max(0, next));
                audio.volume = level;
                audio.muted = level === 0;
                if (level > 0) previousVolume.current = level;
                setVolume(level);
                setMuted(level === 0);
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

export function PortfolioVideoFrame({
  src,
  title,
  admin = false,
  onReady,
  onFail,
}: {
  src: string | null;
  title: string;
  admin?: boolean;
  onReady?: (duration: number) => void;
  onFail?: (message: string) => void;
}) {
  const [failure, setFailure] = useState<{ src: string; message: string } | null>(null);
  const broken = Boolean(src) && failure?.src === src;

  return (
    <div className="absolute inset-0">
      {src && !broken ? (
        <video
          key={src}
          src={src}
          className="h-full w-full object-cover"
          controls
          preload="metadata"
          playsInline
          controlsList="nodownload"
          aria-label={title || "Vídeo"}
          onContextMenu={(event) => event.preventDefault()}
          onLoadedMetadata={(event) => onReady?.(event.currentTarget.duration)}
          onError={(event) => {
            const code = event.currentTarget.error?.code ?? 0;
            if (process.env.NODE_ENV === "development") {
              console.info("[portfolio-media] video error", { code });
            }
            const base = "Este vídeo não pôde ser reproduzido pelo navegador.";
            const hint = code === 3 || code === 4
              ? " Arquivo selecionado, mas o formato/codec de vídeo não é compatível com este navegador. MP4 (H.264 + AAC) costuma reproduzir melhor; MOV pode depender do navegador."
              : "";
            const message = `${base}${hint}`;
            setFailure({ src, message });
            onFail?.(message);
          }}
        />
      ) : (
        <div className="flex h-full flex-col items-center justify-center gap-2 px-6 text-center">
          {broken && admin ? (
            <p className="text-sm text-red-300">{failure?.message}</p>
          ) : (
            <>
              <span className="text-xs font-semibold uppercase tracking-[0.16em] text-red-400">Vídeo</span>
              <p className="text-sm text-zinc-300">{title || "Vídeo"}</p>
              <p className="text-xs text-zinc-500">Espaço reservado para o vídeo.</p>
            </>
          )}
        </div>
      )}
    </div>
  );
}

export function PortfolioImageFrame({
  src,
  alt,
  admin = false,
  zoom = 1,
  positionX = 0,
  positionY = 0,
  onPosition,
  onFail,
}: {
  src: string | null;
  alt: string;
  admin?: boolean;
  zoom?: number;
  positionX?: number;
  positionY?: number;
  onPosition?: (x: number, y: number) => void;
  onFail?: () => void;
}) {
  const frameRef = useRef<HTMLDivElement>(null);
  const panRef = useRef<{ x: number; y: number; positionX: number; positionY: number } | null>(null);
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const [frame, setFrame] = useState({ width: 0, height: 0 });
  const [natural, setNatural] = useState<{ src: string; width: number; height: number } | null>(null);
  const broken = Boolean(src) && failedSrc === src;
  const measured = natural && natural.src === src ? natural : null;
  const layout = src && !broken
    ? imageCoverLayout({
        frameWidth: frame.width,
        frameHeight: frame.height,
        naturalWidth: measured?.width ?? 0,
        naturalHeight: measured?.height ?? 0,
        zoom,
        positionX,
        positionY,
      })
    : null;

  useEffect(() => {
    const node = frameRef.current;
    if (!node || !src) return;
    const observer = new ResizeObserver((entries) => {
      const rect = entries[0]?.contentRect;
      if (!rect) return;
      const width = rect.width;
      const height = rect.height;
      setFrame((current) => (current.width === width && current.height === height ? current : { width, height }));
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, [src]);

  function beginPan(event: ReactPointerEvent<HTMLImageElement>) {
    if (!admin || !onPosition || event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    panRef.current = { x: event.clientX, y: event.clientY, positionX, positionY };
  }

  function movePan(event: ReactPointerEvent<HTMLImageElement>) {
    const pan = panRef.current;
    if (!pan || !layout) return;
    event.preventDefault();
    event.stopPropagation();
    const excessX = Math.max(0, layout.width - frame.width);
    const excessY = Math.max(0, layout.height - frame.height);
    const nextX = excessX > 1
      ? clampImagePosition(pan.positionX + (event.clientX - pan.x) / (excessX / 2))
      : pan.positionX;
    const nextY = excessY > 1
      ? clampImagePosition(pan.positionY + (event.clientY - pan.y) / (excessY / 2))
      : pan.positionY;
    if (nextX === positionX && nextY === positionY) return;
    onPosition?.(nextX, nextY);
  }

  return (
    <div ref={frameRef} className="absolute inset-0 overflow-hidden">
      {src && !broken ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          key={src}
          src={src}
          alt={alt}
          draggable={false}
          className={admin ? "max-w-none cursor-grab touch-none active:cursor-grabbing" : "max-w-none"}
          style={layout
            ? { position: "absolute", width: layout.width, height: layout.height, left: layout.x, top: layout.y }
            : { position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }}
          onLoad={(event) => {
            setNatural({ src, width: event.currentTarget.naturalWidth, height: event.currentTarget.naturalHeight });
          }}
          onDragStart={(event) => event.preventDefault()}
          onPointerDown={beginPan}
          onPointerMove={movePan}
          onPointerUp={() => {
            panRef.current = null;
          }}
          onPointerCancel={() => {
            panRef.current = null;
          }}
          onError={() => {
            setFailedSrc(src);
            onFail?.();
          }}
        />
      ) : (
        <div className="flex h-full items-center justify-center px-4 text-center text-sm text-zinc-400">
          {broken && admin ? "Não foi possível carregar esta imagem." : "Foto será publicada aqui."}
        </div>
      )}
    </div>
  );
}
