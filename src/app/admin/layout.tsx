"use client";

import Link from "next/link";
import { useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useAuth } from "../context/AuthContext";

const MENU = [
  { label: "Dashboard", href: "/admin" },
  { label: "Agendamentos", href: "/admin/agendamentos" },
  { label: "Planos", href: "/admin/planos" },
  { label: "Usuários", href: "/admin/usuarios" },
  { label: "Serviços", href: "/admin/servicos" },
  { label: "Pagamentos", href: "/admin/pagamentos" },
  { label: "FAQ", href: "/admin/faq" },
  { label: "Chat", href: "/admin/chat" },
];

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  // 🔒 Proteção real de rota ADMIN
  useEffect(() => {
    if (!loading && (!user || user.role !== "ADMIN")) {
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

  if (!user || user.role !== "ADMIN") return null;

  return (
    <div className="min-h-screen bg-zinc-800 text-zinc-100">
      {/* HEADER ADMIN */}
      <header className="border-b border-zinc-800 bg-zinc-800">
        <div className="mx-auto max-w-7xl px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <span className="text-lg font-bold text-red-500">
              THouse Rec — Admin
            </span>

            <nav className="hidden md:flex gap-2">
              {MENU.map((item) => {
                const ativo = pathname === item.href;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`rounded-full px-4 py-1 text-sm transition ${
                      ativo
                        ? "bg-red-600 text-white"
                        : "text-zinc-300 hover:text-red-400"
                    }`}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </nav>
          </div>

          <button
            onClick={() => router.push("/")}
            className="text-xs text-zinc-400 hover:text-red-400"
          >
            Voltar ao site
          </button>
        </div>
      </header>

      {/* CONTEÚDO */}
      <main className="mx-auto max-w-7xl px-6 py-8">
        {children}
      </main>
    </div>
  );
}
