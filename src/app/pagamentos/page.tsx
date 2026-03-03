"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function PagamentosPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/carrinho");
  }, [router]);

  return (
    <main className="flex min-h-screen items-center justify-center px-6 py-12 text-zinc-100">
      <div className="text-center">
        <p className="text-zinc-400">Redirecionando para o carrinho...</p>
      </div>
    </main>
  );
}
