"use client";

import { useEffect, useState } from "react";
import { EngineeringDashboard } from "@/components/admin/engineering/EngineeringDashboard";
import type { EngineeringData } from "@/components/admin/engineering/types";
import { EmptyState } from "@/components/admin/engineering/shared";

export default function EngenhariaAdminPage() {
  const [data, setData] = useState<EngineeringData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch("/api/admin/engenharia/reports");
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error ?? `Erro ${res.status}`);
        }
        const json = (await res.json()) as EngineeringData;
        if (!cancelled) setData(json);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Erro ao carregar relatórios");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center text-zinc-400">
        Carregando Engineering Dashboard...
      </div>
    );
  }

  if (error || !data) {
    return (
      <EmptyState
        message={error ?? "Não foi possível carregar os relatórios de engenharia."}
      />
    );
  }

  return <EngineeringDashboard data={data} />;
}
