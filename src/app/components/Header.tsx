"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useAuth } from "../context/AuthContext";
import { useUnreadChatCount } from "../hooks/useUnreadChatCount";
import { useUnreadFaqCount } from "../hooks/useUnreadFaqCount";
import { useUnreadAppointmentCount } from "../hooks/useUnreadAppointmentCount";
import { useUnreadPlanCount } from "../hooks/useUnreadPlanCount";

const navLinks = [
  { href: "/", label: "Home" },
  { href: "/agendamento", label: "Agendamento" },
  { href: "/planos", label: "Planos" },
  { href: "/faq", label: "FAQ" },
  { href: "/chat", label: "Chat" },
  { href: "/termos-contratos", label: "Termos" },
  { href: "/shopping", label: "Shopping" },
  { href: "/contato", label: "Contato" },
];

export default function Header() {
  const { user, logout, loading } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const unreadChatCount = useUnreadChatCount();
  const unreadFaqCount = useUnreadFaqCount();
  const unreadAppointmentCount = useUnreadAppointmentCount();
  const unreadPlanCount = useUnreadPlanCount();
  
  // Somar todas as notificações de "Minha Conta" (FAQ + Agendamentos + Planos)
  const totalMinhaContaNotifications = unreadFaqCount + unreadAppointmentCount + unreadPlanCount;

  // Debug: log do unreadChatCount
  useEffect(() => {
    if (unreadChatCount > 0) {
      console.log(`[Header] 🔔 Badge deve aparecer com ${unreadChatCount} mensagens`);
    } else {
      console.log(`[Header] ⚪ Sem mensagens não lidas (unreadChatCount = ${unreadChatCount})`);
    }
  }, [unreadChatCount]);

  if (loading) {
    return (
      <header className="fixed top-0 left-0 right-0 z-50 border-b border-red-700/40 bg-zinc-950/95 backdrop-blur-md shadow-lg">
        <div className="mx-auto h-[72px] max-w-6xl px-4 sm:px-6" />
      </header>
    );
  }

  const isAdmin = user?.role === "ADMIN";

  return (
    <header className="fixed top-0 left-0 right-0 z-50 border-b border-red-700/40 bg-zinc-950/95 backdrop-blur-md shadow-lg">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 sm:px-6 py-3 sm:py-4">
        {/* Logo - Fixada à esquerda */}
        <Link href="/" className="flex items-center gap-2 font-semibold flex-shrink-0">
          <div className="flex items-baseline gap-1">
            <span className="text-2xl sm:text-3xl text-red-500" style={{ fontWeight: 900, letterSpacing: "-0.05em" }}>T</span>
            <span className="text-lg sm:text-xl text-zinc-100">House Rec</span>
          </div>
        </Link>

        {/* Menu Desktop - Centralizado */}
        <nav className="hidden lg:flex gap-4 xl:gap-6 text-sm items-center flex-1 justify-center px-4">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="text-zinc-200 hover:text-red-400 transition-colors whitespace-nowrap flex items-center gap-2"
            >
              <span>{link.label}</span>
              {link.href === "/chat" && unreadChatCount > 0 && (
                <span className="flex items-center justify-center min-w-[18px] h-[18px] px-1.5 rounded-full bg-red-600 text-white text-[10px] font-bold leading-none">
                  {unreadChatCount > 99 ? "99+" : unreadChatCount}
                </span>
              )}
            </Link>
          ))}

          {isAdmin && (
            <Link
              href="/admin"
              className="ml-2 rounded-full border-2 border-red-600 bg-red-600/10 px-3 sm:px-4 py-1.5 sm:py-2 text-xs font-bold text-red-400 hover:bg-red-600 hover:text-white transition-all whitespace-nowrap"
            >
              🔐 Admin
            </Link>
          )}
        </nav>

        {/* Botões de Ação Desktop - Direita */}
        <div className="hidden md:flex items-center gap-2 sm:gap-2.5 text-xs flex-shrink-0">
          {user ? (
            <>
              <span className="hidden xl:inline text-zinc-300 text-xs whitespace-nowrap">
                Olá, <b>{user.nomeArtistico}</b>
              </span>

              <Link
                href="/conta"
                className="rounded-full border border-zinc-600 px-3 py-1.5 hover:bg-zinc-800 transition-colors whitespace-nowrap text-xs"
              >
                Perfil
              </Link>

              <Link
                href="/minha-conta"
                className="rounded-full border border-zinc-600 px-3 py-1.5 hover:bg-zinc-800 transition-colors whitespace-nowrap text-xs flex items-center gap-2"
              >
                <span>Minha Conta</span>
                {totalMinhaContaNotifications > 0 && (
                  <span className="flex items-center justify-center min-w-[18px] h-[18px] px-1.5 rounded-full bg-red-600 text-white text-[10px] font-bold leading-none">
                    {totalMinhaContaNotifications > 99 ? "99+" : totalMinhaContaNotifications}
                  </span>
                )}
              </Link>

              <button
                onClick={logout}
                className="rounded-full bg-zinc-800 px-3 py-1.5 hover:bg-zinc-700 transition-colors whitespace-nowrap text-xs"
              >
                Sair
              </button>
            </>
          ) : (
            <>
              <Link
                href="/login"
                className="rounded-full border border-zinc-600 px-3 py-1.5 hover:bg-zinc-800 transition-colors whitespace-nowrap text-xs"
              >
                Entrar
              </Link>

              <Link
                href="/registro"
                className="rounded-full bg-red-600 px-3 py-1.5 text-white hover:bg-red-500 transition-colors whitespace-nowrap text-xs"
              >
                Registrar
              </Link>
            </>
          )}
        </div>

        {/* Menu Mobile - Links visíveis em telas médias */}
        <nav className="hidden md:flex lg:hidden gap-3 text-xs items-center flex-1 justify-center px-2">
          {navLinks.slice(0, 4).map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="text-zinc-200 hover:text-red-400 transition-colors whitespace-nowrap flex items-center gap-1.5"
            >
              <span>{link.label}</span>
              {link.href === "/chat" && unreadChatCount > 0 && (
                <span className="flex items-center justify-center min-w-[18px] h-[18px] px-1.5 rounded-full bg-red-600 text-white text-[10px] font-bold leading-none">
                  {unreadChatCount > 99 ? "99+" : unreadChatCount}
                </span>
              )}
            </Link>
          ))}
        </nav>

        {/* Botão Hambúrguer Mobile */}
        <div className="flex md:hidden items-center gap-2">
          {isAdmin && (
            <Link
              href="/admin"
              className="rounded-full border-2 border-red-600 bg-red-600/10 px-2 py-1.5 text-xs font-bold text-red-400"
            >
              Admin
            </Link>
          )}
          
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="p-2 text-zinc-200 hover:text-red-400 transition-colors"
            aria-label="Menu"
          >
            <svg
              className="w-6 h-6"
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              {menuOpen ? (
                <path d="M6 18L18 6M6 6l12 12" />
              ) : (
                <path d="M4 6h16M4 12h16M4 18h16" />
              )}
            </svg>
          </button>
        </div>
      </div>

      {/* Menu Mobile */}
      {menuOpen && (
        <div className="md:hidden border-t border-red-700/40 bg-zinc-950/95 backdrop-blur">
          <nav className="px-4 py-4 space-y-2">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setMenuOpen(false)}
                className="flex items-center justify-between py-2 px-3 text-zinc-200 hover:text-red-400 hover:bg-zinc-900/50 rounded-lg transition-colors"
              >
                <span>{link.label}</span>
                {link.href === "/chat" && unreadChatCount > 0 && (
                  <span className="flex items-center justify-center min-w-[18px] h-[18px] px-1.5 rounded-full bg-red-600 text-white text-[10px] font-bold leading-none ml-2">
                    {unreadChatCount > 99 ? "99+" : unreadChatCount}
                  </span>
                )}
              </Link>
            ))}
            
            <div className="pt-4 border-t border-zinc-800 mt-4 space-y-2">
              {user ? (
                <>
                  <div className="px-3 py-2 text-zinc-300 text-sm">
                    Olá, <b>{user.nomeArtistico}</b>
                  </div>
                  <Link
                    href="/conta"
                    onClick={() => setMenuOpen(false)}
                    className="block py-2 px-3 text-zinc-200 hover:text-red-400 hover:bg-zinc-900/50 rounded-lg transition-colors"
                  >
                    Perfil
                  </Link>
                  <Link
                    href="/minha-conta"
                    onClick={() => setMenuOpen(false)}
                    className="flex items-center justify-between py-2 px-3 text-zinc-200 hover:text-red-400 hover:bg-zinc-900/50 rounded-lg transition-colors"
                  >
                    <span>Minha Conta</span>
                    {totalMinhaContaNotifications > 0 && (
                      <span className="flex items-center justify-center min-w-[18px] h-[18px] px-1.5 rounded-full bg-red-600 text-white text-[10px] font-bold leading-none ml-2">
                        {totalMinhaContaNotifications > 99 ? "99+" : totalMinhaContaNotifications}
                      </span>
                    )}
                  </Link>
                  <button
                    onClick={() => {
                      setMenuOpen(false);
                      logout();
                    }}
                    className="w-full text-left py-2 px-3 text-zinc-200 hover:text-red-400 hover:bg-zinc-900/50 rounded-lg transition-colors"
                  >
                    Sair
                  </button>
                </>
              ) : (
                <>
                  <Link
                    href="/login"
                    onClick={() => setMenuOpen(false)}
                    className="block py-2 px-3 text-zinc-200 hover:text-red-400 hover:bg-zinc-900/50 rounded-lg transition-colors"
                  >
                    Entrar
                  </Link>
                  <Link
                    href="/registro"
                    onClick={() => setMenuOpen(false)}
                    className="block py-2 px-3 bg-red-600 text-white hover:bg-red-500 rounded-lg transition-colors text-center"
                  >
                    Registrar
                  </Link>
                </>
              )}
            </div>
          </nav>
        </div>
      )}
    </header>
  );
}
