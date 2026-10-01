"use client";

import { useState, useEffect, useLayoutEffect, useRef } from "react";
import Link from "next/link";
import { useAuth } from "../context/AuthContext";
import { useUnreadChatCount } from "../hooks/useUnreadChatCount";
import { useUnreadFaqCount } from "../hooks/useUnreadFaqCount";
import { useUnreadAppointmentCount } from "../hooks/useUnreadAppointmentCount";
import { useUnreadPlanCount } from "../hooks/useUnreadPlanCount";

function abbreviateHeaderName(nomeArtistico: string | null | undefined): string {
  const parts = nomeArtistico?.trim().split(/\s+/).filter(Boolean) ?? [];
  if (parts.length === 0) return "Usuário";
  if (parts.length === 1) return parts[0];
  return `${parts[0]} ${parts[1][0].toUpperCase()}.`;
}

const navLinks = [
  { href: "/", label: "Home" },
  { href: "/portfolio", label: "Portfólio" },
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

  useEffect(() => {
    if (!menuOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const closeOnWide = () => {
      if (window.innerWidth >= 1280) setMenuOpen(false);
    };
    window.addEventListener("resize", closeOnWide);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("resize", closeOnWide);
    };
  }, [menuOpen]);

  const isAdmin = user?.role === "ADMIN";
  const fullName = user?.nomeArtistico?.trim() ?? "";
  const displayName = abbreviateHeaderName(user?.nomeArtistico);
  const barRef = useRef<HTMLDivElement>(null);
  const logoRef = useRef<HTMLDivElement>(null);
  const navRef = useRef<HTMLElement>(null);
  const accountRef = useRef<HTMLDivElement>(null);
  const nameRef = useRef<HTMLElement>(null);

  useLayoutEffect(() => {
    const bar = barRef.current;
    const logo = logoRef.current;
    const nav = navRef.current;
    const account = accountRef.current;
    if (!bar || !logo || !nav || !account) return;

    const gap = 12;
    const nameCap = 144;
    const nameMin = 40;
    let skipResize = false;

    function place() {
      if (skipResize) return;
      const barNode = barRef.current;
      const logoNode = logoRef.current;
      const navNode = navRef.current;
      const accountNode = accountRef.current;
      const nameNode = nameRef.current;
      if (!barNode || !logoNode || !navNode || !accountNode) return;
      if (nameNode) nameNode.style.maxWidth = `${nameCap}px`;

      const barBox = barNode.getBoundingClientRect();
      const logoBox = logoNode.getBoundingClientRect();
      const navWidth = navNode.offsetWidth;
      const centerLeft = barBox.left + (barBox.width - navWidth) / 2;
      let accountBox = accountNode.getBoundingClientRect();
      const overlap = centerLeft + navWidth + gap - accountBox.left;
      if (nameNode && overlap > 1) {
        const current = nameNode.getBoundingClientRect().width;
        const next = Math.max(nameMin, Math.floor(current - overlap));
        if (nameNode.style.maxWidth !== `${next}px`) {
          skipResize = true;
          nameNode.style.maxWidth = `${next}px`;
          accountBox = accountNode.getBoundingClientRect();
          requestAnimationFrame(() => {
            skipResize = false;
          });
        }
      }

      const minLeft = logoBox.right + gap - barBox.left;
      const maxLeft = accountBox.left - gap - navWidth - barBox.left;
      const ideal = centerLeft - barBox.left;
      const left = maxLeft >= minLeft ? Math.min(Math.max(ideal, minLeft), maxLeft) : minLeft;
      navNode.style.left = `${left}px`;
      navNode.style.right = "auto";
      navNode.style.translate = "0 -50%";
      navNode.style.transform = "none";
    }

    place();
    const observer = new ResizeObserver(place);
    observer.observe(bar);
    observer.observe(account);
    window.addEventListener("resize", place);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", place);
    };
  }, [loading, displayName, isAdmin, unreadChatCount, totalMinhaContaNotifications]);

  if (loading) {
    return (
      <header className="fixed top-0 left-0 right-0 z-50 border-b border-red-700/40 bg-zinc-950/95 backdrop-blur-md shadow-lg" style={{ height: "var(--header-h, 60px)" }}>
        <div className="mx-auto h-full max-w-6xl px-4 sm:px-6" />
      </header>
    );
  }

  return (
    <header className="fixed top-0 left-0 right-0 z-50 border-b border-red-700/40 bg-zinc-950/95 backdrop-blur-md shadow-lg" style={{ height: "var(--header-h, 60px)" }}>
      {/* Desktop a partir de 1280px. A nav é centralizada na barra, não no espaço que sobra. */}
        <div ref={barRef} className="relative mx-auto hidden h-full w-full max-w-7xl items-center px-3 py-2 xl:flex 2xl:px-4">
          <div ref={logoRef} className="relative z-20 flex shrink-0 justify-start">
            <Link href="/" className="flex items-center gap-1.5 font-semibold flex-shrink-0 whitespace-nowrap">
              <div className="flex items-baseline gap-0.5">
                <span className="text-xl lg:text-2xl text-red-500" style={{ fontWeight: 900, letterSpacing: "-0.05em" }}>T</span>
                <span className="text-base lg:text-lg text-zinc-100">House Rec</span>
              </div>
            </Link>
          </div>

          <nav ref={navRef} className="absolute left-1/2 top-1/2 z-10 flex min-w-max -translate-x-1/2 -translate-y-1/2 items-center gap-1.5 text-sm min-[1366px]:gap-2 2xl:gap-3">
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
          </nav>

          <div ref={accountRef} className="relative z-20 ml-auto flex min-w-0 items-center gap-2 text-xs flex-nowrap">
          {isAdmin && (
            <Link
              href="/admin"
              className="rounded-full border-2 border-red-600 bg-red-600/10 px-3 py-1.5 font-bold text-red-400 hover:bg-red-600 hover:text-white transition-all whitespace-nowrap text-xs"
            >
              🔐 Admin
            </Link>
          )}
          {user ? (
            <>
              <span className="inline-flex min-w-0 items-baseline text-xs text-zinc-300" title={fullName || undefined}>
                <span className="shrink-0">Olá, </span>
                <b ref={nameRef} className="block min-w-0 max-w-36 truncate">{displayName}</b>
              </span>

              <Link
                href="/minha-conta"
                className="rounded-full border border-zinc-600 px-2.5 py-1 hover:bg-zinc-800 transition-colors whitespace-nowrap text-xs flex items-center gap-1.5 flex-shrink-0"
              >
                <span>Minha Conta</span>
                {totalMinhaContaNotifications > 0 && (
                  <span className="flex items-center justify-center min-w-[16px] h-[16px] px-1 rounded-full bg-red-600 text-white text-[9px] font-bold leading-none">
                    {totalMinhaContaNotifications > 99 ? "99+" : totalMinhaContaNotifications}
                  </span>
                )}
              </Link>

              <button
                onClick={logout}
                className="rounded-full bg-zinc-800 px-2.5 py-1 hover:bg-zinc-700 transition-colors whitespace-nowrap text-xs flex-shrink-0"
              >
                Sair
              </button>
            </>
          ) : (
            <>
              <Link
                href="/login"
                className="rounded-full border border-zinc-600 px-2.5 py-1 hover:bg-zinc-800 transition-colors whitespace-nowrap text-xs flex-shrink-0"
              >
                Entrar
              </Link>

              <Link
                href="/registro"
                className="rounded-full bg-red-600 px-2.5 py-1 text-white hover:bg-red-500 transition-colors whitespace-nowrap text-xs flex-shrink-0"
              >
                Registrar
              </Link>
            </>
          )}
          </div>
        </div>

        {/* Mobile: barra compacta, logo + hamburger */}
        <div className="flex xl:hidden items-center justify-between mx-auto max-w-7xl w-full h-full px-4 sm:px-6 py-2">
          <Link href="/" className="flex items-center gap-1.5 font-semibold flex-shrink-0">
            <div className="flex items-baseline gap-0.5 whitespace-nowrap">
              <span className="text-xl text-red-500" style={{ fontWeight: 900, letterSpacing: "-0.05em" }}>T</span>
              <span className="text-base text-zinc-100">House Rec</span>
            </div>
          </Link>
          <div className="flex items-center gap-2">
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

      {menuOpen && (
        <div className="xl:hidden absolute inset-x-0 top-full z-50 max-h-[calc(100dvh-var(--header-h,60px))] overflow-y-auto overscroll-contain border-t border-red-700/40 bg-zinc-950/98 backdrop-blur">
          <nav className="px-3 py-2 space-y-1">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setMenuOpen(false)}
                className="flex items-center justify-between min-h-[44px] px-3 text-[15px] leading-5 text-zinc-200 hover:text-red-400 hover:bg-zinc-900/50 rounded-lg transition-colors"
              >
                <span>{link.label}</span>
                {link.href === "/chat" && unreadChatCount > 0 && (
                  <span className="flex items-center justify-center min-w-[18px] h-[18px] px-1.5 rounded-full bg-red-600 text-white text-[10px] font-bold leading-none ml-2">
                    {unreadChatCount > 99 ? "99+" : unreadChatCount}
                  </span>
                )}
              </Link>
            ))}
            
            <div className="pt-2 border-t border-zinc-800 mt-2 space-y-1">
              {user ? (
                <>
                  <div className="min-w-0 px-3 py-2 text-[15px] leading-5 text-zinc-300" title={fullName || undefined}>
                    <span className="block min-w-0 truncate">Olá, <b>{displayName}</b></span>
                  </div>
                  <Link
                    href="/minha-conta"
                    onClick={() => setMenuOpen(false)}
                    className="flex items-center justify-between min-h-[44px] px-3 text-[15px] leading-5 text-zinc-200 hover:text-red-400 hover:bg-zinc-900/50 rounded-lg transition-colors"
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
                    className="w-full text-left min-h-[44px] px-3 text-[15px] leading-5 text-zinc-200 hover:text-red-400 hover:bg-zinc-900/50 rounded-lg transition-colors"
                  >
                    Sair
                  </button>
                </>
              ) : (
                <>
                  <Link
                    href="/login"
                    onClick={() => setMenuOpen(false)}
                    className="flex items-center min-h-[44px] px-3 text-[15px] leading-5 text-zinc-200 hover:text-red-400 hover:bg-zinc-900/50 rounded-lg transition-colors"
                  >
                    Entrar
                  </Link>
                  <Link
                    href="/registro"
                    onClick={() => setMenuOpen(false)}
                    className="flex items-center justify-center min-h-[44px] px-3 bg-red-600 text-white hover:bg-red-500 rounded-lg transition-colors text-center text-[15px] leading-5"
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
