"use client";

import { useAuth } from "../context/AuthContext";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

/* ===================== TIPOS ===================== */

type ContaData = {
  id: string;
  nomeArtistico: string;
  nomeSocial: string | null;
  email: string;
  telefone: string;
  cpf: string | null;
  pais: string;
  estado: string;
  cidade: string;
  bairro: string;
  dataNascimento: string;
  sexo: string | null;
  genero: string | null;
  generoOutro: string | null;
  estilosMusicais: string | null;
  nacionalidade: string | null;
  foto: string | null;
  role: string;
  createdAt: string;
};

function calcularIdade(dataNascimento: string): number {
  const hoje = new Date();
  const nascimento = new Date(dataNascimento);
  let idade = hoje.getFullYear() - nascimento.getFullYear();
  const mes = hoje.getMonth() - nascimento.getMonth();
  if (mes < 0 || (mes === 0 && hoje.getDate() < nascimento.getDate())) {
    idade--;
  }
  return idade;
}

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
    if (!user || !user.id) {
      router.push("/login");
      return;
    }

    // ✅ Usuário válido → buscar conta
    carregarConta();
  }, [user, loading, router]);

  async function carregarConta() {
    try {
      setLoadingConta(true);
      const r = await fetch("/api/conta", {
        method: "GET",
        credentials: "include",
      });

      if (!r.ok) {
        const errorData = await r.json().catch(() => ({}));
        const errorMessage = errorData.error || `Erro ${r.status}: ${r.statusText}`;
        console.error("Erro na resposta da API:", errorMessage, errorData);
        throw new Error(errorMessage);
      }

      const data: ContaData = await r.json();
      
      // Validar se os dados estão completos
      if (!data || !data.id) {
        throw new Error("Dados da conta incompletos");
      }
      
      setForm(data);
    } catch (err: any) {
      console.error("Erro ao carregar conta:", err);
      // Mostrar erro ao usuário
      alert(`Erro ao carregar dados da conta: ${err.message || "Erro desconhecido"}. Tente fazer login novamente.`);
      // Redirecionar para login em caso de erro de autenticação
      if (err.message?.includes("Não autenticado") || err.message?.includes("401")) {
        router.push("/login");
      }
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
    valor: ContaData[K] | string
  ) {
    setForm((prev) => {
      if (!prev) return prev;
      // Converter string vazia para null em campos opcionais
      if (valor === "" && (campo === "nomeSocial" || campo === "generoOutro")) {
        return { ...prev, [campo]: null };
      }
      return { ...prev, [campo]: valor as ContaData[K] };
    });
  }

  /* ===================== UI ===================== */

  return (
    <div className="relative min-h-screen bg-zinc-900 text-zinc-200 px-4 md:px-6 py-10">
      {/* VOLTAR */}
      <button
        onClick={() => router.push("/")}
        className="absolute left-4 md:left-6 top-4 md:top-6 rounded-full border border-red-600 px-3 md:px-4 py-1.5 md:py-2 text-xs md:text-sm font-semibold text-red-400 hover:bg-red-600 hover:text-white transition"
      >
        ← Voltar para o site
      </button>

      <div className="mx-auto max-w-3xl space-y-10 pt-12 md:pt-0">
        {/* TÍTULO */}
        <div className="text-center mt-4 md:mt-0">
          <h1 className="text-3xl md:text-4xl font-bold">Perfil</h1>
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
          <Input label="Nome social (opcional)" value={form.nomeSocial ?? ""} onChange={(v) => setCampo("nomeSocial", v || null)} />
          <Input label="Email" value={form.email} onChange={(v) => setCampo("email", v)} />
          <Input label="Telefone" value={form.telefone} onChange={(v) => setCampo("telefone", v)} />
          <Input 
            label="CPF" 
            value={form.cpf ? form.cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4') : ""} 
            onChange={(v) => {
              // Formatar CPF automaticamente (XXX.XXX.XXX-XX)
              const apenasNumeros = v.replace(/\D/g, '');
              let formatado = apenasNumeros;
              if (apenasNumeros.length > 3) {
                formatado = apenasNumeros.slice(0, 3) + '.' + apenasNumeros.slice(3);
              }
              if (apenasNumeros.length > 6) {
                formatado = apenasNumeros.slice(0, 3) + '.' + apenasNumeros.slice(3, 6) + '.' + apenasNumeros.slice(6);
              }
              if (apenasNumeros.length > 9) {
                formatado = apenasNumeros.slice(0, 3) + '.' + apenasNumeros.slice(3, 6) + '.' + apenasNumeros.slice(6, 9) + '-' + apenasNumeros.slice(9, 11);
              }
              setCampo("cpf", apenasNumeros || null);
            }}
            placeholder="000.000.000-00"
            maxLength={14}
          />
          <Input
            type="date"
            label="Data de nascimento"
            value={form.dataNascimento.slice(0, 10)}
            onChange={(v) => setCampo("dataNascimento", v)}
          />
          <div>
            <span className="text-sm text-zinc-400">Idade</span>
            <div className="mt-1 rounded bg-zinc-900 border border-zinc-700 px-3 py-2 text-zinc-300">
              {calcularIdade(form.dataNascimento)} anos
            </div>
          </div>
          <Select
            label="Sexo"
            value={form.sexo || ""}
            onChange={(v) => setCampo("sexo", v || null)}
            options={[
              { value: "", label: "Selecione..." },
              { value: "masculino", label: "Masculino" },
              { value: "feminino", label: "Feminino" },
              { value: "prefiro_nao_declarar", label: "Prefiro não declarar" },
            ]}
          />
          <Select
            label="Gênero"
            value={form.genero || ""}
            onChange={(v) => {
              setCampo("genero", v || null);
              if (v !== "outro") {
                setCampo("generoOutro", null);
              }
            }}
            options={[
              { value: "", label: "Selecione..." },
              { value: "heterossexual", label: "Heterossexual" },
              { value: "homossexual", label: "Homossexual" },
              { value: "bissexual", label: "Bissexual" },
              { value: "transsexual", label: "Transsexual" },
              { value: "nao_binario", label: "Não-binário" },
              { value: "outro", label: "Outro" },
            ]}
          />
          {form.genero === "outro" && (
            <Input
              label="Especifique seu gênero"
              value={form.generoOutro ?? ""}
              onChange={(v) => setCampo("generoOutro", v || null)}
              placeholder="Como você se identifica?"
            />
          )}
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

        {/* Botão Admin - apenas para thouse.rec.tremv@gmail.com */}
        {form.email === "thouse.rec.tremv@gmail.com" && (
          <button
            onClick={() => router.push("/admin")}
            className="w-full rounded bg-yellow-600 py-3 font-semibold hover:bg-yellow-700 transition"
          >
            🔐 Área Admin
          </button>
        )}

        <button
          onClick={logout}
          className="w-full rounded bg-zinc-900 py-3 font-semibold hover:bg-zinc-900 transition"
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
    <section className="rounded-lg border border-red-700/40 bg-zinc-900 p-6">
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
  placeholder,
  maxLength,
}: {
  label: string;
  value: string;
  type?: string;
  placeholder?: string;
  maxLength?: number;
  onChange: (v: string) => void;
}) {
  return (
    <label className="block">
      <span className="text-sm text-zinc-400">{label}</span>
      <input
        type={type}
        value={value}
        placeholder={placeholder}
        maxLength={maxLength}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full rounded bg-zinc-900 border border-zinc-700 px-3 py-2 text-zinc-100"
      />
    </label>
  );
}

function Select({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (v: string) => void;
}) {
  return (
    <label className="block">
      <span className="text-sm text-zinc-400">{label}</span>
      <div className="relative">
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="mt-1 w-full rounded bg-zinc-900 border border-zinc-700 px-3 py-2 pr-8 text-zinc-100 appearance-none cursor-pointer"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%23ffffff' d='M6 9L1 4h10z'/%3E%3C/svg%3E")`,
            backgroundRepeat: 'no-repeat',
            backgroundPosition: 'right 0.75rem center',
            backgroundSize: '12px',
            paddingRight: '2.5rem',
          }}
        >
          {options.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>
    </label>
  );
}
