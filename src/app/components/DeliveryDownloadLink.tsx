"use client";

import { useId, useRef, useState, type ReactNode } from "react";
import { withPrepareDownload } from "@/app/lib/delivery-disposition";
import {
  DELIVERY_DOWNLOAD_UNAVAILABLE,
  prepareDownloadDecision,
} from "@/app/lib/delivery-download-ui";

type DeliveryDownloadLinkProps = {
  href: string;
  className?: string;
  children: ReactNode;
};

/**
 * Um clique pede a URL assinada e dispara um <a> temporário.
 * O filename vem do Content-Disposition do R2. O atributo download
 * não é usado: o navegador o ignora em URL cross-origin.
 * A aba atual não muda e o arquivo não entra em JS.
 */
export function DeliveryDownloadLink({ href, className, children }: DeliveryDownloadLinkProps) {
  const statusId = useId();
  const busy = useRef(false);
  const [checking, setChecking] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function onClick(event: React.MouseEvent<HTMLButtonElement>) {
    event.preventDefault();
    if (busy.current) return;
    busy.current = true;
    setChecking(true);
    setMessage(null);
    try {
      const prepared = await fetch(withPrepareDownload(href), {
        method: "GET",
        credentials: "same-origin",
        cache: "no-store",
      });
      const data = (await prepared.json().catch(() => ({}))) as {
        error?: string;
        ok?: boolean;
        downloadUrl?: string;
      };
      const decision = prepareDownloadDecision(prepared.status, data);
      if (decision.action === "error") {
        setMessage(decision.message);
        return;
      }
      const link = document.createElement("a");
      link.href = decision.downloadUrl;
      link.rel = "noopener";
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch {
      setMessage(DELIVERY_DOWNLOAD_UNAVAILABLE);
    } finally {
      busy.current = false;
      setChecking(false);
    }
  }

  return (
    <span className="inline-flex flex-col items-start gap-1">
      <button
        type="button"
        className={`${className || ""} disabled:opacity-60`}
        onClick={(event) => void onClick(event)}
        disabled={checking}
        aria-busy={checking}
        aria-describedby={message ? statusId : undefined}
      >
        {children}
      </button>
      {message ? (
        <p id={statusId} role="alert" className="text-xs text-amber-200">
          {message}
        </p>
      ) : null}
    </span>
  );
}
