import { NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";
import { appointmentOperationalFilter } from "@/app/lib/appointment-operational-filter";
import {
  CALENDAR_LEGEND,
  OPERATIONAL_HOURS,
  PRODUCTION_DELIVERY_HOUR,
  computeCalendarDayStates,
} from "@/app/lib/calendar-day-state";

/**
 * API pública de disponibilidade + estado do calendário (GO-H4).
 * Frontend apenas renderiza `dayStates` / `occupiedHours`.
 */
export async function GET() {
  try {
    const [agendamentos, blocked] = await Promise.all([
      prisma.appointment.findMany({
        where: {
          ...appointmentOperationalFilter,
          status: { not: "cancelado" },
          data: { gte: new Date(new Date().getFullYear(), 0, 1) },
        },
        select: {
          data: true,
          duracaoMinutos: true,
          tipo: true,
        },
        orderBy: { data: "asc" },
      }),
      prisma.blockedTimeSlot.findMany({
        where: { ativo: true },
        select: { data: true, hora: true },
      }),
    ]);

    const agendamentosSerializados = agendamentos.map((a) => ({
      data: a.data instanceof Date ? a.data.toISOString() : a.data,
      duracaoMinutos: a.duracaoMinutos || 60,
      tipo: a.tipo || null,
    }));

    const blockedSlots = blocked.map((s) => ({
      data: s.data,
      hora: s.hora,
    }));

    const dayStates = computeCalendarDayStates({
      appointments: agendamentosSerializados,
      blockedSlots,
    });

    return NextResponse.json({
      agendamentos: agendamentosSerializados,
      blockedSlots,
      dayStates,
      operationalHours: OPERATIONAL_HOURS,
      productionDeliveryHour: PRODUCTION_DELIVERY_HOUR,
      legend: CALENDAR_LEGEND,
    });
  } catch (err: unknown) {
    console.error("Erro ao buscar disponibilidade:", err);
    return NextResponse.json(
      { error: "Erro ao buscar disponibilidade" },
      { status: 500 }
    );
  }
}
