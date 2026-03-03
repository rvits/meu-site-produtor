"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../context/AuthContext";
import Link from "next/link";

const CARRINHO_KEY = "agendamento_carrinho";

type CartItem = {
  cartId?: number;
  data: string;
  hora: string;
  duracaoMinutos?: number;
  tipo?: string;
  servicos: Array<{ id: string; nome: string; quantidade: number; preco: number }>;
  beats: Array<{ id: string; nome: string; quantidade: number; preco: number }>;
  total: number;
  observacoes?: string;
  cupomCode?: string;
  cupomAplicado?: unknown;
};

export default function CarrinhoPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [cart, setCart] = useState<CartItem[]>([]);
  const [carregando, setCarregando] = useState(false);
  const [paymentProvider, setPaymentProvider] = useState<"asaas" | "infinitypay" | "mercadopago">("asaas");

  const [formData, setFormData] = useState({
    nome: "",
    dataNascimento: "",
    cpf: "",
    pais: "Brasil",
    cidade: "",
    bairro: "",
    cep: "",
    formaPagamento: "",
    aceiteTermos: false,
  });
  const [erros, setErros] = useState<Record<string, string>>({});

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = sessionStorage.getItem(CARRINHO_KEY) || localStorage.getItem(CARRINHO_KEY) || "[]";
      const parsed = JSON.parse(raw);
      setCart(Array.isArray(parsed) ? parsed : []);
    } catch {
      setCart([]);
    }
  }, []);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.push("/login?redirect=/carrinho");
      return;
    }
  }, [user, authLoading, router]);

  useEffect(() => {
    fetch("/api/payment-provider")
      .then((res) => res.json())
      .then((data) => {
        if (data.provider) setPaymentProvider(data.provider);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (authLoading || !user) return;
    const carregarPerfil = () => {
      fetch("/api/conta", { credentials: "include" })
        .then((res) => res.json())
        .then((data) => {
          if (data && !data.error) {
            const dNasc = data.dataNascimento;
            let dataNascStr = "";
            if (dNasc) {
              if (typeof dNasc === "string") {
                dataNascStr = dNasc.includes("T") ? dNasc.split("T")[0] : dNasc.substring(0, 10);
              } else {
                dataNascStr = new Date(dNasc).toISOString().split("T")[0];
              }
            }
            setFormData((prev) => ({
              ...prev,
              nome: data.nomeCompleto || data.nomeArtistico || user.nomeArtistico || prev.nome || "",
              pais: data.pais || prev.pais || "Brasil",
              cidade: data.cidade || prev.cidade || "",
              bairro: data.bairro || prev.bairro || "",
              cep: (data.cep || prev.cep || "").replace(/\D/g, "").slice(0, 8),
              cpf: (data.cpf || prev.cpf || "").replace(/\D/g, "").slice(0, 11),
              dataNascimento: dataNascStr || prev.dataNascimento,
            }));
          } else {
            setFormData((prev) => ({ ...prev, nome: user.nomeArtistico || prev.nome || "" }));
          }
        })
        .catch(() => {});
    };
    carregarPerfil();
    const t = setTimeout(carregarPerfil, 500);
    return () => clearTimeout(t);
  }, [user, authLoading]);

  const removeItem = (cartId: number) => {
    const next = cart.filter((i) => i.cartId !== cartId);
    setCart(next);
    const str = JSON.stringify(next);
    sessionStorage.setItem(CARRINHO_KEY, str);
    localStorage.setItem(CARRINHO_KEY, str);
  };

  const totalGeral = cart.reduce((s, i) => s + (Number(i.total) || 0), 0);

  const handleChange = (campo: string, valor: string | boolean) => {
    setFormData((prev) => ({ ...prev, [campo]: valor }));
    if (erros[campo]) {
      setErros((prev) => {
        const next = { ...prev };
        delete next[campo];
        return next;
      });
    }
  };

  const formatarCPF = (valor: string) => {
    const n = valor.replace(/\D/g, "");
    return n.length <= 11 ? n : n.slice(0, 11);
  };
  const formatarCEP = (valor: string) => {
    const n = valor.replace(/\D/g, "");
    return n.length <= 8 ? n : n.slice(0, 8);
  };

  const validarFormulario = (): boolean => {
    const novos: Record<string, string> = {};
    if (!formData.nome || formData.nome.length < 2) novos.nome = "Nome deve ter no mínimo 2 caracteres";
    if (!formData.dataNascimento) novos.dataNascimento = "Data de nascimento é obrigatória";
    if (!formData.cpf || !/^\d{11}$/.test(formData.cpf.replace(/\D/g, ""))) novos.cpf = "CPF deve conter 11 dígitos";
    if (!formData.pais) novos.pais = "País é obrigatório";
    if (!formData.cidade) novos.cidade = "Cidade é obrigatória";
    if (!formData.bairro) novos.bairro = "Bairro é obrigatório";
    if (!formData.cep || !/^\d{8}$/.test(formData.cep.replace(/\D/g, ""))) novos.cep = "CEP deve conter 8 dígitos";
    if (!formData.formaPagamento) novos.formaPagamento = "Selecione a forma de pagamento";
    if (!formData.aceiteTermos) novos.aceiteTermos = "É necessário aceitar os termos de contrato";
    setErros(novos);
    if (Object.keys(novos).length > 0) {
      const primeiro = Object.keys(novos)[0];
      setTimeout(() => {
        const el = document.querySelector(`[name="${primeiro}"]`);
        if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
      }, 100);
      return false;
    }
    return true;
  };

  const handleFinalizar = async () => {
    if (cart.length === 0) {
      alert("Carrinho vazio.");
      return;
    }
    if (!validarFormulario()) return;

    setCarregando(true);
    try {
      const cpfFormatado = formatarCPF(formData.cpf);
      const cepFormatado = formatarCEP(formData.cep);

      const updateRes = await fetch("/api/conta/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
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
      if (!updateRes.ok) {
        const d = await updateRes.json();
        alert(d.error || "Erro ao salvar dados. Verifique os campos.");
        setCarregando(false);
        return;
      }

      const items = cart.map(({ cartId, ...rest }) => rest);
      const endpoint = `/api/${paymentProvider}/checkout-carrinho`;
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          items,
          total: totalGeral,
          ...(formData.formaPagamento && { paymentMethod: formData.formaPagamento }),
        }),
      });

      let data: Record<string, unknown> = {};
      const text = await res.text();
      try {
        if (text) data = JSON.parse(text) as Record<string, unknown>;
      } catch {
        data = { error: text || `Erro ${res.status}` };
      }

      if (!res.ok) {
        const msg = (data.error as string) || (data.message as string) || `Erro ${res.status} ao criar pagamento.`;
        console.error("[Carrinho] Erro na API:", res.status, text);
        alert(msg);
        setCarregando(false);
        return;
      }

      const url = (data.initPoint || data.invoiceUrl || data.bankSlipUrl || data.url) as string | undefined;
      if (url) {
        window.location.href = url;
      } else {
        console.error("[Carrinho] Resposta sem URL de pagamento:", data);
        alert("Não foi possível obter o link de pagamento. Verifique o console (F12).");
        setCarregando(false);
      }
    } catch (e) {
      console.error(e);
      alert("Erro inesperado. Tente novamente.");
      setCarregando(false);
    }
  };

  if (authLoading) {
    return (
      <main className="mx-auto max-w-3xl px-4 sm:px-6 py-8 sm:py-10 text-zinc-100">
        <div className="flex h-64 items-center justify-center text-zinc-400">Carregando...</div>
      </main>
    );
  }

  if (!user) return null;

  return (
    <main className="relative mx-auto max-w-5xl px-4 sm:px-6 py-8 sm:py-10 text-zinc-100 overflow-x-hidden min-h-screen">
      <div
        className="fixed inset-0 z-0 bg-no-repeat bg-zinc-900 page-bg-image"
        style={{
          backgroundImage: "url(/agendamento-bg.png.jpeg)",
          ["--page-bg-size" as string]: "cover",
          ["--page-bg-position" as string]: "center -20%",
        }}
        aria-hidden
      />
      <div className="relative z-10">
        <section className="mb-8">
          <h1 className="text-2xl md:text-3xl font-semibold text-center">
            Carrinho de agendamentos <span className="text-red-500">THouse Rec</span>
          </h1>
          <p className="text-sm text-zinc-300 text-center mt-2">
            Revise os agendamentos, preencha seus dados e finalize o pagamento.
          </p>
        </section>

        {cart.length === 0 ? (
          <section className="mb-8 flex justify-center px-4">
            <div className="relative w-full max-w-5xl border border-red-500 rounded-xl p-8 text-center" style={{ borderWidth: "1px", borderBottomWidth: "2px" }}>
              <p className="text-zinc-300 mb-4">Seu carrinho está vazio.</p>
              <Link
                href="/agendamento"
                className="inline-block rounded-full bg-red-600 px-6 py-3 text-sm font-semibold text-white hover:bg-red-500 transition-colors"
              >
                Ir para agendamento
              </Link>
            </div>
          </section>
        ) : (
          <>
            {/* Resumo dos agendamentos */}
            <section className="mb-8 flex justify-center px-4">
              <div className="relative w-full max-w-5xl border border-red-500" style={{ borderWidth: "1px", borderBottomWidth: "2px" }}>
                <div
                  className="relative p-6 md:p-8 space-y-6"
                  style={{
                    background: "linear-gradient(to right, rgba(0,0,0,0) 0%, rgba(0,0,0,0.75) 8%, rgba(0,0,0,0.85) 20%, rgba(0,0,0,0.85) 80%, rgba(0,0,0,0.75) 92%, rgba(0,0,0,0) 100%)",
                    backdropFilter: "blur(16px)",
                    WebkitBackdropFilter: "blur(16px)",
                  }}
                >
                  <h2 className="text-center text-xl font-semibold text-red-400" style={{ textShadow: "0 2px 4px rgba(0, 0, 0, 0.5)" }}>
                    Resumo do pagamento
                  </h2>

                  <ul className="space-y-4">
                    {cart.map((item, idx) => {
                      const dataStr = item.data ? new Date(item.data + "T12:00:00").toLocaleDateString("pt-BR") : "—";
                      const itens = [...(item.servicos || []), ...(item.beats || [])];
                      return (
                        <li
                          key={item.cartId ?? idx}
                          className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-4 rounded-xl bg-zinc-900/60 border border-zinc-700"
                        >
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-zinc-200">
                              {dataStr} às {item.hora || "—"}
                            </p>
                            <ul className="text-sm text-zinc-400 mt-1">
                              {itens.map((s, i) => (
                                <li key={i}>
                                  {(s.quantidade ?? 1)}x {s.nome} — R$ {((s.quantidade ?? 1) * (s.preco ?? 0)).toFixed(2).replace(".", ",")}
                                </li>
                              ))}
                            </ul>
                            <p className="text-sm text-yellow-300 mt-1 font-semibold">
                              Total deste agendamento: R$ {(Number(item.total) || 0).toFixed(2).replace(".", ",")}
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() => item.cartId != null && removeItem(item.cartId)}
                            className="shrink-0 rounded-lg border border-red-500/60 bg-red-500/10 px-3 py-1.5 text-sm text-red-400 hover:bg-red-500/20 transition-colors"
                          >
                            Remover
                          </button>
                        </li>
                      );
                    })}
                  </ul>

                  <div className="pt-4 border-t border-zinc-600 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <p className="text-2xl font-bold text-yellow-300">
                      Total geral: R$ {totalGeral.toFixed(2).replace(".", ",")}
                    </p>
                    <Link
                      href="/agendamento"
                      className="rounded-full border border-zinc-500 bg-zinc-700/50 px-4 py-2 text-sm font-medium text-zinc-200 hover:bg-zinc-600/50 transition-colors"
                    >
                      Adicionar mais agendamentos
                    </Link>
                  </div>

                  <p className="text-xs text-zinc-400 text-center pt-2">
                    Ao continuar, você será direcionado para o ambiente seguro do Asaas. A compra só será concluída após a confirmação do pagamento e o aceite dos{" "}
                    <Link href="/termos-contratos" className="text-blue-400 underline underline-offset-2 hover:text-blue-300">termos de uso</Link> e do{" "}
                    <Link href="/termos-contratos" className="text-blue-400 underline underline-offset-2 hover:text-blue-300">contrato de prestação de serviço</Link> da THouse Rec.
                  </p>
                </div>
              </div>
            </section>

            {/* Formulário e pagamento */}
            <section className="mb-8 rounded-2xl border border-red-500 bg-zinc-900/50 p-4 sm:p-6 space-y-6">
              <h2 className="text-lg font-semibold text-red-400">Informações para pagamento</h2>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-zinc-300 mb-2">Nome completo *</label>
                  <input
                    type="text"
                    name="nome"
                    value={formData.nome}
                    onChange={(e) => handleChange("nome", e.target.value)}
                    className={`w-full rounded-lg border bg-zinc-800 px-4 py-2 text-sm text-zinc-100 focus:outline-none ${erros.nome ? "border-red-500" : "border-zinc-600 focus:border-red-500"}`}
                    placeholder="Seu nome completo"
                  />
                  {erros.nome && <p className="mt-1 text-xs text-red-400">{erros.nome}</p>}
                </div>
                <div>
                  <label className="block text-sm font-medium text-zinc-300 mb-2">Data de nascimento *</label>
                  <input
                    type="date"
                    name="dataNascimento"
                    value={formData.dataNascimento}
                    onChange={(e) => handleChange("dataNascimento", e.target.value)}
                    className={`w-full rounded-lg border bg-zinc-800 px-4 py-2 text-sm text-zinc-100 focus:outline-none ${erros.dataNascimento ? "border-red-500" : "border-zinc-600 focus:border-red-500"}`}
                  />
                  {erros.dataNascimento && <p className="mt-1 text-xs text-red-400">{erros.dataNascimento}</p>}
                </div>
                <div>
                  <label className="block text-sm font-medium text-zinc-300 mb-2">CPF *</label>
                  <input
                    type="text"
                    name="cpf"
                    value={formData.cpf}
                    onChange={(e) => handleChange("cpf", formatarCPF(e.target.value))}
                    className={`w-full rounded-lg border bg-zinc-800 px-4 py-2 text-sm text-zinc-100 focus:outline-none ${erros.cpf ? "border-red-500" : "border-zinc-600 focus:border-red-500"}`}
                    placeholder="00000000000"
                    maxLength={11}
                  />
                  {erros.cpf && <p className="mt-1 text-xs text-red-400">{erros.cpf}</p>}
                </div>
                <div>
                  <label className="block text-sm font-medium text-zinc-300 mb-2">País *</label>
                  <input
                    type="text"
                    name="pais"
                    value={formData.pais}
                    onChange={(e) => handleChange("pais", e.target.value)}
                    className={`w-full rounded-lg border bg-zinc-800 px-4 py-2 text-sm text-zinc-100 focus:outline-none ${erros.pais ? "border-red-500" : "border-zinc-600 focus:border-red-500"}`}
                    placeholder="Brasil"
                  />
                  {erros.pais && <p className="mt-1 text-xs text-red-400">{erros.pais}</p>}
                </div>
                <div>
                  <label className="block text-sm font-medium text-zinc-300 mb-2">Cidade *</label>
                  <input
                    type="text"
                    name="cidade"
                    value={formData.cidade}
                    onChange={(e) => handleChange("cidade", e.target.value)}
                    className={`w-full rounded-lg border bg-zinc-800 px-4 py-2 text-sm text-zinc-100 focus:outline-none ${erros.cidade ? "border-red-500" : "border-zinc-600 focus:border-red-500"}`}
                    placeholder="Sua cidade"
                  />
                  {erros.cidade && <p className="mt-1 text-xs text-red-400">{erros.cidade}</p>}
                </div>
                <div>
                  <label className="block text-sm font-medium text-zinc-300 mb-2">Bairro *</label>
                  <input
                    type="text"
                    name="bairro"
                    value={formData.bairro}
                    onChange={(e) => handleChange("bairro", e.target.value)}
                    className={`w-full rounded-lg border bg-zinc-800 px-4 py-2 text-sm text-zinc-100 focus:outline-none ${erros.bairro ? "border-red-500" : "border-zinc-600 focus:border-red-500"}`}
                    placeholder="Seu bairro"
                  />
                  {erros.bairro && <p className="mt-1 text-xs text-red-400">{erros.bairro}</p>}
                </div>
                <div>
                  <label className="block text-sm font-medium text-zinc-300 mb-2">CEP *</label>
                  <input
                    type="text"
                    name="cep"
                    value={formData.cep}
                    onChange={(e) => handleChange("cep", formatarCEP(e.target.value))}
                    className={`w-full rounded-lg border bg-zinc-800 px-4 py-2 text-sm text-zinc-100 focus:outline-none ${erros.cep ? "border-red-500" : "border-zinc-600 focus:border-red-500"}`}
                    placeholder="00000000"
                    maxLength={8}
                  />
                  {erros.cep && <p className="mt-1 text-xs text-red-400">{erros.cep}</p>}
                </div>
                <div>
                  <label className="block text-sm font-medium text-zinc-300 mb-2">Forma de pagamento *</label>
                  <select
                    name="formaPagamento"
                    value={formData.formaPagamento}
                    onChange={(e) => handleChange("formaPagamento", e.target.value)}
                    className={`w-full rounded-lg border bg-zinc-800 px-4 py-2 text-sm text-zinc-100 focus:outline-none appearance-none ${erros.formaPagamento ? "border-red-500" : "border-zinc-600 focus:border-red-500"}`}
                    style={{
                      backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%23ffffff' d='M6 9L1 4h10z'/%3E%3C/svg%3E")`,
                      backgroundRepeat: "no-repeat",
                      backgroundPosition: "right 0.75rem center",
                      paddingRight: "2.5rem",
                    }}
                  >
                    <option value="">Selecione a forma de pagamento</option>
                    <option value="cartao_credito">Cartão de crédito</option>
                    <option value="cartao_debito">Cartão de débito</option>
                    <option value="pix">Pix</option>
                    <option value="boleto">Boleto bancário</option>
                  </select>
                  {erros.formaPagamento && <p className="mt-1 text-xs text-red-400">{erros.formaPagamento}</p>}
                </div>
              </div>

              <div className="flex items-start gap-3 pt-4 border-t border-zinc-700 flex-wrap">
                <input
                  type="checkbox"
                  id="aceite-termos-carrinho"
                  checked={formData.aceiteTermos}
                  onChange={(e) => handleChange("aceiteTermos", e.target.checked)}
                  className={`mt-1 h-4 w-4 cursor-pointer rounded border-zinc-600 bg-zinc-900 text-red-600 focus:ring-2 focus:ring-red-500 ${erros.aceiteTermos ? "border-red-500" : ""}`}
                />
                <label htmlFor="aceite-termos-carrinho" className="text-sm text-zinc-300 cursor-pointer">
                  Li e aceito os{" "}
                  <Link href="/termos-contratos" className="text-blue-400 underline underline-offset-2 hover:text-blue-300">termos de uso</Link> e o{" "}
                  <Link href="/termos-contratos" className="text-blue-400 underline underline-offset-2 hover:text-blue-300">contrato de prestação de serviço</Link> da THouse Rec *
                </label>
              </div>
              {erros.aceiteTermos && <p className="text-xs text-red-400 -mt-2">{erros.aceiteTermos}</p>}
            </section>

            <section>
              <button
                type="button"
                onClick={handleFinalizar}
                disabled={carregando}
                className="w-full rounded-full bg-red-600 px-6 py-3 text-base font-semibold text-white hover:bg-red-500 disabled:opacity-60 disabled:cursor-not-allowed transition-all"
                style={{ textShadow: "0 2px 4px rgba(0, 0, 0, 0.5)" }}
              >
                {carregando ? "Redirecionando para o Asaas..." : "Pagar com Asaas (Pix, cartão, boleto)"}
              </button>
            </section>
          </>
        )}
      </div>
    </main>
  );
}
