import { getAsaasApiKey } from "./env";

/**
 * Faz reembolso direto de um pagamento no Asaas
 */
export async function refundAsaasPayment(paymentId: string, value?: number, description?: string) {
  try {
    const apiKey = getAsaasApiKey();
    if (!apiKey) {
      throw new Error("API key do Asaas não configurada");
    }

    const isProduction = apiKey.startsWith("$aact_prod_");
    const apiUrl = isProduction
      ? "https://www.asaas.com/api/v3"
      : "https://sandbox.asaas.com/api/v3";

    const refundPayload: any = {
      value: value, // Valor a reembolsar (opcional, se não informar reembolsa tudo)
      description: description || "Reembolso de cancelamento de plano",
    };

    console.log(`[Asaas Refund] Fazendo reembolso do pagamento ${paymentId}:`, refundPayload);

    const response = await fetch(`${apiUrl}/payments/${paymentId}/refund`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "access_token": apiKey,
      },
      body: JSON.stringify(refundPayload),
    });

    const responseText = await response.text();
    
    if (!response.ok) {
      console.error(`[Asaas Refund] Erro ao fazer reembolso:`, {
        status: response.status,
        response: responseText,
      });
      throw new Error(`Erro ao fazer reembolso no Asaas: ${response.status} - ${responseText}`);
    }

    let refundData;
    try {
      refundData = JSON.parse(responseText);
    } catch (parseError) {
      console.error("[Asaas Refund] Erro ao parsear resposta:", parseError);
      throw new Error("Erro ao processar resposta do reembolso");
    }

    console.log("[Asaas Refund] Reembolso realizado com sucesso:", refundData);

    return refundData;
  } catch (error: any) {
    console.error("[Asaas Refund] Erro:", error);
    throw error;
  }
}
