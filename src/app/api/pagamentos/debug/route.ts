// src/app/api/pagamentos/debug/route.ts
// Rota de debug para verificar problemas sem autenticação
import { NextResponse } from "next/server";
import { getAsaasApiKey } from "@/app/lib/env";

export async function GET(req: Request) {
  try {
    const apiKey = getAsaasApiKey();
    
    return NextResponse.json({
      apiKeyConfigured: !!apiKey,
      apiKeyType: apiKey ? (apiKey.startsWith("$aact_prod_") ? "produção" : "sandbox") : "não configurado",
      apiKeyPreview: apiKey ? `${apiKey.substring(0, 20)}...` : null,
      nodeEnv: process.env.NODE_ENV,
      siteUrl: process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000",
    });
  } catch (error: any) {
    return NextResponse.json({
      error: error.message,
      stack: error.stack,
    }, { status: 500 });
  }
}
