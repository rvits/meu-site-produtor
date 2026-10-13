"use client";

import { useId, useRef, useState, type ReactNode } from "react";
import { withAttachmentDisposition } from "@/app/lib/delivery-disposition";
import {
  DELIVERY_DOWNLOAD_UNAVAILABLE,
  probeDownloadDecision,
} from "@/app/lib/delivery-download-ui";

type DeliveryDownloadLinkProps = {
  href: string;
  className?: string;
  children: ReactNode;
};

const FRAME_LIFETIME_MS = 180_000;

/**
 * Um clique: probe autenticado e, se ok, navegação do download num iframe oculto.
 * A aba atual não muda. O corpo do arquivo não entra em JS nem na função da Vercel.
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
      const probe = await fetch(href, {
        method: "GET",
        credentials: "same-origin",
        cache: "no-store",
        headers: { "x-delivery-probe": "1" },
      });
      const data = (await probe.json().catch(() => ({}))) as { error?: string; ok?: boolean };
      const decision = probeDownloadDecision(probe.status, data);
      if (decision.action === "error") {
        setMessage(decision.message);
        return;
      }
      const frame = document.createElement("iframe");
      frame.tabIndex = -1;
      frame.setAttribute("aria-hidden", "true");
      frame.style.cssText =
        "position:fixed;left:-9999px;top:0;width:1px;height:1px;border:0;opacity:0;pointer-events:none";
      frame.src = withAttachmentDisposition(href);
      document.body.appendChild(frame);
      window.setTimeout(() => frame.remove(), FRAME_LIFETIME_MS);
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
