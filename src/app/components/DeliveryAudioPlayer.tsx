"use client";

/**
 * Player visual das entregas já salvas. O <audio> nativo reproduz
 * /api/entregas/<serviceId>. Não baixa o arquivo em JS.
 * O Download é o DeliveryDownloadLink já validado.
 * O último volume vem só do volumechange desse elemento e é reaplicado quando a src troca.
 */

import { useEffect, useId, useLayoutEffect, useReducer, useRef, type ReactNode } from "react";
import { DeliveryDownloadLink } from "@/app/components/DeliveryDownloadLink";
import {
  DELIVERY_AUDIO_PLAY_EVENT,
  DELIVERY_AUDIO_UNAVAILABLE,
  INITIAL_DELIVERY_PLAYER,
  SEEK_STEP_SECONDS,
  announceDeliveryAudioPlay,
  deliveryPlayerKeyAction,
  deliveryPlayerMuteLabel,
  deliveryPlayerTransportLabel,
  formatPlaybackClock,
  formatPlaybackTime,
  knownDuration,
  playbackProgress,
  reduceDeliveryPlayer,
  seekRatio,
  seekRatioToTime,
  shouldPauseForOtherPlayer,
  shouldPersistVolumeEvent,
  stepPlaybackTime,
  type DeliveryAudioPlayDetail,
} from "@/app/lib/delivery-audio-player";

export type DeliveryAudioPlayerProps = {
  src?: string | null;
  label?: string;
  /** Proxy /api/entregas/<serviceId>. O prepare do download usa esta mesma URL. */
  downloadHref?: string | null;
  /** Substitui o link real só quando o caller já tem o controle de download. */
  download?: ReactNode;
  preload?: "none" | "metadata";
  showLabel?: boolean;
  className?: string;
};

function PlayIcon() {
  return (
    <svg viewBox="0 0 24 24" className="ml-0.5 h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M8 5.5v13l11-6.5-11-6.5z" />
    </svg>
  );
}

function PauseIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
      <path d="M9 5v14M15 5v14" />
    </svg>
  );
}

function VolumeIcon({ muted }: { muted: boolean }) {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 10v4h3l4 4V6L7 10H4z" />
      {muted ? (
        <path d="M16 9.5l4 5M20 9.5l-4 5" />
      ) : (
        <path d="M16 9a3.5 3.5 0 010 6M17.8 7a6 6 0 010 10" />
      )}
    </svg>
  );
}

function DownloadIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 3v12m0 0l-4-4m4 4l4-4M4 17v2a2 2 0 002 2h12a2 2 0 002-2v-2" />
    </svg>
  );
}

function SpinnerIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4 animate-spin" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2" opacity="0.25" />
      <path d="M21 12a9 9 0 00-9-9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

const controlClass =
  "inline-flex h-8 shrink-0 items-center justify-center text-zinc-200 transition-colors hover:bg-zinc-800 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950";

export function DeliveryAudioPlayer({
  src,
  label,
  downloadHref,
  download,
  preload = "none",
  showLabel = true,
  className,
}: DeliveryAudioPlayerProps) {
  const playerId = useId();
  const audioRef = useRef<HTMLAudioElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const [state, dispatch] = useReducer(reduceDeliveryPlayer, INITIAL_DELIVERY_PLAYER);
  const volumeRef = useRef({ volume: INITIAL_DELIVERY_PLAYER.volume, muted: INITIAL_DELIVERY_PLAYER.muted });
  const appliedSrcRef = useRef<string | undefined>(undefined);
  const mediaSrc = src || undefined;
  const canDownload = Boolean(downloadHref);
  const progress = playbackProgress(state.current, state.duration);
  const transportLabel = deliveryPlayerTransportLabel(state);

  useLayoutEffect(() => {
    dispatch({ type: "src" });
    const audio = audioRef.current;
    if (!audio) {
      appliedSrcRef.current = mediaSrc;
      return;
    }
    const saved = volumeRef.current;
    appliedSrcRef.current = mediaSrc;
    audio.volume = saved.volume;
    audio.muted = saved.muted;
    if (audio.readyState >= 1) {
      dispatch({ type: "loadedmetadata", duration: audio.duration });
    }
  }, [mediaSrc]);

  useEffect(() => {
    function onOther(event: Event) {
      const otherId = (event as CustomEvent<DeliveryAudioPlayDetail>).detail?.id;
      if (!shouldPauseForOtherPlayer(playerId, otherId)) return;
      audioRef.current?.pause();
    }
    window.addEventListener(DELIVERY_AUDIO_PLAY_EVENT, onOther);
    return () => window.removeEventListener(DELIVERY_AUDIO_PLAY_EVENT, onOther);
  }, [playerId]);

  function seekAt(clientX: number) {
    const audio = audioRef.current;
    const track = trackRef.current;
    if (!audio || !track) return;
    const duration = knownDuration(audio.duration);
    if (duration == null) return;
    const ratio = seekRatio(clientX, track.getBoundingClientRect());
    const next = seekRatioToTime(ratio, duration);
    audio.currentTime = next;
    dispatch({ type: "timeupdate", current: next });
  }

  function step(delta: number) {
    const audio = audioRef.current;
    if (!audio) return;
    const next = stepPlaybackTime(audio.currentTime, delta, knownDuration(audio.duration));
    if (next == null) return;
    audio.currentTime = next;
    dispatch({ type: "timeupdate", current: next });
  }

  async function toggle() {
    const audio = audioRef.current;
    if (!audio || !mediaSrc) return;
    if (!audio.paused) {
      audio.pause();
      return;
    }
    dispatch({ type: "waiting" });
    try {
      await audio.play();
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        dispatch({ type: "pause" });
        return;
      }
      dispatch({ type: "error" });
    }
  }

  function toggleMute() {
    const audio = audioRef.current;
    if (!audio) return;
    const next = reduceDeliveryPlayer(
      { ...state, volume: audio.volume, muted: audio.muted },
      { type: "toggle-mute" },
    );
    audio.volume = next.volume;
    audio.muted = next.muted;
    dispatch({ type: "toggle-mute" });
  }

  function setVolume(raw: number) {
    const audio = audioRef.current;
    if (!audio) return;
    const next = reduceDeliveryPlayer(
      { ...state, volume: audio.volume, muted: audio.muted },
      { type: "set-volume", volume: raw },
    );
    audio.volume = next.volume;
    audio.muted = next.muted;
    dispatch({ type: "set-volume", volume: raw });
  }

  function onVolumeChange(event: React.SyntheticEvent<HTMLAudioElement>) {
    const audio = event.currentTarget;
    const eventSrc = audio.getAttribute("src") || undefined;
    if (!shouldPersistVolumeEvent(appliedSrcRef.current, eventSrc)) return;
    volumeRef.current = { volume: audio.volume, muted: audio.muted };
    dispatch({ type: "volumechange", volume: audio.volume, muted: audio.muted });
  }

  function onKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;
    const action = deliveryPlayerKeyAction(event.key, {
      tagName: target.tagName,
      inputType: target instanceof HTMLInputElement ? target.type : undefined,
      isContentEditable: target.isContentEditable,
    });
    if (!action) return;
    event.preventDefault();
    if (action === "toggle") void toggle();
    if (action === "back") step(-SEEK_STEP_SECONDS);
    if (action === "forward") step(SEEK_STEP_SECONDS);
    if (action === "mute") toggleMute();
  }

  return (
    <div
      role="group"
      tabIndex={0}
      data-delivery-player=""
      aria-label={label ? `Entrega: ${label}` : "Player de entrega"}
      title={label || undefined}
      onKeyDown={onKeyDown}
      className={`@container w-full min-w-0 rounded-xl border border-red-800/70 bg-zinc-950 px-2.5 py-2 text-zinc-100 outline-none focus-visible:ring-2 focus-visible:ring-red-500 ${className || ""}`}
    >
      <div className="flex min-w-0 items-center gap-2">
        <button
          type="button"
          className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-red-600 text-white transition-colors hover:bg-red-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950 disabled:opacity-50"
          aria-label={transportLabel}
          aria-busy={state.waiting}
          disabled={!mediaSrc}
          onClick={() => void toggle()}
        >
          {state.waiting ? <SpinnerIcon /> : state.playing ? <PauseIcon /> : <PlayIcon />}
        </button>
        <span className="w-12 shrink-0 text-center text-[11px] tabular-nums text-zinc-400">
          {formatPlaybackClock(state.current, state.duration)}
        </span>
        <div
          ref={trackRef}
          role="slider"
          tabIndex={0}
          aria-label="Posição da reprodução"
          aria-valuemin={0}
          aria-valuemax={state.duration == null ? 0 : Math.round(state.duration)}
          aria-valuenow={Math.round(state.current)}
          aria-valuetext={
            state.duration == null
              ? "Duração desconhecida"
              : `${formatPlaybackTime(state.current)} de ${formatPlaybackTime(state.duration)}`
          }
          aria-disabled={state.duration == null}
          onPointerDown={(event) => {
            if (state.duration == null) return;
            event.currentTarget.setPointerCapture(event.pointerId);
            seekAt(event.clientX);
          }}
          onPointerMove={(event) => {
            if (!event.currentTarget.hasPointerCapture(event.pointerId)) return;
            seekAt(event.clientX);
          }}
          onKeyDown={(event) => {
            if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
            event.preventDefault();
            event.stopPropagation();
            step(event.key === "ArrowLeft" ? -SEEK_STEP_SECONDS : SEEK_STEP_SECONDS);
          }}
          className="relative h-8 min-w-0 flex-1 touch-none rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
        >
          <span className="absolute inset-x-0 top-1/2 h-1 -translate-y-1/2 rounded-full bg-zinc-800" />
          <span
            className="absolute left-0 top-1/2 h-1 -translate-y-1/2 rounded-full bg-red-600"
            style={{ width: `${progress * 100}%` }}
          />
          {state.duration != null ? (
            <span
              className="absolute top-1/2 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-red-500"
              style={{ left: `${progress * 100}%` }}
            />
          ) : null}
        </div>
        <span className="w-14 shrink-0 text-center text-[11px] tabular-nums text-zinc-300">
          {formatPlaybackTime(state.duration)}
        </span>
      </div>

      <div className="mt-1 flex min-w-0 items-center gap-2">
        {showLabel && label ? (
          <p className="min-w-0 flex-1 truncate text-[11px] text-zinc-400" title={label}>
            {label}
          </p>
        ) : (
          <span className="min-w-0 flex-1" />
        )}
        <button
          type="button"
          className={controlClass + " w-8 rounded-full"}
          aria-label={deliveryPlayerMuteLabel(state.muted)}
          onClick={toggleMute}
        >
          <VolumeIcon muted={state.muted || state.volume === 0} />
        </button>
        <input
          type="range"
          min={0}
          max={1}
          step={0.05}
          value={state.muted ? 0 : state.volume}
          aria-label="Volume"
          onChange={(event) => setVolume(Number(event.currentTarget.value))}
          className="hidden h-4 w-16 shrink-0 cursor-pointer appearance-none bg-transparent @min-[400px]:block [&::-webkit-slider-runnable-track]:h-1 [&::-webkit-slider-runnable-track]:rounded-full [&::-webkit-slider-runnable-track]:bg-zinc-800 [&::-webkit-slider-thumb]:mt-[-3px] [&::-webkit-slider-thumb]:h-2.5 [&::-webkit-slider-thumb]:w-2.5 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-red-500 [&::-moz-range-track]:h-1 [&::-moz-range-track]:rounded-full [&::-moz-range-track]:bg-zinc-800 [&::-moz-range-thumb]:h-2.5 [&::-moz-range-thumb]:w-2.5 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:bg-red-500"
        />
        {download ?? (canDownload ? (
          <DeliveryDownloadLink
            href={downloadHref || ""}
            className={controlClass + " gap-1 rounded-lg px-2 text-[11px] font-medium"}
          >
            <DownloadIcon />
            Download
          </DeliveryDownloadLink>
        ) : null)}
      </div>

      {state.error ? (
        <p role="alert" className="mt-1 text-[11px] text-amber-200">
          {DELIVERY_AUDIO_UNAVAILABLE}
        </p>
      ) : null}

      <audio
        ref={audioRef}
        controls={false}
        preload={preload}
        src={mediaSrc}
        className="sr-only"
        aria-hidden="true"
        onLoadedMetadata={(event) => dispatch({ type: "loadedmetadata", duration: event.currentTarget.duration })}
        onDurationChange={(event) => dispatch({ type: "durationchange", duration: event.currentTarget.duration })}
        onTimeUpdate={(event) => dispatch({ type: "timeupdate", current: event.currentTarget.currentTime })}
        onSeeking={(event) => dispatch({ type: "seeking", current: event.currentTarget.currentTime })}
        onSeeked={(event) => dispatch({ type: "seeked", current: event.currentTarget.currentTime })}
        onPlay={() => {
          dispatch({ type: "play" });
          announceDeliveryAudioPlay(playerId);
        }}
        onPause={() => dispatch({ type: "pause" })}
        onWaiting={() => dispatch({ type: "waiting" })}
        onPlaying={() => dispatch({ type: "playing" })}
        onCanPlay={() => dispatch({ type: "canplay" })}
        onEnded={() => dispatch({ type: "ended" })}
        onError={() => dispatch({ type: "error" })}
        onVolumeChange={onVolumeChange}
      />
    </div>
  );
}
