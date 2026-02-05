"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function EsqueciSenhaPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [novaSenha, setNovaSenha] = useState("");
  const [mensagem, setMensagem] = useState("");
  const [erro, setErro] = useState("");
  const [carregando, setCarregando] = useState(false);
  const [modoAdmin, setModoAdmin] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErro("");
    setMensagem("");
    setCarregando(true);

    try {
      const res = await fetch("/api/esqueci-senha", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, novaSenha: modoAdmin ? novaSenha : undefined }),
      });

      const data = await res.json();
      setCarregando(false);

      if (!res.ok) {
        // Verificar se é erro de email não cadastrado
        if (res.status === 404 && data.error === "email_nao_cadastrado") {
          setErro(data.message || "Este email não possui cadastro em nosso sistema.");
          return;
        }
        
        setErro(data.error || "Erro ao processar solicitação");
        // Mostrar debug se disponível
        if (data.details) {
          console.error("Erro detalhado:", data.details);
          setErro(`${data.error}\n\nDebug: ${JSON.stringify(data.details, null, 2)}`);
        }
        return;
      }

      // Mostrar informações de debug no console
      if (data.debug) {
        console.log("Debug do envio de email:", data.debug);
        if (data.debug.erro) {
          console.error("Erro ao enviar email:", data.debug.erro);
          setErro(`Erro ao enviar email: ${data.debug.erro.message || 'Erro desconhecido'}\n\nCódigo gerado: ${data.debug.codigoGerado}\n\nVerifique o terminal para mais detalhes.`);
          return;
        }
        
        // Se o email foi enviado com sucesso, mostrar mensagem
        if (data.debug.emailEnviado) {
          console.log("✅ Email enviado com sucesso! Código:", data.debug.codigoGerado);
          setMensagem(`Código enviado para ${email}. Verifique sua caixa de entrada e spam.`);
        } else {
          console.warn("⚠️ Email não foi enviado, mas não houve erro reportado.");
          setErro("Email não foi enviado. Verifique o terminal para mais detalhes.");
          return;
        }
      }

      if (modoAdmin) {
        setMensagem("Senha alterada com sucesso!");
        setEmail("");
        setNovaSenha("");
      } else {
        // Redirecionar para página de verificação de código apenas se o email foi enviado com sucesso
        router.push(`/verificar-codigo?email=${encodeURIComponent(email)}`);
      }
    } catch (err) {
      setCarregando(false);
      setErro("Erro ao processar solicitação");
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-6 py-12 text-zinc-100">
      <div className="w-full max-w-md">
        <h1 className="mb-2 text-2xl text-center font-semibold">
          Esqueci minha senha
        </h1>

        <p className="mb-6 text-sm text-center text-zinc-400">
          Digite seu email para receber um código de verificação por email.
        </p>

        <div className="mb-4 flex items-center gap-2">
          <input
            type="checkbox"
            id="modoAdmin"
            checked={modoAdmin}
            onChange={(e) => setModoAdmin(e.target.checked)}
            className="rounded border-zinc-600"
          />
          <label htmlFor="modoAdmin" className="text-xs text-zinc-400">
            Modo Admin (resetar senha diretamente)
          </label>
        </div>

        <form
          onSubmit={handleSubmit}
          className="space-y-4 rounded-2xl border border-red-700/40 bg-zinc-900 p-6"
        >
          <div className="space-y-1">
            <label className="text-xs text-zinc-300">Email</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm outline-none focus:border-red-500"
              placeholder="voce@exemplo.com"
            />
          </div>

          {modoAdmin && (
            <div className="space-y-1">
              <label className="text-xs text-zinc-300">Nova Senha</label>
              <input
                type="password"
                required={modoAdmin}
                value={novaSenha}
                onChange={(e) => setNovaSenha(e.target.value)}
                className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm outline-none focus:border-red-500"
                placeholder="Nova senha"
              />
            </div>
          )}

          {erro && (
            <div className="rounded-lg border border-red-600/50 bg-red-950/40 px-4 py-3">
              <p className="text-sm font-semibold text-red-300 mb-1">⚠️ Aviso</p>
              <p className="text-xs text-red-400">
                {erro}
              </p>
            </div>
          )}

          {mensagem && (
            <p className="rounded bg-green-950/40 px-3 py-2 text-xs text-green-400">
              {mensagem}
            </p>
          )}

          <button
            type="submit"
            disabled={carregando}
            className={`mt-2 w-full rounded-full px-4 py-2 text-sm font-semibold transition ${
              carregando
                ? "cursor-wait bg-zinc-900 text-zinc-500"
                : "bg-red-600 text-white hover:bg-red-500"
            }`}
          >
            {carregando ? "Processando..." : modoAdmin ? "Resetar Senha" : "Enviar Código"}
          </button>
        </form>

        <div className="mt-4 text-center">
          <Link
            href="/login"
            className="text-xs text-zinc-400 hover:text-red-400 underline"
          >
            Voltar para login
          </Link>
        </div>
      </div>
    </main>
  );
}
