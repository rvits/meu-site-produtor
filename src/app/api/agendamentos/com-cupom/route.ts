import { NextResponse } from "next/server";
import { requireAuth } from "@/app/lib/auth";
import { prisma } from "@/app/lib/prisma";
import { z } from "zod";

const agendamentoComCupomSchema = z.object({
  data: z.string(),
  hora: z.string(),
  duracaoMinutos: z.number().optional(),
  tipo: z.string().optional(),
  observacoes: z.string().optional(),
  servicos: z.array(z.object({
    id: z.string(),
    nome: z.string(),
    quantidade: z.number(),
    preco: z.number(),
  })).optional(),
  beats: z.array(z.object({
    id: z.string(),
    nome: z.string(),
    quantidade: z.number(),
    preco: z.number(),
  })).optional(),
  cupomCode: z.string(),
});

export async function POST(req: Request) {
  try {
    const user = await requireAuth();

    const body = await req.json();
    const validation = agendamentoComCupomSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.errors[0]?.message || "Dados inválidos" },
        { status: 400 }
      );
    }

    const { data, hora, duracaoMinutos, tipo, observacoes, servicos, beats, cupomCode } = validation.data;

    // Calcular total dos serviços
    const totalServicos = (servicos || []).reduce((acc: number, s: any) => acc + (s.preco * s.quantidade), 0);
    const totalBeats = (beats || []).reduce((acc: number, b: any) => acc + (b.preco * b.quantidade), 0);
    const total = totalServicos + totalBeats;
    
    console.log("[API Agendamento com Cupom] Dados recebidos:", {
      data,
      hora,
      servicos: servicos?.length || 0,
      beats: beats?.length || 0,
      total,
      cupomCode,
    });

    // Validar cupom diretamente no banco (sem fazer fetch interno)
    const coupon = await prisma.coupon.findUnique({
      where: { code: cupomCode.toUpperCase() },
    });

    if (!coupon) {
      return NextResponse.json(
        { error: "Cupom inexistente. Verifique o código e tente novamente." },
        { status: 404 }
      );
    }

    // Verificar se já foi usado
    if (coupon.used) {
      return NextResponse.json(
        { error: "Este cupom já foi utilizado e não pode ser usado novamente." },
        { status: 400 }
      );
    }

    // Verificar se está associado a um agendamento pendente (não pode ser usado em outro agendamento)
    if (coupon.appointmentId) {
      const agendamentoAssociado = await prisma.appointment.findUnique({
        where: { id: coupon.appointmentId },
      });
      
      if (agendamentoAssociado && agendamentoAssociado.status === "pendente") {
        return NextResponse.json(
          { error: "Este cupom já está sendo usado em um agendamento pendente. Aguarde a confirmação ou cancele o agendamento anterior." },
          { status: 400 }
        );
      }
    }

    // Verificar se expirou
    const agora = new Date();
    if (coupon.expiresAt && new Date(coupon.expiresAt) < agora) {
      return NextResponse.json(
        { error: "Este cupom expirou" },
        { status: 400 }
      );
    }

    // Verificar regra especial: cupons de plano expiram 1 mês após expiração do plano
    if (coupon.userPlanId && coupon.discountType === "service") {
      const userPlan = await prisma.userPlan.findUnique({
        where: { id: coupon.userPlanId },
      });

      if (userPlan && userPlan.endDate) {
        const umMesAposPlano = new Date(userPlan.endDate);
        umMesAposPlano.setMonth(umMesAposPlano.getMonth() + 1);
        
        if (agora > umMesAposPlano) {
          return NextResponse.json(
            { error: "Este cupom expirou. Cupons de plano são válidos até 1 mês após a expiração do plano." },
            { status: 400 }
          );
        }
      }
    }

    // Verificar valor mínimo
    if (coupon.minValue && total < coupon.minValue) {
      return NextResponse.json(
        { error: `Valor mínimo para usar este cupom é R$ ${coupon.minValue.toFixed(2).replace(".", ",")}` },
        { status: 400 }
      );
    }

    // Cupom 10% serviços: NÃO permite uso em beats
    if (coupon.serviceType === "percent_servicos" && totalBeats > 0) {
      return NextResponse.json(
        { error: "Este cupom de 10% é válido apenas para serviços avulsos. Não pode ser usado em beats." },
        { status: 400 }
      );
    }

    // Cupom 10% beats: NÃO permite uso em outros serviços
    if (coupon.serviceType === "percent_beats" && totalServicos > 0) {
      return NextResponse.json(
        { error: "Este cupom de 10% é válido apenas para beats. Não pode ser usado em serviços avulsos." },
        { status: 400 }
      );
    }

    // Calcular desconto
    let discount = 0;
    let finalTotal = total;
    
    if (coupon.discountType === "service") {
      // Cupom de serviço - zera o valor
      discount = total;
      finalTotal = 0;
    } else if (coupon.discountType === "percent") {
      discount = (total * coupon.discountValue) / 100;
      if (coupon.maxDiscount && discount > coupon.maxDiscount) {
        discount = coupon.maxDiscount;
      }
      finalTotal = total - discount;
    } else {
      // Fixed discount
      if (coupon.couponType === "reembolso") {
        if (coupon.discountValue >= total) {
          discount = total;
          finalTotal = 0;
        } else {
          discount = coupon.discountValue;
          finalTotal = total - discount;
        }
      } else {
        discount = coupon.discountValue;
        finalTotal = total - discount;
      }
    }

    console.log("[API Agendamento com Cupom] Cupom validado:", {
      code: coupon.code,
      discountType: coupon.discountType,
      serviceType: coupon.serviceType,
      discount,
      finalTotal,
    });

    // Verificar se cupom de serviço corresponde aos serviços selecionados
    if (coupon.discountType === "service" && coupon.serviceType) {
      const servicosIds = (servicos || []).map((s: any) => s.id);
      const beatsIds = (beats || []).map((b: any) => b.id);
      const todosServicos = [...servicosIds, ...beatsIds];
      
      // Mapear tipos de serviço equivalentes
      const serviceTypeMap: Record<string, string[]> = {
        "captacao": ["captacao", "sessao"],
        "mix": ["mix"],
        "master": ["master"],
        "mix_master": ["mix_master", "mix", "master"],
        "sonoplastia": ["sonoplastia"],
        "beat1": ["beat1"],
        "beat2": ["beat2"],
        "beat3": ["beat3"],
        "beat4": ["beat4"],
        "producao_completa": ["producao_completa"],
      };

      const tiposPermitidos = serviceTypeMap[coupon.serviceType] || [coupon.serviceType];
      const temServicoValido = todosServicos.some((id: string) => tiposPermitidos.includes(id));

      if (!temServicoValido) {
        return NextResponse.json(
          { error: `Este cupom é válido apenas para o serviço: ${coupon.serviceType}. Selecione o serviço correspondente.` },
          { status: 400 }
        );
      }
    }

    // Criar data/hora do agendamento
    const dataHoraISO = new Date(`${data}T${hora}:00`);
    const duracao = duracaoMinutos || 60;

    // Verificar conflitos
    const conflito = await prisma.appointment.findFirst({
      where: {
        status: { not: "cancelado" },
        AND: [
          { data: { lt: new Date(dataHoraISO.getTime() + (duracao * 60000)) } },
          { data: { gte: new Date(dataHoraISO.getTime() - (duracao * 60000)) } },
        ],
      },
    });

    if (conflito) {
      return NextResponse.json(
        { error: "Já existe um agendamento neste horário." },
        { status: 409 }
      );
    }

    // Criar agendamento com status "pendente" (aguardando confirmação do admin)
    const appointment = await prisma.appointment.create({
      data: {
        userId: user.id,
        data: dataHoraISO,
        duracaoMinutos: duracao,
        tipo: tipo || "sessao",
        observacoes: observacoes || null,
        status: "pendente", // Pendente para admin confirmar
      },
    });

    // Associar cupom ao agendamento (mas NÃO marcar como usado ainda)
    // O cupom só será marcado como usado quando o agendamento for confirmado pelo admin
    await prisma.coupon.update({
      where: { id: coupon.id },
      data: {
        appointmentId: appointment.id,
        // NÃO marcar como usado ainda - só quando admin confirmar
      },
    });

    // Enviar email de notificação para o admin
    try {
      const { sendPaymentNotificationToTHouse } = await import("@/app/lib/sendEmail");
      await sendPaymentNotificationToTHouse(
        user.email,
        user.nomeArtistico,
        user.telefone || "",
        appointment.data,
        appointment.tipo,
        appointment.duracaoMinutos,
        appointment.observacoes || "",
        0, // Total = 0 porque foi pago com cupom
        "cupom", // Método de pagamento
        servicos || [],
        beats || []
      );
      console.log(`[API] Email de notificação enviado para admin sobre agendamento com cupom`);
    } catch (emailError: any) {
      console.error("[API] Erro ao enviar email (não crítico):", emailError);
    }

    console.log(`[API] Agendamento criado com cupom ${cupomCode}: ${appointment.id} (status: pendente)`);

    return NextResponse.json({
      success: true,
      appointment: {
        id: appointment.id,
        data: appointment.data,
        status: appointment.status,
      },
      message: "Agendamento criado com sucesso usando cupom! Aguarde a confirmação do admin. Você receberá um email quando o agendamento for confirmado.",
    });
  } catch (err: any) {
    console.error("[API] Erro ao criar agendamento com cupom:", err);
    console.error("[API] Stack trace:", err.stack);
    if (err.message === "Não autenticado") {
      return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
    }
    return NextResponse.json(
      { 
        error: err.message || "Erro ao criar agendamento",
        details: process.env.NODE_ENV === "development" ? err.stack : undefined
      },
      { status: 500 }
    );
  }
}
