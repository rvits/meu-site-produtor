import { NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";
import { requireAdmin } from "@/app/lib/auth";

export async function GET() {
  try {
    await requireAdmin();

    // Contar estatísticas (com tratamento de erro se modelos não existirem ainda)
    let appointments = 0;
    let users = 0;
    let payments = 0;
    let activePlans = 0;
    let services = 0;
    let pendingChats = 0;

    try {
      appointments = await prisma.appointment.count();
    } catch (e) {}

    try {
      users = await prisma.user.count();
    } catch (e) {}

    try {
      payments = await prisma.payment.count();
    } catch (e) {}

    try {
      activePlans = await prisma.userPlan.count({
        where: { status: "active" },
      });
    } catch (e) {}

    try {
      services = await prisma.service.count();
    } catch (e) {}

    try {
      pendingChats = await prisma.chatSession.count({
        where: { humanRequested: true, adminAccepted: false },
      });
    } catch (e) {}

    return NextResponse.json({
      appointments,
      users,
      payments,
      activePlans,
      services,
      pendingChats,
    });
  } catch (err: any) {
    console.error("Erro ao buscar stats:", err);
    if (err.message === "Acesso negado" || err.message === "Não autenticado") {
      return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
    }
    return NextResponse.json({ error: "Erro ao buscar estatísticas" }, { status: 500 });
  }
}
