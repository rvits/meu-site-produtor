"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../context/AuthContext";

export default function RegistroPage() {
  const { registro } = useAuth();
  const router = useRouter();

  // ===== Dados principais =====
  const [nomeArtistico, setNomeArtistico] = useState("");
  const [email, setEmail] = useState("");
  const [telefone, setTelefone] = useState("");
  const [senha, setSenha] = useState("");
  const [confirmar, setConfirmar] = useState("");

  // ===== Localização =====
  const [pais, setPais] = useState("Brasil");
  const [estado, setEstado] = useState("");
  const [cidade, setCidade] = useState("");
  const [bairro, setBairro] = useState("");

  // ===== Perfil =====
  const [dataNascimento, setDataNascimento] = useState("");
  const [estilosMusicais, setEstilosMusicais] = useState("");
  const [nacionalidade, setNacionalidade] = useState("");

  // ===== UI =====
  const [mostrarSenha, setMostrarSenha] = useState(false);
  const [mostrarConfirmar, setMostrarConfirmar] = useState(false);
  const [erro, setErro] = useState("");
  const [carregando, setCarregando] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErro("");

    if (senha !== confirmar) {
      setErro("As senhas não conferem.");
      return;
    }

    setCarregando(true);

    const ok = await registro({
      nomeArtistico,
      email,
      senha,
      telefone,
      pais,
      estado,
      cidade,
      bairro,
      dataNascimento,
      estilosMusicais: estilosMusicais || null,
      nacionalidade: nacionalidade || null,
    });

    setCarregando(false);

    if (!ok) {
      setErro(
        "Não foi possível registrar. Verifique os dados ou se o email já está em uso."
      );
      return;
    }

    router.push("/conta");
  }

  return (
    <main className="mx-auto max-w-xl px-6 py-12 text-zinc-100">
      <h1 className="mb-2 text-2xl font-semibold text-center">
        Criar conta na THouse Rec
      </h1>

      <p className="mb-8 text-center text-sm text-zinc-400">
        Crie seu acesso para gerenciar agendamentos, planos e produções com o
        Tremv.
      </p>

      <form
        onSubmit={handleSubmit}
        className="space-y-5 rounded-2xl border border-red-700/40 bg-zinc-900 p-6"
      >
        {/* Nome artístico */}
        <Input
          label="Nome artístico"
          value={nomeArtistico}
          onChange={setNomeArtistico}
          placeholder="Tremv, Dizzy, etc."
          required
        />

        {/* Email */}
        <Input
          label="Email"
          type="email"
          value={email}
          onChange={setEmail}
          placeholder="voce@exemplo.com"
          required
        />

        {/* Telefone */}
        <Input
          label="Telefone"
          value={telefone}
          onChange={setTelefone}
          placeholder="+55 (21) 99999-9999"
          required
        />

        {/* Localização */}
        <div className="grid gap-4 md:grid-cols-2">
          <Input label="País" value={pais} onChange={setPais} required />
          <Input label="Estado" value={estado} onChange={setEstado} required />
          <Input label="Cidade" value={cidade} onChange={setCidade} required />
          <Input label="Bairro" value={bairro} onChange={setBairro} required />
        </div>

        {/* Data nascimento */}
        <Input
          label="Data de nascimento"
          type="date"
          value={dataNascimento}
          onChange={setDataNascimento}
          required
        />

        {/* Estilos */}
        <Input
          label="Estilos musicais (opcional)"
          value={estilosMusicais}
          onChange={setEstilosMusicais}
          placeholder="Trap, Boom bap, Drill..."
        />

        {/* Nacionalidade */}
        <Input
          label="Nacionalidade (opcional)"
          value={nacionalidade}
          onChange={setNacionalidade}
        />

        {/* Senha */}
        <PasswordInput
          label="Senha"
          value={senha}
          onChange={setSenha}
          mostrar={mostrarSenha}
          toggle={() => setMostrarSenha((v) => !v)}
        />

        <PasswordInput
          label="Confirmar senha"
          value={confirmar}
          onChange={setConfirmar}
          mostrar={mostrarConfirmar}
          toggle={() => setMostrarConfirmar((v) => !v)}
        />

        {erro && (
          <p className="rounded bg-red-950/40 px-3 py-2 text-xs text-red-400">
            {erro}
          </p>
        )}

        <button
          type="submit"
          disabled={carregando}
          className={`w-full rounded-full px-4 py-3 text-sm font-semibold transition ${
            carregando
              ? "cursor-wait bg-zinc-900 text-zinc-500"
              : "bg-red-600 text-white hover:bg-red-500"
          }`}
        >
          {carregando ? "Criando conta..." : "Criar conta"}
        </button>
      </form>
    </main>
  );
}

/* ======================================================
   COMPONENTES AUXILIARES
====================================================== */

function Input({
  label,
  value,
  onChange,
  type = "text",
  placeholder,
  required,
}: any) {
  return (
    <div className="space-y-1">
      <label className="text-xs text-zinc-300">{label}</label>
      <input
        type={type}
        required={required}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm outline-none focus:border-red-500"
      />
    </div>
  );
}

function PasswordInput({
  label,
  value,
  onChange,
  mostrar,
  toggle,
}: any) {
  return (
    <div className="space-y-1">
      <label className="text-xs text-zinc-300">{label}</label>
      <div className="relative">
        <input
          type={mostrar ? "text" : "password"}
          required
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 pr-16 text-sm outline-none focus:border-red-500"
        />
        <button
          type="button"
          onClick={toggle}
          className="absolute inset-y-0 right-2 text-xs text-zinc-400 hover:text-red-400"
        >
          {mostrar ? "Ocultar" : "Ver"}
        </button>
      </div>
    </div>
  );
}
