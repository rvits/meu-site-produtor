"use client";

import { useSearchParams } from "next/navigation";
import { GO_LIVE_MAINTENANCE_MESSAGE } from "@/app/lib/go-live-maintenance";

export default function ManutencaoPage() {
  const searchParams = useSearchParams();
  const isGoLive = searchParams.get("mode") === "golive";

  return (
    <div className="min-h-screen bg-gradient-to-br from-zinc-900 via-zinc-800 to-zinc-900 flex items-center justify-center px-4">
      <div className="max-w-2xl w-full text-center space-y-8">
        <div className="space-y-4">
          <div className="text-6xl md:text-8xl font-bold text-red-500 mb-4">
            <span className="text-red-500">T</span>House Rec
          </div>
          <h1 className="text-3xl md:text-4xl font-bold text-zinc-100 mb-4">
            {isGoLive ? "Preparativos para o lançamento" : "Site em Manutenção"}
          </h1>
          <p className="text-lg md:text-xl text-zinc-300 leading-relaxed">
            {isGoLive ? (
              GO_LIVE_MAINTENANCE_MESSAGE
            ) : (
              <>
                Estamos realizando atualizações para melhorar sua experiência.
                <br />
                Voltaremos em breve!
              </>
            )}
          </p>
        </div>

        <div className="pt-8">
          <div className="inline-block animate-spin rounded-full h-16 w-16 border-4 border-red-500 border-t-transparent"></div>
        </div>

        <div className="pt-4 text-sm text-zinc-400">
          <p>Obrigado pela sua paciência.</p>
        </div>
      </div>
    </div>
  );
}
