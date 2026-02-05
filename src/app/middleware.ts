import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { prisma } from "./lib/prisma";

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

    // Se modo de manutenção está ativo
    if (settings.maintenanceMode) {
      // Verificar se é admin através do cookie de sessão
      const sessionCookie = request.cookies.get("session_id");
      let isAdmin = false;
      
      if (sessionCookie) {
        try {
          const session = await prisma.session.findUnique({
            where: { id: sessionCookie.value },
            include: {
              user: {
                select: {
                  email: true,
                  role: true,
                },
              },
            },
          });

          // Verificar se é admin ou thouse.rec.tremv@gmail.com
          if (
            session &&
            session.user &&
            session.expiresAt > new Date() &&
            (session.user.role === "ADMIN" || session.user.email === "thouse.rec.tremv@gmail.com")
          ) {
            isAdmin = true;
          }
        } catch (err) {
          // Se houver erro ao verificar sessão, continuar
        }
      }

      // Se é admin, permitir acesso a tudo
      if (isAdmin) {
        return NextResponse.next();
      }

      // Se não é admin e não está na página de manutenção, redirecionar
      if (pathname !== "/manutencao") {
        return NextResponse.redirect(new URL("/manutencao", request.url));
      }
    } else {
      // Se modo de manutenção está desligado e está na página de manutenção, redirecionar para home
      if (pathname === "/manutencao") {
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
