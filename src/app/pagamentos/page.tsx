"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "../context/AuthContext";
import Link from "next/link";

type TipoPagamento = "plano" | "agendamento";

function PagamentosContent() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  
  const [formData, setFormData] = useState({
    nome: "",
    dataNascimento: "",
    cpf: "",
    pais: "",
    cidade: "",
    bairro: "",
    cep: "",
    formaPagamento: "",
    aceiteTermos: false,
  });

  const [erros, setErros] = useState<Record<string, string>>({});
  const [carregando, setCarregando] = useState(false);
  const [tipoPagamento, setTipoPagamento] = useState<TipoPagamento | null>(null);
  const [resumoPagamento, setResumoPagamento] = useState<any>(null);
  const [paymentProvider, setPaymentProvider] = useState<"asaas" | "infinitypay" | "mercadopago">("asaas");

  // Detectar qual provedor de pagamento usar
  useEffect(() => {
    fetch("/api/payment-provider")
      .then(res => res.json())
      .then(data => {
        if (data.provider) {
          setPaymentProvider(data.provider);
        }
      })
      .catch(err => {
        console.error("[Pagamentos] Erro ao detectar provedor:", err);
        // Default para asaas se houver erro
        setPaymentProvider("asaas");
      });
  }, []);

  // Verificar tipo de pagamento e carregar dados do usuário
  useEffect(() => {
    if (authLoading) return;

    if (!user) {
      router.push("/login?redirect=/pagamentos");
      return;
    }

    // Verificar se veio de agendamento ou plano
    const tipo = searchParams.get("tipo") as TipoPagamento;
    const planId = searchParams.get("planId");
    const modo = searchParams.get("modo");
    const agendamentoData = searchParams.get("agendamento");

    if (tipo === "plano" && planId && modo) {
      setTipoPagamento("plano");
      // Carregar dados do plano
      fetch(`/api/planos?planId=${planId}&modo=${modo}`)
        .then((res) => res.json())
        .then((data) => {
          setResumoPagamento({
            tipo: "plano",
            planId,
            modo,
            ...data,
          });
        });
    } else if (tipo === "agendamento" && agendamentoData) {
      setTipoPagamento("agendamento");
      try {
        const agendamento = JSON.parse(decodeURIComponent(agendamentoData));
        setResumoPagamento({
          tipo: "agendamento",
          ...agendamento,
        });
      } catch (e) {
        console.error("Erro ao parsear dados do agendamento:", e);
      }
    }

    // Carregar dados completos do usuário da API
    if (user) {
      fetch("/api/conta")
        .then((res) => res.json())
        .then((data) => {
          if (data && !data.error) {
            setFormData((prev) => ({
              ...prev,
              nome: data.nomeArtistico || user.nomeArtistico || "",
              pais: data.pais || "",
              cidade: data.cidade || "",
              bairro: data.bairro || "",
              cep: data.cep || "",
              cpf: data.cpf || "",
              dataNascimento: data.dataNascimento
                ? new Date(data.dataNascimento).toISOString().split("T")[0]
                : "",
            }));
          } else {
            // Fallback para dados básicos do contexto
            setFormData((prev) => ({
              ...prev,
              nome: user.nomeArtistico || "",
            }));
          }
        })
        .catch((err) => {
          console.error("[Pagamentos] Erro ao carregar dados do usuário:", err);
          // Fallback para dados básicos do contexto
          setFormData((prev) => ({
            ...prev,
            nome: user.nomeArtistico || "",
          }));
        });
    }
  }, [user, authLoading, router, searchParams]);

  const handleChange = (campo: string, valor: string | boolean) => {
    setFormData((prev) => ({ ...prev, [campo]: valor }));
    // Limpar erro do campo quando o usuário começar a digitar
    if (erros[campo]) {
      setErros((prev) => {
        const novos = { ...prev };
        delete novos[campo];
        return novos;
      });
    }
  };

  const validarFormulario = (): boolean => {
    const novosErros: Record<string, string> = {};

    if (!formData.nome || formData.nome.length < 2) {
      novosErros.nome = "Nome deve ter no mínimo 2 caracteres";
    }

    if (!formData.dataNascimento) {
      novosErros.dataNascimento = "Data de nascimento é obrigatória";
    }

    if (!formData.cpf || !/^\d{11}$/.test(formData.cpf.replace(/\D/g, ""))) {
      novosErros.cpf = "CPF deve conter 11 dígitos";
    }

    if (!formData.pais) {
      novosErros.pais = "País é obrigatório";
    }

    if (!formData.cidade) {
      novosErros.cidade = "Cidade é obrigatória";
    }

    if (!formData.bairro) {
      novosErros.bairro = "Bairro é obrigatório";
    }

    if (!formData.cep || !/^\d{8}$/.test(formData.cep.replace(/\D/g, ""))) {
      novosErros.cep = "CEP deve conter 8 dígitos";
    }

    if (!formData.formaPagamento) {
      novosErros.formaPagamento = "Selecione a forma de pagamento";
    }

    if (!formData.aceiteTermos) {
      novosErros.aceiteTermos = "É necessário aceitar os termos de contrato";
    }

    setErros(novosErros);
    return Object.keys(novosErros).length === 0;
  };

  const formatarCPF = (valor: string) => {
    const apenasNumeros = valor.replace(/\D/g, "");
    if (apenasNumeros.length <= 11) {
      return apenasNumeros;
    }
    return apenasNumeros.slice(0, 11);
  };

  const formatarCEP = (valor: string) => {
    const apenasNumeros = valor.replace(/\D/g, "");
    if (apenasNumeros.length <= 8) {
      return apenasNumeros;
    }
    return apenasNumeros.slice(0, 8);
  };

  const handlePagar = async () => {
    if (!validarFormulario()) {
      // Scroll para o primeiro erro
      const primeiroErro = Object.keys(erros)[0];
      if (primeiroErro) {
        const elemento = document.querySelector(`[name="${primeiroErro}"]`);
        if (elemento) {
          elemento.scrollIntoView({ behavior: "smooth", block: "center" });
        }
      }
      return;
    }

    try {
      setCarregando(true);

      // Primeiro, salvar/atualizar dados do usuário
      const cpfFormatado = formatarCPF(formData.cpf);
      const cepFormatado = formatarCEP(formData.cep);

      await fetch("/api/conta/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nomeArtistico: formData.nome,
          dataNascimento: formData.dataNascimento,
          cpf: cpfFormatado,
          pais: formData.pais,
          cidade: formData.cidade,
          bairro: formData.bairro,
          cep: cepFormatado,
        }),
      });

      // Usar o provedor detectado
      const providerPrefix = paymentProvider;
      
      // Depois, criar pagamento no provedor escolhido
      let endpoint = `/api/${providerPrefix}/checkout`;
      let body: any = {};

      if (tipoPagamento === "plano" && resumoPagamento) {
        body = {
          planId: resumoPagamento.planId,
          modo: resumoPagamento.modo,
          paymentMethod: formData.formaPagamento,
        };
      } else if (tipoPagamento === "agendamento" && resumoPagamento) {
        // Criar endpoint para pagamento de agendamento
        endpoint = `/api/${providerPrefix}/checkout-agendamento`;
        body = {
          servicos: resumoPagamento.servicos || [],
          beats: resumoPagamento.beats || [],
          data: resumoPagamento.data,
          hora: resumoPagamento.hora,
          duracaoMinutos: resumoPagamento.duracaoMinutos || 60,
          tipo: resumoPagamento.tipo || "sessao",
          observacoes: resumoPagamento.observacoes || "",
          total: resumoPagamento.total || 0,
          paymentMethod: formData.formaPagamento,
          cupomCode: resumoPagamento.cupomCode || undefined, // Incluir código do cupom se aplicado
        };
      } else {
        alert("Tipo de pagamento não identificado. Tente novamente.");
        return;
      }

      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        let errorMessage = "Erro ao criar pagamento. Tente novamente.";
        try {
          const error = await res.json();
          console.error("[Pagamentos] Erro na API:", JSON.stringify(error, null, 2));
          errorMessage = error.error || error.message || errorMessage;
          if (error.debug) {
            console.error("[Pagamentos] Debug info:", error.debug);
          }
        } catch (parseError) {
          console.error("[Pagamentos] Erro ao parsear resposta de erro:", parseError);
          const textError = await res.text();
          console.error("[Pagamentos] Resposta de erro (texto):", textError);
          errorMessage = `Erro ${res.status}: ${textError || errorMessage}`;
        }
        alert(errorMessage);
        return;
      }

      let data;
      try {
        data = await res.json();
        console.log("[Pagamentos] Resposta da API:", JSON.stringify(data, null, 2));
      } catch (parseError) {
        console.error("[Pagamentos] Erro ao parsear resposta:", parseError);
        const textResponse = await res.text();
        console.error("[Pagamentos] Resposta (texto):", textResponse);
        alert("Erro ao processar resposta do servidor. Verifique o console para mais detalhes.");
        return;
      }

      if (data.initPoint) {
        console.log("[Pagamentos] Redirecionando para:", data.initPoint);
        window.location.href = data.initPoint;
      } else {
        console.error("[Pagamentos] Resposta sem initPoint:", JSON.stringify(data, null, 2));
        alert("Não foi possível obter o link de pagamento. Verifique o console para mais detalhes.");
      }
    } catch (e) {
      console.error(e);
      alert("Erro inesperado ao iniciar o pagamento.");
    } finally {
      setCarregando(false);
    }
  };

  if (authLoading) {
    return (
      <main className="mx-auto max-w-3xl px-6 py-10 text-zinc-100">
        <div className="flex h-64 items-center justify-center text-zinc-400">
          Carregando...
        </div>
      </main>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <main className="mx-auto max-w-5xl px-6 py-10 text-zinc-100">
      <section className="mb-8 space-y-4">
        <h1 className="text-2xl font-semibold md:text-3xl text-center">
          Finalizar Pagamento{" "}
          <span className="text-red-500">THouse Rec</span>
        </h1>

        <p className="text-sm leading-relaxed text-zinc-300 md:text-base text-center">
          Preencha suas informações para finalizar o pagamento. O pagamento é
          processado com segurança pelo <strong>Asaas</strong>, onde você
          poderá escolher <strong>Pix, cartão de crédito, cartão de débito, boleto</strong> ou
          outras formas disponíveis.
        </p>
      </section>

      {/* RESUMO DO PAGAMENTO */}
      {resumoPagamento && (
        <section className="mb-8 rounded-2xl border border-red-500 bg-zinc-900/50 p-6 space-y-3">
          <h2 className="text-lg font-semibold text-red-400">
            Resumo do pagamento
          </h2>

          {resumoPagamento.tipo === "plano" && (
            <>
              <p className="text-zinc-300">
                <strong>Tipo:</strong> {resumoPagamento.nome || "Plano"}
              </p>
              <p className="text-zinc-300">
                <strong>Periodicidade:</strong>{" "}
                {resumoPagamento.modo === "mensal" ? "Mensal" : "Anual"}
              </p>
              <p className="text-lg font-semibold text-yellow-300">
                Total: R$ {resumoPagamento.valor?.toFixed(2).replace(".", ",") || "0,00"}
              </p>
            </>
          )}

          {resumoPagamento.tipo === "agendamento" && (
            <>
              <p className="text-zinc-300">
                <strong>Data:</strong>{" "}
                {resumoPagamento.data
                  ? new Date(resumoPagamento.data).toLocaleDateString("pt-BR")
                  : "-"}
              </p>
              <p className="text-zinc-300">
                <strong>Hora:</strong> {resumoPagamento.hora || "-"}
              </p>
              <p className="text-zinc-300">
                <strong>Serviços:</strong> {resumoPagamento.servicos?.length || 0} serviço(s)
              </p>
              <p className="text-lg font-semibold text-yellow-300">
                Total: R$ {resumoPagamento.total?.toFixed(2).replace(".", ",") || "0,00"}
              </p>
            </>
          )}

          <p className="text-xs text-zinc-400">
            Ao continuar, você será direcionado para o ambiente seguro do
            Asaas. A compra só será concluída após a confirmação do
            pagamento e o aceite dos <strong>termos de uso</strong> e do{" "}
            <strong>contrato de prestação de serviço</strong> da THouse Rec.
          </p>
        </section>
      )}

      {/* FORMULÁRIO */}
      <section className="mb-8 rounded-2xl border border-red-500 bg-zinc-900/50 p-6 space-y-6">
        <h2 className="text-lg font-semibold text-red-400">
          Informações para Pagamento
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Nome */}
          <div>
            <label className="block text-sm font-medium text-zinc-300 mb-2">
              Nome Completo *
            </label>
            <input
              type="text"
              name="nome"
              value={formData.nome}
              onChange={(e) => handleChange("nome", e.target.value)}
              className={`w-full rounded-lg border bg-zinc-800 px-4 py-2 text-sm text-zinc-100 focus:outline-none ${
                erros.nome ? "border-red-500" : "border-zinc-600 focus:border-red-500"
              }`}
              placeholder="Seu nome completo"
            />
            {erros.nome && (
              <p className="mt-1 text-xs text-red-400">{erros.nome}</p>
            )}
          </div>

          {/* Data de Nascimento */}
          <div>
            <label className="block text-sm font-medium text-zinc-300 mb-2">
              Data de Nascimento *
            </label>
            <input
              type="date"
              name="dataNascimento"
              value={formData.dataNascimento}
              onChange={(e) => handleChange("dataNascimento", e.target.value)}
              className={`w-full rounded-lg border bg-zinc-800 px-4 py-2 text-sm text-zinc-100 focus:outline-none ${
                erros.dataNascimento
                  ? "border-red-500"
                  : "border-zinc-600 focus:border-red-500"
              }`}
            />
            {erros.dataNascimento && (
              <p className="mt-1 text-xs text-red-400">{erros.dataNascimento}</p>
            )}
          </div>

          {/* CPF */}
          <div>
            <label className="block text-sm font-medium text-zinc-300 mb-2">
              CPF *
            </label>
            <input
              type="text"
              name="cpf"
              value={formData.cpf}
              onChange={(e) => handleChange("cpf", formatarCPF(e.target.value))}
              className={`w-full rounded-lg border bg-zinc-800 px-4 py-2 text-sm text-zinc-100 focus:outline-none ${
                erros.cpf ? "border-red-500" : "border-zinc-600 focus:border-red-500"
              }`}
              placeholder="00000000000"
              maxLength={11}
            />
            {erros.cpf && (
              <p className="mt-1 text-xs text-red-400">{erros.cpf}</p>
            )}
          </div>

          {/* País */}
          <div>
            <label className="block text-sm font-medium text-zinc-300 mb-2">
              País *
            </label>
            <input
              type="text"
              name="pais"
              value={formData.pais}
              onChange={(e) => handleChange("pais", e.target.value)}
              className={`w-full rounded-lg border bg-zinc-800 px-4 py-2 text-sm text-zinc-100 focus:outline-none ${
                erros.pais ? "border-red-500" : "border-zinc-600 focus:border-red-500"
              }`}
              placeholder="Brasil"
            />
            {erros.pais && (
              <p className="mt-1 text-xs text-red-400">{erros.pais}</p>
            )}
          </div>

          {/* Cidade */}
          <div>
            <label className="block text-sm font-medium text-zinc-300 mb-2">
              Cidade *
            </label>
            <input
              type="text"
              name="cidade"
              value={formData.cidade}
              onChange={(e) => handleChange("cidade", e.target.value)}
              className={`w-full rounded-lg border bg-zinc-800 px-4 py-2 text-sm text-zinc-100 focus:outline-none ${
                erros.cidade ? "border-red-500" : "border-zinc-600 focus:border-red-500"
              }`}
              placeholder="Sua cidade"
            />
            {erros.cidade && (
              <p className="mt-1 text-xs text-red-400">{erros.cidade}</p>
            )}
          </div>

          {/* Bairro */}
          <div>
            <label className="block text-sm font-medium text-zinc-300 mb-2">
              Bairro *
            </label>
            <input
              type="text"
              name="bairro"
              value={formData.bairro}
              onChange={(e) => handleChange("bairro", e.target.value)}
              className={`w-full rounded-lg border bg-zinc-800 px-4 py-2 text-sm text-zinc-100 focus:outline-none ${
                erros.bairro ? "border-red-500" : "border-zinc-600 focus:border-red-500"
              }`}
              placeholder="Seu bairro"
            />
            {erros.bairro && (
              <p className="mt-1 text-xs text-red-400">{erros.bairro}</p>
            )}
          </div>

          {/* CEP */}
          <div>
            <label className="block text-sm font-medium text-zinc-300 mb-2">
              CEP *
            </label>
            <input
              type="text"
              name="cep"
              value={formData.cep}
              onChange={(e) => handleChange("cep", formatarCEP(e.target.value))}
              className={`w-full rounded-lg border bg-zinc-800 px-4 py-2 text-sm text-zinc-100 focus:outline-none ${
                erros.cep ? "border-red-500" : "border-zinc-600 focus:border-red-500"
              }`}
              placeholder="00000000"
              maxLength={8}
            />
            {erros.cep && (
              <p className="mt-1 text-xs text-red-400">{erros.cep}</p>
            )}
          </div>

          {/* Forma de Pagamento */}
          <div>
            <label className="block text-sm font-medium text-zinc-300 mb-2">
              Forma de Pagamento *
            </label>
            <select
              name="formaPagamento"
              value={formData.formaPagamento}
              onChange={(e) => handleChange("formaPagamento", e.target.value)}
              className={`w-full rounded-lg border bg-zinc-800 px-4 py-2 text-sm text-zinc-100 focus:outline-none appearance-none ${
                erros.formaPagamento ? "border-red-500" : "border-zinc-600 focus:border-red-500"
              }`}
              style={{
                backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%23ffffff' d='M6 9L1 4h10z'/%3E%3C/svg%3E")`,
                backgroundRepeat: "no-repeat",
                backgroundPosition: "right 0.75rem center",
                paddingRight: "2.5rem",
              }}
            >
              <option value="">Selecione a forma de pagamento</option>
              <option value="cartao_credito">Cartão de Crédito</option>
              <option value="cartao_debito">Cartão de Débito</option>
              <option value="pix">Pix</option>
              <option value="boleto">Boleto Bancário</option>
            </select>
            {erros.formaPagamento && (
              <p className="mt-1 text-xs text-red-400">{erros.formaPagamento}</p>
            )}
          </div>
        </div>

        {/* Checkbox de Aceite */}
        <div className="flex items-start gap-3 pt-4 border-t border-zinc-700">
          <input
            type="checkbox"
            id="aceite-termos-pagamento"
            checked={formData.aceiteTermos}
            onChange={(e) => handleChange("aceiteTermos", e.target.checked)}
            className={`mt-1 h-4 w-4 cursor-pointer rounded border-zinc-600 bg-zinc-900 text-red-600 focus:ring-2 focus:ring-red-500 ${
              erros.aceiteTermos ? "border-red-500" : ""
            }`}
          />
          <label
            htmlFor="aceite-termos-pagamento"
            className="text-sm text-zinc-300 cursor-pointer"
          >
            Li e aceito os{" "}
            <Link
              href="/termos-contratos"
              className="text-blue-400 underline underline-offset-2 hover:text-blue-300 transition-colors"
            >
              termos de uso
            </Link>{" "}
            e o{" "}
            <Link
              href="/termos-contratos"
              className="text-blue-400 underline underline-offset-2 hover:text-blue-300 transition-colors"
            >
              contrato de prestação de serviço
            </Link>{" "}
            da THouse Rec *
          </label>
        </div>
        {erros.aceiteTermos && (
          <p className="text-xs text-red-400 -mt-2">{erros.aceiteTermos}</p>
        )}
      </section>

      {/* BOTÃO DE PAGAR */}
      <section>
        <button
          type="button"
          onClick={handlePagar}
          disabled={carregando}
          className="w-full rounded-full bg-red-600 px-6 py-3 text-base font-semibold text-white hover:bg-red-500 disabled:cursor-not-allowed disabled:opacity-60 transition-all"
          style={{ textShadow: "0 2px 4px rgba(0, 0, 0, 0.5)" }}
        >
          {carregando
            ? "Redirecionando para o Asaas..."
            : "Pagar com Asaas (Pix, cartão, boleto)"}
        </button>
      </section>
    </main>
  );
}

export default function PagamentosPage() {
  return (
    <Suspense fallback={
      <main className="flex min-h-screen items-center justify-center px-6 py-12 text-zinc-100">
        <div className="animate-pulse text-center">
          <div className="h-8 bg-zinc-800 rounded w-64 mb-4"></div>
          <div className="h-4 bg-zinc-800 rounded w-48"></div>
        </div>
      </main>
    }>
      <PagamentosContent />
    </Suspense>
  );
}
