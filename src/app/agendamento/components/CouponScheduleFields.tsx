"use client";

/**
 * Agendamento por cupom — mesmo SchedulingCalendar do fluxo comum (GO-H4).
 */
import { couponSchedulingHintText } from "@/app/lib/scheduling-context";
import { SchedulingCalendar } from "@/app/agendamento/components/SchedulingCalendar";

export function CouponScheduleFields({
  serviceType,
  serviceName,
  dataSelecionada,
  horaSelecionada,
  onDataChange,
  onHoraChange,
}: {
  serviceType: string | null | undefined;
  serviceName?: string | null;
  dataSelecionada: string;
  horaSelecionada: string;
  onDataChange: (value: string) => void;
  onHoraChange: (value: string) => void;
}) {
  return (
    <div className="space-y-3">
      <p className="text-center text-sm leading-relaxed text-zinc-300">
        {couponSchedulingHintText(serviceType)}
      </p>
      <div className="overflow-hidden rounded-xl border border-red-500/80">
        <SchedulingCalendar
          serviceType={serviceType}
          serviceName={serviceName}
          dataSelecionada={dataSelecionada || null}
          horaSelecionada={horaSelecionada || null}
          onDataChange={(v) => onDataChange(v || "")}
          onHoraChange={(v) => onHoraChange(v || "")}
          title="Agendamento virtual"
        />
      </div>
    </div>
  );
}
