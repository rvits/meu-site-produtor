import { NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";
import { requireAdmin } from "@/app/lib/auth";

function defaultStats() {
  return {
    usuarios: { total: 0, comConta: 0, semConta: 0, porcentagemComConta: 0 },
    pagamentos: { total: 0, porUsuarios: 0, porNaoUsuarios: 0, valorTotal: 0 },
    planos: { total: 0, ativos: 0, inativos: 0 },
    agendamentos: {
      total: 0,
      totalAtivos: 0,
      totalCancelados: 0,
      hoje: 0,
      hojeCancelados: 0,
      estaSemana: 0,
      estaSemanaCancelados: 0,
      esteMes: 0,
      esteMesCancelados: 0,
    },
    servicos: { total: 0, pendentes: 0, aceitos: 0, aFazer: 0, concluidos: 0, cancelados: 0 },
    usoDiario: [] as { data: string; usuarios: number }[],
  };
}

export async function GET() {
  try {
    await requireAdmin();
  } catch (err: any) {
    if (err.message === "Acesso negado" || err.message === "Não autenticado") {
      return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
    }
    throw err;
  }

  const stats = defaultStats();

  try {
    stats.usuarios.total = await prisma.user.count();
    stats.usuarios.comConta = await prisma.user.count({
      where: { email: { not: "" } },
    });
    stats.usuarios.semConta = stats.usuarios.total - stats.usuarios.comConta;
    stats.usuarios.porcentagemComConta =
      stats.usuarios.total > 0
        ? (stats.usuarios.comConta / stats.usuarios.total) * 100
        : 0;
  } catch (e) {
    console.warn("[Admin Stats] Usuários:", e);
  }

  try {
    // Apenas pagamentos aprovados: refletem o que realmente entrou e atualizam ao cancelar/excluir
    const pagamentosAprovados = await prisma.payment.findMany({
      where: { status: "approved" },
      include: { user: true },
    });
    stats.pagamentos.total = pagamentosAprovados.length;
    stats.pagamentos.porUsuarios = pagamentosAprovados.filter((p) => p.user).length;
    stats.pagamentos.porNaoUsuarios =
      stats.pagamentos.total - stats.pagamentos.porUsuarios;
    stats.pagamentos.valorTotal = pagamentosAprovados.reduce(
      (acc, p) => acc + p.amount,
      0
    );
  } catch (e) {
    console.warn("[Admin Stats] Pagamentos:", e);
  }

  try {
    stats.planos.total = await prisma.userPlan.count();
    stats.planos.ativos = await prisma.userPlan.count({
      where: { status: "active" },
    });
    stats.planos.inativos = stats.planos.total - stats.planos.ativos;
  } catch (e) {
    console.warn("[Admin Stats] Planos:", e);
  }

  try {
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    const fimHoje = new Date(hoje.getTime() + 24 * 60 * 60 * 1000);
    const inicioSemana = new Date(hoje);
    inicioSemana.setDate(hoje.getDate() - hoje.getDay());
    const inicioMes = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
    const ativosWhere = { cancelledAt: null };
    const canceladosWhere = { cancelledAt: { not: null } };

    stats.agendamentos.total = await prisma.appointment.count();
    stats.agendamentos.totalAtivos = await prisma.appointment.count({ where: ativosWhere });
    stats.agendamentos.totalCancelados = await prisma.appointment.count({ where: canceladosWhere });

    stats.agendamentos.hoje = await prisma.appointment.count({
      where: { ...ativosWhere, data: { gte: hoje, lt: fimHoje } },
    });
    stats.agendamentos.hojeCancelados = await prisma.appointment.count({
      where: { ...canceladosWhere, data: { gte: hoje, lt: fimHoje } },
    });

    stats.agendamentos.estaSemana = await prisma.appointment.count({
      where: { ...ativosWhere, data: { gte: inicioSemana } },
    });
    stats.agendamentos.estaSemanaCancelados = await prisma.appointment.count({
      where: { ...canceladosWhere, data: { gte: inicioSemana } },
    });

    stats.agendamentos.esteMes = await prisma.appointment.count({
      where: { ...ativosWhere, data: { gte: inicioMes } },
    });
    stats.agendamentos.esteMesCancelados = await prisma.appointment.count({
      where: { ...canceladosWhere, data: { gte: inicioMes } },
    });
  } catch (e) {
    console.warn("[Admin Stats] Agendamentos:", e);
  }

  try {
    stats.servicos.total = await prisma.service.count();
    stats.servicos.pendentes = await prisma.service.count({
      where: { status: "pendente" },
    });
    stats.servicos.aceitos = await prisma.service.count({
      where: { status: "aceito" },
    });
    stats.servicos.aFazer = stats.servicos.aceitos; // aceitos = ainda a fazer (não concluídos)
    stats.servicos.concluidos = await prisma.service.count({
      where: { status: "concluido" },
    });
    stats.servicos.cancelados = await prisma.service.count({
      where: { status: "cancelado" },
    });
  } catch (e) {
    console.warn("[Admin Stats] Serviços:", e);
  }

  try {
    const trintaDiasAtras = new Date();
    trintaDiasAtras.setDate(trintaDiasAtras.getDate() - 30);
    const loginLogs = await prisma.loginLog.findMany({
      where: {
        createdAt: { gte: trintaDiasAtras },
        success: true,
      },
      select: { createdAt: true, userId: true },
    });
    const usoDiarioMap = new Map<string, Set<string>>();
    loginLogs.forEach((log) => {
      const data = log.createdAt.toISOString().split("T")[0];
      if (!usoDiarioMap.has(data)) usoDiarioMap.set(data, new Set());
      if (log.userId) usoDiarioMap.get(data)!.add(log.userId);
    });
    stats.usoDiario = Array.from(usoDiarioMap.entries())
      .map(([data, usuarios]) => ({ data, usuarios: usuarios.size }))
      .sort((a, b) => a.data.localeCompare(b.data));
  } catch (e) {
    console.warn("[Admin Stats] Uso diário (LoginLog):", e);
  }

  // Sem cache: estatísticas sempre refletem o estado atual do banco (exclusões, cancelamentos)
  return NextResponse.json(stats, {
    headers: {
      "Cache-Control": "no-store, no-cache, must-revalidate",
      Pragma: "no-cache",
    },
  });
}
