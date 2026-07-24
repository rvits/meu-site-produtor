"use client";

/**
 * Campos de data/hora reutilizados pelo agendamento por cupom (e alinhados ao comum).
 * Presencial: calendário (input date) + horários.
 * Produção: só data + mensagem de entrega desejada.
 */
import {
  PRODUCTION_DELIVERY_DATE_MESSAGE,
  SCHEDULE_HORARIOS,
  minScheduleDateIso,
  serviceNeedsStudioHours,
} from "@/app/agendamento/scheduling-shared";
import { Button, Callout, Field, Input } from "@/components/design-system";

export function CouponScheduleFields({
  serviceType,
  dataSelecionada,
  horaSelecionada,
  onDataChange,
  onHoraChange,
}: {
  serviceType: string | null | undefined;
  dataSelecionada: string;
  horaSelecionada: string;
  onDataChange: (value: string) => void;
  onHoraChange: (value: string) => void;
}) {
  const precisaHora = serviceNeedsStudioHours(serviceType);
  const minDate = minScheduleDateIso(0);

  return (
    <div className="space-y-4">
      {!precisaHora && (
        <Callout intent="info">{PRODUCTION_DELIVERY_DATE_MESSAGE}</Callout>
      )}
      <Field label={precisaHora ? "Data da sessão" : "Data de entrega desejada"}>
        <Input
          type="date"
          min={minDate}
          value={dataSelecionada}
          onChange={(e) => onDataChange(e.target.value)}
        />
      </Field>
      {precisaHora && (
        <Field label="Horário">
          <div className="grid grid-cols-3 gap-2">
            {SCHEDULE_HORARIOS.map((h) => (
              <Button
                key={h}
                type="button"
                onClick={() => onHoraChange(h)}
                variant={horaSelecionada === h ? "primary" : "outline"}
              >
                {h}
              </Button>
            ))}
          </div>
        </Field>
      )}
    </div>
  );
}
