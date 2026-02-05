"use client";

import { usePathname } from "next/navigation";
import Header from "./Header";

export default function ConditionalHeader() {
  const pathname = usePathname();
  
  // Não renderizar Header nas rotas admin e manutenção
  if (pathname?.startsWith("/admin") || pathname === "/manutencao") {
    return null;
  }
  
  return <Header />;
}
