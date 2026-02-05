"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../context/AuthContext";

export default function RegistroPage() {
  const { registro } = useAuth();
  const router = useRouter();

  // ===== Dados principais =====
  const [nomeCompleto, setNomeCompleto] = useState("");
  const [nomeArtistico, setNomeArtistico] = useState("");
  const [email, setEmail] = useState("");
  const [telefone, setTelefone] = useState("");
  const [cpf, setCpf] = useState("");
  const [senha, setSenha] = useState("");
  const [confirmar, setConfirmar] = useState("");

  // ===== Localização =====
  const [pais, setPais] = useState("Brasil");
  const [estado, setEstado] = useState("");
  const [cidade, setCidade] = useState("");
  const [bairro, setBairro] = useState("");

  // ===== Perfil =====
  const [dataNascimento, setDataNascimento] = useState("");
  const [nomeSocial, setNomeSocial] = useState("");
  const [sexo, setSexo] = useState("");
  const [genero, setGenero] = useState("");
  const [generoOutro, setGeneroOutro] = useState("");
  const [estilosMusicais, setEstilosMusicais] = useState("");
  const [nacionalidade, setNacionalidade] = useState("");

  // Calcular idade
  function calcularIdade(data: string): number {
    if (!data) return 0;
    const hoje = new Date();
    const nascimento = new Date(data);
    let idade = hoje.getFullYear() - nascimento.getFullYear();
    const mes = hoje.getMonth() - nascimento.getMonth();
    if (mes < 0 || (mes === 0 && hoje.getDate() < nascimento.getDate())) {
      idade--;
    }
    return idade;
  }

  const idade = calcularIdade(dataNascimento);
  const menorDeIdade = idade > 0 && idade < 18;

  // ===== UI =====
  const [mostrarSenha, setMostrarSenha] = useState(false);
  const [mostrarConfirmar, setMostrarConfirmar] = useState(false);
  const [aceiteTermos, setAceiteTermos] = useState(false);
  const [erro, setErro] = useState("");
  const [carregando, setCarregando] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErro("");

    if (senha !== confirmar) {
      setErro("As senhas não conferem.");
      return;
    }

    if (!aceiteTermos) {
      setErro("É necessário aceitar os termos de uso para se registrar.");
      return;
    }

    setCarregando(true);

    const ok = await registro({
      nomeCompleto,
      nomeArtistico,
      nomeSocial: nomeSocial || null,
      email,
      senha,
      telefone,
      cpf: cpf.replace(/\D/g, ''), // Remove formatação, só números
      pais,
      estado,
      cidade,
      bairro,
      dataNascimento,
      sexo: sexo || null,
      genero: genero || null,
      generoOutro: genero && genero === "outro" ? generoOutro : null,
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
        {/* Nome completo */}
        <Input
          label="Nome completo"
          value={nomeCompleto}
          onChange={setNomeCompleto}
          placeholder="Seu nome completo de registro"
          required
        />

        {/* Nome artístico */}
        <Input
          label="Nome artístico"
          value={nomeArtistico}
          onChange={setNomeArtistico}
          placeholder="Tremv, Dizzy, etc."
          required
        />

        {/* Nome social */}
        <Input
          label="Nome social (opcional)"
          value={nomeSocial}
          onChange={setNomeSocial}
          placeholder="Como você gostaria de ser chamado"
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

        {/* CPF */}
        <Input
          label="CPF"
          value={cpf}
          onChange={(value: string) => {
            // Formatar CPF automaticamente (XXX.XXX.XXX-XX)
            const apenasNumeros = value.replace(/\D/g, '');
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
            setCpf(formatado);
          }}
          placeholder="000.000.000-00"
          required
          maxLength={14}
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

        {/* Idade calculada */}
        {idade > 0 && (
          <div className="rounded-lg border border-zinc-700 bg-zinc-800/50 px-3 py-2 text-sm text-zinc-300">
            <strong>Idade:</strong> {idade} anos
          </div>
        )}

        {/* Mensagem para menores de 18 anos */}
        {menorDeIdade && (
          <div className="rounded-lg border border-yellow-600/50 bg-yellow-950/20 p-4 text-sm text-yellow-200">
            <p className="font-semibold mb-2">⚠️ Autorização Necessária</p>
            <p>
              Para menores de 18 anos, é necessário enviar uma autorização por escrito do responsável legal 
              para o email de contato da THouse Rec antes de realizar qualquer serviço ou assinar planos.
            </p>
            <p className="mt-2 text-xs text-yellow-300">
              Email: contato@thouse-rec.com.br (será atualizado em breve)
            </p>
          </div>
        )}

        {/* Sexo */}
        <Select
          label="Sexo"
          value={sexo}
          onChange={setSexo}
          options={[
            { value: "", label: "Selecione..." },
            { value: "masculino", label: "Masculino" },
            { value: "feminino", label: "Feminino" },
            { value: "prefiro_nao_declarar", label: "Prefiro não declarar" },
          ]}
        />

        {/* Gênero */}
        <Select
          label="Gênero"
          value={genero}
          onChange={(v) => {
            setGenero(v);
            if (v !== "outro") {
              setGeneroOutro("");
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

        {/* Gênero Outro */}
        {genero === "outro" && (
          <Input
            label="Especifique seu gênero"
            value={generoOutro}
            onChange={setGeneroOutro}
            placeholder="Como você se identifica?"
          />
        )}

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

        {/* Checkbox de aceite dos termos */}
        <div className="flex items-start gap-2">
          <input
            type="checkbox"
            id="aceite-termos-registro"
            checked={aceiteTermos}
            onChange={(e) => setAceiteTermos(e.target.checked)}
            className="mt-1 h-4 w-4 cursor-pointer rounded border-zinc-600 bg-zinc-900 text-red-600 focus:ring-2 focus:ring-red-500 focus:ring-offset-0"
            required
          />
          <label
            htmlFor="aceite-termos-registro"
            className="text-xs text-white cursor-pointer"
          >
            Li e aceito os{" "}
            <a
              href="/termos-contratos"
              target="_blank"
              className="!text-blue-400 underline underline-offset-2 hover:!text-blue-300 transition-colors"
              style={{ color: '#60a5fa' }}
              onClick={(e) => e.stopPropagation()}
            >
              termos de uso
            </a>
          </label>
        </div>

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
    <div className="space-y-1">
      <label className="text-xs text-zinc-300">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 pr-8 text-sm text-zinc-100 outline-none focus:border-red-500 appearance-none cursor-pointer"
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
