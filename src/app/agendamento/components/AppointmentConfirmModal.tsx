"use client";

import { Button, Modal } from "@/components/design-system";
import type { AppointmentConfirmationView } from "@/app/lib/appointment-confirmation";

export function AppointmentConfirmModal({
  open,
  draft,
  confirming = false,
  onBack,
  onConfirm,
}: {
  open: boolean;
  draft: AppointmentConfirmationView | null;
  confirming?: boolean;
  onBack: () => void;
  onConfirm: () => void;
}) {
  return (
    <Modal
      open={open && !!draft}
      onClose={onBack}
      title="CONFIRMAR AGENDAMENTO"
      footer={
        <>
          <Button type="button" variant="ghost" onClick={onBack} disabled={confirming}>
            VOLTAR
          </Button>
          <Button type="button" variant="primary" onClick={onConfirm} disabled={confirming || !draft}>
            CONFIRMAR E CONTINUAR
          </Button>
        </>
      }
    >
      {draft && (
        <div className="space-y-3 text-sm text-zinc-200">
          <p>
            <span className="text-zinc-400">Serviço: </span>
            {draft.serviceName}
          </p>
          <p>
            <span className="text-zinc-400">Data: </span>
            {draft.dateLabel}
          </p>
          {draft.hourLabel != null && (
            <p>
              <span className="text-zinc-400">Horário: </span>
              {draft.hourLabel}
            </p>
          )}
          <p>
            <span className="text-zinc-400">Valor: </span>
            {draft.valueLabel}
          </p>
          <p className="pt-2 text-zinc-300 leading-relaxed">{draft.question}</p>
        </div>
      )}
    </Modal>
  );
}
