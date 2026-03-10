/**
 * POST /api/admin/reprocessar-pagamento-teste
 * Reprocessa o último pagamento de teste (R$ 5) do usuário admin: associa ao agendamento,
 * cria Services e cupons (Sessão Teste, Beat Teste) para que apareçam em Minha Conta, Admin e estatísticas.
 * Só admin.
 */
import { NextResponse } from "next/server";
import { requireAuth } from "@/app/lib/auth";
import { prisma } from "@/app/lib/prisma";

export async function POST() {
  try {
    const user = await requireAuth();
    if (user.role !== "ADMIN" && user.email !== "thouse.rec.tremv@gmail.com") {
      return NextResponse.json({ error: "Acesso negado. Apenas administradores." }, { status: 403 });
    }

    // Último pagamento de teste: primeiro do usuário logado; se admin e não achar, último do sistema (qualquer usuário)
    // select apenas colunas que existem em todos os bancos (evita erro se appointmentIds não existir)
    let pagamento = await prisma.payment.findFirst({
      where: {
        userId: user.id,
        amount: 5,
        type: "agendamento",
        status: "approved",
      },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        userId: true,
        amount: true,
        type: true,
        status: true,
        asaasId: true,
        appointmentId: true,
        createdAt: true,
      },
    });

    if (!pagamento && (user.role === "ADMIN" || user.email === "thouse.rec.tremv@gmail.com")) {
      pagamento = await prisma.payment.findFirst({
        where: { amount: 5, type: "agendamento", status: "approved" },
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          userId: true,
          amount: true,
          type: true,
          status: true,
          asaasId: true,
          appointmentId: true,
          createdAt: true,
        },
      });
    }

    // Se ainda não existe pagamento (webhook não rodou), criar a partir do último metadata do usuário logado
    const paymentMetadataRecente = await prisma.paymentMetadata.findFirst({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
    });

    if (!pagamento && paymentMetadataRecente) {
      pagamento = await prisma.payment.create({
        data: {
          userId: user.id,
          amount: 5,
          status: "approved",
          type: "agendamento",
          currency: "BRL",
          asaasId: paymentMetadataRecente.asaasId,
        },
      });
    }

    if (!pagamento) {
      return NextResponse.json({
        error: "Nenhum pagamento de teste (R$ 5, agendamento) encontrado. Faça um pagamento de teste ou peça ao dono do pagamento para reprocessar.",
      }, { status: 404 });
    }

    // Metadata do DONO do pagamento (quem fez o teste), não do admin logado
    const ownerId = pagamento.userId;
    let paymentMetadata = pagamento.asaasId
      ? await prisma.paymentMetadata.findFirst({
          where: { userId: ownerId, asaasId: pagamento.asaasId },
          orderBy: { createdAt: "desc" },
        })
      : null;
    if (!paymentMetadata) {
      paymentMetadata = await prisma.paymentMetadata.findFirst({
        where: { userId: ownerId },
        orderBy: { createdAt: "desc" },
      });
    }
    if (!paymentMetadata && ownerId === user.id && paymentMetadataRecente) {
      paymentMetadata = paymentMetadataRecente;
    }

    let metadata: Record<string, any> = {};
    if (paymentMetadata) {
      try {
        metadata = JSON.parse(paymentMetadata.metadata);
      } catch {
        // ignore
      }
    }

    const appointmentId = metadata.appointmentId ? parseInt(String(metadata.appointmentId), 10) : null;
    let agendamentoFinalId: number | null = null;

    if (appointmentId) {
      const apt = await prisma.appointment.findUnique({
        where: { id: appointmentId },
        select: { id: true, userId: true },
      });
      if (apt) agendamentoFinalId = apt.id;
    }

    if (!agendamentoFinalId && metadata.data && metadata.hora) {
      const dataHoraISO = new Date(`${metadata.data}T${metadata.hora}:00`);
      const duracao = parseInt(metadata.duracaoMinutos || "60", 10);
      const novo = await prisma.appointment.create({
        data: {
          userId: pagamento.userId,
          data: dataHoraISO,
          duracaoMinutos: duracao,
          tipo: metadata.tipoAgendamento || "sessao",
          observacoes: metadata.observacoes || "Agendamento de teste - Pagamento R$ 5,00",
          status: "pendente",
        },
      });
      agendamentoFinalId = novo.id;
    }

    if (!agendamentoFinalId) {
      return NextResponse.json({
        error: "Não foi possível identificar ou criar o agendamento. Metadata sem data/hora ou appointmentId.",
      }, { status: 400 });
    }

    // Garantir que o agendamento pertence ao usuário do pagamento (para cupons e Minha Conta aparecerem)
    // SQL bruto para não depender de colunas que podem não existir no banco (ex.: cancelReason)
    await prisma.$executeRawUnsafe(
      `UPDATE "Appointment" SET "userId" = $1 WHERE id = $2`,
      pagamento.userId,
      agendamentoFinalId,
    );

    // Vincular pagamento ao agendamento (select só colunas que existem em todos os bancos)
    await prisma.payment.update({
      where: { id: pagamento.id },
      data: { appointmentId: agendamentoFinalId, type: "agendamento" },
    });

    const services = metadata.servicos ? (Array.isArray(metadata.servicos) ? metadata.servicos : JSON.parse(metadata.servicos)) : [];
    const beats = metadata.beats ? (Array.isArray(metadata.beats) ? metadata.beats : JSON.parse(metadata.beats)) : [];

    const userIdApt = pagamento.userId;

    let servicesCreated = 0;
    for (const svc of services) {
      const tipo = svc.id || svc.nome || "sessao";
      const desc = [svc.nome, svc.quantidade > 1 ? `Qtd: ${svc.quantidade}` : null].filter(Boolean).join(" — ") || tipo;
      for (let q = 0; q < (svc.quantidade || 1); q++) {
        try {
          await prisma.service.create({
            data: {
              userId: userIdApt,
              appointmentId: agendamentoFinalId,
              tipo: String(tipo),
              description: desc,
              status: "pendente",
            },
          });
          servicesCreated++;
        } catch (e) {
          console.warn("[Reprocessar Teste] Service já existe?", e);
        }
      }
    }
    for (const b of beats) {
      const tipoBeat = b.id || b.nome || "beat";
      const descBeat = [b.nome, b.quantidade > 1 ? `Qtd: ${b.quantidade}` : null].filter(Boolean).join(" — ") || tipoBeat;
      for (let q = 0; q < (b.quantidade || 1); q++) {
        try {
          await prisma.service.create({
            data: {
              userId: userIdApt,
              appointmentId: agendamentoFinalId,
              tipo: String(tipoBeat),
              description: descBeat,
              status: "pendente",
            },
          });
          servicesCreated++;
        } catch (e) {
          console.warn("[Reprocessar Teste] Service beat já existe?", e);
        }
      }
    }

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30);
    let couponIndex = 0;
    const makeCode = (tipo: string) => `TESTE_AGEND_${agendamentoFinalId}_${tipo}_${couponIndex++}`;
    let couponsCreated = 0;

    for (const svc of services) {
      const serviceType = String(svc.id || svc.nome || "sessao");
      for (let q = 0; q < Math.max(1, Number(svc.quantidade) || 1); q++) {
        const code = makeCode(serviceType);
        const existing = await prisma.coupon.findUnique({ where: { code } });
        if (existing) continue;
        await prisma.coupon.create({
          data: {
            code,
            couponType: "plano",
            discountType: "service",
            discountValue: 0,
            serviceType: serviceType,
            appointmentId: agendamentoFinalId,
            expiresAt,
          },
        });
        couponsCreated++;
      }
    }
    for (const b of beats) {
      const serviceType = String(b.id || b.nome || "beat1");
      for (let q = 0; q < Math.max(1, Number(b.quantidade) || 1); q++) {
        const code = makeCode(serviceType);
        const existing = await prisma.coupon.findUnique({ where: { code } });
        if (existing) continue;
        await prisma.coupon.create({
          data: {
            code,
            couponType: "plano",
            discountType: "service",
            discountValue: 0,
            serviceType: serviceType,
            appointmentId: agendamentoFinalId,
            expiresAt,
          },
        });
        couponsCreated++;
      }
    }
    if (services.length === 0 && beats.length === 0) {
      const code = makeCode("sessao");
      const existing = await prisma.coupon.findUnique({ where: { code } });
      if (!existing) {
        await prisma.coupon.create({
          data: {
            code,
            couponType: "plano",
            discountType: "service",
            discountValue: 0,
            serviceType: "sessao",
            appointmentId: agendamentoFinalId,
            expiresAt,
          },
        });
        couponsCreated++;
      }
    }

    const owner = await prisma.user.findUnique({
      where: { id: pagamento.userId },
      select: { email: true, nomeArtistico: true },
    });

    return NextResponse.json({
      success: true,
      message: "Pagamento de teste reprocessado. Agendamento, serviços e cupons foram criados/vinculados.",
      appointmentId: agendamentoFinalId,
      paymentId: pagamento.id,
      servicesCreated,
      couponsCreated,
      forUser: owner ? { email: owner.email, nome: owner.nomeArtistico } : null,
      hint: "Quem fez o pagamento deve acessar Minha Conta e clicar em Atualizar para ver agendamento e cupons. No admin, use os botões Atualizar em Agendamentos e Serviços.",
    });
  } catch (err: any) {
    console.error("[Reprocessar Pagamento Teste]", err);
    return NextResponse.json(
      { error: err?.message || "Erro ao reprocessar pagamento de teste." },
      { status: 500 }
    );
  }
}
