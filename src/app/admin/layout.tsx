"use client";

import Link from "next/link";
import { useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useAuth } from "../context/AuthContext";

// Menu sem Dashboard (Dashboard será exibido separadamente no header)
const MENU = [
  { label: "Usuários", href: "/admin/usuarios" },
  { label: "Agendamentos", href: "/admin/agendamentos" },
  { label: "Controle Agendamento", href: "/admin/controle-agendamento" },
  { label: "Planos e Cupons", href: "/admin/planos" },
  { label: "FAQ", href: "/admin/faq" },
  { label: "Serviços Solicitados", href: "/admin/servicos-solicitados" },
  { label: "Serviços Aceitos", href: "/admin/servicos-aceitos" },
  { label: "Pagamentos", href: "/admin/pagamentos" },
  { label: "Estatísticas", href: "/admin/estatisticas" },
  { label: "Chats Pendentes", href: "/admin/chats-pendentes" },
  { label: "Chats Gerais", href: "/admin/chats-gerais" },
  { label: "Pausa Virtual", href: "/admin/manutencao" },
];

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  // 🔒 Proteção real de rota ADMIN - permite por role ADMIN ou email específico
  useEffect(() => {
    if (!loading && (!user || (user.role !== "ADMIN" && user.email !== "thouse.rec.tremv@gmail.com"))) {
      router.replace("/");
    }
  }, [user, loading, router]);

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center text-zinc-400">
        Verificando permissões...
      </div>
    );
  }

  if (!user || (user.role !== "ADMIN" && user.email !== "thouse.rec.tremv@gmail.com")) return null;

  return (
    <div className="min-h-screen bg-zinc-900 text-zinc-100">
      {/* HEADER ADMIN */}
      <header className="sticky top-0 z-50 border-b border-red-700/40 bg-zinc-950/95 backdrop-blur-sm">
        <div className="mx-auto max-w-7xl px-6 py-4">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-4">
              <span className="text-xl font-bold text-red-500">
                THouse Rec — Admin
              </span>
              <button
                onClick={() => router.push("/")}
                className="text-sm text-zinc-400 hover:text-red-400 transition"
              >
                ← Voltar ao site
              </button>
            </div>
          </div>
          
          {/* DASHBOARD CENTRALIZADO */}
          <div className="flex justify-center mb-4">
            <Link
              href="/admin"
              className={`
                rounded-xl border-2 px-6 py-3 text-base font-semibold transition-all duration-300
                ${pathname === "/admin"
                  ? "bg-red-600 text-white border-red-500 shadow-lg shadow-red-600/20"
                  : "bg-gradient-to-br from-red-500/20 to-red-600/20 border-red-500/50 text-zinc-100 hover:from-red-500/30 hover:to-red-600/30 hover:border-red-500/70"
                }
              `}
            >
              📊 Dashboard
            </Link>
          </div>

          {/* NAVEGAÇÃO PRINCIPAL */}
          <nav className="flex flex-wrap gap-2 justify-center">
            {MENU.map((item) => {
              const ativo = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`rounded-lg px-4 py-2 text-sm font-medium transition whitespace-nowrap ${
                    ativo
                      ? "bg-red-600 text-white shadow-lg shadow-red-600/20"
                      : "text-zinc-300 hover:text-red-400 hover:bg-zinc-800 border border-zinc-700"
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>
      </header>

      {/* CONTEÚDO */}
      <main className="mx-auto max-w-7xl px-6 py-8">
        {children}
      </main>
    </div>
  );
}
