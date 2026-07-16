"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useDomainRefresh } from "@/app/hooks/useDomainRefresh";
import { deliveryDisplayName } from "@/app/lib/delivery-url-validation";

interface Appointment {
  id: number;
  data: string;
  status: string;
  tipo: string;
  observacoes?: string | null;
}

interface PaymentInfo {
  id: string;
  amount: number;
  status: string;
  paymentMethod: string | null;
}

interface CouponInfo {
  id: string;
  code: string;
  type: string;
  status: string;
}

interface Service {
  id: string;
  tipo: string;
  description?: string | null;
  observacoes?: string | null;
  status: string;
  acceptedAt?: string;
  appointmentId: number | null;
  appointment: Appointment | null;
  deliveryAudioUrl?: string | null;
  deliveryAudioFormat?: string | null;
  payment?: PaymentInfo | null;
  coupons?: CouponInfo[];
  user: {
    nomeArtistico: string;
    email: string;
  };
  createdAt: string;
}

const COLUMN_DEFS: { key: string; label: string }[] = [
  { key: "pendente", label: "Pendentes" },
  { key: "aceito", label: "Aceitos" },
  { key: "em_andamento", label: "Em andamento" },
  { key: "recusado", label: "Recusados" },
  { key: "cancelado", label: "Cancelados" },
  { key: "concluido", label: "Concluídos" },
];

function statusBadge(status: string) {
  switch (status) {
    case "pendente":
      return { label: "Pendente", color: "bg-amber-500", text: "text-amber-300" };
    case "aceito":
      return { label: "Aceito", color: "bg-green-500", text: "text-green-300" };
    case "em_andamento":
      return { label: "Em andamento", color: "bg-blue-500", text: "text-blue-300" };
    case "recusado":
      return { label: "Recusado", color: "bg-red-500", text: "text-red-300" };
    case "cancelado":
      return { label: "Cancelado", color: "bg-zinc-500", text: "text-zinc-300" };
    case "concluido":
      return { label: "Concluído", color: "bg-purple-500", text: "text-purple-300" };
    default:
      return { label: status, color: "bg-zinc-500", text: "text-zinc-300" };
  }
}

function ServiceCard({
  s,
  onExcluir,
  excluindoId,
}: {
  s: Service;
  onExcluir: (id: string) => void;
  excluindoId: string | null;
}) {
  const badge = statusBadge(s.status);
  return (
    <div className="rounded-lg border border-zinc-700 bg-zinc-900/70 p-3 space-y-2 text-sm">
      <div className="flex items-center gap-2">
        <span className={`w-2 h-2 rounded-full ${badge.color}`} />
        <span className={`text-xs font-semibold ${badge.text}`}>{badge.label}</span>
      </div>
      <div>
        <div className="text-xs text-zinc-500">Usuário</div>
        <div className="text-zinc-100 font-medium">{s.user.nomeArtistico}</div>
        <div className="text-xs text-zinc-400">{s.user.email}</div>
      </div>
      <div>
        <div className="text-xs text-zinc-500">Tipo</div>
        <div className="text-zinc-200">{s.tipo}</div>
      </div>
      <div>
        <div className="text-xs text-zinc-500">Data</div>
        <div className="text-zinc-300">
          {s.appointment?.data
            ? new Date(s.appointment.data).toLocaleString("pt-BR")
            : new Date(s.createdAt).toLocaleString("pt-BR")}
        </div>
      </div>
      <div>
        <div className="text-xs text-zinc-500">Agendamento</div>
        {s.appointmentId != null && s.appointment ? (
          <Link
            href={`/admin/agendamentos?highlight=${s.appointment.id}`}
            className="font-mono text-red-400 hover:underline"
          >
            #{s.appointment.id} · {s.appointment.status}
          </Link>
        ) : (
          <span className="text-zinc-500">—</span>
        )}
      </div>
      <div>
        <div className="text-xs text-zinc-500">Pagamento</div>
        {s.payment ? (
          <div className="text-zinc-300">
            R$ {s.payment.amount.toFixed(2).replace(".", ",")} · {s.payment.status}
            {s.payment.paymentMethod ? ` · ${s.payment.paymentMethod}` : ""}
          </div>
        ) : (
          <span className="text-zinc-500">—</span>
        )}
      </div>
      <div>
        <div className="text-xs text-zinc-500">Entrega</div>
        {s.deliveryAudioUrl ? (
          <div className="text-zinc-300">
            {deliveryDisplayName(s.deliveryAudioUrl)}
            {s.deliveryAudioFormat ? ` (${s.deliveryAudioFormat})` : ""}
          </div>
        ) : (
          <span className="text-zinc-500">—</span>
        )}
      </div>
      <div>
        <div className="text-xs text-zinc-500">Cupons</div>
        {s.coupons && s.coupons.length > 0 ? (
          <ul className="text-xs text-zinc-300 space-y-0.5">
            {s.coupons.map((c) => (
              <li key={c.id}>
                {c.code} · {c.type} · {c.status}
              </li>
            ))}
          </ul>
        ) : (
          <span className="text-zinc-500">—</span>
        )}
      </div>
      {(s.observacoes || s.description) && (
        <div>
          <div className="text-xs text-zinc-500">Observações</div>
          <div className="text-zinc-400 text-xs">{s.observacoes || s.description}</div>
        </div>
      )}
      {s.status === "cancelado" && (
        <button
          type="button"
          onClick={() => onExcluir(s.id)}
          disabled={excluindoId === s.id}
          className="mt-1 w-full rounded border border-red-800 px-2 py-1 text-xs text-red-300 hover:bg-red-900/40 disabled:opacity-50"
        >
          {excluindoId === s.id ? "Excluindo…" : "Excluir registro"}
        </button>
      )}
    </div>
  );
}

export default function AdminServicosGeraisPage() {
  const [servicos, setServicos] = useState<Service[]>([]);
  const [busca, setBusca] = useState("");
  const [loading, setLoading] = useState(true);
  const [excluindoId, setExcluindoId] = useState<string | null>(null);

  const carregarServicos = useCallback(async (withRepair = false) => {
    try {
      if (withRepair) setLoading(true);
      const url = withRepair ? "/api/admin/servicos?repair=1" : "/api/admin/servicos";
      const res = await fetch(url, {
        cache: "no-store",
        headers: {
          "Cache-Control": "no-cache, no-store, must-revalidate",
          Pragma: "no-cache",
        },
      });
      if (res.ok) {
        const data = await res.json();
        setServicos(data.servicos || []);
      }
    } catch (err) {
      console.error("Erro ao carregar serviços", err);
    } finally {
      setLoading(false);
    }
  }, []);

  const { refresh } = useDomainRefresh("servicos-gerais", () => carregarServicos(false));

  useEffect(() => {
    void carregarServicos(true);
  }, [carregarServicos]);
  void refresh;

  const filtrados = useMemo(() => {
    if (!busca.trim()) return servicos;
    const q = busca.toLowerCase();
    return servicos.filter(
      (s) =>
        s.user.nomeArtistico.toLowerCase().includes(q) ||
        s.user.email.toLowerCase().includes(q) ||
        (s.appointment?.id && String(s.appointment.id).includes(q)) ||
        s.tipo.toLowerCase().includes(q)
    );
  }, [servicos, busca]);

  const byStatus = useMemo(() => {
    const map: Record<string, Service[]> = {};
    for (const col of COLUMN_DEFS) map[col.key] = [];
    for (const s of filtrados) {
      const key = COLUMN_DEFS.some((c) => c.key === s.status) ? s.status : "pendente";
      map[key].push(s);
    }
    return map;
  }, [filtrados]);

  async function excluirServico(id: string) {
    if (!confirm("Excluir este serviço cancelado do banco de dados? Esta ação não pode ser desfeita.")) {
      return;
    }
    try {
      setExcluindoId(id);
      const res = await fetch(`/api/admin/servicos?id=${encodeURIComponent(id)}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (res.ok) {
        await carregarServicos();
      } else {
        alert(data.error || "Erro ao excluir serviço.");
      }
    } catch (err) {
      console.error("Erro ao excluir serviço", err);
      alert("Erro ao excluir serviço.");
    } finally {
      setExcluindoId(null);
    }
  }

  if (loading) {
    return <p className="text-zinc-400">Carregando serviços gerais...</p>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-zinc-100 mb-2">Serviços Gerais</h1>
        <p className="text-zinc-400">
          Visão completa por status: usuário, pagamento, agendamento, tipo, data, entrega, cupons e
          observações.
        </p>
      </div>

      <div className="rounded-xl border border-zinc-700 bg-zinc-800/50 p-4">
        <input
          type="text"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Buscar por nome, email, tipo ou ID do agendamento..."
          className="w-full rounded-lg border border-zinc-600 bg-zinc-900 px-4 py-2 text-zinc-100 placeholder-zinc-500 focus:border-red-500 focus:outline-none"
        />
        {busca && (
          <p className="mt-2 text-sm text-zinc-400">{filtrados.length} serviço(s)</p>
        )}
      </div>

      <div className="grid gap-4 xl:grid-cols-3 lg:grid-cols-2">
        {COLUMN_DEFS.map((col) => (
          <div
            key={col.key}
            className="rounded-xl border border-zinc-700 bg-zinc-800/40 p-3 min-h-[200px]"
          >
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-zinc-100">{col.label}</h2>
              <span className="text-xs text-zinc-500">{byStatus[col.key]?.length || 0}</span>
            </div>
            <div className="space-y-3 max-h-[70vh] overflow-y-auto pr-1">
              {(byStatus[col.key] || []).length === 0 ? (
                <p className="text-xs text-zinc-500">Nenhum item.</p>
              ) : (
                (byStatus[col.key] || []).map((s) => (
                  <ServiceCard
                    key={s.id}
                    s={s}
                    onExcluir={excluirServico}
                    excluindoId={excluindoId}
                  />
                ))
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
