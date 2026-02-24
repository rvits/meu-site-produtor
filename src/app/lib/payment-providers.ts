/**
 * Interface abstrata para provedores de pagamento
 */
export interface PaymentProvider {
  createCheckout(params: CheckoutParams): Promise<CheckoutResponse>;
}

export interface CheckoutParams {
  items: CheckoutItem[];
  payer?: {
    name: string;
    email: string;
    cpf?: string;
  };
  metadata?: Record<string, any>;
  paymentMethod?: "cartao_credito" | "cartao_debito" | "pix" | "boleto";
  backUrls: {
    success: string;
    failure: string;
    pending: string;
  };
}

export interface CheckoutItem {
  id: string;
  title: string;
  quantity: number;
  unit_price: number;
  currency_id?: string;
}

export interface CheckoutResponse {
  initPoint: string;
  preferenceId?: string;
  provider: string;
}

/**
 * Implementação do Infinity Pay
 */
export class InfinityPayProvider implements PaymentProvider {
  private apiKey: string;
  private apiUrl: string;

  constructor(apiKey: string, isTest: boolean = true) {
    this.apiKey = apiKey;
    // Infinity Pay geralmente usa URLs diferentes para teste e produção
    this.apiUrl = isTest 
      ? "https://api.infinitypay.com.br/v1" // URL de teste (ajustar conforme documentação)
      : "https://api.infinitypay.com.br/v1"; // URL de produção (ajustar conforme documentação)
  }

  async createCheckout(params: CheckoutParams): Promise<CheckoutResponse> {
    try {
      // Preparar dados para Infinity Pay
      const payload = {
        amount: params.items.reduce((sum, item) => sum + (item.unit_price * item.quantity), 0),
        currency: "BRL",
        items: params.items.map(item => ({
          id: item.id,
          title: item.title,
          quantity: item.quantity,
          price: item.unit_price,
        })),
        customer: params.payer ? {
          name: params.payer.name,
          email: params.payer.email,
        } : undefined,
        metadata: params.metadata || {},
        return_url: params.backUrls.success,
        cancel_url: params.backUrls.failure,
        webhook_url: params.backUrls.pending, // Ajustar conforme necessário
      };

      console.log("[InfinityPay] Criando checkout:", JSON.stringify(payload, null, 2));

      const response = await fetch(`${this.apiUrl}/checkout`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${this.apiKey}`,
          // Ou "X-API-Key" dependendo da documentação do Infinity Pay
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error("[InfinityPay] Erro na resposta:", response.status, errorText);
        throw new Error(`Infinity Pay API error: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      
      // Ajustar conforme a estrutura de resposta do Infinity Pay
      // Geralmente retorna algo como { checkout_url, id, etc }
      const initPoint = data.checkout_url || data.url || data.payment_url;
      
      if (!initPoint) {
        console.error("[InfinityPay] Resposta sem URL de checkout:", data);
        throw new Error("Infinity Pay não retornou URL de checkout");
      }

      console.log("[InfinityPay] Checkout criado com sucesso:", initPoint);

      return {
        initPoint,
        preferenceId: data.id || data.checkout_id,
        provider: "infinitypay",
      };
    } catch (error: any) {
      console.error("[InfinityPay] Erro ao criar checkout:", error);
      throw new Error(`Erro ao criar checkout Infinity Pay: ${error.message}`);
    }
  }
}

/**
 * Implementação do Asaas
 */
export class AsaasProvider implements PaymentProvider {
  private apiKey: string;
  private apiUrl: string;

  constructor(apiKey: string, isTest: boolean = true) {
    this.apiKey = apiKey;
    
    // Detectar ambiente automaticamente pelo token
    // Tokens de produção começam com $aact_prod_
    // Tokens de sandbox começam com $aact_YTU... ou outros padrões
    const isProductionToken = apiKey.startsWith('$aact_prod_');
    
    // Se o token é de produção, usar URL de produção independente do isTest
    // Se o token é de sandbox, usar URL de sandbox
    this.apiUrl = isProductionToken
      ? "https://www.asaas.com/api/v3" // URL de produção
      : "https://sandbox.asaas.com/api/v3"; // URL de teste (sandbox)
    
    console.log(`[Asaas] Ambiente detectado: ${isProductionToken ? 'PRODUÇÃO' : 'SANDBOX'} (token: ${apiKey.substring(0, 20)}...)`);
  }

  async createCheckout(params: CheckoutParams): Promise<CheckoutResponse> {
    try {
      const totalAmount = params.items.reduce((sum, item) => sum + (item.unit_price * item.quantity), 0);
      
      // Preparar dados para Asaas
      // O Asaas precisa primeiro criar ou buscar um cliente (customer)
      let customerId: string | null = null;
      
      if (params.payer) {
        // Tentar buscar cliente existente ou criar novo (com CPF se disponível)
        customerId = await this.getOrCreateCustomer({
          name: params.payer.name,
          email: params.payer.email,
          cpf: params.payer.cpf,
        });
      }

      // Criar cobrança no Asaas
      // Mapear método de pagamento do nosso formato para o formato do Asaas
      // Opções válidas: CREDIT_CARD, DEBIT_CARD, PIX, BOLETO, UNDEFINED (usuário escolhe)
      const billingTypeMap: Record<string, string> = {
        "cartao_credito": "CREDIT_CARD",
        "cartao_debito": "DEBIT_CARD",
        "pix": "PIX",
        "boleto": "BOLETO",
      };
      
      // Se não especificar método, usar UNDEFINED para permitir que o usuário escolha
      const billingType = params.paymentMethod 
        ? billingTypeMap[params.paymentMethod] || "UNDEFINED"
        : "UNDEFINED"; // UNDEFINED permite que o usuário escolha no checkout do Asaas
      
      // IMPORTANTE: Asaas limita externalReference a 100 caracteres
      // Usar APENAS userId no externalReference (máximo 36 caracteres para UUID)
      // O metadata completo DEVE ser armazenado em PaymentMetadata ANTES de chamar createCheckout
      const externalReference = params.metadata?.userId;
      
      if (!externalReference) {
        throw new Error("userId é obrigatório no metadata para criar pagamento no Asaas");
      }
      
      // Validar que externalReference não excede 100 caracteres
      if (externalReference.length > 100) {
        throw new Error(`externalReference (${externalReference.length} caracteres) excede o limite de 100 caracteres do Asaas. Use apenas userId.`);
      }
      
      const paymentPayload: any = {
        customer: customerId || undefined,
        billingType: billingType,
        value: Number(totalAmount.toFixed(2)),
        dueDate: this.formatDateForAsaas(new Date(Date.now() + 3 * 24 * 60 * 60 * 1000)), // 3 dias a partir de hoje
        description: params.items.map(item => item.title).join(", ") || "Pagamento THouse Rec",
        externalReference: externalReference, // APENAS userId (máximo 36 caracteres)
      };

      // Log para debug (metadata completo deve estar em PaymentMetadata)
      if (params.metadata && Object.keys(params.metadata).length > 0) {
        console.log("[Asaas] ExternalReference (apenas userId):", externalReference);
        console.log("[Asaas] Metadata completo deve estar em PaymentMetadata antes desta chamada");
      }

      // Adicionar informações do cliente se não tiver customerId
      if (!customerId && params.payer) {
        paymentPayload.name = params.payer.name;
        paymentPayload.email = params.payer.email;
        if (params.payer.cpf) {
          paymentPayload.cpfCnpj = params.payer.cpf.replace(/\D/g, "");
        }
      }

      // Adicionar callback URLs se disponíveis
      // Nota: O Asaas requer que o domínio esteja configurado na conta
      // Para desenvolvimento, use LocalTunnel ou ngrok
      if (params.backUrls) {
        // Verificar se a URL é localhost
        const isLocalhost = params.backUrls.success.includes('localhost') || params.backUrls.success.includes('127.0.0.1');
        
        if (isLocalhost) {
          console.warn("[Asaas] ⚠️ Detectado localhost. Removendo callback temporariamente para permitir testes sem domínio configurado.");
          console.warn("[Asaas] ⚠️ Para produção, configure um domínio no painel do Asaas e use LocalTunnel ou ngrok para desenvolvimento.");
          console.warn("[Asaas] ⚠️ Após o pagamento, você pode acessar manualmente: /pagamentos/sucesso?tipo=agendamento");
          
          // Remover callback temporariamente se for localhost (para permitir testes sem domínio configurado)
          // Isso permite criar pagamentos mesmo sem ter um domínio configurado no Asaas
          // IMPORTANTE: Em produção, você DEVE configurar um domínio válido
          // Não adicionar callback se for localhost
        } else {
          // Se não for localhost, adicionar callback normalmente
          // Mesmo que o tunnel esteja instável, tentar adicionar o callback
          // O usuário pode acessar manualmente a página de sucesso se o redirecionamento falhar
          try {
            paymentPayload.callback = {
              successUrl: params.backUrls.success,
              autoRedirect: true,
            };
            console.log("[Asaas] ✅ Callback configurado:", params.backUrls.success);
          } catch (error) {
            console.warn("[Asaas] ⚠️ Erro ao configurar callback (não crítico):", error);
            console.warn("[Asaas] ⚠️ Após o pagamento, você pode acessar manualmente: /pagamentos/sucesso?tipo=agendamento");
          }
        }
      }

      console.log("[Asaas] Criando cobrança:", JSON.stringify(paymentPayload, null, 2));

      const response = await fetch(`${this.apiUrl}/payments`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "access_token": this.apiKey,
        },
        body: JSON.stringify(paymentPayload),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error("[Asaas] Erro na resposta:", response.status, errorText);
        
        // Tentar parsear o erro para mensagem mais clara
        let errorMessage = `Asaas API error: ${response.status}`;
        try {
          const errorData = JSON.parse(errorText);
          if (errorData.errors && Array.isArray(errorData.errors) && errorData.errors.length > 0) {
            const firstError = errorData.errors[0];
            errorMessage = `Asaas API error: ${response.status} - ${firstError.description || firstError.message || errorText}`;
            
            // Mensagens específicas para erros comuns
            if (firstError.code === "insufficient_permission") {
              errorMessage = `❌ Permissão insuficiente: A chave de API não tem a permissão PAYMENT:WRITE necessária. Por favor, gere um novo token no painel do Asaas com as permissões corretas. Veja o GUIA_ASAAS.md para instruções detalhadas.`;
            } else if (firstError.code === "invalid_environment") {
              errorMessage = `❌ Ambiente inválido: A chave de API não pertence a este ambiente. Verifique se está usando o token correto (produção ou sandbox).`;
            } else if (firstError.code === "invalid_customer.cpfCnpj") {
              errorMessage = `❌ CPF obrigatório: Para criar esta cobrança é necessário preencher o CPF ou CNPJ do cliente. Por favor, cadastre seu CPF no perfil antes de realizar o pagamento.`;
            } else if (response.status === 401) {
              errorMessage = `❌ Token inválido: A chave de API está incorreta ou expirada. Verifique o token no arquivo .env.`;
            } else if (response.status === 403) {
              errorMessage = `❌ Acesso negado: ${firstError.description || "A chave de API não tem permissão para esta operação."}`;
            }
          } else {
            errorMessage = `Asaas API error: ${response.status} - ${errorText}`;
          }
        } catch (parseError) {
          // Se não conseguir parsear, usar a mensagem original
          errorMessage = `Asaas API error: ${response.status} - ${errorText}`;
        }
        
        throw new Error(errorMessage);
      }

      const data = await response.json();
      
      // O Asaas retorna a URL de checkout no campo 'invoiceUrl' ou 'bankSlipUrl'
      // Para pagamento online, geralmente retorna 'invoiceUrl'
      const initPoint = data.invoiceUrl || data.bankSlipUrl || data.url;
      
      if (!initPoint) {
        console.error("[Asaas] Resposta sem URL de checkout:", data);
        throw new Error("Asaas não retornou URL de checkout");
      }

      console.log("[Asaas] Cobrança criada com sucesso:", initPoint);

      return {
        initPoint,
        preferenceId: data.id,
        provider: "asaas",
      };
    } catch (error: any) {
      console.error("[Asaas] Erro ao criar checkout:", error);
      throw new Error(`Erro ao criar checkout Asaas: ${error.message}`);
    }
  }

  /**
   * Busca ou cria um cliente no Asaas
   * Método público para uso externo
   */
  async getOrCreateCustomer(payer: { name: string; email: string; cpf?: string }): Promise<string | null> {
    try {
      // Primeiro, tentar buscar cliente existente por email
      const searchResponse = await fetch(`${this.apiUrl}/customers?email=${encodeURIComponent(payer.email)}`, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          "access_token": this.apiKey,
        },
      });

      if (searchResponse.ok) {
        const searchData = await searchResponse.json();
        if (searchData.data && searchData.data.length > 0) {
          const existingCustomer = searchData.data[0];
          
          // Se o cliente existe mas não tem CPF e temos CPF para atualizar, atualizar
          if (payer.cpf && !existingCustomer.cpfCnpj) {
            const updateResponse = await fetch(`${this.apiUrl}/customers/${existingCustomer.id}`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "access_token": this.apiKey,
              },
              body: JSON.stringify({
                cpfCnpj: payer.cpf.replace(/\D/g, ''), // Remove formatação
              }),
            });
            
            if (updateResponse.ok) {
              console.log("[Asaas] CPF atualizado para cliente existente");
            }
          }
          
          // Cliente já existe
          return existingCustomer.id;
        }
      }

      // Se não encontrou, criar novo cliente
      const customerPayload: any = {
        name: payer.name,
        email: payer.email,
      };

      // Adicionar CPF se disponível (Asaas exige CPF ou CNPJ)
      if (payer.cpf) {
        customerPayload.cpfCnpj = payer.cpf.replace(/\D/g, ''); // Remove formatação (só números)
      } else {
        // Asaas exige CPF ou CNPJ - não podemos criar cliente sem isso
        throw new Error("CPF é obrigatório para criar pagamentos no Asaas. Por favor, cadastre seu CPF no perfil antes de realizar o pagamento.");
      }

      const createResponse = await fetch(`${this.apiUrl}/customers`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "access_token": this.apiKey,
        },
        body: JSON.stringify(customerPayload),
      });

      if (createResponse.ok) {
        const customerData = await createResponse.json();
        return customerData.id;
      }

      // Se falhar, retornar null e continuar sem customer
      console.warn("[Asaas] Não foi possível criar/buscar cliente, continuando sem customer");
      return null;
    } catch (error) {
      console.warn("[Asaas] Erro ao buscar/criar cliente:", error);
      return null;
    }
  }

  /**
   * Formata data para o formato esperado pelo Asaas (YYYY-MM-DD)
   */
  private formatDateForAsaas(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }
}

/**
 * Implementação do Mercado Pago (mantida para compatibilidade)
 */
export class MercadoPagoProvider implements PaymentProvider {
  private accessToken: string;
  private siteUrl: string;

  constructor(accessToken: string, siteUrl: string) {
    this.accessToken = accessToken;
    this.siteUrl = siteUrl;
  }

  async createCheckout(params: CheckoutParams): Promise<CheckoutResponse> {
    // Esta implementação será movida da rota atual
    // Por enquanto, retornamos um erro indicando que precisa ser implementado
    throw new Error("Mercado Pago provider precisa ser implementado via SDK");
  }
}

/**
 * Factory para criar o provedor de pagamento baseado na configuração
 * Sistema simplificado: usa apenas Asaas
 */
export function createPaymentProvider(): PaymentProvider {
  const isTest = process.env.NODE_ENV !== "production";

  // Sistema usa apenas Asaas
  const { getAsaasApiKey } = require('./env');
  const apiKey = getAsaasApiKey();
  if (!apiKey) {
    throw new Error("ASAAS_API_KEY não configurado no .env. Configure o token do Asaas para usar o sistema de pagamentos.");
  }
  
  return new AsaasProvider(apiKey, isTest);
}
