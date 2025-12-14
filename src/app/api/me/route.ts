import { NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";
import { cookies } from "next/headers";

export const runtime = "nodejs";

export async function GET() {
  try {
    // ⚠️ cookies() É ASYNC
    const cookieStore = await cookies();
    const sessionId = cookieStore.get("session_id")?.value;

    if (!sessionId) {
      return NextResponse.json({ user: null });
    }

    const session = await prisma.session.findUnique({
      where: { id: sessionId },
      include: { user: true },
    });

    if (!session || session.expiresAt < new Date()) {
      return NextResponse.json({ user: null });
    }

    const { user } = session;

    return NextResponse.json({
      user: {
        id: user.id,
        nomeArtistico: user.nomeArtistico,
        email: user.email,
        role: user.role,
      },
    });
  } catch (err) {
    console.error("Erro /me:", err);
    return NextResponse.json({ user: null });
  }
}
