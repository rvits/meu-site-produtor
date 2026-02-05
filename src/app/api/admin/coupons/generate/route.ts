import { NextResponse } from "next/server";
import { requireAdmin } from "@/app/lib/auth";
import { prisma } from "@/app/lib/prisma";
import { generateCouponCode } from "@/app/lib/coupons";

export async function POST(req: Request) {
  try {
    await requireAdmin();

    const body = await req.json();
    const { 
      discountType = "fixed", // "percent" ou "fixed"
      discountValue, 
      appointmentId,
      userId,
      expiresInDays = 90 // Expira em 90 dias por padrão
    } = body;

    if (!discountValue || discountValue <= 0) {
      return NextResponse.json(
        { error: "Valor do desconto é obrigatório" },
        { status: 400 }
      );
    }

    if (discountType !== "percent" && discountType !== "fixed") {
      return NextResponse.json(
        { error: "Tipo de desconto inválido (deve ser 'percent' ou 'fixed')" },
        { status: 400 }
      );
    }

    // Gerar código único
    let code = generateCouponCode();
    let attempts = 0;
    while (attempts < 10) {
      const exists = await prisma.coupon.findUnique({
        where: { code },
      });
      if (!exists) break;
      code = generateCouponCode();
      attempts++;
    }

    if (attempts >= 10) {
      return NextResponse.json(
        { error: "Erro ao gerar código único. Tente novamente." },
        { status: 500 }
      );
    }

    // Calcular data de expiração
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + expiresInDays);

    // Criar cupom
    const coupon = await prisma.coupon.create({
      data: {
        code,
        discountType,
        discountValue,
        appointmentId: appointmentId || null,
        usedBy: userId || null,
        expiresAt,
      },
    });

    return NextResponse.json({
      coupon: {
        id: coupon.id,
        code: coupon.code,
        discountType: coupon.discountType,
        discountValue: coupon.discountValue,
        expiresAt: coupon.expiresAt,
      },
    });
  } catch (error: any) {
    console.error("[API] Erro ao gerar cupom:", error);
    if (error.message === "Acesso negado" || error.message === "Não autenticado") {
      return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
    }
    return NextResponse.json(
      { error: "Erro ao gerar cupom" },
      { status: 500 }
    );
  }
}
