// src/app/api/payment-provider/route.ts
import { NextResponse } from "next/server";

export async function GET() {
  // Sistema simplificado: usa apenas Asaas
import { getAsaasApiKey } from "@/app/lib/env";

  const asaasKey = getAsaasApiKey();
  
  if (!asaasKey) {
    return NextResponse.json({ 
      provider: null,
      error: "ASAAS_API_KEY não configurado",
      available: {
        asaas: false,
      }
    }, { status: 500 });
  }
  
  return NextResponse.json({ 
    provider: "asaas",
    available: {
      asaas: true,
    }
  });
}
