import { NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";
import { requireAdmin } from "@/app/lib/auth";

export async function GET() {
  try {
    await requireAdmin();

    // Usuários
    const totalUsuarios = await prisma.user.count();
    const usuariosComConta = await prisma.user.count({
      where: { email: { not: "" } },
    });
    const usuariosSemConta = totalUsuarios - usuariosComConta;
    const porcentagemComConta = totalUsuarios > 0 ? (usuariosComConta / totalUsuarios) * 100 : 0;

    // Pagamentos
    const todosPagamentos = await prisma.payment.findMany({
      include: { user: true },
    });
    const pagamentosPorUsuarios = todosPagamentos.filter((p) => p.user).length;
    const pagamentosPorNaoUsuarios = todosPagamentos.length - pagamentosPorUsuarios;
    const valorTotal = todosPagamentos.reduce((acc, p) => acc + p.amount, 0);

    // Planos
    const totalPlanos = await prisma.userPlan.count();
    const planosAtivos = await prisma.userPlan.count({
      where: { status: "active" },
    });
    const planosInativos = totalPlanos - planosAtivos;

    // Agendamentos
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    const inicioSemana = new Date(hoje);
    inicioSemana.setDate(hoje.getDate() - hoje.getDay());
    const inicioMes = new Date(hoje.getFullYear(), hoje.getMonth(), 1);

    const totalAgendamentos = await prisma.appointment.count();
    const agendamentosHoje = await prisma.appointment.count({
      where: {
        data: {
          gte: hoje,
          lt: new Date(hoje.getTime() + 24 * 60 * 60 * 1000),
        },
      },
    });
    const agendamentosEstaSemana = await prisma.appointment.count({
      where: {
        data: {
          gte: inicioSemana,
        },
      },
    });
    const agendamentosEsteMes = await prisma.appointment.count({
      where: {
        data: {
          gte: inicioMes,
        },
      },
    });

    // Serviços
    const totalServicos = await prisma.service.count();
    const servicosPendentes = await prisma.service.count({
      where: { status: "pendente" },
    });
    const servicosAceitos = await prisma.service.count({
      where: { status: "aceito" },
    });

    // Uso diário (últimos 30 dias)
    const trintaDiasAtras = new Date();
    trintaDiasAtras.setDate(trintaDiasAtras.getDate() - 30);
    
    const loginLogs = await prisma.loginLog.findMany({
      where: {
        createdAt: { gte: trintaDiasAtras },
        success: true,
      },
      select: {
        createdAt: true,
        userId: true,
      },
    });

    // Agrupar por dia
    const usoDiarioMap = new Map<string, Set<string>>();
    loginLogs.forEach((log) => {
      const data = log.createdAt.toISOString().split("T")[0];
      if (!usoDiarioMap.has(data)) {
        usoDiarioMap.set(data, new Set());
      }
      if (log.userId) {
        usoDiarioMap.get(data)!.add(log.userId);
      }
    });

    const usoDiario = Array.from(usoDiarioMap.entries())
      .map(([data, usuarios]) => ({
        data,
        usuarios: usuarios.size,
      }))
      .sort((a, b) => a.data.localeCompare(b.data));

    return NextResponse.json({
      usuarios: {
        total: totalUsuarios,
        comConta: usuariosComConta,
        semConta: usuariosSemConta,
        porcentagemComConta,
      },
      pagamentos: {
        total: todosPagamentos.length,
        porUsuarios: pagamentosPorUsuarios,
        porNaoUsuarios: pagamentosPorNaoUsuarios,
        valorTotal,
      },
      planos: {
        total: totalPlanos,
        ativos: planosAtivos,
        inativos: planosInativos,
      },
      agendamentos: {
        total: totalAgendamentos,
        hoje: agendamentosHoje,
        estaSemana: agendamentosEstaSemana,
        esteMes: agendamentosEsteMes,
      },
      servicos: {
        total: totalServicos,
        pendentes: servicosPendentes,
        aceitos: servicosAceitos,
      },
      usoDiario,
    });
  } catch (err: any) {
    console.error("Erro ao buscar estatísticas detalhadas:", err);
    if (err.message === "Acesso negado" || err.message === "Não autenticado") {
      return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
    }
    return NextResponse.json({ error: "Erro ao buscar estatísticas" }, { status: 500 });
  }
}
