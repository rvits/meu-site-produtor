"use client";

import { useId, useState, type ReactNode } from "react";
import { withAttachmentDisposition } from "@/app/lib/delivery-disposition";

type DeliveryDownloadLinkProps = {
  href: string;
  download?: string;
  className?: string;
  children: ReactNode;
};

/**
 * O primeiro toque só consulta a rota (probe JSON).
 * O segundo toque é um clique nativo no mesmo <a>, ainda dentro do gesto do usuário.
 * Não usa window.open nem click() sintético depois do await: o Safari bloqueia os dois.
 */
export function DeliveryDownloadLink({ href, download, className, children }: DeliveryDownloadLinkProps) {
  const statusId = useId();
  const [message, setMessage] = useState<string | null>(null);
  const [armed, setArmed] = useState(false);

  async function onClick(event: React.MouseEvent<HTMLAnchorElement>) {
    if (armed) {
      setArmed(false);
      setMessage(null);
      return;
    }
    event.preventDefault();
    setMessage(null);
    try {
      const probe = await fetch(href, { headers: { "x-delivery-probe": "1" } });
      const data = (await probe.json().catch(() => ({}))) as { error?: string; ok?: boolean };
      if (!probe.ok || !data.ok) {
        setArmed(false);
        setMessage(data.error || "Arquivo temporariamente indisponível. Tente novamente mais tarde.");
        return;
      }
      setArmed(true);
      setMessage("Arquivo disponível. Toque novamente para baixar.");
    } catch {
      setArmed(false);
      setMessage("Arquivo temporariamente indisponível. Tente novamente mais tarde.");
    }
  }

  return (
    <span className="inline-flex flex-col items-start gap-1">
      <a
        href={armed ? withAttachmentDisposition(href) : href}
        download={download}
        className={className}
        onClick={onClick}
        aria-describedby={message ? statusId : undefined}
      >
        {children}
      </a>
      {message ? (
        <p id={statusId} role="status" className="text-xs text-amber-200">
          {message}
        </p>
      ) : null}
    </span>
  );
}
