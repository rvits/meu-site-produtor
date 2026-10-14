/**
 * Estado do player visual de entregas.
 * Não busca bytes, não assina URL e não escolhe a key do arquivo.
 *
 * Vários players na mesma página: o que começa a tocar emite
 * `thouse-delivery-audio-play`. Os outros pausam o próprio elemento.
 * O player do portfólio usa outro evento e não entra aqui.
 */

export const DELIVERY_AUDIO_PLAY_EVENT = "thouse-delivery-audio-play";
export const DELIVERY_AUDIO_UNAVAILABLE = "Áudio temporariamente indisponível.";
export const UNKNOWN_PLAYBACK_TIME = "--:--";
export const SEEK_STEP_SECONDS = 5;

export type DeliveryAudioPlayDetail = { id: string };

export type DeliveryPlayerState = {
  current: number;
  duration: number | null;
  playing: boolean;
  waiting: boolean;
  error: boolean;
  muted: boolean;
  volume: number;
  remembered: number;
};

export const INITIAL_DELIVERY_PLAYER: DeliveryPlayerState = {
  current: 0,
  duration: null,
  playing: false,
  waiting: false,
  error: false,
  muted: false,
  volume: 1,
  remembered: 1,
};

export type DeliveryPlayerEvent =
  | { type: "loadedmetadata" | "durationchange"; duration: number }
  | { type: "timeupdate"; current: number }
  | { type: "play" }
  | { type: "pause" }
  | { type: "waiting" }
  | { type: "playing" }
  | { type: "ended" }
  | { type: "error" }
  | { type: "volumechange"; volume: number; muted: boolean }
  | { type: "seeking" | "seeked"; current: number }
  | { type: "canplay" }
  | { type: "src" }
  | { type: "seek"; ratio: number }
  | { type: "step"; delta: number }
  | { type: "toggle-mute" }
  | { type: "set-volume"; volume: number };

export type DeliveryPlayerKeyAction = "toggle" | "back" | "forward" | "mute";

export function knownDuration(value: number | null | undefined): number | null {
  if (value == null || !Number.isFinite(value) || value <= 0) return null;
  return value;
}

export function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(1, Math.max(0, value));
}

export function clampVolume(value: number): number {
  if (!Number.isFinite(value)) return 1;
  return Math.min(1, Math.max(0, value));
}

export function formatPlaybackTime(seconds: number | null | undefined): string {
  if (seconds == null || !Number.isFinite(seconds) || seconds < 0) return UNKNOWN_PLAYBACK_TIME;
  const total = Math.floor(seconds);
  const hours = Math.floor(total / 3600);
  const mins = Math.floor((total % 3600) / 60);
  const secs = total % 60;
  const pad = (value: number) => String(value).padStart(2, "0");
  if (hours > 0) return `${hours}:${pad(mins)}:${pad(secs)}`;
  return `${mins}:${pad(secs)}`;
}

/** Antes dos metadados, 0:00 sugeriria uma duração real. */
export function formatPlaybackClock(current: number, duration: number | null): string {
  if (duration == null && (!Number.isFinite(current) || current <= 0)) return UNKNOWN_PLAYBACK_TIME;
  return formatPlaybackTime(current);
}

export function seekRatio(clientX: number, rect: { left: number; width: number }): number {
  if (!(rect.width > 0) || !Number.isFinite(clientX)) return 0;
  return clamp01((clientX - rect.left) / rect.width);
}

export function seekRatioToTime(ratio: number, duration: number | null): number {
  const known = knownDuration(duration);
  if (known == null) return 0;
  return clamp01(ratio) * known;
}

export function stepPlaybackTime(current: number, delta: number, duration: number | null): number | null {
  const known = knownDuration(duration);
  if (known == null || !Number.isFinite(delta)) return null;
  const base = Number.isFinite(current) && current > 0 ? current : 0;
  return Math.min(known, Math.max(0, base + delta));
}

export function playbackProgress(current: number, duration: number | null): number {
  const known = knownDuration(duration);
  if (known == null) return 0;
  return clamp01(current / known);
}

export function nextVolumeState(
  current: { volume: number; muted: boolean; remembered: number },
  action: { type: "toggle-mute" } | { type: "set-volume"; volume: number },
): { volume: number; muted: boolean; remembered: number } {
  if (action.type === "set-volume") {
    const volume = clampVolume(action.volume);
    return {
      volume,
      muted: volume === 0,
      remembered: volume > 0 ? volume : current.remembered,
    };
  }
  if (current.muted || current.volume === 0) {
    const volume = current.remembered > 0 ? current.remembered : 1;
    return { volume, muted: false, remembered: volume };
  }
  const remembered = current.volume > 0 ? current.volume : current.remembered;
  return { volume: current.volume, muted: true, remembered };
}

export function reduceDeliveryPlayer(state: DeliveryPlayerState, event: DeliveryPlayerEvent): DeliveryPlayerState {
  switch (event.type) {
    case "loadedmetadata":
    case "durationchange":
      return { ...state, duration: knownDuration(event.duration) };
    case "timeupdate":
      if (!Number.isFinite(event.current) || event.current < 0) return state;
      return { ...state, current: event.current };
    case "play":
      return { ...state, playing: true, error: false };
    case "pause":
      return { ...state, playing: false, waiting: false };
    case "waiting":
      return { ...state, waiting: true };
    case "playing":
      return { ...state, playing: true, waiting: false, error: false };
    case "ended":
      return { ...state, playing: false, waiting: false };
    case "error":
      return { ...state, playing: false, waiting: false, error: true };
    case "volumechange": {
      const volume = clampVolume(event.volume);
      return {
        ...state,
        volume,
        muted: event.muted || volume === 0,
        remembered: volume > 0 ? volume : state.remembered,
      };
    }
    case "seeking":
    case "seeked":
      if (!Number.isFinite(event.current) || event.current < 0) return state;
      return { ...state, current: event.current, waiting: event.type === "seeking" ? state.waiting : false };
    case "canplay":
      return { ...state, waiting: false };
    case "src":
      return {
        ...INITIAL_DELIVERY_PLAYER,
        volume: state.volume,
        muted: state.muted,
        remembered: state.remembered,
      };
    case "seek": {
      if (state.duration == null) return state;
      return { ...state, current: seekRatioToTime(event.ratio, state.duration) };
    }
    case "step": {
      const next = stepPlaybackTime(state.current, event.delta, state.duration);
      if (next == null) return state;
      return { ...state, current: next };
    }
    case "toggle-mute":
      return { ...state, ...nextVolumeState(state, { type: "toggle-mute" }) };
    case "set-volume":
      return { ...state, ...nextVolumeState(state, event) };
    default:
      return state;
  }
}

export function deliveryPlayerTransportLabel(state: { playing: boolean; waiting: boolean }): string {
  if (state.waiting) return "Carregando áudio";
  if (state.playing) return "Pausar";
  return "Reproduzir";
}

export function deliveryPlayerMuteLabel(muted: boolean): string {
  return muted ? "Ativar som" : "Silenciar";
}

export function deliveryPlayerKeyAction(
  key: string,
  target: { tagName: string; inputType?: string; isContentEditable?: boolean },
): DeliveryPlayerKeyAction | null {
  const tag = target.tagName.toLowerCase();
  const inputType = (target.inputType || "").toLowerCase();
  const typing =
    target.isContentEditable === true ||
    tag === "textarea" ||
    tag === "select" ||
    (tag === "input" && inputType !== "range");
  if (typing) return null;
  const slider = tag === "input" && inputType === "range";
  const button = tag === "button";
  if (key === " " || key === "Spacebar") {
    if (button || slider) return null;
    return "toggle";
  }
  if (key === "ArrowLeft") return slider ? null : "back";
  if (key === "ArrowRight") return slider ? null : "forward";
  if (key === "m" || key === "M") return "mute";
  return null;
}

/**
 * Durante a troca de src o elemento pode emitir volumechange com o padrão do navegador.
 * Esse evento não substitui o volume que o ouvinte escolheu.
 */
export function shouldPersistVolumeEvent(appliedSrc: string | undefined, eventSrc: string | undefined): boolean {
  if (appliedSrc === undefined) return true;
  return eventSrc === appliedSrc;
}

export function shouldPauseForOtherPlayer(selfId: string, otherId: string | undefined): boolean {
  return Boolean(otherId) && otherId !== selfId;
}

export function announceDeliveryAudioPlay(id: string): void {
  if (typeof window === "undefined" || !id) return;
  window.dispatchEvent(
    new CustomEvent<DeliveryAudioPlayDetail>(DELIVERY_AUDIO_PLAY_EVENT, { detail: { id } }),
  );
}
