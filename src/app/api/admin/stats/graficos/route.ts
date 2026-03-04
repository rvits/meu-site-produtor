import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";
import { requireAdmin } from "@/app/lib/auth";

type Periodo = "diario" | "semanal" | "mensal" | "anual";

function getDateRange(periodo: Periodo, mes?: string, data?: string, ano?: string) {
  const now = new Date();
  let inicio: Date;
  let fim: Date = new Date(now);

  if (periodo === "diario") {
    const d = data ? new Date(data + "T00:00:00") : now;
    inicio = new Date(d);
    inicio.setHours(0, 0, 0, 0);
    fim = new Date(d);
    fim.setHours(23, 59, 59, 999);
  } else if (periodo === "semanal") {
    fim = new Date(now);
    fim.setHours(23, 59, 59, 999);
    inicio = new Date(fim);
    inicio.setDate(inicio.getDate() - 6);
    inicio.setHours(0, 0, 0, 0);
  } else if (periodo === "mensal") {
    if (mes) {
      const [y, m] = mes.split("-").map(Number);
      inicio = new Date(y, m - 1, 1);
      fim = new Date(y, m, 0, 23, 59, 59, 999);
    } else {
      inicio = new Date(now.getFullYear(), now.getMonth(), 1);
      fim = new Date(now);
    }
  } else {
    // anual
    const y = ano ? parseInt(ano, 10) : now.getFullYear();
    inicio = new Date(y, 0, 1);
    fim = new Date(y, 11, 31, 23, 59, 59, 999);
  }
  return { inicio, fim };
}

export async function GET(req: NextRequest) {
  try {
    await requireAdmin();
  } catch (err: unknown) {
    const e = err as { message?: string };
    if (e.message === "Acesso negado" || e.message === "Não autenticado") {
      return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
    }
    throw err;
  }

  const { searchParams } = new URL(req.url);
  const secao = searchParams.get("secao");
  const periodo = (searchParams.get("periodo") || "mensal") as Periodo;
  const mes = searchParams.get("mes") || undefined;
  const data = searchParams.get("data") || undefined;
  const ano = searchParams.get("ano") || undefined;
  const filtro = searchParams.get("filtro") || "todos"; // para pagamentos: todos | agendamento | plano:bronze etc

  if (!secao) {
    return NextResponse.json({ error: "secao obrigatória" }, { status: 400 });
  }

  const { inicio, fim } = getDateRange(periodo, mes, data, ano);

  try {
    if (secao === "usuarios") {
      const users = await prisma.user.findMany({
        where: { createdAt: { gte: inicio, lte: fim } },
        select: { createdAt: true },
      });
      const buckets: { label: string; valor: number }[] = [];
      if (periodo === "diario") {
        for (let h = 0; h < 24; h++) {
          const hInicio = new Date(inicio);
          hInicio.setHours(h, 0, 0, 0);
          const hFim = new Date(inicio);
          hFim.setHours(h, 59, 59, 999);
          const count = users.filter(
            (u) => u.createdAt >= hInicio && u.createdAt <= hFim
          ).length;
          buckets.push({ label: `${h.toString().padStart(2, "0")}:00`, valor: count });
        }
      } else if (periodo === "semanal") {
        for (let d = 0; d < 7; d++) {
          const dayStart = new Date(inicio);
          dayStart.setDate(inicio.getDate() + d);
          dayStart.setHours(0, 0, 0, 0);
          const dayEnd = new Date(dayStart);
          dayEnd.setHours(23, 59, 59, 999);
          const count = users.filter(
            (u) => u.createdAt >= dayStart && u.createdAt <= dayEnd
          ).length;
          const label = dayStart.toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit", month: "2-digit" });
          buckets.push({ label, valor: count });
        }
      } else if (periodo === "mensal") {
        const daysInMonth = Math.ceil((fim.getTime() - inicio.getTime()) / (24 * 60 * 60 * 1000)) + 1;
        for (let d = 0; d < daysInMonth; d++) {
          const dayStart = new Date(inicio);
          dayStart.setDate(inicio.getDate() + d);
          if (dayStart > fim) break;
          dayStart.setHours(0, 0, 0, 0);
          const dayEnd = new Date(dayStart);
          dayEnd.setHours(23, 59, 59, 999);
          const count = users.filter(
            (u) => u.createdAt >= dayStart && u.createdAt <= dayEnd
          ).length;
          buckets.push({
            label: dayStart.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }),
            valor: count,
          });
        }
      } else {
        for (let m = 0; m < 12; m++) {
          const monthStart = new Date(inicio.getFullYear(), m, 1);
          const monthEnd = new Date(inicio.getFullYear(), m + 1, 0, 23, 59, 59, 999);
          if (monthStart < inicio || monthEnd > fim) continue;
          const count = users.filter(
            (u) => u.createdAt >= monthStart && u.createdAt <= monthEnd
          ).length;
          buckets.push({
            label: monthStart.toLocaleDateString("pt-BR", { month: "short" }),
            valor: count,
          });
        }
      }
      return NextResponse.json({ buckets, periodo, inicio: inicio.toISOString(), fim: fim.toISOString() });
    }

    if (secao === "pagamentos") {
      const where: { createdAt: { gte: Date; lte: Date }; status: string; type?: string; planId?: string } = {
        createdAt: { gte: inicio, lte: fim },
        status: "approved",
      };
      if (filtro !== "todos") {
        if (filtro === "agendamento") {
          where.type = "agendamento";
        } else if (filtro.startsWith("plano:")) {
          where.type = "plano";
          where.planId = filtro.slice(6);
        }
      }
      const payments = await prisma.payment.findMany({
        where,
        select: { createdAt: true, amount: true },
      });
      const buckets: { label: string; valor: number; valorTotal: number }[] = [];
      const daysInRange = Math.ceil((fim.getTime() - inicio.getTime()) / (24 * 60 * 60 * 1000)) + 1;
      for (let d = 0; d < daysInRange; d++) {
        const dayStart = new Date(inicio);
        dayStart.setDate(inicio.getDate() + d);
        if (dayStart > fim) break;
        dayStart.setHours(0, 0, 0, 0);
        const dayEnd = new Date(dayStart);
        dayEnd.setHours(23, 59, 59, 999);
        const dayPayments = payments.filter(
          (p) => p.createdAt >= dayStart && p.createdAt <= dayEnd
        );
        buckets.push({
          label: dayStart.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }),
          valor: dayPayments.length,
          valorTotal: dayPayments.reduce((s, p) => s + p.amount, 0),
        });
      }
      return NextResponse.json({ buckets, periodo, inicio: inicio.toISOString(), fim: fim.toISOString() });
    }

    if (secao === "planos") {
      const [assinados, comFimNoPeriodo, canceladosNoPeriodo] = await Promise.all([
        prisma.userPlan.findMany({
          where: { createdAt: { gte: inicio, lte: fim } },
          select: { createdAt: true },
        }),
        prisma.userPlan.findMany({
          where: { endDate: { gte: inicio, lte: fim } },
          select: { endDate: true },
        }),
        prisma.userPlan.findMany({
          where: { status: "cancelled", updatedAt: { gte: inicio, lte: fim } },
          select: { updatedAt: true },
        }),
      ]);
      const daysInRange = Math.ceil((fim.getTime() - inicio.getTime()) / (24 * 60 * 60 * 1000)) + 1;
      const buckets: { label: string; assinados: number; cancelados: number }[] = [];
      for (let d = 0; d < daysInRange; d++) {
        const dayStart = new Date(inicio);
        dayStart.setDate(inicio.getDate() + d);
        if (dayStart > fim) break;
        dayStart.setHours(0, 0, 0, 0);
        const dayEnd = new Date(dayStart);
        dayEnd.setHours(23, 59, 59, 999);
        const a = assinados.filter((p) => p.createdAt >= dayStart && p.createdAt <= dayEnd).length;
        const c1 = comFimNoPeriodo.filter((p) => p.endDate && p.endDate >= dayStart && p.endDate <= dayEnd).length;
        const c2 = canceladosNoPeriodo.filter((p) => p.updatedAt >= dayStart && p.updatedAt <= dayEnd).length;
        buckets.push({
          label: dayStart.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }),
          assinados: a,
          cancelados: c1 + c2,
        });
      }
      return NextResponse.json({ buckets, periodo, inicio: inicio.toISOString(), fim: fim.toISOString() });
    }

    if (secao === "agendamentos") {
      const appointments = await prisma.appointment.findMany({
        where: { data: { gte: inicio, lte: fim }, cancelledAt: null },
        select: { data: true },
      });
      const buckets: { label: string; valor: number }[] = [];
      if (periodo === "diario") {
        for (let h = 0; h < 24; h++) {
          const hInicio = new Date(inicio);
          hInicio.setHours(h, 0, 0, 0);
          const hFim = new Date(inicio);
          hFim.setHours(h, 59, 59, 999);
          const count = appointments.filter(
            (a) => a.data >= hInicio && a.data <= hFim
          ).length;
          buckets.push({ label: `${h.toString().padStart(2, "0")}:00`, valor: count });
        }
      } else {
        const daysInRange = periodo === "semanal" ? 7 : Math.ceil((fim.getTime() - inicio.getTime()) / (24 * 60 * 60 * 1000)) + 1;
        for (let d = 0; d < daysInRange; d++) {
          const dayStart = new Date(inicio);
          dayStart.setDate(inicio.getDate() + d);
          if (dayStart > fim) break;
          dayStart.setHours(0, 0, 0, 0);
          const dayEnd = new Date(dayStart);
          dayEnd.setHours(23, 59, 59, 999);
          const count = appointments.filter(
            (a) => a.data >= dayStart && a.data <= dayEnd
          ).length;
          buckets.push({
            label: dayStart.toLocaleDateString("pt-BR", periodo === "semanal" ? { weekday: "short", day: "2-digit", month: "2-digit" } : { day: "2-digit", month: "2-digit" }),
            valor: count,
          });
        }
      }
      return NextResponse.json({ buckets, periodo, inicio: inicio.toISOString(), fim: fim.toISOString() });
    }

    if (secao === "agendamentos-servicos") {
      const appointments = await prisma.appointment.findMany({
        where: { data: { gte: inicio, lte: fim }, cancelledAt: null },
        select: { data: true, tipo: true },
      });
      const allLabels: string[] = [];
      const byTipo = new Map<string, Map<string, number>>();

      const ensureTipo = (tipo: string) => {
        if (!byTipo.has(tipo)) byTipo.set(tipo, new Map());
      };
      const addPoint = (tipo: string, label: string, inc: number) => {
        ensureTipo(tipo);
        const m = byTipo.get(tipo)!;
        m.set(label, (m.get(label) ?? 0) + inc);
      };

      if (periodo === "diario") {
        for (let h = 0; h < 24; h++) {
          const label = `${h.toString().padStart(2, "0")}:00`;
          allLabels.push(label);
          const hInicio = new Date(inicio);
          hInicio.setHours(h, 0, 0, 0);
          const hFim = new Date(inicio);
          hFim.setHours(h, 59, 59, 999);
          appointments.forEach((a) => {
            if (a.data >= hInicio && a.data <= hFim) addPoint(a.tipo, label, 1);
          });
        }
      } else {
        const daysInRange = periodo === "semanal" ? 7 : Math.ceil((fim.getTime() - inicio.getTime()) / (24 * 60 * 60 * 1000)) + 1;
        for (let d = 0; d < daysInRange; d++) {
          const dayStart = new Date(inicio);
          dayStart.setDate(inicio.getDate() + d);
          if (dayStart > fim) break;
          const label = dayStart.toLocaleDateString("pt-BR", periodo === "semanal" ? { weekday: "short", day: "2-digit", month: "2-digit" } : { day: "2-digit", month: "2-digit" });
          allLabels.push(label);
          dayStart.setHours(0, 0, 0, 0);
          const dayEnd = new Date(dayStart);
          dayEnd.setHours(23, 59, 59, 999);
          appointments.forEach((a) => {
            if (a.data >= dayStart && a.data <= dayEnd) addPoint(a.tipo, label, 1);
          });
        }
      }

      const tipos = Array.from(new Set(appointments.map((a) => a.tipo)));
      if (tipos.length === 0) tipos.push("(nenhum)");
      const series = tipos.map((tipo) => {
        ensureTipo(tipo);
        const pontos = allLabels.map((label) => ({
          label,
          valor: byTipo.get(tipo)?.get(label) ?? 0,
        }));
        return { tipo, pontos };
      });
      return NextResponse.json({ series, periodo, inicio: inicio.toISOString(), fim: fim.toISOString() });
    }

    if (secao === "filtros-pagamentos") {
      const plans = await prisma.userPlan.findMany({ select: { planId: true, planName: true }, distinct: ["planId"] });
      const opts = [
        { id: "todos", label: "Todos" },
        { id: "agendamento", label: "Agendamentos" },
        ...plans.map((p) => ({ id: `plano:${p.planId}`, label: p.planName })),
      ];
      const seen = new Set<string>();
      const unique = opts.filter((o) => {
        if (seen.has(o.id)) return false;
        seen.add(o.id);
        return true;
      });
      return NextResponse.json({ filtros: unique });
    }

    return NextResponse.json({ error: "secao inválida" }, { status: 400 });
  } catch (e) {
    console.error("[Admin Stats Graficos]", e);
    return NextResponse.json({ error: "Erro ao gerar dados do gráfico" }, { status: 500 });
  }
}
