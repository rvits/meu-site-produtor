"use client";

import { useAuth } from "../context/AuthContext";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

/* ===================== TIPOS ===================== */

type ContaData = {
  id: string;
  nomeArtistico: string;
  email: string;
  telefone: string;
  pais: string;
  estado: string;
  cidade: string;
  bairro: string;
  dataNascimento: string;
  estilosMusicais: string | null;
  nacionalidade: string | null;
  foto: string | null;
  role: string;
  createdAt: string;
};

/* ===================== PAGE ===================== */

export default function ContaPage() {
  const { user, loading, logout } = useAuth();
  const router = useRouter();

  const [form, setForm] = useState<ContaData | null>(null);
  const [loadingConta, setLoadingConta] = useState(true);

  /* 🔒 PROTEÇÃO + CARGA REAL */
  useEffect(() => {
    // ⛔ Ainda hidratando AuthContext
    if (loading) return;

    // ❌ Sem usuário → login
    if (!user) {
      router.push("/login");
      return;
    }

    // ✅ Usuário válido → buscar conta
    carregarConta(user.id);
  }, [user, loading, router]);

  async function carregarConta(userId: string) {
    try {
      const r = await fetch("/api/conta", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId }),
      });

      if (!r.ok) throw new Error("Erro ao buscar conta");

      const data: ContaData = await r.json();
      setForm(data);
    } catch (err) {
      console.error("Erro ao carregar conta:", err);
    } finally {
      setLoadingConta(false);
    }
  }

  async function salvarAlteracoes() {
    if (!form) return;

    const r = await fetch("/api/conta/update", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });

    const data = await r.json();

    if (!r.ok) {
      alert(data.error || "Erro ao salvar dados");
      return;
    }

    alert("Dados atualizados com sucesso!");
  }

  /* ===================== LOADING ===================== */

  if (loading || loadingConta) {
    return (
      <p className="mt-20 text-center text-zinc-400">
        Carregando sua conta...
      </p>
    );
  }

  if (!form) return null;

  function setCampo<K extends keyof ContaData>(
    campo: K,
    valor: ContaData[K]
  ) {
    setForm((prev) => (prev ? { ...prev, [campo]: valor } : prev));
  }

  /* ===================== UI ===================== */

  return (
    <div className="relative min-h-screen bg-black text-zinc-200 px-6 py-10">
      {/* VOLTAR */}
      <button
        onClick={() => router.push("/")}
        className="absolute left-6 top-6 rounded-full border border-red-600 px-4 py-2 text-sm font-semibold text-red-400 hover:bg-red-600 hover:text-white transition"
      >
        ← Voltar para o site
      </button>

      <div className="mx-auto max-w-3xl space-y-10">
        {/* TÍTULO */}
        <div className="text-center">
          <h1 className="text-4xl font-bold">Minha Conta</h1>
          <p className="mt-2 text-red-400 text-lg font-semibold">
            {form.nomeArtistico}
          </p>
        </div>

        {/* FOTO */}
        <div className="flex flex-col items-center gap-4">
          <div className="h-32 w-32 overflow-hidden rounded-full border border-red-600 bg-zinc-900">
            {form.foto ? (
              <img
                src={form.foto}
                alt="Foto de perfil"
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-zinc-500 text-sm">
                Sem foto
              </div>
            )}
          </div>

          <Input
            label="URL da foto"
            value={form.foto ?? ""}
            onChange={(v) => setCampo("foto", v)}
          />
        </div>

        {/* PERFIL */}
        <Section title="Perfil">
          <Input label="Nome artístico" value={form.nomeArtistico} onChange={(v) => setCampo("nomeArtistico", v)} />
          <Input label="Email" value={form.email} onChange={(v) => setCampo("email", v)} />
          <Input label="Telefone" value={form.telefone} onChange={(v) => setCampo("telefone", v)} />
          <Input
            type="date"
            label="Data de nascimento"
            value={form.dataNascimento.slice(0, 10)}
            onChange={(v) => setCampo("dataNascimento", v)}
          />
        </Section>

        {/* LOCALIZAÇÃO */}
        <Section title="Localização">
          <Input label="País" value={form.pais} onChange={(v) => setCampo("pais", v)} />
          <Input label="Estado" value={form.estado} onChange={(v) => setCampo("estado", v)} />
          <Input label="Cidade" value={form.cidade} onChange={(v) => setCampo("cidade", v)} />
          <Input label="Bairro" value={form.bairro} onChange={(v) => setCampo("bairro", v)} />
        </Section>

        {/* ARTÍSTICO */}
        <Section title="Perfil Artístico">
          <Input label="Estilos musicais" value={form.estilosMusicais ?? ""} onChange={(v) => setCampo("estilosMusicais", v)} />
          <Input label="Nacionalidade" value={form.nacionalidade ?? ""} onChange={(v) => setCampo("nacionalidade", v)} />
        </Section>

        <button
          onClick={salvarAlteracoes}
          className="w-full rounded bg-red-600 py-3 font-semibold hover:bg-red-700 transition"
        >
          Salvar alterações
        </button>

        <button
          onClick={logout}
          className="w-full rounded bg-zinc-700 py-3 font-semibold hover:bg-zinc-600 transition"
        >
          Sair da conta
        </button>
      </div>
    </div>
  );
}

/* ================= COMPONENTES ================= */

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-lg border border-red-700/40 bg-black/40 p-6">
      <h2 className="mb-4 text-lg font-semibold text-red-400">{title}</h2>
      <div className="grid grid-cols-1 gap-4">{children}</div>
    </section>
  );
}

function Input({
  label,
  value,
  onChange,
  type = "text",
}: {
  label: string;
  value: string;
  type?: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className="block">
      <span className="text-sm text-zinc-400">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full rounded bg-zinc-900 border border-zinc-700 px-3 py-2"
      />
    </label>
  );
}
