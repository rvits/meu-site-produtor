"use client";

/**
 * Upload novo de entrega vai direto ao R2.
 * PREPARE → PUT com o target do servidor → CONFIRM → PATCH com a prova.
 * A URL assinada não entra em state, localStorage, banco nem log.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { DELIVERY_MAX_BYTES } from "@/app/lib/delivery-access";
import { deliveryDisplayName } from "@/app/lib/delivery-url-validation";
import type { AdminService } from "./types";
import { StatusBadge } from "./Badges";
import { Icons, formatBytes, formatDateTime, serviceTypeLabel } from "./meta";
import { Spinner } from "./States";

const ALLOWED = ["wav", "mp3", "zip"] as const;
type Formato = (typeof ALLOWED)[number];

const SAFE_ERRORS = new Set([
  "Formato de arquivo não suportado.",
  "O arquivo excede o limite permitido.",
  "Não foi possível enviar o arquivo. Tente novamente.",
  "Não foi possível confirmar o arquivo enviado. Tente novamente.",
]);

const CANONICAL_MIME: Record<Formato, string> = {
  wav: "audio/wav",
  mp3: "audio/mpeg",
  zip: "application/zip",
};

interface UploadedInfo {
  reference: string;
  commitToken: string;
  formato: Formato;
  fileName: string;
  size: number;
  mime: string;
  previewUrl: string | null;
}

interface UploadTarget {
  url: string;
  method: "PUT";
  headers: Record<string, string>;
  expiresIn: number;
}

function publicError(value: unknown, fallback: string): string {
  return typeof value === "string" && SAFE_ERRORS.has(value) ? value : fallback;
}

function isUploadTarget(value: unknown): value is UploadTarget {
  if (!value || typeof value !== "object") return false;
  const target = value as Record<string, unknown>;
  if (typeof target.url !== "string" || target.method !== "PUT") return false;
  if (!target.headers || typeof target.headers !== "object") return false;
  const headers = target.headers as Record<string, unknown>;
  return typeof headers["Content-Type"] === "string" && typeof headers["x-amz-meta-kind"] === "string";
}

export function DeliveryModal({
  service,
  onClose,
  onSaved,
}: {
  service: AdminService;
  onClose: () => void;
  onSaved: () => Promise<void> | void;
}) {
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploaded, setUploaded] = useState<UploadedInfo | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const previewRef = useRef<string | null>(null);

  const releasePreview = useCallback((url: string | null) => {
    if (url) URL.revokeObjectURL(url);
    if (previewRef.current === url) previewRef.current = null;
  }, []);

  useEffect(() => {
    return () => {
      if (previewRef.current) URL.revokeObjectURL(previewRef.current);
    };
  }, []);

  const clearUploaded = useCallback(() => {
    setUploaded((current) => {
      if (current?.previewUrl) releasePreview(current.previewUrl);
      return null;
    });
  }, [releasePreview]);

  const doUpload = useCallback(
    async (file: File) => {
      setError(null);
      const ext = (file.name.split(".").pop() || "").toLowerCase();
      if (!ALLOWED.includes(ext as Formato)) {
        setError("Formato de arquivo não suportado.");
        return;
      }
      if (file.size <= 0) {
        setError("Formato de arquivo não suportado.");
        return;
      }
      if (file.size > DELIVERY_MAX_BYTES) {
        setError("O arquivo excede o limite permitido.");
        return;
      }

      setUploading(true);
      clearUploaded();
      let previewUrl: string | null = null;
      try {
        const prepareRes = await fetch("/api/admin/servicos/upload-entrega/prepare", {
          method: "POST",
          credentials: "same-origin",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ fileName: file.name, size: file.size }),
        });
        const prepared = (await prepareRes.json().catch(() => null)) as {
          error?: unknown;
          reference?: unknown;
          upload?: unknown;
          uploadToken?: unknown;
        } | null;
        if (!prepareRes.ok || !prepared || !isUploadTarget(prepared.upload) || typeof prepared.uploadToken !== "string") {
          setError(publicError(prepared?.error, "Não foi possível enviar o arquivo. Tente novamente."));
          return;
        }
        const upload = prepared.upload;
        const uploadToken = prepared.uploadToken;

        const putRes = await fetch(upload.url, {
          method: upload.method,
          headers: upload.headers,
          body: file,
        });
        if (!putRes.ok) {
          setError("Não foi possível enviar o arquivo. Tente novamente.");
          return;
        }

        const confirmRes = await fetch("/api/admin/servicos/upload-entrega/confirm", {
          method: "POST",
          credentials: "same-origin",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ uploadToken }),
        });
        const confirmed = (await confirmRes.json().catch(() => null)) as {
          error?: unknown;
          deliveryAudioUrl?: unknown;
          deliveryAudioFormat?: unknown;
          commitToken?: unknown;
        } | null;
        const formato = confirmed?.deliveryAudioFormat;
        if (
          !confirmRes.ok ||
          !confirmed ||
          typeof confirmed.deliveryAudioUrl !== "string" ||
          typeof confirmed.commitToken !== "string" ||
          (formato !== "wav" && formato !== "mp3" && formato !== "zip")
        ) {
          setError(publicError(confirmed?.error, "Não foi possível confirmar o arquivo enviado. Tente novamente."));
          return;
        }

        previewUrl = URL.createObjectURL(file);
        previewRef.current = previewUrl;
        setUploaded({
          reference: confirmed.deliveryAudioUrl,
          commitToken: confirmed.commitToken,
          formato,
          fileName: file.name,
          size: file.size,
          mime: CANONICAL_MIME[formato],
          previewUrl,
        });
      } catch {
        if (previewUrl) releasePreview(previewUrl);
        setError("Não foi possível enviar o arquivo. Tente novamente.");
      } finally {
        setUploading(false);
      }
    },
    [clearUploaded, releasePreview]
  );

  async function salvar() {
    if (!uploaded) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/servicos?id=${encodeURIComponent(service.id)}`, {
        method: "PATCH",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: "concluido",
          deliveryAudioUrl: uploaded.reference,
          deliveryAudioFormat: uploaded.formato,
          deliveryCommitToken: uploaded.commitToken,
        }),
      });
      const data = (await res.json().catch(() => null)) as { error?: unknown } | null;
      if (!res.ok) {
        setError(publicError(data?.error, "Não foi possível confirmar o arquivo enviado. Tente novamente."));
        return;
      }
      await onSaved();
      onClose();
    } catch {
      setError("Não foi possível confirmar o arquivo enviado. Tente novamente.");
    } finally {
      setSaving(false);
    }
  }

  const isAudioPreview = Boolean(uploaded && uploaded.formato !== "zip" && uploaded.previewUrl);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !uploading && !saving) onClose();
      }}
    >
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-zinc-700 bg-zinc-900 shadow-2xl">
        <div className="flex items-center justify-between border-b border-zinc-800 px-5 py-4">
          <h2 className="flex items-center gap-2 text-base font-bold text-zinc-100">
            <Icons.upload className="w-4 h-4 text-green-400" />
            Entregar Serviço
          </h2>
          <button
            type="button"
            onClick={onClose}
            disabled={uploading || saving}
            className="rounded-lg p-1.5 text-zinc-500 transition-colors hover:bg-zinc-800 hover:text-zinc-200 disabled:opacity-40"
            aria-label="Fechar"
          >
            <Icons.x className="w-4 h-4" />
          </button>
        </div>

        <div className="grid grid-cols-2 gap-3 border-b border-zinc-800 px-5 py-4 text-xs">
          <div>
            <p className="text-[10px] uppercase tracking-wide text-zinc-500">Cliente</p>
            <p className="font-medium text-zinc-200">{service.user.nomeArtistico}</p>
            <p className="text-[11px] text-zinc-500">{service.user.email}</p>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-wide text-zinc-500">Serviço</p>
            <p className="font-medium text-zinc-200">{serviceTypeLabel(service.tipo)}</p>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-wide text-zinc-500">Agendamento</p>
            <p className="text-zinc-300">
              {service.appointment
                ? `#${service.appointment.id} · ${formatDateTime(service.appointment.data)}`
                : "—"}
            </p>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-wide text-zinc-500">Status</p>
            <StatusBadge status={service.status} className="mt-0.5" />
          </div>
          {service.deliveryAudioUrl && !uploaded && (
            <div className="col-span-2">
              <p className="text-[10px] uppercase tracking-wide text-zinc-500">Arquivo atual</p>
              <p className="truncate text-zinc-300">{deliveryDisplayName(service.deliveryAudioUrl)}</p>
            </div>
          )}
        </div>

        <div className="px-5 py-4">
          {!uploaded ? (
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setDragOver(true);
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragOver(false);
                const file = e.dataTransfer.files?.[0];
                if (file && !uploading) void doUpload(file);
              }}
              className={`flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed px-6 py-10 text-center transition-colors ${
                dragOver
                  ? "border-green-500/70 bg-green-500/5"
                  : "border-zinc-700 bg-zinc-800/40 hover:border-zinc-500"
              }`}
            >
              {uploading ? (
                <>
                  <Spinner className="w-7 h-7 text-green-400" />
                  <p className="text-sm font-medium text-zinc-200">Enviando arquivo…</p>
                </>
              ) : (
                <>
                  <span className="rounded-full border border-zinc-700 bg-zinc-800 p-3 text-zinc-400">
                    <Icons.upload className="w-6 h-6" />
                  </span>
                  <div>
                    <p className="text-sm font-medium text-zinc-200">
                      Arraste o arquivo aqui ou{" "}
                      <button
                        type="button"
                        onClick={() => inputRef.current?.click()}
                        className="text-green-400 underline-offset-2 hover:underline"
                      >
                        selecione
                      </button>
                    </p>
                    <p className="mt-1 text-xs text-zinc-500">WAV, MP3 ou ZIP · até 80MB</p>
                  </div>
                </>
              )}
              <input
                ref={inputRef}
                type="file"
                accept=".wav,.mp3,.zip,audio/wav,audio/mpeg,application/zip"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) void doUpload(file);
                  e.target.value = "";
                }}
              />
            </div>
          ) : (
            <div className="space-y-3 rounded-xl border border-green-500/30 bg-green-500/5 p-4">
              <p className="flex items-center gap-2 text-sm font-semibold text-green-300">
                <Icons.checkCircle className="w-4 h-4" />
                Arquivo enviado
              </p>
              <div className="flex items-start gap-3">
                <span className="rounded-lg border border-zinc-700 bg-zinc-800 p-2 text-purple-300">
                  {uploaded.formato === "zip" ? <Icons.file className="w-5 h-5" /> : <Icons.music className="w-5 h-5" />}
                </span>
                <div className="min-w-0 text-xs">
                  <p className="truncate font-medium text-zinc-200">{uploaded.fileName}</p>
                  <p className="text-zinc-500">
                    {formatBytes(uploaded.size)} · {uploaded.mime} · {uploaded.formato.toUpperCase()}
                  </p>
                </div>
              </div>
              {isAudioPreview && uploaded.previewUrl && (
                <audio controls preload="metadata" className="h-9 w-full" src={uploaded.previewUrl}>
                  Seu navegador não reproduz áudio.
                </audio>
              )}
              <div className="flex flex-wrap gap-2 pt-1">
                {uploaded.previewUrl && (
                  <a
                    href={uploaded.previewUrl}
                    download={uploaded.fileName}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-600 px-2.5 py-1.5 text-xs font-medium text-zinc-200 transition-colors hover:border-zinc-400"
                  >
                    <Icons.download className="w-3 h-3" />
                    Download
                  </a>
                )}
                <button
                  type="button"
                  onClick={() => inputRef.current?.click()}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-600 px-2.5 py-1.5 text-xs font-medium text-zinc-200 transition-colors hover:border-zinc-400"
                >
                  <Icons.refresh className="w-3 h-3" />
                  Substituir arquivo
                </button>
                <button
                  type="button"
                  onClick={clearUploaded}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-red-800 px-2.5 py-1.5 text-xs font-medium text-red-300 transition-colors hover:bg-red-900/40"
                >
                  <Icons.trash className="w-3 h-3" />
                  Excluir arquivo
                </button>
              </div>
              <input
                ref={inputRef}
                type="file"
                accept=".wav,.mp3,.zip,audio/wav,audio/mpeg,application/zip"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) void doUpload(file);
                  e.target.value = "";
                }}
              />
            </div>
          )}

          {error && (
            <p className="mt-3 rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-xs text-red-300">
              {error}
            </p>
          )}
        </div>

        <div className="flex justify-end gap-2 border-t border-zinc-800 px-5 py-4">
          <button
            type="button"
            onClick={onClose}
            disabled={uploading || saving}
            className="rounded-lg border border-zinc-600 px-4 py-2 text-sm font-medium text-zinc-300 transition-colors hover:bg-zinc-800 disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={salvar}
            disabled={!uploaded || uploading || saving}
            className="inline-flex items-center gap-2 rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-green-500 disabled:opacity-50"
          >
            {saving && <Spinner className="w-3.5 h-3.5" />}
            {saving ? "Salvando…" : "Salvar entrega"}
          </button>
        </div>
      </div>
    </div>
  );
}
