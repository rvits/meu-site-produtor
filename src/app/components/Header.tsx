"use client";

import Link from "next/link";
import { useAuth } from "../context/AuthContext";

const navLinks = [
  { href: "/", label: "Home" },
  { href: "/agendamento", label: "Agendamento" },
  { href: "/planos", label: "Planos" },
  { href: "/faq", label: "FAQ" },
  { href: "/chat", label: "Chat" },
  { href: "/termos-contratos", label: "Termos de Contrato" },
  { href: "/shopping", label: "Shopping" },
  { href: "/contato", label: "Contato" },
];

export default function Header() {
  const { user, logout, loading } = useAuth();

  if (loading) {
    return (
      <header className="sticky top-0 z-20 border-b border-red-700/40 bg-zinc-950/80 backdrop-blur">
        <div className="mx-auto h-[72px] max-w-6xl px-6" />
      </header>
    );
  }

  const isAdmin = user?.role === "ADMIN";

  return (
    <header className="sticky top-0 z-20 border-b border-red-700/40 bg-zinc-950/80 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
        <Link href="/" className="flex items-baseline gap-1 font-semibold">
          <span className="text-3xl text-red-500" style={{ fontWeight: 900, letterSpacing: "-0.05em" }}>T</span>
          <span className="text-xl text-zinc-100">House Rec</span>
        </Link>

        <nav className="hidden md:flex gap-6 text-sm items-center">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="text-zinc-200 hover:text-red-400"
            >
              {link.label}
            </Link>
          ))}

          {isAdmin && (
            <Link
              href="/admin"
              className="ml-2 rounded-full border-2 border-red-600 bg-red-600/10 px-4 py-2 text-xs font-bold text-red-400 hover:bg-red-600 hover:text-white transition-all"
            >
              🔐 Admin
            </Link>
          )}
        </nav>

        {/* Botão Admin Mobile */}
        {isAdmin && (
          <Link
            href="/admin"
            className="md:hidden rounded-full border-2 border-red-600 bg-red-600/10 px-3 py-2 text-xs font-bold text-red-400 hover:bg-red-600 hover:text-white transition-all"
          >
            Admin
          </Link>
        )}

        <div className="flex items-center gap-3 text-xs">
          {user ? (
            <>
              <span className="hidden md:inline text-zinc-300">
                Olá, <b>{user.nomeArtistico}</b>
              </span>

              <Link
                href="/conta"
                className="rounded-full border border-zinc-600 px-3 py-1 hover:bg-zinc-800"
              >
                Conta
              </Link>

              <button
                onClick={logout}
                className="rounded-full bg-zinc-800 px-3 py-1 hover:bg-zinc-700"
              >
                Sair
              </button>
            </>
          ) : (
            <>
              <Link
                href="/login"
                className="rounded-full border border-zinc-600 px-3 py-1 hover:bg-zinc-800"
              >
                Entrar
              </Link>

              <Link
                href="/registro"
                className="rounded-full bg-red-600 px-3 py-1 text-white hover:bg-red-500"
              >
                Registrar
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
