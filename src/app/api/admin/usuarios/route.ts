import { NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";
import { requireAdmin } from "@/app/lib/auth";

export async function GET() {
  try {
    await requireAdmin();

    const usuarios = await prisma.user.findMany({
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        nomeArtistico: true,
        email: true,
        role: true,
        blocked: true,
        blockedAt: true,
        blockedReason: true,
        createdAt: true,
        _count: {
          select: {
            appointments: true,
            payments: true,
            userPlans: true,
          },
        },
      },
    });

    // Buscar últimos logins de cada usuário
    const usuariosComLogins = await Promise.all(
      usuarios.map(async (user) => {
        try {
          const lastLogin = await prisma.loginLog.findFirst({
            where: { userId: user.id, success: true },
            orderBy: { createdAt: "desc" },
            select: {
              ipAddress: true,
              userAgent: true,
              createdAt: true,
            },
          });

          const loginCount = await prisma.loginLog.count({
            where: { userId: user.id, success: true },
          });

          const failedLoginCount = await prisma.loginLog.count({
            where: { userId: user.id, success: false },
          });

          return {
            ...user,
            lastLogin,
            loginCount,
            failedLoginCount,
          };
        } catch (e) {
          return { ...user, lastLogin: null, loginCount: 0, failedLoginCount: 0 };
        }
      })
    );

    return NextResponse.json({ usuarios: usuariosComLogins });
  } catch (err: any) {
    if (err.message === "Acesso negado" || err.message === "Não autenticado") {
      return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
    }
    return NextResponse.json({ error: "Erro ao buscar usuários" }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    await requireAdmin();

    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "ID é obrigatório" }, { status: 400 });
    }

    const body = await req.json();
    const { role, blocked, blockedReason } = body;

    const updateData: any = {};
    if (role !== undefined) updateData.role = role;
    if (blocked !== undefined) {
      updateData.blocked = blocked;
      if (blocked) {
        updateData.blockedAt = new Date();
        updateData.blockedReason = blockedReason || "Bloqueado pelo admin";
      } else {
        updateData.blockedAt = null;
        updateData.blockedReason = null;
      }
    }

    const usuario = await prisma.user.update({
      where: { id },
      data: updateData,
      select: {
        id: true,
        nomeArtistico: true,
        email: true,
        role: true,
        blocked: true,
        blockedAt: true,
        blockedReason: true,
      },
    });

    return NextResponse.json({ usuario });
  } catch (err: any) {
    if (err.message === "Acesso negado" || err.message === "Não autenticado") {
      return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
    }
    return NextResponse.json({ error: "Erro ao atualizar usuário" }, { status: 500 });
  }
}
