import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { prisma } from "./prisma";

export async function getSessionUser() {
  const cookieStore = await cookies();
  const sessionId = cookieStore.get("session_id")?.value;

  if (!sessionId) return null;

  const session = await prisma.session.findUnique({
    where: { id: sessionId },
    include: { user: true },
  });

  if (!session || session.expiresAt < new Date()) {
    return null;
  }

  return session.user;
}

export async function requireAuth() {
  const user = await getSessionUser();
  if (!user) {
    throw new Error("Não autenticado");
  }
  return user;
}

export async function requireAdmin() {
  const user = await requireAuth();
  // Permite acesso se for ADMIN ou se for o email específico
  if (user.role !== "ADMIN" && user.email !== "thouse.rec.tremv@gmail.com") {
    throw new Error("Acesso negado");
  }
  return user;
}

export function unauthorizedResponse(message = "Não autorizado") {
  return NextResponse.json({ error: message }, { status: 401 });
}
