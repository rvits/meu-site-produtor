// src/app/api/test-payment/route.ts
import { NextResponse } from "next/server";
import { requireAuth } from "@/app/lib/auth";
import { AsaasProvider, InfinityPayProvider } from "@/app/lib/payment-providers";
import { prisma } from "@/app/lib/prisma";

import { getAsaasApiKey, getEnv } from "@/app/lib/env";

const ASAAS_API_KEY = getAsaasApiKey();
const INFINITYPAY_API_KEY = getEnv('INFINITYPAY_API_KEY');
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
const IS_TEST = process.env.NODE_ENV !== "production";

export async function POST(req: Request) {
  try {
    // 🔒 Verificar autenticação e se é admin
    const user = await requireAuth();
    
    // Apenas admin pode usar pagamento de teste
    if (user.email !== "thouse.rec.tremv@gmail.com" && user.role !== "ADMIN") {
      return NextResponse.json(
        { error: "Acesso negado. Apenas administradores podem usar pagamento de teste." },
        { status: 403 }
      );
    }

    // Debug: Verificar se a variável está sendo lida
    console.log("[Test Payment] Verificando variáveis de ambiente...");
    console.log("[Test Payment] process.env.ASAAS_API_KEY tipo:", typeof process.env.ASAAS_API_KEY);
    console.log("[Test Payment] process.env.ASAAS_API_KEY valor (raw):", JSON.stringify(process.env.ASAAS_API_KEY));
    console.log("[Test Payment] process.env.ASAAS_API_KEY existe:", !!process.env.ASAAS_API_KEY);
    console.log("[Test Payment] process.env.ASAAS_API_KEY length:", process.env.ASAAS_API_KEY?.length || 0);
    console.log("[Test Payment] ASAAS_API_KEY (após getAsaasApiKey) existe:", !!ASAAS_API_KEY);
    console.log("[Test Payment] ASAAS_API_KEY (após getAsaasApiKey) valor:", JSON.stringify(ASAAS_API_KEY?.substring(0, 50) + '...'));
    console.log("[Test Payment] ASAAS_API_KEY (após getAsaasApiKey) length:", ASAAS_API_KEY?.length || 0);
    console.log("[Test Payment] INFINITYPAY_API_KEY existe:", !!INFINITYPAY_API_KEY);
    console.log("[Test Payment] Todas as variáveis ASAAS:", Object.keys(process.env).filter(k => k.includes('ASAAS')));

    // Detectar qual provedor usar (prioridade: Asaas > Infinity Pay)
    let provider: AsaasProvider | InfinityPayProvider;
    let providerName: string;

    if (ASAAS_API_KEY) {
      provider = new AsaasProvider(ASAAS_API_KEY, IS_TEST);
      providerName = "asaas";
      console.log("[Test Payment] Usando Asaas como provedor");
    } else if (INFINITYPAY_API_KEY) {
      provider = new InfinityPayProvider(INFINITYPAY_API_KEY, IS_TEST);
      providerName = "infinitypay";
      console.log("[Test Payment] Usando Infinity Pay como provedor");
    } else {
      console.error("[Test Payment] Nenhum provedor de pagamento configurado (ASAAS_API_KEY ou INFINITYPAY_API_KEY).");
      console.error("[Test Payment] Variáveis de ambiente disponíveis:", Object.keys(process.env).filter(k => k.includes('ASAAS') || k.includes('INFINITY')));
      return NextResponse.json(
        { error: "Configuração de pagamento ausente no servidor. Reinicie o servidor após configurar ASAAS_API_KEY no .env" },
        { status: 500 }
      );
    }

    const body = await req.json();
    const { tipo, data, hora, observacoes, duracaoMinutos, servicos, beats } = body; // "plano" ou "agendamento"

    let metadata: any = {
      tipo: tipo || "teste",
      userId: user.id,
      isTest: true,
    };

    // Serviços e beats: normalizar como array para o webhook registrar em Serviços Solicitados
    const servicosArray = Array.isArray(servicos) ? servicos : [];
    const beatsArray = Array.isArray(beats) ? beats : [];
    const primeiroServico = servicosArray[0];
    const primeiroBeat = beatsArray[0];
    const tipoAgendamento = primeiroServico?.id || primeiroBeat?.id || "sessao";

    // Se for teste de agendamento, criar registro temporário antes do pagamento
    if (tipo === "agendamento") {
      // Validar dados do agendamento
      if (!data || !hora) {
        return NextResponse.json(
          { error: "Data e horário são obrigatórios para teste de agendamento." },
          { status: 400 }
        );
      }

      // Verificar conflitos antes de criar o pagamento
      const dataHoraISO = new Date(`${data}T${hora}:00`);
      const duracao = duracaoMinutos || 60;

      const conflito = await prisma.appointment.findFirst({
        where: {
          status: { not: "cancelado" },
          AND: [
            { data: { lt: new Date(dataHoraISO.getTime() + (duracao * 60000)) } },
            { data: { gte: new Date(dataHoraISO.getTime() - (duracao * 60000)) } },
          ],
        },
        select: { id: true },
      });

      if (conflito) {
        return NextResponse.json(
          { error: "Já existe um agendamento neste horário." },
          { status: 409 }
        );
      }

      // Criar agendamento temporário; tipo reflete o primeiro serviço/beat selecionado
      let agendamentoTemp: { id: number };
      try {
        agendamentoTemp = await prisma.appointment.create({
          data: {
            userId: user.id,
            data: dataHoraISO,
            duracaoMinutos: duracao,
            tipo: tipoAgendamento,
            observacoes: observacoes || "Agendamento de teste - Pagamento R$ 5,00",
            status: "pendente",
          },
        });
      } catch (createErr: any) {
        const msg = String(createErr?.message || "").toLowerCase();
        // Banco em produção pode não ter colunas cancelReason/cancelledAt; inserir só colunas base
        if (msg.includes("cancelreason") || msg.includes("does not exist") || msg.includes("unknown column")) {
          const rows = await prisma.$queryRawUnsafe<[{ id: number }]>(
            `INSERT INTO "Appointment" ("userId", "data", "duracaoMinutos", "tipo", "observacoes", "status") VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
            user.id,
            dataHoraISO,
            duracao,
            tipoAgendamento,
            observacoes || "Agendamento de teste - Pagamento R$ 5,00",
            "pendente",
          );
          if (!rows?.[0]?.id) throw createErr;
          agendamentoTemp = { id: rows[0].id };
          console.log("[Test Payment] Agendamento criado via fallback (DB sem coluna cancelReason):", agendamentoTemp.id);
        } else {
          throw createErr;
        }
      }

      metadata.appointmentId = agendamentoTemp.id.toString();
      metadata.data = data;
      metadata.hora = hora;
      metadata.duracaoMinutos = duracao.toString();
      metadata.tipoAgendamento = tipoAgendamento;
      metadata.observacoes = observacoes || "Agendamento de teste - Pagamento R$ 5,00";
      metadata.servicos = servicosArray;
      metadata.beats = beatsArray;
      metadata.paymentMethod = "pix";
      console.log("[Test Payment] Agendamento temporário criado:", agendamentoTemp.id, "servicos:", servicosArray.length, "beats:", beatsArray.length);
    }

    // Se for teste de plano, NÃO criar plano antes do pagamento
    // O plano será criado apenas após pagamento confirmado no webhook
    if (tipo === "plano") {
      // Adicionar informações do plano de teste no metadata
      metadata.planId = "teste";
      metadata.planName = "Plano de Teste";
      metadata.modo = "mensal";
      metadata.amount = "5.00";
      metadata.billingDay = new Date().getDate().toString();
      metadata.paymentMethod = "pix";
      console.log("[Test Payment] Dados do plano de teste preparados para criação após pagamento");
    }

    // Criar checkout de teste com R$ 5,00
    const items = [
      {
        id: "teste-pagamento",
        title: tipo === "agendamento" 
          ? "Pagamento de Teste - Agendamento THouse Rec"
          : tipo === "plano"
          ? "Pagamento de Teste - Plano THouse Rec"
          : "Pagamento de Teste - THouse Rec",
        quantity: 1,
        unit_price: 5.00,
      },
    ];

    console.log(`[Test Payment] Criando checkout de teste com ${providerName}...`, {
      userEmail: user.email,
      tipo,
      valor: 5.00,
    });

    // Buscar CPF do usuário (obrigatório para Asaas em produção)
    const userWithCpf = await prisma.user.findUnique({
      where: { id: user.id },
      select: { cpf: true },
    });

    const cpfLimpo = userWithCpf?.cpf?.replace(/\D/g, "");
    if (!cpfLimpo || cpfLimpo.length !== 11) {
      return NextResponse.json(
        { error: "CPF é obrigatório para gerar pagamento no Asaas. Cadastre seu CPF em Perfil ou Minha Conta e tente novamente." },
        { status: 400 }
      );
    }

    // IMPORTANTE: Asaas limita externalReference a 100 caracteres
    // 1. Salvar metadata completo em PaymentMetadata ANTES de criar checkout
    // 2. Passar apenas userId no externalReference (máximo 36 caracteres)
    // 3. No webhook, buscar metadata usando userId do externalReference
    
    console.log("[Test Payment] Salvando metadata completo em PaymentMetadata...");
    
    // Criar registro de PaymentMetadata com todos os dados
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 24); // Expira em 24 horas
    
    const paymentMetadata = await prisma.paymentMetadata.create({
      data: {
        userId: user.id,
        metadata: JSON.stringify(metadata),
        expiresAt,
      },
    });
    
    console.log("[Test Payment] PaymentMetadata criado:", paymentMetadata.id);
    console.log("[Test Payment] Usando apenas userId no externalReference:", user.id);

    const checkoutResponse = await provider.createCheckout({
      items,
      payer: {
        name: user.nomeArtistico || user.email,
        email: user.email,
        cpf: cpfLimpo,
      },
      paymentMethod: undefined, // Para teste, deixar usuário escolher (UNDEFINED)
      metadata: {
        userId: user.id, // APENAS userId - metadata completo está em PaymentMetadata
      },
      backUrls: {
        success: `${SITE_URL}/pagamentos/sucesso?teste=true&tipo=${tipo || 'agendamento'}`,
        failure: `${SITE_URL}/pagamentos/falha?teste=true`,
        pending: `${SITE_URL}/pagamentos/pendente?teste=true`,
      },
    });
    
    // Vincular PaymentMetadata ao ID do pagamento Asaas para o webhook encontrar o metadata correto
    const asaasPaymentId = (checkoutResponse as { preferenceId?: string }).preferenceId;
    if (asaasPaymentId && paymentMetadata?.id) {
      try {
        await prisma.paymentMetadata.update({
          where: { id: paymentMetadata.id },
          data: { asaasId: asaasPaymentId },
        });
        console.log("[Test Payment] PaymentMetadata.asaasId atualizado:", asaasPaymentId);
      } catch (e) {
        console.warn("[Test Payment] Erro ao atualizar PaymentMetadata.asaasId:", e);
      }
    }

    console.log(`[Test Payment] Checkout criado com sucesso (${providerName}):`, checkoutResponse.initPoint);
    
    return NextResponse.json({ 
      initPoint: checkoutResponse.initPoint,
      provider: providerName,
      isTest: true,
    });
  } catch (err: any) {
    console.error("[Test Payment] Erro ao criar checkout:", err);
    
    if (err.message === "Não autenticado") {
      return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
    }
    
    // Extrair mensagem de erro mais amigável
    let errorMessage = err?.message || "Erro desconhecido ao criar pagamento de teste";
    let errorCode = 500;
    let errorDetails: any = {};
    
    // Verificar se é erro de permissão do Asaas
    if (errorMessage.includes("insufficient_permission") || errorMessage.includes("PAYMENT:WRITE")) {
      errorCode = 403;
      errorDetails = {
        tipo: "permissao_insuficiente",
        solucao: "Gere um novo token no painel do Asaas com a permissão PAYMENT:WRITE",
        guia: "Consulte o arquivo GUIA_ASAAS.md para instruções detalhadas",
      };
    } else if (errorMessage.includes("invalid_environment")) {
      errorCode = 400;
      errorDetails = {
        tipo: "ambiente_invalido",
        solucao: "Verifique se está usando o token correto (produção ou sandbox)",
      };
    } else if (errorMessage.includes("Token inválido") || errorMessage.includes("401")) {
      errorCode = 401;
      errorDetails = {
        tipo: "token_invalido",
        solucao: "Verifique se o token no arquivo .env está correto",
      };
    }
    
    // Verificar se é erro de domínio não configurado
    if (errorMessage.includes("domínio configurado") || errorMessage.includes("Cadastre um site")) {
      errorCode = 400;
      errorDetails = {
        tipo: "dominio_nao_configurado",
        solucao: "Configure um domínio no painel do Asaas (Minha Conta → Informações → Domínios). Para desenvolvimento, use LocalTunnel ou ngrok.",
        guia: "Consulte o arquivo CONFIGURAR_DOMINIO_ASAAS.md para instruções detalhadas",
      };
    }
    
    return NextResponse.json(
      { 
        error: errorMessage,
        details: errorDetails,
        debug: process.env.NODE_ENV === "development" ? {
          message: err?.message,
          stack: err?.stack,
        } : undefined
      },
      { status: errorCode }
    );
  }
}
