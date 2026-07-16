"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/app/context/AuthContext";
import { isSchedulableServiceType } from "@/app/lib/service-catalog";

type CouponPayload = {
  code: string;
  typeLabel: string;
  serviceType: string | null;
  exclusiveScheduling: boolean;
  checkoutDiscount: boolean;
  used: boolean;
  status: string;
  catalogItem: { id: string; nome: string; preco: number; category: "service" | "beat" } | null;
};

const HORARIOS = ["10:00", "11:00", "12:00", "14:00", "15:00", "16:00", "17:00", "18:00", "19:00", "20:00"];

export default function AgendamentoCupomPage() {
  const params = useParams();
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const codigo = String(params?.codigo || "").toUpperCase();

  const [coupon, setCoupon] = useState<CouponPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [dataSelecionada, setDataSelecionada] = useState<string>("");
  const [horaSelecionada, setHoraSelecionada] = useState<string>("");
  const [observacoes, setObservacoes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    if (!codigo) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/coupons/${encodeURIComponent(codigo)}`, {
        cache: "no-store",
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Cupom inválido.");
        setCoupon(null);
        return;
      }
      const c = data.coupon as CouponPayload;
      if (c.checkoutDiscount && !c.exclusiveScheduling) {
        router.replace(`/agendamento?cupom=${encodeURIComponent(c.code)}`);
        return;
      }
      if (!c.exclusiveScheduling) {
        setError("Este cupom não abre agenda exclusiva.");
        setCoupon(null);
        return;
      }
      if (c.used || c.status === "utilizado") {
        setError("Este cupom já foi utilizado.");
      }
      setCoupon(c);
    } catch {
      setError("Erro ao carregar cupom.");
    } finally {
      setLoading(false);
    }
  }, [codigo, router]);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.push(`/login?redirect=/agendamento/cupom/${encodeURIComponent(codigo)}`);
      return;
    }
    void load();
  }, [authLoading, user, load, router, codigo]);

  const precisaAgenda = useMemo(() => {
    if (!coupon?.serviceType) return true;
    return isSchedulableServiceType(coupon.serviceType);
  }, [coupon]);

  const minDate = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() + (precisaAgenda ? 0 : 0));
    return d.toISOString().slice(0, 10);
  }, [precisaAgenda]);

  async function confirmar() {
    if (!coupon?.catalogItem || !coupon.serviceType) {
      alert("Cupom sem serviço vinculado.");
      return;
    }
    if (!dataSelecionada || !horaSelecionada) {
      alert(precisaAgenda ? "Selecione data e horário." : "Informe a data e horário de referência.");
      return;
    }
    const item = {
      id: coupon.catalogItem.id,
      nome: coupon.catalogItem.nome,
      quantidade: 1,
      preco: coupon.catalogItem.preco,
    };
    const body = {
      data: dataSelecionada,
      hora: horaSelecionada,
      duracaoMinutos: 60,
      tipo: coupon.serviceType,
      observacoes: observacoes || `Resgate cupom ${coupon.code}`,
      servicos: coupon.catalogItem.category === "service" ? [item] : [],
      beats: coupon.catalogItem.category === "beat" ? [item] : [],
      cupomCode: coupon.code,
    };

    try {
      setSubmitting(true);
      const res = await fetch("/api/agendamentos/com-cupom", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || "Não foi possível agendar com este cupom.");
        return;
      }
      alert("Agendamento criado com sucesso. Acompanhe em Minha Conta.");
      router.push("/minha-conta");
    } catch {
      alert("Erro inesperado ao agendar.");
    } finally {
      setSubmitting(false);
    }
  }

  if (authLoading || loading) {
    return (
      <main className="min-h-screen bg-zinc-950 text-zinc-100 flex items-center justify-center p-6">
        <p className="text-zinc-400">Carregando cupom…</p>
      </main>
    );
  }

  if (error && !coupon) {
    return (
      <main className="min-h-screen bg-zinc-950 text-zinc-100 p-6">
        <div className="max-w-lg mx-auto space-y-4">
          <h1 className="text-2xl font-semibold text-red-400">Cupom indisponível</h1>
          <p className="text-zinc-300">{error}</p>
          <Link href="/minha-conta" className="text-red-400 underline">
            Voltar para Minha Conta
          </Link>
        </div>
      </main>
    );
  }

  if (!coupon?.catalogItem) {
    return (
      <main className="min-h-screen bg-zinc-950 text-zinc-100 p-6">
        <div className="max-w-lg mx-auto space-y-4">
          <h1 className="text-2xl font-semibold text-red-400">Serviço do cupom inválido</h1>
          <p className="text-zinc-300">
            O cupom {coupon?.code} não possui um serviço reconhecido no catálogo.
          </p>
          <Link href="/minha-conta" className="text-red-400 underline">
            Voltar para Minha Conta
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100 p-4 md:p-8">
      <div className="max-w-xl mx-auto space-y-6">
        <div>
          <p className="text-xs uppercase tracking-wide text-zinc-500">Agenda exclusiva do cupom</p>
          <h1 className="text-2xl font-bold text-zinc-100 mt-1">{coupon.catalogItem.nome}</h1>
          <p className="text-sm text-zinc-400 mt-1">
            Código <span className="font-mono text-zinc-200">{coupon.code}</span> · {coupon.typeLabel}
          </p>
          <p className="text-sm text-zinc-500 mt-2">
            Serviço travado. Não é possível adicionar outros itens nem passar pelo Asaas.
          </p>
          {error && <p className="text-sm text-amber-400 mt-2">{error}</p>}
        </div>

        <div className="rounded-xl border border-zinc-700 bg-zinc-900/60 p-4 space-y-4">
          <div>
            <label className="block text-xs text-zinc-400 mb-1">
              {precisaAgenda ? "Data da sessão" : "Data de referência"}
            </label>
            <input
              type="date"
              min={minDate}
              value={dataSelecionada}
              onChange={(e) => setDataSelecionada(e.target.value)}
              className="w-full rounded-lg border border-zinc-600 bg-zinc-950 px-3 py-2 text-zinc-100"
            />
          </div>
          <div>
            <label className="block text-xs text-zinc-400 mb-1">Horário</label>
            <div className="grid grid-cols-3 gap-2">
              {HORARIOS.map((h) => (
                <button
                  key={h}
                  type="button"
                  onClick={() => setHoraSelecionada(h)}
                  className={[
                    "rounded border px-2 py-1.5 text-sm",
                    horaSelecionada === h
                      ? "border-red-500 bg-red-600/20 text-red-200"
                      : "border-zinc-600 text-zinc-300 hover:border-zinc-400",
                  ].join(" ")}
                >
                  {h}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-xs text-zinc-400 mb-1">Observações (opcional)</label>
            <textarea
              value={observacoes}
              onChange={(e) => setObservacoes(e.target.value)}
              rows={3}
              className="w-full rounded-lg border border-zinc-600 bg-zinc-950 px-3 py-2 text-sm text-zinc-100"
              placeholder="Detalhes do projeto…"
            />
          </div>
          <button
            type="button"
            disabled={submitting || coupon.used}
            onClick={() => void confirmar()}
            className="w-full rounded-lg bg-red-600 px-4 py-3 text-sm font-semibold text-white hover:bg-red-500 disabled:opacity-50"
          >
            {submitting ? "Agendando…" : "Confirmar agendamento com cupom"}
          </button>
        </div>

        <Link href="/minha-conta" className="text-sm text-zinc-400 hover:text-zinc-200">
          ← Voltar para Minha Conta
        </Link>
      </div>
    </main>
  );
}
