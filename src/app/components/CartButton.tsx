"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export default function CartButton() {
  const pathname = usePathname();

  // Não mostrar em perfil, minha-conta, admin nem manutenção
  if (pathname === "/conta" || pathname?.startsWith("/minha-conta") || pathname?.startsWith("/admin") || pathname === "/manutencao") {
    return null;
  }

  return (
    <Link
      href="/carrinho"
      className="fixed top-[4.75rem] right-4 z-40 rounded-full bg-red-600 px-4 py-2 text-sm font-semibold text-white shadow-lg hover:bg-red-500 transition-colors"
      aria-label="Ir para o carrinho"
    >
      🛒 Carrinho
    </Link>
  );
}
