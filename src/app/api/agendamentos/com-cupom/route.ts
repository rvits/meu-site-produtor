import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { requireAuth } from "@/app/lib/auth";
import { prisma } from "@/app/lib/prisma";
import { z } from "zod";
import { normalizeServiceTypeId } from "@/app/lib/service-catalog";
import { agendamentoBloqueiaReusoCupom } from "@/app/lib/coupon-booking-rules";
import { normalizeStaleCouponAppointmentLink } from "@/app/lib/coupon-stale-appointment";
import { reconcileAppointmentWithServices } from "@/app/lib/appointment-service-sync";

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

    let couponRow = await prisma.coupon.findUnique({
      where: { code: cupomCode.toUpperCase() },
    });

    if (!couponRow) {
      return NextResponse.json(
        { error: "Cupom inexistente. Verifique o código e tente novamente." },
        { status: 404 }
      );
    }

    await normalizeStaleCouponAppointmentLink(couponRow.id);
    const couponReload = await prisma.coupon.findUnique({
      where: { code: cupomCode.toUpperCase() },
    });
    if (!couponReload) {
      return NextResponse.json({ error: "Cupom inexistente." }, { status: 404 });
    }
    couponRow = couponReload;

    if (couponRow.used) {
      return NextResponse.json(
        { error: "Este cupom já foi utilizado e não pode ser usado novamente." },
        { status: 400 }
      );
    }

    if (couponRow.appointmentId) {
      const agendamentoAssociado = await prisma.appointment.findUnique({
        where: { id: couponRow.appointmentId },
        select: { id: true, status: true },
      });
      if (agendamentoAssociado && agendamentoBloqueiaReusoCupom(agendamentoAssociado.status)) {
        return NextResponse.json(
          {
            error:
              "Este cupom já está vinculado a um agendamento em andamento. Aguarde o desfecho ou use outro cupom.",
          },
          { status: 400 }
        );
      }
      return NextResponse.json(
        {
          error:
            "Este cupom ainda está reservado a outro agendamento. Atualize a página ou contate o suporte.",
        },
        { status: 409 }
      );
    }

    // Verificar se expirou
    const agora = new Date();
    if (couponRow.expiresAt && new Date(couponRow.expiresAt) < agora) {
      return NextResponse.json(
        { error: "Este cupom expirou" },
        { status: 400 }
      );
    }

    // Verificar regra especial: cupons de plano expiram 1 mês após expiração do plano
    if (couponRow.userPlanId && couponRow.discountType === "service") {
      const userPlan = await prisma.userPlan.findUnique({
        where: { id: couponRow.userPlanId },
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
    if (couponRow.minValue && total < couponRow.minValue) {
      return NextResponse.json(
        { error: `Valor mínimo para usar este cupom é R$ ${couponRow.minValue.toFixed(2).replace(".", ",")}` },
        { status: 400 }
      );
    }

    // Cupom 10% serviços: NÃO permite uso em beats
    if (couponRow.serviceType === "percent_servicos" && totalBeats > 0) {
      return NextResponse.json(
        { error: "Este cupom de 10% é válido apenas para serviços avulsos. Não pode ser usado em beats." },
        { status: 400 }
      );
    }

    // Cupom 10% beats: NÃO permite uso em outros serviços
    if (couponRow.serviceType === "percent_beats" && totalServicos > 0) {
      return NextResponse.json(
        { error: "Este cupom de 10% é válido apenas para beats. Não pode ser usado em serviços avulsos." },
        { status: 400 }
      );
    }

    // Calcular desconto
    let discount = 0;
    let finalTotal = total;
    
    if (couponRow.discountType === "service") {
      // Cupom de serviço - zera o valor
      discount = total;
      finalTotal = 0;
    } else if (couponRow.discountType === "percent") {
      discount = (total * couponRow.discountValue) / 100;
      if (couponRow.maxDiscount && discount > couponRow.maxDiscount) {
        discount = couponRow.maxDiscount;
      }
      finalTotal = total - discount;
    } else {
      // Fixed discount
      if (couponRow.couponType === "reembolso") {
        if (couponRow.discountValue >= total) {
          discount = total;
          finalTotal = 0;
        } else {
          discount = couponRow.discountValue;
          finalTotal = total - discount;
        }
      } else {
        discount = couponRow.discountValue;
        finalTotal = total - discount;
      }
    }

    console.log("[API Agendamento com Cupom] Cupom validado:", {
      code: couponRow.code,
      discountType: couponRow.discountType,
      serviceType: couponRow.serviceType,
      discount,
      finalTotal,
    });

    // Verificar se cupom de serviço corresponde aos serviços selecionados
    if (couponRow.discountType === "service" && couponRow.serviceType) {
      const servicosIds = (servicos || []).map((s: any) => s.id);
      const beatsIds = (beats || []).map((b: any) => b.id);
      const todosServicos = [...servicosIds, ...beatsIds];
      
      // Mapear tipos de serviço equivalentes (inclui cupons de teste: sessao, beat, beat1-beat4)
      const serviceTypeMap: Record<string, string[]> = {
        "sessao": ["sessao", "captacao"],
        "captacao": ["captacao", "sessao"],
        "mix": ["mix"],
        "master": ["master"],
        "mix_master": ["mix_master", "mix", "master"],
        "sonoplastia": ["sonoplastia"],
        "beat": ["beat1", "beat2", "beat3", "beat4"],
        "beat1": ["beat1"],
        "beat2": ["beat2"],
        "beat3": ["beat3"],
        "beat4": ["beat4"],
        "producao_completa": ["producao_completa"],
      };

      const tiposPermitidos = serviceTypeMap[couponRow.serviceType] || [couponRow.serviceType];
      const temServicoValido = todosServicos.some((id: string) => tiposPermitidos.includes(id));

      if (!temServicoValido) {
        return NextResponse.json(
          { error: `Este cupom é válido apenas para o serviço: ${couponRow.serviceType}. Selecione o serviço correspondente.` },
          { status: 400 }
        );
      }
    }

    // Criar data/hora do agendamento
    const dataHoraISO = new Date(`${data}T${hora}:00`);
    const duracao = duracaoMinutos || 60;

    let appointment!: {
      id: number;
      data: Date;
      tipo: string;
      duracaoMinutos: number;
      observacoes: string | null;
      status: string;
    };

    try {
      await prisma.$transaction(
        async (tx) => {
          const conflito = await tx.appointment.findFirst({
            where: {
              status: { not: "cancelado" },
              AND: [
                { data: { lt: new Date(dataHoraISO.getTime() + duracao * 60000) } },
                { data: { gte: new Date(dataHoraISO.getTime() - duracao * 60000) } },
              ],
            },
            select: { id: true },
          });
          if (conflito) {
            const err = new Error("SLOT_CONFLICT");
            (err as { code?: string }).code = "SLOT_CONFLICT";
            throw err;
          }

          const apt = await tx.appointment.create({
            data: {
              userId: user.id,
              data: dataHoraISO,
              duracaoMinutos: duracao,
              tipo: tipo || "sessao",
              observacoes: observacoes || null,
              status: "pendente",
            },
          });

          const claimed = await tx.coupon.updateMany({
            where: {
              id: couponRow.id,
              used: false,
              appointmentId: null,
            },
            data: { appointmentId: apt.id },
          });

          if (claimed.count !== 1) {
            const err = new Error("COUPON_CLAIM_CONFLICT");
            (err as { code?: string }).code = "COUPON_CLAIM_CONFLICT";
            throw err;
          }

          appointment = {
            id: apt.id,
            data: apt.data,
            tipo: apt.tipo,
            duracaoMinutos: apt.duracaoMinutos,
            observacoes: apt.observacoes,
            status: apt.status,
          };

          if (Array.isArray(servicos) && servicos.length > 0) {
            for (const svc of servicos) {
              const tipoSvc = normalizeServiceTypeId(String(svc.id || svc.nome || "sessao"));
              const desc =
                [svc.nome, svc.quantidade > 1 ? `Qtd: ${svc.quantidade}` : null].filter(Boolean).join(" — ") ||
                tipoSvc;
              for (let q = 0; q < (svc.quantidade || 1); q++) {
                await tx.service.create({
                  data: {
                    userId: user.id,
                    appointmentId: apt.id,
                    tipo: tipoSvc,
                    description: desc,
                    status: "pendente",
                  },
                });
              }
            }
          }

          if (Array.isArray(beats) && beats.length > 0) {
            for (const b of beats) {
              const tipoB = normalizeServiceTypeId(String(b.id || b.nome || "beat1"));
              const descB =
                [b.nome, b.quantidade > 1 ? `Qtd: ${b.quantidade}` : null].filter(Boolean).join(" — ") || tipoB;
              for (let q = 0; q < (b.quantidade || 1); q++) {
                await tx.service.create({
                  data: {
                    userId: user.id,
                    appointmentId: apt.id,
                    tipo: tipoB,
                    description: descB,
                    status: "pendente",
                  },
                });
              }
            }
          }
        },
        {
          isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
          maxWait: 5000,
          timeout: 20000,
        }
      );
    } catch (e: unknown) {
      const code = (e as { code?: string })?.code;
      const msg = (e as Error)?.message;
      if (code === "SLOT_CONFLICT" || msg === "SLOT_CONFLICT") {
        return NextResponse.json({ error: "Já existe um agendamento neste horário." }, { status: 409 });
      }
      if (code === "COUPON_CLAIM_CONFLICT" || msg === "COUPON_CLAIM_CONFLICT") {
        return NextResponse.json(
          {
            error:
              "Não foi possível reservar este cupom (pode ter sido usado por outra requisição). Atualize e tente novamente.",
          },
          { status: 409 }
        );
      }
      if (code === "P2034") {
        return NextResponse.json(
          { error: "Concorrência ao gravar o agendamento. Tente novamente." },
          { status: 409 }
        );
      }
      throw e;
    }

    await reconcileAppointmentWithServices(appointment.id);
    console.log("[API Agendamento com Cupom] Agendamento e vínculo criados:", appointment.id);

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
