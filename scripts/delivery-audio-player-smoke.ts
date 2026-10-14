/**
 * Player visual das entregas. Sem rede, sem banco e sem áudio real.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { DeliveryAudioPlayer } from "../src/app/components/DeliveryAudioPlayer";
import { deliveryPresentedName } from "../src/app/lib/delivery-filename";
import {
  DELIVERY_AUDIO_PLAY_EVENT,
  DELIVERY_AUDIO_UNAVAILABLE,
  INITIAL_DELIVERY_PLAYER,
  SEEK_STEP_SECONDS,
  deliveryPlayerKeyAction,
  deliveryPlayerMuteLabel,
  deliveryPlayerTransportLabel,
  formatPlaybackClock,
  formatPlaybackTime,
  playbackProgress,
  reduceDeliveryPlayer,
  seekRatio,
  seekRatioToTime,
  shouldPauseForOtherPlayer,
  shouldPersistVolumeEvent,
  stepPlaybackTime,
  type DeliveryPlayerState,
} from "../src/app/lib/delivery-audio-player";

const FIXTURE_UUID = "5288d1aa-7960-42a6-9edd-5fd2bf0bfa3f";

function must(condition: boolean, message: string) {
  if (!condition) throw new Error(message);
}

function visibleText(html: string): string {
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/&quot;/g, "\"")
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
}

function at(state: DeliveryPlayerState, patch: Partial<DeliveryPlayerState>): DeliveryPlayerState {
  return { ...state, ...patch };
}

function main() {
  assert.equal(formatPlaybackTime(null), "--:--");
  assert.equal(formatPlaybackTime(Number.NaN), "--:--");
  assert.equal(formatPlaybackTime(Number.POSITIVE_INFINITY), "--:--");
  assert.equal(formatPlaybackTime(-1), "--:--");
  assert.equal(formatPlaybackClock(0, null), "--:--");
  assert.equal(formatPlaybackTime(0), "0:00");
  assert.equal(formatPlaybackTime(32), "0:32");
  assert.equal(formatPlaybackTime(135), "2:15");
  assert.equal(formatPlaybackTime(32.9), "0:32");
  assert.equal(formatPlaybackTime(3735), "1:02:15");
  assert.equal(formatPlaybackClock(0, 135), "0:00");

  const named = deliveryPresentedName({
    originalName: `"Ao Redor"- Rvits.wav`,
    tipo: "mix",
    format: "wav",
    url: `/api/entregas/${FIXTURE_UUID}`,
  });
  const fallback = deliveryPresentedName({
    originalName: null,
    tipo: "mix",
    format: "wav",
    url: `/api/entregas/${FIXTURE_UUID}`,
  });
  assert.equal(fallback, "Mix.wav");
  must(!fallback.includes(FIXTURE_UUID), "fallback mostrou UUID");
  must(!named.includes(FIXTURE_UUID), "nome salvo mostrou UUID");

  const withName = renderToStaticMarkup(createElement(DeliveryAudioPlayer, {
    src: `/api/entregas/${FIXTURE_UUID}`,
    label: named,
    downloadHref: `/api/entregas/${FIXTURE_UUID}`,
    preload: "none",
  }));
  const withFallback = renderToStaticMarkup(createElement(DeliveryAudioPlayer, {
    src: `/api/entregas/${FIXTURE_UUID}`,
    label: fallback,
    downloadHref: `/api/entregas/${FIXTURE_UUID}`,
    preload: "none",
  }));
  must(visibleText(withName).includes(named), "render não mostrou o nome");
  must(visibleText(withFallback).includes("Mix.wav"), "render não mostrou o fallback");
  must(!visibleText(withName).includes(FIXTURE_UUID), "UUID apareceu como texto");
  must(!visibleText(withFallback).includes(FIXTURE_UUID), "UUID apareceu no fallback");
  must(withFallback.includes(`src="/api/entregas/${FIXTURE_UUID}"`), "player deixou o proxy");
  must(withFallback.includes('preload="none"'), "preload none sumiu");
  must(!withFallback.includes("controls="), "controls nativo voltou ao markup");
  must(withFallback.includes('aria-label="Reproduzir"'), "play sem nome acessível");
  must(withFallback.includes('aria-label="Posição da reprodução"'), "slider sem nome");
  must(withFallback.includes('aria-label="Volume"'), "volume sem nome");
  must(withFallback.includes('aria-label="Silenciar"'), "mute sem nome");
  must(visibleText(withFallback).includes("Download"), "download não aparece");
  must(visibleText(withFallback).includes("--:--"), "duração desconhecida virou 0:00");
  must(!visibleText(withFallback).includes("0:00"), "relógio inicial enganoso");
  must(withFallback.includes("w-full") && withFallback.includes("min-w-0"), "player sem largura fluida");
  must(withFallback.includes("truncate"), "nome não trunca");
  must(withFallback.includes("@container"), "player sem container");
  must(withFallback.includes("@min-[400px]:block"), "volume não se adapta ao espaço");
  must((withFallback.match(/data-delivery-player/g) || []).length === 1, "raiz do player ausente");

  const localPreview = renderToStaticMarkup(createElement(DeliveryAudioPlayer, {
    src: "blob:http://local/preview",
    label: "faixa.wav",
    preload: "metadata",
    showLabel: false,
  }));
  must(!localPreview.includes("Download"), "preview local ganhou download de entrega");
  must(!localPreview.includes("/api/entregas"), "preview chamou o proxy");
  must(localPreview.includes('preload="metadata"'), "preview não pede metadados");

  const pair = renderToStaticMarkup(createElement("div", null,
    createElement(DeliveryAudioPlayer, { src: "/api/entregas/a", label: "Mix.wav", downloadHref: "/api/entregas/a" }),
    createElement(DeliveryAudioPlayer, { src: "/api/entregas/b", label: "Master.wav", downloadHref: "/api/entregas/b" }),
  ));
  must((pair.match(/data-delivery-player/g) || []).length === 2, "dois players não renderizam");
  assert.equal(shouldPauseForOtherPlayer("a", "b"), true);
  assert.equal(shouldPauseForOtherPlayer("a", "a"), false);
  assert.equal(shouldPauseForOtherPlayer("a", undefined), false);
  assert.equal(shouldPauseForOtherPlayer("a", ""), false);

  let player = reduceDeliveryPlayer(INITIAL_DELIVERY_PLAYER, { type: "loadedmetadata", duration: 135 });
  assert.equal(player.duration, 135);
  assert.equal(formatPlaybackTime(player.duration), "2:15");
  player = reduceDeliveryPlayer(player, { type: "durationchange", duration: 3735 });
  assert.equal(formatPlaybackTime(player.duration), "1:02:15");
  player = reduceDeliveryPlayer(player, { type: "durationchange", duration: Number.NaN });
  assert.equal(player.duration, null);
  player = reduceDeliveryPlayer(INITIAL_DELIVERY_PLAYER, { type: "loadedmetadata", duration: 135 });

  player = reduceDeliveryPlayer(player, { type: "play" });
  assert.equal(player.playing, true);
  assert.equal(deliveryPlayerTransportLabel(player), "Pausar");
  player = reduceDeliveryPlayer(player, { type: "waiting" });
  assert.equal(player.waiting, true);
  assert.equal(deliveryPlayerTransportLabel(player), "Carregando áudio");
  player = reduceDeliveryPlayer(player, { type: "playing" });
  assert.equal(player.waiting, false);
  assert.equal(player.playing, true);
  player = reduceDeliveryPlayer(player, { type: "timeupdate", current: 32 });
  assert.equal(player.current, 32);
  assert.equal(formatPlaybackTime(player.current), "0:32");
  assert.equal(playbackProgress(player.current, player.duration), 32 / 135);

  assert.equal(seekRatio(50, { left: 0, width: 200 }), 0.25);
  assert.equal(seekRatio(-10, { left: 0, width: 200 }), 0);
  assert.equal(seekRatio(500, { left: 0, width: 200 }), 1);
  assert.equal(seekRatioToTime(0.5, null), 0);
  player = reduceDeliveryPlayer(player, { type: "seek", ratio: 0.5 });
  assert.equal(player.current, 67.5);
  player = reduceDeliveryPlayer(at(player, { duration: null }), { type: "seek", ratio: 0.5 });
  assert.equal(player.current, 67.5);
  player = reduceDeliveryPlayer(at(player, { duration: 135, current: 10 }), { type: "step", delta: SEEK_STEP_SECONDS });
  assert.equal(player.current, 15);
  player = reduceDeliveryPlayer(player, { type: "step", delta: -SEEK_STEP_SECONDS });
  assert.equal(player.current, 10);
  assert.equal(stepPlaybackTime(1, -5, 135), 0);
  assert.equal(stepPlaybackTime(10, 5, null), null);
  player = reduceDeliveryPlayer(at(player, { duration: 135, current: 10, waiting: true }), { type: "seeking", current: 20 });
  assert.equal(player.current, 20);
  assert.equal(player.waiting, true);
  player = reduceDeliveryPlayer(player, { type: "seeked", current: 21 });
  assert.equal(player.current, 21);
  assert.equal(player.waiting, false);
  player = reduceDeliveryPlayer(at(player, { waiting: true }), { type: "canplay" });
  assert.equal(player.waiting, false);
  assert.equal(shouldPersistVolumeEvent(undefined, "/api/entregas/a"), true);
  assert.equal(shouldPersistVolumeEvent("/api/entregas/a", "/api/entregas/a"), true);
  assert.equal(shouldPersistVolumeEvent("/api/entregas/a", "/api/entregas/b"), false);

  player = reduceDeliveryPlayer(player, { type: "set-volume", volume: 0.4 });
  assert.equal(player.volume, 0.4);
  assert.equal(player.muted, false);
  player = reduceDeliveryPlayer(player, { type: "toggle-mute" });
  assert.equal(player.muted, true);
  assert.equal(player.volume, 0.4);
  assert.equal(deliveryPlayerMuteLabel(true), "Ativar som");
  player = reduceDeliveryPlayer(player, { type: "toggle-mute" });
  assert.equal(player.muted, false);
  assert.equal(player.volume, 0.4);
  player = reduceDeliveryPlayer(player, { type: "set-volume", volume: 2 });
  assert.equal(player.volume, 1);
  player = reduceDeliveryPlayer(player, { type: "volumechange", volume: 0, muted: true });
  assert.equal(player.volume, 0);
  assert.equal(player.muted, true);
  assert.equal(player.remembered, 1);
  player = reduceDeliveryPlayer(player, { type: "toggle-mute" });
  assert.equal(player.muted, false);
  assert.equal(player.volume, 1);

  player = reduceDeliveryPlayer(at(player, { playing: true, current: 20, duration: 135 }), { type: "ended" });
  assert.equal(player.playing, false);
  assert.equal(player.waiting, false);
  player = reduceDeliveryPlayer(at(player, { playing: true, waiting: true }), { type: "pause" });
  assert.equal(player.playing, false);
  assert.equal(player.waiting, false);
  player = reduceDeliveryPlayer(at(player, { playing: true }), { type: "error" });
  assert.equal(player.error, true);
  assert.equal(player.playing, false);
  must(!DELIVERY_AUDIO_UNAVAILABLE.toLowerCase().includes("perdido"), "erro fala em arquivo perdido");
  must(!DELIVERY_AUDIO_UNAVAILABLE.toLowerCase().includes("não encontrado"), "erro trata indisponibilidade como ausência");

  const remembered = player.volume;
  player = reduceDeliveryPlayer(at(player, { playing: true, waiting: true, error: true, current: 40, duration: 90, volume: 0.25, muted: true, remembered: 0.25 }), { type: "src" });
  assert.equal(player.current, 0);
  assert.equal(player.duration, null);
  assert.equal(player.playing, false);
  assert.equal(player.waiting, false);
  assert.equal(player.error, false);
  assert.equal(player.volume, 0.25);
  assert.equal(player.muted, true);
  assert.notEqual(player.volume, remembered);

  assert.equal(deliveryPlayerKeyAction(" ", { tagName: "div" }), "toggle");
  assert.equal(deliveryPlayerKeyAction("ArrowLeft", { tagName: "div" }), "back");
  assert.equal(deliveryPlayerKeyAction("ArrowRight", { tagName: "div" }), "forward");
  assert.equal(deliveryPlayerKeyAction("m", { tagName: "div" }), "mute");
  assert.equal(deliveryPlayerKeyAction("M", { tagName: "div" }), "mute");
  assert.equal(deliveryPlayerKeyAction(" ", { tagName: "button" }), null);
  assert.equal(deliveryPlayerKeyAction("ArrowRight", { tagName: "button" }), "forward");
  assert.equal(deliveryPlayerKeyAction("ArrowLeft", { tagName: "input", inputType: "range" }), null);
  assert.equal(deliveryPlayerKeyAction("m", { tagName: "input", inputType: "range" }), "mute");
  assert.equal(deliveryPlayerKeyAction(" ", { tagName: "input", inputType: "text" }), null);
  assert.equal(deliveryPlayerKeyAction("ArrowLeft", { tagName: "textarea" }), null);
  assert.equal(deliveryPlayerKeyAction("m", { tagName: "div", isContentEditable: true }), null);
  assert.equal(deliveryPlayerKeyAction("k", { tagName: "div" }), null);
  assert.equal(SEEK_STEP_SECONDS, 5);

  const playerSource = readFileSync("src/app/components/DeliveryAudioPlayer.tsx", "utf8");
  const logicSource = readFileSync("src/app/lib/delivery-audio-player.ts", "utf8");
  must(playerSource.includes("controls={false}"), "audio segue com controls nativo");
  must(playerSource.includes("DeliveryDownloadLink"), "download foi reimplementado");
  must(playerSource.includes("announceDeliveryAudioPlay"), "players não se coordenam");
  must(playerSource.includes("shouldPauseForOtherPlayer"), "pausa cruzada não consulta o id");
  must(playerSource.includes("audioRef.current?.pause()"), "outro player não pausa");
  must(playerSource.includes("DELIVERY_AUDIO_PLAY_EVENT"), "evento de coordenação ausente");
  must(logicSource.includes(`"${DELIVERY_AUDIO_PLAY_EVENT}"`), "nome do evento ausente");
  must(playerSource.includes("seekRatio"), "seek não usa a barra");
  must(playerSource.includes("stepPlaybackTime"), "teclado não avança o áudio");
  must(playerSource.includes("removeEventListener"), "listener de coordenação vaza");
  must(!playerSource.includes("fetch("), "player passou a buscar a entrega");
  must(!playerSource.includes(".blob("), "player materializa o arquivo");
  must(!playerSource.includes("createObjectURL"), "player cria object URL");
  must(!playerSource.includes("window.location"), "player navega a aba");
  must(!playerSource.includes("window.open"), "player abre popup");
  must(!playerSource.includes("AudioContext"), "player usa Web Audio");
  must(!playerSource.includes("r2.cloudflarestorage.com"), "player recebe URL assinada");
  must(!logicSource.includes("fetch(") && !logicSource.includes(".blob("), "lógica do player busca bytes");
  must(!playerSource.includes("eslint-disable"), "lint foi relaxado");
  must(playerSource.includes("shouldPersistVolumeEvent"), "volume não passa pelo evento do áudio");
  must(playerSource.includes("useLayoutEffect"), "troca de src não reaplica o volume");
  must(playerSource.includes("onSeeking") && playerSource.includes("onSeeked") && playerSource.includes("onCanPlay"), "eventos de mídia faltando");
  must(playerSource.includes("rounded-full"), "play deixou de ser circular");
  must((playerSource.match(/volumeRef\.current =/g) || []).length === 1, "volume é gravado fora do evento");

  const surfaces = [
    "src/app/admin/servicos-ui/ServiceCard.tsx",
    "src/app/admin/agendamentos-ui/AppointmentDrawer.tsx",
    "src/app/minha-conta/portal-ui/AppointmentCard.tsx",
    "src/app/minha-conta/portal-ui/DownloadsSection.tsx",
  ];
  for (const file of surfaces) {
    const source = readFileSync(file, "utf8");
    must(source.includes("DeliveryAudioPlayer"), `${file} não usa o player`);
    must(source.includes('preload="none"'), `${file} perdeu preload none`);
    must(!source.includes("<audio"), `${file} manteve o player nativo`);
    must(source.includes("deliveryPresentedName"), `${file} deixou o nome da entrega`);
  }
  const card = readFileSync("src/app/admin/servicos-ui/ServiceCard.tsx", "utf8");
  must(card.includes("src={s.deliveryAudioUrl"), "card deixou de usar o proxy");

  const modal = readFileSync("src/app/admin/servicos-ui/DeliveryModal.tsx", "utf8");
  must(!modal.includes("DeliveryAudioPlayer"), "preview do modal entrou no player de entrega");
  must(modal.includes("<audio"), "preview local perdeu o áudio nativo");
  must(modal.includes("src={uploaded.previewUrl}"), "preview deixou o object URL");
  must(modal.includes('preload="metadata"'), "preview perdeu metadata");
  must(!modal.includes("/api/entregas"), "preview chama o proxy");
  must(modal.includes("revokeObjectURL"), "modal deixou de revogar o preview");
  must(modal.includes("download={uploaded.fileName}"), "download local do modal sumiu");

  const portfolio = readFileSync("src/app/portfolio/components/PortfolioMedia.tsx", "utf8");
  must(portfolio.includes("<audio"), "portfólio perdeu o player próprio");
  must(portfolio.includes("thouse-portfolio-audio-play"), "portfólio entrou na coordenação das entregas");
  must(!portfolio.includes("DeliveryAudioPlayer"), "portfólio passou a usar o player de entrega");

  const downloadLink = readFileSync("src/app/components/DeliveryDownloadLink.tsx", "utf8");
  must(downloadLink.includes("withPrepareDownload"), "download deixou o prepare");
  must(!downloadLink.includes(".blob("), "download passou a materializar o arquivo");
  must(!downloadLink.includes("DeliveryAudioPlayer"), "download passou a depender do player");

  const route = readFileSync("src/app/api/entregas/[serviceId]/route.ts", "utf8");
  must(!route.includes("DeliveryAudioPlayer"), "endpoint passou a conhecer o player");
  must(route.includes("isPrepareDownload"), "prepare saiu da rota");
  const csp = readFileSync("next.config.ts", "utf8");
  const frameSrc = csp.split("\n").find((line) => line.includes("frame-src"));
  must(Boolean(frameSrc) && !frameSrc!.includes("r2.cloudflarestorage.com"), "frame-src passou a permitir R2");

  console.log("delivery-audio-player-smoke ok");
}

main();
