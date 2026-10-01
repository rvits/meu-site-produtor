"use client";

/**
 * Editor visual do Portfólio.
 * Os controles só aparecem para role ADMIN no cliente. A autorização real é requireAdmin() na API.
 * Salvar grava o rascunho no servidor. Publicar é a única ação que altera a versão pública.
 * O preview usa object URL na hora. O arquivo permanente sobe em seguida e só a referência entra no rascunho.
 * Redimensionar pelo teclado não está nesta versão.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/app/context/AuthContext";
import { LinkButton } from "@/components/design-system";
import {
  LOCAL_MEDIA_WARNING,
  SECTION_ORDER,
  cloneDocument,
  createBlock,
  DEFAULT_IMAGE_FRAME,
  documentHasUnpersistedMedia,
  normalizeDocument,
  samePortfolio,
  resizeColumns,
  resizeHeight,
  type BlockKind,
  type PortfolioBlock,
  type PortfolioDocument,
  type PortfolioSectionId,
  type ResizeEdge,
  type ResizeOrigin,
} from "../portfolio-data";
import { canPlayHint, type LocalMediaFile, type MediaKind } from "./PortfolioMedia";
import { PortfolioSection, type PortfolioCanvasMode } from "./PortfolioCanvas";
import { checkPortfolioFile, localMediaBlocksPublish, portfolioAccept, PORTFOLIO_STORAGE_UNAVAILABLE } from "../portfolio-media-ref";
import { uploadPortfolioFile } from "../portfolio-upload";

const UNPERSISTED_MEDIA_MESSAGE =
  "Existem arquivos de mídia que ainda não foram enviados para armazenamento permanente.";

type AdminSnapshot = {
  draft: PortfolioDocument;
  published: PortfolioDocument;
  draftVersion: number;
};

export function PortfolioExperience({ initialPublished }: { initialPublished: PortfolioDocument }) {
  const { user } = useAuth();
  const isAdmin = user?.role === "ADMIN";
  const [mode, setMode] = useState<"published" | "edit" | "preview">("published");
  const [published, setPublished] = useState<PortfolioDocument>(() => cloneDocument(initialPublished));
  const [draft, setDraft] = useState<PortfolioDocument>(() => cloneDocument(initialPublished));
  const [savedDraft, setSavedDraft] = useState<PortfolioDocument>(() => cloneDocument(initialPublished));
  const [draftVersion, setDraftVersion] = useState(0);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState<"save" | "publish" | null>(null);
  const [confirmPublish, setConfirmPublish] = useState(false);
  const [confirmLeave, setConfirmLeave] = useState(false);
  const [pendingRemove, setPendingRemove] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const [resizingId, setResizingId] = useState<string | null>(null);
  const [localMedia, setLocalMedia] = useState<Record<string, LocalMediaFile>>({});
  const [mediaNote, setMediaNote] = useState<Record<string, { error: string | null; duration: number | null }>>({});
  const localMediaRef = useRef<Record<string, LocalMediaFile>>({});
  const resizeRef = useRef<(ResizeOrigin & { id: string; sectionId: PortfolioSectionId }) | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const fileTarget = useRef<{ id: string; sectionId: PortfolioSectionId; kind: MediaKind } | null>(null);
  const busyRef = useRef(false);
  const uploadEpoch = useRef(0);
  const uploadGeneration = useRef<Record<string, number>>({});
  const uploadResult = useRef(0);

  const editing = isAdmin && mode === "edit";
  const showingDraft = isAdmin && (mode === "edit" || mode === "preview");
  const page = showingDraft ? draft : published;
  const modeRef = useRef(mode);
  modeRef.current = mode;
  const draftRef = useRef(draft);
  draftRef.current = draft;
  const localDirty = useMemo(() => !samePortfolio(draft, savedDraft), [draft, savedDraft]);
  const differsFromPublished = useMemo(() => !samePortfolio(savedDraft, published), [savedDraft, published]);
  const unpersistedMedia = useMemo(
    () => documentHasUnpersistedMedia(draft) || localMediaBlocksPublish(Object.values(localMedia)),
    [draft, localMedia]
  );
  const canSave = editing && localDirty && !busy;
  const canPublish = editing && !localDirty && differsFromPublished && !unpersistedMedia && draftVersion > 0 && !busy;

  useEffect(() => {
    const media = localMediaRef;
    return () => {
      for (const item of Object.values(media.current)) URL.revokeObjectURL(item.url);
      media.current = {};
    };
  }, []);

  function applySnapshot(snapshot: AdminSnapshot, replaceDraft: boolean) {
    const nextPublished = normalizeDocument(snapshot.published) ?? cloneDocument(snapshot.published);
    const nextDraft = normalizeDocument(snapshot.draft) ?? cloneDocument(snapshot.draft);
    setPublished(nextPublished);
    setSavedDraft(cloneDocument(nextDraft));
    setDraftVersion(snapshot.draftVersion);
    if (replaceDraft) setDraft(cloneDocument(nextDraft));
  }

  useEffect(() => {
    if (!isAdmin) return;
    let cancel = false;
    (async () => {
      try {
        const response = await fetch("/api/admin/portfolio");
        if (!response.ok || cancel || modeRef.current !== "published") return;
        const snapshot = await response.json() as AdminSnapshot;
        applySnapshot(snapshot, true);
      } catch {
        if (!cancel) setNotice("Não foi possível ler o rascunho do servidor.");
      }
    })();
    return () => {
      cancel = true;
    };
  }, [isAdmin]);

  useEffect(() => {
    let frame = 0;
    function onMove(event: PointerEvent) {
      const session = resizeRef.current;
      if (!session) return;
      const clientX = event.clientX;
      const clientY = event.clientY;
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const current = resizeRef.current;
        if (!current) return;
        if (current.edge === "left" || current.edge === "right") {
          const next = resizeColumns(current, clientX);
          setDraft((state) => {
            const item = state.sections[current.sectionId].find((block) => block.id === current.id);
            if (!item || (item.columnStart === next.columnStart && item.columnSpan === next.columnSpan && item.size === next.size)) {
              return state;
            }
            return {
              sections: {
                ...state.sections,
                [current.sectionId]: state.sections[current.sectionId].map((block) =>
                  block.id === current.id ? { ...block, ...next } : block
                ),
              },
            };
          });
          return;
        }
        const minHeight = resizeHeight(current, clientY);
        setDraft((state) => {
          const item = state.sections[current.sectionId].find((block) => block.id === current.id);
          if (!item || item.minHeight === minHeight) return state;
          return {
            sections: {
              ...state.sections,
              [current.sectionId]: state.sections[current.sectionId].map((block) =>
                block.id === current.id ? { ...block, minHeight } : block
              ),
            },
          };
        });
      });
    }
    function finish() {
      if (!resizeRef.current) return;
      resizeRef.current = null;
      setResizingId(null);
    }
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", finish);
    window.addEventListener("pointercancel", finish);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", finish);
      window.removeEventListener("pointercancel", finish);
    };
  }, []);

  useEffect(() => {
    if (!resizingId) return;
    const edge = resizeRef.current?.edge;
    const body = window.document.body;
    const previousUserSelect = body.style.userSelect;
    const previousCursor = body.style.cursor;
    body.style.userSelect = "none";
    body.style.cursor = edge === "left" || edge === "right" ? "ew-resize" : "ns-resize";
    return () => {
      body.style.userSelect = previousUserSelect;
      body.style.cursor = previousCursor;
    };
  }, [resizingId]);

  function updateBlock(sectionId: PortfolioSectionId, id: string, patch: Partial<PortfolioBlock>) {
    setDraft((current) => ({
      sections: {
        ...current.sections,
        [sectionId]: current.sections[sectionId].map((item) =>
          item.id === id ? { ...item, ...patch } : item
        ),
      },
    }));
  }

  function shiftBlock(sectionId: PortfolioSectionId, id: string, direction: -1 | 1) {
    setDraft((current) => {
      const list = [...current.sections[sectionId]];
      const index = list.findIndex((item) => item.id === id);
      const next = index + direction;
      if (index < 0 || next < 0 || next >= list.length) return current;
      const [item] = list.splice(index, 1);
      list.splice(next, 0, item);
      return { sections: { ...current.sections, [sectionId]: list } };
    });
  }

  function moveBlock(sectionId: PortfolioSectionId, fromId: string, toId: string) {
    if (fromId === toId) return;
    setDraft((current) => {
      const list = [...current.sections[sectionId]];
      const from = list.findIndex((item) => item.id === fromId);
      const to = list.findIndex((item) => item.id === toId);
      if (from < 0 || to < 0) return current;
      const [item] = list.splice(from, 1);
      list.splice(to, 0, item);
      return { sections: { ...current.sections, [sectionId]: list } };
    });
  }

  function forgetFile(id: string) {
    const previous = localMediaRef.current[id];
    if (!previous) return;
    URL.revokeObjectURL(previous.url);
    const next = { ...localMediaRef.current };
    delete next[id];
    localMediaRef.current = next;
    setLocalMedia(next);
  }

  function forgetAllFiles() {
    uploadEpoch.current += 1;
    for (const item of Object.values(localMediaRef.current)) URL.revokeObjectURL(item.url);
    localMediaRef.current = {};
    setLocalMedia({});
  }

  function uploadFailureMessage(error: unknown): string {
    const message = error instanceof Error ? error.message : "";
    if (message.includes(PORTFOLIO_STORAGE_UNAVAILABLE)) {
      return PORTFOLIO_STORAGE_UNAVAILABLE;
    }
    if (message.startsWith("Use ") || message.startsWith("O arquivo passa") || message === "Arquivo vazio.") return message;
    return "Não foi possível enviar o arquivo.";
  }

  function beginUpload(id: string) {
    const generation = (uploadGeneration.current[id] ?? 0) + 1;
    uploadGeneration.current[id] = generation;
    return { epoch: uploadEpoch.current, generation };
  }

  function uploadStillCurrent(id: string, ticket: { epoch: number; generation: number }) {
    return uploadEpoch.current === ticket.epoch && uploadGeneration.current[id] === ticket.generation;
  }

  function rememberFile(sectionId: PortfolioSectionId, id: string, kind: MediaKind, file: File) {
    const problem = checkPortfolioFile(file, kind);
    if (problem) {
      setMediaNote((current) => ({ ...current, [id]: { error: problem, duration: null } }));
      return;
    }
    const previous = localMediaRef.current[id];
    if (previous) URL.revokeObjectURL(previous.url);
    const url = URL.createObjectURL(file);
    const ticket = beginUpload(id);
    const next = {
      ...localMediaRef.current,
      [id]: { url, name: file.name, type: file.type, size: file.size, file, phase: "uploading" as const, error: null },
    };
    localMediaRef.current = next;
    setLocalMedia(next);
    setMediaNote((current) => ({ ...current, [id]: { error: null, duration: null } }));
    updateBlock(sectionId, id, {
      previewOnly: true,
      ...(kind === "image" ? DEFAULT_IMAGE_FRAME : {}),
    });
    if (process.env.NODE_ENV === "development" && (file.type.startsWith("video/") || file.type.startsWith("audio/"))) {
      const played = file.type.startsWith("audio/") ? "audio" : "video";
      console.info("[portfolio-media]", {
        name: file.name,
        type: file.type || "(sem MIME)",
        size: file.size,
        canPlayType: canPlayHint(played, file.type),
      });
    }
    void sendPortfolioFile(sectionId, id, kind, file, ticket);
  }

  function retryFile(sectionId: PortfolioSectionId, id: string, kind: MediaKind) {
    const current = localMediaRef.current[id];
    if (!current || current.phase === "uploading") return;
    const ticket = beginUpload(id);
    const next = {
      ...localMediaRef.current,
      [id]: { ...current, phase: "uploading" as const, error: null },
    };
    localMediaRef.current = next;
    setLocalMedia(next);
    updateBlock(sectionId, id, { previewOnly: true });
    void sendPortfolioFile(sectionId, id, kind, current.file, ticket);
  }

  async function sendPortfolioFile(
    sectionId: PortfolioSectionId,
    id: string,
    kind: MediaKind,
    file: File,
    ticket: { epoch: number; generation: number }
  ) {
    try {
      const media = await uploadPortfolioFile(kind, file);
      if (!uploadStillCurrent(id, ticket)) return;
      const current = localMediaRef.current[id];
      if (!current) return;
      const next = { ...localMediaRef.current, [id]: { ...current, phase: "done" as const, error: null } };
      localMediaRef.current = next;
      setLocalMedia(next);
      if (!uploadStillCurrent(id, ticket)) return;
      updateBlock(sectionId, id, { media, src: media.url, previewOnly: false });
    } catch (error) {
      if (!uploadStillCurrent(id, ticket)) return;
      const current = localMediaRef.current[id];
      if (!current) return;
      const next = {
        ...localMediaRef.current,
        [id]: { ...current, phase: "error" as const, error: uploadFailureMessage(error) },
      };
      localMediaRef.current = next;
      setLocalMedia(next);
    } finally {
      uploadResult.current += 1;
    }
  }

  function clearFile(sectionId: PortfolioSectionId, id: string) {
    beginUpload(id);
    forgetFile(id);
    updateBlock(sectionId, id, { previewOnly: false, src: null, media: null, ...DEFAULT_IMAGE_FRAME });
  }

  function addBlock(sectionId: PortfolioSectionId, kind: BlockKind) {
    setDraft((current) => ({
      sections: {
        ...current.sections,
        [sectionId]: [...current.sections[sectionId], createBlock(sectionId, kind)],
      },
    }));
  }

  function removeBlock(sectionId: PortfolioSectionId, id: string) {
    beginUpload(id);
    forgetFile(id);
    setDraft((current) => ({
      sections: {
        ...current.sections,
        [sectionId]: current.sections[sectionId].filter((item) => item.id !== id),
      },
    }));
    setPendingRemove(null);
    if (editingId === id) setEditingId(null);
  }

  async function enterEdit() {
    if (busy) return;
    setNotice(null);
    setConfirmLeave(false);
    setConfirmPublish(false);
    try {
      const response = await fetch("/api/admin/portfolio");
      if (!response.ok) {
        setNotice("Não foi possível abrir o rascunho do servidor.");
        return;
      }
      const snapshot = await response.json() as AdminSnapshot;
      applySnapshot(snapshot, true);
      forgetAllFiles();
      setMode("edit");
    } catch {
      setNotice("Não foi possível abrir o rascunho do servidor.");
    }
  }

  function leaveEdit() {
    if (localDirty) {
      setConfirmLeave(true);
      return;
    }
    setConfirmPublish(false);
    setMode("published");
  }

  function discardLocalChanges() {
    forgetAllFiles();
    setDraft(cloneDocument(savedDraft));
    setConfirmLeave(false);
    setConfirmPublish(false);
    setNotice(null);
    setMode("published");
  }

  async function saveChanges() {
    if (!canSave || busyRef.current) return;
    busyRef.current = true;
    const sentEpoch = uploadEpoch.current;
    const sentResult = uploadResult.current;
    const clean = normalizeDocument(draftRef.current);
    if (!clean) {
      busyRef.current = false;
      setNotice("Não foi possível validar as alterações.");
      return;
    }
    setBusy("save");
    setNotice(null);
    try {
      const response = await fetch("/api/admin/portfolio/draft", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ document: clean, draftVersion }),
      });
      const payload = await response.json().catch(() => null) as (AdminSnapshot & { error?: string }) | null;
      if (!response.ok || !payload || payload.draftVersion == null) {
        setNotice(payload?.error || "Não foi possível salvar as alterações.");
        return;
      }
      const uploadSettledDuringSave = uploadEpoch.current !== sentEpoch || uploadResult.current !== sentResult;
      applySnapshot(payload, !uploadSettledDuringSave);
      setNotice(documentHasUnpersistedMedia(clean) ? UNPERSISTED_MEDIA_MESSAGE : "Rascunho salvo. O site público não mudou.");
    } catch {
      setNotice("Não foi possível salvar as alterações.");
    } finally {
      busyRef.current = false;
      setBusy(null);
    }
  }

  async function publishSaved() {
    if (!canPublish || busyRef.current) return;
    busyRef.current = true;
    setBusy("publish");
    setNotice(null);
    try {
      const response = await fetch("/api/admin/portfolio/publish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ draftVersion }),
      });
      const payload = await response.json().catch(() => null) as (AdminSnapshot & { error?: string }) | null;
      if (!response.ok || !payload || !payload.published) {
        setNotice(payload?.error || "Não foi possível publicar.");
        return;
      }
      applySnapshot(payload, true);
      setConfirmPublish(false);
      setMode("published");
      setNotice("Portfólio publicado.");
    } catch {
      setNotice("Não foi possível publicar.");
    } finally {
      busyRef.current = false;
      setBusy(null);
    }
  }

  function beginResize(
    sectionId: PortfolioSectionId,
    item: PortfolioBlock,
    edge: ResizeEdge,
    event: React.PointerEvent<HTMLButtonElement>
  ) {
    event.preventDefault();
    event.stopPropagation();
    const article = event.currentTarget.closest("article");
    const grid = article?.closest("[data-portfolio-grid]");
    if (!article || !grid) return;
    const gridRect = grid.getBoundingClientRect();
    const blockRect = article.getBoundingClientRect();
    const gap = Number.parseFloat(getComputedStyle(grid).columnGap) || 0;
    resizeRef.current = {
      id: item.id,
      sectionId,
      edge,
      columnStart: item.columnStart,
      columnSpan: item.columnSpan,
      gridLeft: gridRect.left,
      columnWidth: (gridRect.width - gap * 11) / 12,
      gap,
      blockLeft: blockRect.left,
      blockTop: blockRect.top,
      blockBottom: blockRect.bottom,
    };
    setResizingId(item.id);
  }

  function openFilePicker(sectionId: PortfolioSectionId, id: string, kind: MediaKind) {
    fileTarget.current = { id, sectionId, kind };
    const input = fileInputRef.current;
    if (!input) return;
    input.accept = portfolioAccept(kind);
    input.value = "";
    input.click();
  }

  function onFileChosen(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    const target = fileTarget.current;
    event.target.value = "";
    if (!file || !target) return;
    rememberFile(target.sectionId, target.id, target.kind, file);
  }

  function renderSection(sectionId: PortfolioSectionId) {
    const canvasMode: PortfolioCanvasMode = mode === "edit" ? "edit" : mode === "preview" ? "preview" : "public";
    return (
      <PortfolioSection
        sectionId={sectionId}
        blocks={page.sections[sectionId]}
        mode={canvasMode}
        localMedia={localMedia}
        mediaNote={mediaNote}
        editingId={editingId}
        pendingRemove={pendingRemove}
        dragId={dragId}
        resizingId={resizingId}
        onMoveBlock={(currentSection, fromId, toId) => {
          moveBlock(currentSection, fromId, toId);
          setDragId(null);
        }}
        onShiftBlock={shiftBlock}
        onPatchBlock={updateBlock}
        onResizeStart={beginResize}
        onDragId={setDragId}
        onEditingId={setEditingId}
        onPendingRemove={setPendingRemove}
        onRemoveBlock={removeBlock}
        onBrowse={openFilePicker}
        onFile={rememberFile}
        onRetryFile={retryFile}
        onClearFile={clearFile}
        onMediaReady={(id, duration, type) => {
          if (process.env.NODE_ENV === "development") {
            console.info("[portfolio-media] loadedmetadata", { id, duration, type });
          }
          setMediaNote((current) => ({ ...current, [id]: { error: null, duration } }));
        }}
        onMediaFail={(id, message, type) => {
          if (process.env.NODE_ENV === "development") {
            console.info("[portfolio-media] error", { id, type, message });
          }
          setMediaNote((current) => ({ ...current, [id]: { error: message, duration: current[id]?.duration ?? null } }));
        }}
      />
    );
  }

  function addButtons(sectionId: PortfolioSectionId) {
    if (!editing) return null;
    const kinds: Array<{ kind: BlockKind; label: string }> = [
      { kind: "title", label: "+ Título" },
      { kind: "text", label: "+ Texto" },
      { kind: "image", label: "+ Foto" },
      { kind: "audio", label: "+ Áudio" },
      { kind: "video", label: "+ Vídeo" },
    ];
    return (
      <div className="mt-6 flex flex-wrap gap-2">
        {kinds.map((item) => (
          <button key={item.kind} type="button" className="rounded-full border border-zinc-600 px-3 py-1 text-xs text-zinc-200" onClick={() => addBlock(sectionId, item.kind)}>
            {item.label}
          </button>
        ))}
      </div>
    );
  }

  return (
    <>
      <div className="fixed inset-0 z-0 bg-black" aria-hidden />
      <input ref={fileInputRef} type="file" className="hidden" tabIndex={-1} onChange={onFileChosen} />
      <main className="relative z-10 mx-auto max-w-6xl overflow-x-hidden px-4 py-8 text-zinc-100 sm:px-6 sm:py-12">
        {isAdmin ? (
          <div className="mb-8 flex flex-wrap items-center gap-3 rounded-lg border border-zinc-700 bg-black px-4 py-3 text-sm">
            <span className={localDirty ? "text-red-400" : "text-zinc-300"}>
              {localDirty ? "Alterações não salvas" : differsFromPublished ? "Rascunho salvo" : "Publicado"}
            </span>
            {mode === "published" ? (
              <button type="button" className="rounded-full bg-red-600 px-3 py-1 text-white" onClick={enterEdit}>
                Editar página
              </button>
            ) : null}
            {mode === "edit" ? (
              <>
                <button type="button" className="rounded-full border border-zinc-600 px-3 py-1" onClick={() => { setConfirmPublish(false); setConfirmLeave(false); setMode("preview"); }}>Visualizar</button>
                <button type="button" className="rounded-full border border-zinc-600 px-3 py-1 disabled:cursor-not-allowed disabled:opacity-40" disabled={!canSave} onClick={saveChanges}>
                  {busy === "save" ? "Salvando…" : "Salvar alterações"}
                </button>
                <button
                  type="button"
                  className="rounded-full border border-zinc-600 px-3 py-1 disabled:cursor-not-allowed disabled:opacity-40"
                  disabled={!canPublish}
                  title={unpersistedMedia ? UNPERSISTED_MEDIA_MESSAGE : localDirty ? "Salve as alterações antes de publicar." : undefined}
                  onClick={() => setConfirmPublish(true)}
                >
                  {busy === "publish" ? "Publicando…" : "Publicar"}
                </button>
                <button type="button" className="rounded-full border border-zinc-600 px-3 py-1" onClick={leaveEdit}>Sair da edição</button>
              </>
            ) : null}
            {mode === "preview" ? (
              <>
                <span className="text-xs text-zinc-400">Pré-visualização do rascunho. O público ainda vê a versão publicada.</span>
                <button type="button" className="rounded-full border border-zinc-600 px-3 py-1" onClick={() => setMode("edit")}>Voltar à edição</button>
              </>
            ) : null}
            {confirmPublish ? (
              <div className="w-full rounded border border-zinc-700 p-3 text-xs text-zinc-300">
                <p>Publicar alterações do Portfólio?</p>
                <p className="mt-1">Após publicar, esta versão ficará visível para todos os visitantes e usuários.</p>
                <div className="mt-2 flex flex-wrap gap-3">
                  <button type="button" onClick={() => setConfirmPublish(false)} disabled={busy === "publish"}>Cancelar</button>
                  <button type="button" className="text-red-300" onClick={publishSaved} disabled={!canPublish}>
                    {busy === "publish" ? "Publicando…" : "Publicar"}
                  </button>
                </div>
              </div>
            ) : null}
            {confirmLeave ? (
              <div className="w-full rounded border border-zinc-700 p-3 text-xs text-zinc-300">
                <p>Existem alterações não salvas.</p>
                <div className="mt-2 flex flex-wrap gap-3">
                  <button type="button" onClick={() => setConfirmLeave(false)}>Continuar editando</button>
                  <button type="button" className="text-red-300" onClick={discardLocalChanges}>Descartar alterações</button>
                </div>
              </div>
            ) : null}
          </div>
        ) : null}
        {editing ? <p className="mb-6 text-sm text-zinc-400">{LOCAL_MEDIA_WARNING}</p> : null}
        {editing && unpersistedMedia ? <p className="mb-6 text-sm text-zinc-400">{UNPERSISTED_MEDIA_MESSAGE}</p> : null}
        {notice && isAdmin ? <p className="mb-6 text-sm text-zinc-400">{notice}</p> : null}

        <section>
          <h2 className="sr-only">Apresentação</h2>
          {renderSection("hero")}
          {addButtons("hero")}
        </section>

        <section className="mt-16 space-y-10">
          <h2 className="text-2xl font-semibold text-red-400 sm:text-3xl">Projetos Concluídos</h2>
          <div className="space-y-6">
            <h3 className="text-lg font-semibold uppercase tracking-[0.12em]">Autorais</h3>
            {SECTION_ORDER.filter((section) => section.group === "autorais").map((section) => (
              <section key={section.id}>
                <h4 className="mb-3 text-sm font-semibold text-zinc-200">{section.heading}</h4>
                {renderSection(section.id)}
                {addButtons(section.id)}
              </section>
            ))}
          </div>
          <div className="space-y-6">
            <h3 className="text-lg font-semibold uppercase tracking-[0.12em]">Serviços Concluídos</h3>
            {SECTION_ORDER.filter((section) => section.group === "servicos").map((section) => (
              <section key={section.id}>
                <h4 className="mb-3 text-sm font-semibold text-zinc-200">{section.heading}</h4>
                {renderSection(section.id)}
                {addButtons(section.id)}
              </section>
            ))}
          </div>
        </section>

        <section className="mt-16 rounded-lg border border-red-500/80 bg-black px-5 py-6">
          <p className="max-w-2xl text-sm leading-relaxed text-zinc-200">
            Se quiser produzir com a THouse Rec, o agendamento e o contato seguem pelas páginas do estúdio.
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            <LinkButton href="/agendamento" variant="primary">Ver agendamento</LinkButton>
            <LinkButton href="/contato" variant="outline">Entrar em contato</LinkButton>
          </div>
        </section>

        <p className="mt-10 w-full text-xs leading-relaxed text-zinc-400">
          Os conteúdos de áudio, vídeo e imagem apresentados neste portfólio são destinados exclusivamente à
          apreciação e demonstração dos trabalhos realizados. A reprodução, distribuição ou utilização sem
          autorização não é permitida e está sujeita às medidas cabíveis nos termos da legislação aplicável.{" "}
          <Link href="/termos-contratos" className="text-zinc-300 underline underline-offset-2 hover:text-red-300">
            Consulte os Termos de Uso.
          </Link>
        </p>
      </main>
    </>
  );
}
