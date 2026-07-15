import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { prisma } from "./lib/prisma";
import { isGoLiveBlockedPage, isGoLiveMaintenanceMode } from "./lib/go-live-maintenance";

async function sessionIsAdmin(sessionCookie: { value: string } | undefined): Promise<boolean> {
  if (!sessionCookie) return false;
  try {
    const session = await prisma.session.findUnique({
      where: { id: sessionCookie.value },
      include: {
        user: {
          select: { email: true, role: true },
        },
      },
    });
    return Boolean(
      session &&
        session.user &&
        session.expiresAt > new Date() &&
        (session.user.role === "ADMIN" || session.user.email === "thouse.rec.tremv@gmail.com")
    );
  } catch {
    return false;
  }
}

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  // Permitir acesso a rotas de API e arquivos estáticos
  if (
    pathname.startsWith("/api") ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/icon") ||
    pathname.startsWith("/favicon")
  ) {
    return NextResponse.next();
  }

  // Verificar modo de manutenção
  try {
    let settings = await prisma.siteSettings.findUnique({
      where: { id: "main" },
    });

    // Se não existe, criar com modo desligado
    if (!settings) {
      settings = await prisma.siteSettings.create({
        data: {
          id: "main",
          maintenanceMode: false,
        },
      });
    }

    const sessionCookie = request.cookies.get("session_id");
    const isAdmin = await sessionIsAdmin(sessionCookie);

    // GO-01 — modo preparação Go Live (env): login ok; cadastro/compra/agendamento bloqueados
    if (isGoLiveMaintenanceMode()) {
      if (!isAdmin && isGoLiveBlockedPage(pathname)) {
        const url = new URL("/manutencao", request.url);
        url.searchParams.set("mode", "golive");
        return NextResponse.redirect(url);
      }
    }

    // Se modo de manutenção está ativo
    if (settings.maintenanceMode) {
      if (isAdmin) {
        return NextResponse.next();
      }

      if (pathname !== "/manutencao") {
        return NextResponse.redirect(new URL("/manutencao", request.url));
      }
    } else if (!isGoLiveMaintenanceMode() || isAdmin) {
      if (pathname === "/manutencao" && !request.nextUrl.searchParams.get("mode")) {
        return NextResponse.redirect(new URL("/", request.url));
      }
    }
  } catch (err) {
    // Em caso de erro, permitir acesso normal
    console.error("Erro no middleware de manutenção:", err);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    "/((?!api|_next/static|_next/image|favicon.ico).*)",
  ],
};
