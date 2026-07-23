"use client";

/**
 * GO-03A — Modal profissional de entrega (PARTE 6).
 * Upload usa exatamente o pipeline certificado no PROMPT 01:
 * navegador → Vercel Blob (token emitido por /api/admin/servicos/upload-entrega).
 * A conclusão continua pelo PATCH /api/admin/servicos (completeService) — sem
 * nenhuma mudança de domínio.
 */
import { useCallback, useRef, useState } from "react";
import { upload } from "@vercel/blob/client";
import { deliveryDisplayName } from "@/app/lib/delivery-url-validation";
import type { AdminService } from "./types";
import { StatusBadge } from "./Badges";
import { Icons, formatBytes, formatDateTime, serviceTypeLabel } from "./meta";
import { Spinner } from "./States";

const MAX_BYTES = 80 * 1024 * 1024;
const ALLOWED = ["wav", "mp3", "zip"] as const;
type Formato = (typeof ALLOWED)[number];

interface UploadedInfo {
  url: string;
  formato: Formato;
  fileName: string;
  size: number;
  mime: string;
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
  const [progress, setProgress] = useState(0);
  const [saving, setSaving] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploaded, setUploaded] = useState<UploadedInfo | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const doUpload = useCallback(
    async (file: File) => {
      setError(null);
      const ext = (file.name.split(".").pop() || "").toLowerCase();
      if (!ALLOWED.includes(ext as Formato)) {
        setError("Formato não permitido. Use WAV, MP3 ou ZIP.");
        return;
      }
      if (file.size <= 0 || file.size > MAX_BYTES) {
        setError("Arquivo inválido ou maior que 80MB.");
        return;
      }
      setUploading(true);
      setProgress(0);
      setUploaded(null);

      const finish = (url: string) => {
        setUploaded({
          url,
          formato: (ext === "mp3" ? "mp3" : ext === "zip" ? "zip" : "wav") as Formato,
          fileName: file.name,
          size: file.size,
          mime: file.type || (ext === "zip" ? "application/zip" : `audio/${ext}`),
        });
        setProgress(100);
      };

      /** Multipart com XHR: progresso real (ideal até ~4MB no limite de body Vercel). */
      const uploadMultipart = () =>
        new Promise<string>((resolve, reject) => {
          const xhr = new XMLHttpRequest();
          xhr.open("POST", "/api/admin/servicos/upload-entrega");
          xhr.withCredentials = true;
          xhr.upload.onprogress = (ev) => {
            if (ev.lengthComputable && ev.total > 0) {
              setProgress(Math.min(99, Math.round((ev.loaded / ev.total) * 100)));
            } else if (ev.loaded > 0) {
              setProgress((p) => Math.min(90, Math.max(p, 15)));
            }
          };
          xhr.onload = () => {
            try {
              const data = JSON.parse(xhr.responseText || "{}");
              if (xhr.status >= 200 && xhr.status < 300 && data.deliveryAudioUrl) {
                resolve(String(data.deliveryAudioUrl));
              } else {
                reject(new Error(data.error || `Falha no upload (${xhr.status})`));
              }
            } catch {
              reject(new Error(`Falha no upload (${xhr.status})`));
            }
          };
          xhr.onerror = () => reject(new Error("Falha de rede no upload."));
          xhr.ontimeout = () => reject(new Error("Tempo esgotado no upload."));
          xhr.timeout = 10 * 60 * 1000;
          const fd = new FormData();
          fd.append("file", file);
          fd.append("serviceId", service.id);
          xhr.send(fd);
        });

      try {
        // Até 4MB: multipart com progresso confiável. Acima: Blob client (evita 413).
        const VERCEL_BODY_SAFE = 4 * 1024 * 1024;
        if (file.size <= VERCEL_BODY_SAFE) {
          const url = await uploadMultipart();
          finish(url);
          return;
        }

        setProgress(5);
        const safeBase = file.name
          .replace(/\.[^.]+$/, "")
          .replace(/[^a-zA-Z0-9._-]+/g, "_")
          .slice(0, 80);
        const rand = crypto.randomUUID().slice(0, 8);
        const pathname = `deliveries/${service.id.slice(0, 8)}_${Date.now()}_${rand}_${safeBase}.${ext}`;
        const blob = await upload(pathname, file, {
          access: "public",
          handleUploadUrl: "/api/admin/servicos/upload-entrega",
          clientPayload: service.id,
          multipart: true,
          onUploadProgress: ({ loaded, total, percentage }) => {
            if (typeof percentage === "number" && Number.isFinite(percentage)) {
              setProgress(Math.max(5, Math.min(99, Math.round(percentage))));
            } else if (total && total > 0) {
              setProgress(Math.max(5, Math.min(99, Math.round((loaded / total) * 100))));
            } else if (loaded > 0) {
              setProgress((p) => Math.min(90, Math.max(p, 20)));
            }
          },
        });
        finish(blob.url);
      } catch (e) {
        const msg = e instanceof Error && e.message ? e.message : "Falha no upload.";
        setError(msg.includes("Formato não permitido") ? msg : `Falha no upload. ${msg}`);
      } finally {
        setUploading(false);
      }
    },
    [service.id]
  );

  async function salvar() {
    if (!uploaded) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/servicos?id=${service.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: "concluido",
          deliveryAudioUrl: uploaded.url,
          deliveryAudioFormat: uploaded.formato,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Erro ao concluir. Verifique o arquivo.");
        return;
      }
      await onSaved();
      onClose();
    } catch {
      setError("Erro ao salvar a entrega. Tente novamente.");
    } finally {
      setSaving(false);
    }
  }

  const isAudioPreview = uploaded && uploaded.formato !== "zip";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !uploading && !saving) onClose();
      }}
    >
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-zinc-700 bg-zinc-900 shadow-2xl">
        {/* Cabeçalho */}
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

        {/* Informações */}
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

        {/* Área de upload */}
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
                  <p className="text-sm font-medium text-zinc-200">Enviando arquivo… {progress}%</p>
                  <div className="h-1.5 w-full max-w-xs overflow-hidden rounded-full bg-zinc-700">
                    <div
                      className="h-full rounded-full bg-green-500 transition-all duration-200"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
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
              {isAudioPreview && (
                <audio controls preload="metadata" className="h-9 w-full" src={uploaded.url}>
                  Seu navegador não reproduz áudio.
                </audio>
              )}
              <div className="flex flex-wrap gap-2 pt-1">
                <a
                  href={uploaded.url}
                  download={uploaded.fileName}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-600 px-2.5 py-1.5 text-xs font-medium text-zinc-200 transition-colors hover:border-zinc-400"
                >
                  <Icons.download className="w-3 h-3" />
                  Download
                </a>
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
                  onClick={() => setUploaded(null)}
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

        {/* Rodapé */}
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
