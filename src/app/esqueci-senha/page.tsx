"use client";

/**
 * Esqueci senha — fluxo seguro: email → código → verificação → troca.
 * GO-04A.1: removido modo admin / reset direto apenas com email.
 */

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  AuthShell,
  Button,
  Callout,
  Field,
  Input,
  COPY,
} from "@/components/design-system";

export default function EsqueciSenhaPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [mensagem, setMensagem] = useState("");
  const [erro, setErro] = useState("");
  const [carregando, setCarregando] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErro("");
    setMensagem("");
    setCarregando(true);

    try {
      const res = await fetch("/api/esqueci-senha", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      const data = await res.json();
      setCarregando(false);

      if (!res.ok) {
        if (res.status === 404 && data.error === "email_nao_cadastrado") {
          setErro(data.message || "Este email não possui cadastro em nosso sistema.");
          return;
        }

        setErro(
          typeof data.error === "string"
            ? data.error
            : "Erro ao processar solicitação"
        );
        return;
      }

      setMensagem(`Código enviado para ${email}. Verifique sua caixa de entrada e spam.`);
      router.push(`/verificar-codigo?email=${encodeURIComponent(email)}`);
    } catch {
      setCarregando(false);
      setErro("Erro ao processar solicitação");
    }
  }

  return (
    <AuthShell
      title="Esqueci minha senha"
      subtitle="Digite seu email para receber um código de verificação."
      footer={
        <p className="text-center text-xs">
          <Link href="/login" className="text-zinc-400 hover:text-red-400 underline underline-offset-2">
            Voltar para login
          </Link>
        </p>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-3">
        <Field label="Email">
          <Input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="voce@exemplo.com"
            autoComplete="email"
          />
        </Field>

        {erro && (
          <Callout intent="error" title="Não foi possível continuar">
            <span className="whitespace-pre-wrap">{erro}</span>
          </Callout>
        )}

        {mensagem && (
          <Callout intent="success" title={COPY.states.success}>
            {mensagem}
          </Callout>
        )}

        <Button type="submit" variant="primary" fullWidth size="md" loading={carregando}>
          {carregando ? COPY.states.processing : "Enviar código"}
        </Button>
      </form>
    </AuthShell>
  );
}
