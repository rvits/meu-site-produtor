"use client";

import { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { useRouter } from "next/navigation";

interface Agendamento {
  id: number;
  data: string;
  duracaoMinutos: number;
  tipo: string;
  observacoes?: string;
  status: string;
  pagamento: {
    id: string;
    amount: number;
    status: string;
    paymentMethod: string | null;
    createdAt: string;
  } | null;
}

interface Plano {
  id: string;
  planId: string;
  planName: string;
  modo: string;
  amount: number;
  status: string;
  startDate: string;
  endDate: string | null;
  ativo: boolean;
  expiraEm: string | null;
}

interface Cupom {
  id: string;
  code: string;
  couponType: string; // "plano" ou "reembolso"
  discountType: string;
  discountValue: number;
  serviceType: string | null;
  expiresAt: string | null;
  createdAt: string;
  used: boolean;
  usedAt: string | null;
  status: "disponivel" | "usado" | "expirado";
  userPlan?: {
    id: string;
    planId: string;
    planName: string;
    endDate: string | null;
  } | null;
}

interface FAQQuestion {
  id: string;
  question: string;
  answer: string | null;
  status: string; // "pendente", "respondida", "recusada"
  blocked?: boolean; // Campo adicional para verificar se foi bloqueada
  blockedReason?: string | null; // Motivo da recusa
  published: boolean;
  answeredAt: string | null;
  readAt: string | null; // Quando o usuário leu a resposta
  createdAt: string;
  faq?: {
    id: string;
    question: string;
  } | null;
}

export default function MinhaContaPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [agendamentos, setAgendamentos] = useState<Agendamento[]>([]);
  const [planos, setPlanos] = useState<Plano[]>([]);
  const [cupons, setCupons] = useState<Cupom[]>([]);
  const [faqQuestions, setFaqQuestions] = useState<FAQQuestion[]>([]);

  useEffect(() => {
    if (!user) {
      router.push("/login");
      return;
    }
    carregarDados();
    
    // Atualizar dados automaticamente a cada 1 minuto
    const interval = setInterval(() => {
      carregarDados();
    }, 60000);
    
    return () => clearInterval(interval);
  }, [user]);

  async function carregarDados() {
    try {
      // Adicionar timestamp para evitar cache
      const timestamp = new Date().getTime();
      const res = await fetch(`/api/meus-dados?t=${timestamp}`, { 
        cache: "no-store",
        headers: {
          "Cache-Control": "no-cache, no-store, must-revalidate",
          "Pragma": "no-cache",
        },
      });
      if (res.ok) {
        const data = await res.json();
        console.log("[Minha Conta] Dados carregados:", {
          totalPlanos: data.planos?.length || 0,
          planos: data.planos,
          totalFaqQuestions: data.faqQuestions?.length || 0,
          faqQuestions: data.faqQuestions,
          timestamp: new Date().toISOString(),
        });
        setAgendamentos(data.agendamentos || []);
        setPlanos(data.planos || []);
        setCupons(data.cupons || []);
        setFaqQuestions(data.faqQuestions || []);
        
        // Marcar todas as perguntas respondidas como lidas quando visualizar
        const perguntasRespondidasNaoLidas = (data.faqQuestions || []).filter(
          (p: any) => p.status === "respondida" && !p.readAt
        );
        
        // Marcar agendamentos confirmados como lidos quando visualizar
        const agendamentosConfirmadosNaoLidos = (data.agendamentos || []).filter((a: any) => {
          const isConfirmed = (a.status === "aceito" || a.status === "confirmado") && a.pagamento?.status === "approved";
          return isConfirmed && !a.readAt;
        });
        
        // Marcar planos ativos como lidos quando visualizar
        const planosAtivosNaoLidos = (data.planos || []).filter((p: any) => {
          const isActive = p.status === "active" && p.ativo === true;
          return isActive && !p.readAt;
        });
        
        // Marcar todas como lidas
        const promises: Promise<any>[] = [];
        
        if (perguntasRespondidasNaoLidas.length > 0) {
          promises.push(
            ...perguntasRespondidasNaoLidas.map((p: any) =>
              fetch("/api/faq/mark-read", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                credentials: "include",
                body: JSON.stringify({ questionId: p.id }),
              }).catch((err) => console.error("Erro ao marcar pergunta como lida:", err))
            )
          );
        }
        
        if (agendamentosConfirmadosNaoLidos.length > 0) {
          promises.push(
            ...agendamentosConfirmadosNaoLidos.map((a: any) =>
              fetch("/api/appointments/mark-read", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                credentials: "include",
                body: JSON.stringify({ appointmentId: a.id }),
              }).catch((err) => console.error("Erro ao marcar agendamento como lido:", err))
            )
          );
        }
        
        if (planosAtivosNaoLidos.length > 0) {
          promises.push(
            ...planosAtivosNaoLidos.map((p: any) =>
              fetch("/api/plans/mark-read", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                credentials: "include",
                body: JSON.stringify({ planId: p.id }),
              }).catch((err) => console.error("Erro ao marcar plano como lido:", err))
            )
          );
        }
        
        if (promises.length > 0) {
          Promise.all(promises).then(() => {
            // Disparar eventos para atualizar os hooks imediatamente
            window.dispatchEvent(new CustomEvent("faq-updated"));
            window.dispatchEvent(new CustomEvent("appointment-updated"));
            window.dispatchEvent(new CustomEvent("plan-updated"));
            // Recarregar dados para atualizar o badge
            setTimeout(() => carregarDados(), 500);
          });
        }
      } else {
        const errorText = await res.text();
        console.error("[Minha Conta] Erro na resposta:", res.status, errorText);
      }
    } catch (err) {
      console.error("Erro ao carregar dados:", err);
    } finally {
      setLoading(false);
    }
  }

  function getStatusColor(status: string) {
    if (status === "pendente") return "bg-orange-500";
    if (status === "aceito" || status === "confirmado") return "bg-green-500";
    if (status === "recusado" || status === "cancelado") return "bg-red-500";
    return "bg-gray-500";
  }

  function getStatusLabel(status: string) {
    const labels: Record<string, string> = {
      pendente: "Pendente",
      aceito: "Aceito",
      confirmado: "Confirmado",
      recusado: "Recusado",
      cancelado: "Cancelado",
    };
    return labels[status] || status;
  }

  function getServiceName(serviceType: string) {
    const names: Record<string, string> = {
      sessao: "Sessão",
      captacao: "Captação",
      sonoplastia: "Sonoplastia",
      mix: "Mixagem",
      master: "Masterização",
      mix_master: "Mix + Master",
      beat1: "1 Beat",
      beat2: "2 Beats",
      beat3: "3 Beats",
      beat4: "4 Beats",
      beat_mix_master: "Beat + Mix + Master",
      producao_completa: "Produção Completa",
      percent_servicos: "10% em serviços avulsos",
      percent_beats: "10% em beats",
    };
    return names[serviceType] || serviceType;
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-950 text-zinc-100 p-8">
        <p className="text-zinc-400">Carregando...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 p-4 md:p-8">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-zinc-100 mb-2">Minha Conta</h1>
            <p className="text-zinc-400">Gerencie seus agendamentos, planos e cupons</p>
          </div>
          <button
            onClick={() => {
              setLoading(true);
              carregarDados();
            }}
            className="px-4 py-2 bg-zinc-700 hover:bg-zinc-600 text-zinc-100 rounded-lg transition-colors flex items-center gap-2"
            title="Atualizar dados"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Atualizar
          </button>
        </div>

        {/* Planos Ativos */}
        <div className="rounded-xl border border-zinc-700 bg-zinc-800/50 p-6">
          <h2 className="text-xl font-bold text-zinc-100 mb-4">📦 Meus Planos</h2>
          {planos.length === 0 ? (
            <p className="text-zinc-400">Você não possui planos ativos.</p>
          ) : (
            <div className="space-y-4">
              {planos.map((plano) => (
                <div
                  key={plano.id}
                  className={`rounded-lg border p-4 ${
                    plano.ativo ? "border-green-500/50 bg-green-500/10" : "border-zinc-600 bg-zinc-900/50"
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h3 className="text-lg font-bold text-zinc-100">{plano.planName}</h3>
                      <p className="text-sm text-zinc-400">
                        {plano.modo === "mensal" ? "Mensal" : "Anual"} - R$ {plano.amount.toFixed(2).replace(".", ",")}
                      </p>
                      <p className={`text-sm mt-2 ${plano.ativo ? "text-green-400" : "text-red-400"}`}>
                        {plano.ativo ? "✅ Ativo" : "❌ Inativo"}
                      </p>
                      {plano.expiraEm && (
                        <p className="text-xs text-zinc-500 mt-1">
                          Expira em: {new Date(plano.expiraEm).toLocaleDateString("pt-BR")}
                        </p>
                      )}
                    </div>
                    {plano.ativo && (
                      <button
                        onClick={async () => {
                          if (!confirm("Tem certeza que deseja cancelar este plano? Os cupons de serviços não utilizados serão removidos.")) {
                            return;
                          }
                          
                          // Perguntar tipo de reembolso
                          const refundChoice = confirm(
                            "Escolha o tipo de reembolso:\n\n" +
                            "OK = Reembolso direto na conta bancária (via Asaas)\n" +
                            "Cancelar = Cupom de reembolso para usar em futuros agendamentos"
                          );
                          
                          const refundType = refundChoice ? "direct" : "coupon";
                          
                          try {
                            const res = await fetch("/api/planos/cancelar", {
                              method: "POST",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({ 
                                userPlanId: plano.id,
                                refundType: refundType,
                              }),
                            });

                            const data = await res.json();

                            if (res.ok) {
                              let message = "Seu plano foi cancelado com sucesso!";
                              if (data.refundType === "direct") {
                                message += `\n\nReembolso direto de R$ ${data.refundAmount?.toFixed(2).replace(".", ",") || "0,00"} será processado em até 5 dias úteis na sua conta bancária.`;
                              } else if (data.couponCode) {
                                message += `\n\nCupom de reembolso: ${data.couponCode}\nValor: R$ ${data.refundAmount?.toFixed(2).replace(".", ",") || "0,00"}`;
                              }
                              alert(message);
                              // Recarregar dados sem recarregar a página
                              await carregarDados();
                            } else {
                              alert(data.error || "Erro ao cancelar plano");
                            }
                          } catch (err) {
                            alert("Erro ao cancelar plano");
                          }
                        }}
                        className="ml-4 px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-semibold rounded-lg transition-colors"
                      >
                        Cancelar Plano
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Cupons */}
        <div className="rounded-xl border border-zinc-700 bg-zinc-800/50 p-6">
          <h2 className="text-xl font-bold text-zinc-100 mb-4">🎟️ Meus Cupons</h2>
          
          {/* Explicação dos tipos de cupons */}
          <div className="mb-6 p-4 bg-zinc-900/50 rounded-lg border border-zinc-600">
            <h3 className="text-sm font-semibold text-zinc-200 mb-3">ℹ️ Tipos de Cupons</h3>
            <div className="space-y-2 text-xs text-zinc-400">
              <div>
                <strong className="text-green-400">🟢 Cupons de Plano:</strong> Gerados quando você assina um plano. Permitem usar serviços específicos <strong>gratuitamente</strong> (zeram o valor total). Cada serviço deve ser agendado separadamente.
              </div>
              <div>
                <strong className="text-blue-400">🔵 Cupons de Reembolso:</strong> Gerados quando um agendamento é cancelado ou recusado. Servem como <strong>crédito</strong> para descontar do valor total. Podem zerar o serviço ou ser usados como desconto parcial (você paga a diferença). <strong className="text-yellow-400">⚠️ Importante:</strong> Sobras não utilizadas <strong>se perdem</strong> - não acumulam crédito.
              </div>
            </div>
          </div>

          {cupons.length === 0 ? (
            <p className="text-zinc-400">Você não possui cupons.</p>
          ) : (
            <div className="space-y-6">
              {/* Cupons de Plano Disponíveis */}
              {cupons.filter(c => c.status === "disponivel" && c.couponType === "plano").length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-green-400 mb-2">
                    ✅ Cupons de Plano - Disponíveis ({cupons.filter(c => c.status === "disponivel" && c.couponType === "plano").length})
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {cupons.filter(c => c.status === "disponivel" && c.couponType === "plano").map((cupom) => (
                      <div
                        key={cupom.id}
                        className="rounded-lg border border-green-500/50 bg-green-500/10 p-4"
                      >
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex-1">
                            <p className="text-xs text-green-400 font-semibold mb-1">CÓDIGO DO CUPOM</p>
                            <div className="flex items-center gap-2">
                              <p className="text-2xl font-bold text-green-300 font-mono tracking-wider">
                                {cupom.code}
                              </p>
                              <button
                                type="button"
                                onClick={async () => {
                                  try {
                                    await navigator.clipboard.writeText(cupom.code);
                                    alert("Código copiado para a área de transferência!");
                                  } catch (err) {
                                    // Fallback para navegadores mais antigos
                                    const textArea = document.createElement("textarea");
                                    textArea.value = cupom.code;
                                    textArea.style.position = "fixed";
                                    textArea.style.opacity = "0";
                                    document.body.appendChild(textArea);
                                    textArea.select();
                                    document.execCommand("copy");
                                    document.body.removeChild(textArea);
                                    alert("Código copiado para a área de transferência!");
                                  }
                                }}
                                className="px-3 py-1 text-xs font-semibold text-green-300 bg-green-500/20 border border-green-500/50 rounded hover:bg-green-500/30 transition-colors"
                                title="Copiar código"
                              >
                                📋 Copiar
                              </button>
                            </div>
                          </div>
                        </div>
                        {cupom.serviceType && (
                          <p className="text-sm text-zinc-300 mt-2">
                            <strong>Serviço:</strong> {getServiceName(cupom.serviceType)}
                          </p>
                        )}
                        {cupom.expiresAt && (
                          <p className="text-xs text-zinc-400 mt-2">
                            Válido até: {new Date(cupom.expiresAt).toLocaleDateString("pt-BR")}
                          </p>
                        )}
                        {cupom.userPlan && cupom.userPlan.endDate && (
                          <p className="text-xs text-yellow-400 mt-2">
                            ⚠️ Válido até 1 mês após expiração do plano ({new Date(cupom.userPlan.endDate).toLocaleDateString("pt-BR")})
                          </p>
                        )}
                        <p className="text-xs text-green-400 mt-2">
                          💡 Este cupom zera o valor do serviço específico. Agende quando quiser!
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Cupons de Reembolso Disponíveis */}
              {cupons.filter(c => c.status === "disponivel" && c.couponType === "reembolso").length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-blue-400 mb-2">
                    💰 Cupons de Reembolso - Disponíveis ({cupons.filter(c => c.status === "disponivel" && c.couponType === "reembolso").length})
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {cupons.filter(c => c.status === "disponivel" && c.couponType === "reembolso").map((cupom) => (
                      <div
                        key={cupom.id}
                        className="rounded-lg border border-blue-500/50 bg-blue-500/10 p-4"
                      >
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex-1">
                            <p className="text-xs text-blue-400 font-semibold mb-1">CÓDIGO DO CUPOM</p>
                            <div className="flex items-center gap-2">
                              <p className="text-2xl font-bold text-blue-300 font-mono tracking-wider">
                                {cupom.code}
                              </p>
                              <button
                                type="button"
                                onClick={async () => {
                                  try {
                                    await navigator.clipboard.writeText(cupom.code);
                                    alert("Código copiado para a área de transferência!");
                                  } catch (err) {
                                    const textArea = document.createElement("textarea");
                                    textArea.value = cupom.code;
                                    textArea.style.position = "fixed";
                                    textArea.style.opacity = "0";
                                    document.body.appendChild(textArea);
                                    textArea.select();
                                    document.execCommand("copy");
                                    document.body.removeChild(textArea);
                                    alert("Código copiado para a área de transferência!");
                                  }
                                }}
                                className="px-3 py-1 text-xs font-semibold text-blue-300 bg-blue-500/20 border border-blue-500/50 rounded hover:bg-blue-500/30 transition-colors"
                                title="Copiar código"
                              >
                                📋 Copiar
                              </button>
                            </div>
                          </div>
                        </div>
                        <p className="text-sm text-zinc-300 mt-2">
                          <strong>Valor:</strong> R$ {cupom.discountValue.toFixed(2).replace(".", ",")}
                        </p>
                        {cupom.expiresAt && (
                          <p className="text-xs text-zinc-400 mt-2">
                            Válido até: {new Date(cupom.expiresAt).toLocaleDateString("pt-BR")}
                          </p>
                        )}
                        <p className="text-xs text-yellow-400 mt-2">
                          ⚠️ Pode zerar o serviço ou ser usado como desconto parcial. <strong>Sobras não utilizadas se perdem.</strong>
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Cupons Usados */}
              {cupons.filter(c => c.status === "usado").length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-zinc-400 mb-2">📋 Usados ({cupons.filter(c => c.status === "usado").length})</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {cupons.filter(c => c.status === "usado").map((cupom) => (
                      <div
                        key={cupom.id}
                        className="rounded-lg border border-zinc-600 bg-zinc-900/50 p-4 opacity-60"
                      >
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex-1">
                            <p className="text-xs text-zinc-500 font-semibold mb-1">CÓDIGO DO CUPOM</p>
                            <div className="flex items-center gap-2">
                              <p className="text-xl font-bold text-zinc-500 font-mono tracking-wider">
                                {cupom.code}
                              </p>
                              <button
                                type="button"
                                onClick={async () => {
                                  try {
                                    await navigator.clipboard.writeText(cupom.code);
                                    alert("Código copiado para a área de transferência!");
                                  } catch (err) {
                                    const textArea = document.createElement("textarea");
                                    textArea.value = cupom.code;
                                    textArea.style.position = "fixed";
                                    textArea.style.opacity = "0";
                                    document.body.appendChild(textArea);
                                    textArea.select();
                                    document.execCommand("copy");
                                    document.body.removeChild(textArea);
                                    alert("Código copiado para a área de transferência!");
                                  }
                                }}
                                className="px-3 py-1 text-xs font-semibold text-zinc-400 bg-zinc-500/20 border border-zinc-500/50 rounded hover:bg-zinc-500/30 transition-colors"
                                title="Copiar código"
                              >
                                📋 Copiar
                              </button>
                            </div>
                          </div>
                          <span className="text-xs bg-zinc-700 text-zinc-400 px-2 py-1 rounded">Usado</span>
                        </div>
                        {cupom.serviceType && (
                          <p className="text-sm text-zinc-500 mt-2">
                            <strong>Serviço:</strong> {getServiceName(cupom.serviceType)}
                          </p>
                        )}
                        {cupom.usedAt && (
                          <p className="text-xs text-zinc-600 mt-2">
                            Usado em: {new Date(cupom.usedAt).toLocaleDateString("pt-BR")}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Cupons Expirados */}
              {cupons.filter(c => c.status === "expirado").length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-red-400 mb-2">❌ Expirados ({cupons.filter(c => c.status === "expirado").length})</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {cupons.filter(c => c.status === "expirado").map((cupom) => (
                      <div
                        key={cupom.id}
                        className={`rounded-lg border bg-red-500/5 p-4 opacity-60 ${
                          cupom.couponType === "plano" ? "border-red-500/30" : "border-red-500/30"
                        }`}
                      >
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex-1">
                            <p className="text-xs text-red-400 font-semibold mb-1">CÓDIGO DO CUPOM</p>
                            <div className="flex items-center gap-2">
                              <p className="text-xl font-bold text-red-400 font-mono tracking-wider line-through">
                                {cupom.code}
                              </p>
                              <button
                                type="button"
                                onClick={async () => {
                                  try {
                                    await navigator.clipboard.writeText(cupom.code);
                                    alert("Código copiado para a área de transferência!");
                                  } catch (err) {
                                    const textArea = document.createElement("textarea");
                                    textArea.value = cupom.code;
                                    textArea.style.position = "fixed";
                                    textArea.style.opacity = "0";
                                    document.body.appendChild(textArea);
                                    textArea.select();
                                    document.execCommand("copy");
                                    document.body.removeChild(textArea);
                                    alert("Código copiado para a área de transferência!");
                                  }
                                }}
                                className="px-3 py-1 text-xs font-semibold text-red-300 bg-red-500/20 border border-red-500/50 rounded hover:bg-red-500/30 transition-colors"
                                title="Copiar código"
                              >
                                📋 Copiar
                              </button>
                            </div>
                          </div>
                          <span className={`text-xs px-2 py-1 rounded ${
                            cupom.couponType === "plano" ? "bg-green-900/30 text-green-400" : "bg-blue-900/30 text-blue-400"
                          }`}>
                            {cupom.couponType === "plano" ? "Plano" : "Reembolso"}
                          </span>
                        </div>
                        {cupom.serviceType && (
                          <p className="text-sm text-zinc-500 mt-2">
                            <strong>Serviço:</strong> {getServiceName(cupom.serviceType)}
                          </p>
                        )}
                        {cupom.discountValue > 0 && cupom.discountType === "fixed" && (
                          <p className="text-sm text-zinc-500 mt-2">
                            <strong>Valor:</strong> R$ {cupom.discountValue.toFixed(2).replace(".", ",")}
                          </p>
                        )}
                        {cupom.expiresAt && (
                          <p className="text-xs text-red-400 mt-2">
                            Expirou em: {new Date(cupom.expiresAt).toLocaleDateString("pt-BR")}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Agendamentos */}
        <div className="rounded-xl border border-zinc-700 bg-zinc-800/50 p-6">
          <h2 className="text-xl font-bold text-zinc-100 mb-4">📅 Meus Agendamentos</h2>
          {agendamentos.length === 0 ? (
            <p className="text-zinc-400">Você não possui agendamentos.</p>
          ) : (
            <div className="space-y-4">
              {agendamentos.map((agendamento) => (
                <div
                  key={agendamento.id}
                  className="rounded-lg border border-zinc-600 bg-zinc-900/50 p-4"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <div className={`w-3 h-3 rounded-full ${getStatusColor(agendamento.status)}`}></div>
                        <h3 className="text-lg font-bold text-zinc-100">{agendamento.tipo}</h3>
                        <span className={`rounded-full px-3 py-1 text-xs font-semibold ${
                          agendamento.status === "pendente"
                            ? "bg-orange-500/20 text-orange-300"
                            : agendamento.status === "aceito" || agendamento.status === "confirmado"
                            ? "bg-green-500/20 text-green-300"
                            : "bg-red-500/20 text-red-300"
                        }`}>
                          {getStatusLabel(agendamento.status)}
                        </span>
                      </div>
                      <div className="text-sm text-zinc-400 space-y-1">
                        <div>
                          <strong className="text-zinc-300">Data/Hora:</strong>{" "}
                          {new Date(agendamento.data).toLocaleString("pt-BR")}
                        </div>
                        <div>
                          <strong className="text-zinc-300">Duração:</strong> {agendamento.duracaoMinutos} minutos
                        </div>
                        {agendamento.observacoes && (
                          <div>
                            <strong className="text-zinc-300">Observações:</strong> {agendamento.observacoes}
                          </div>
                        )}
                        {agendamento.pagamento && (
                          <div className="mt-2 pt-2 border-t border-zinc-700">
                            <div className="flex items-center gap-2">
                              <div className="w-2 h-2 rounded-full bg-green-500"></div>
                              <span className="text-green-400 font-semibold">✅ Pagamento Confirmado</span>
                            </div>
                            <div className="text-xs text-zinc-500 mt-1 ml-4">
                              Valor: R$ {agendamento.pagamento.amount.toFixed(2).replace(".", ",")} |{" "}
                              Método: {agendamento.pagamento.paymentMethod || "Não informado"}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                    {/* Botão de cancelamento para agendamentos confirmados e pagos */}
                    {(agendamento.status === "aceito" || agendamento.status === "confirmado") && 
                     agendamento.pagamento && 
                     agendamento.pagamento.status === "approved" && (
                      <div className="ml-4">
                        <button
                          onClick={async () => {
                            if (!confirm("Tem certeza que deseja cancelar este agendamento? O horário ficará disponível novamente.")) {
                              return;
                            }
                            
                            // Perguntar tipo de reembolso
                            const refundChoice = confirm(
                              "Escolha o tipo de reembolso:\n\n" +
                              "OK = Reembolso direto na conta bancária (via Asaas)\n" +
                              "Cancelar = Cupom de reembolso para usar em futuros agendamentos"
                            );
                            
                            const refundType = refundChoice ? "direct" : "coupon";
                            
                            try {
                              const res = await fetch("/api/agendamentos/cancelar", {
                                method: "POST",
                                headers: { "Content-Type": "application/json" },
                                body: JSON.stringify({ 
                                  appointmentId: agendamento.id,
                                  refundType: refundType,
                                }),
                              });

                              const data = await res.json();

                              if (res.ok) {
                                let message = "Seu agendamento foi cancelado com sucesso!";
                                if (data.refundType === "direct") {
                                  message += `\n\nReembolso direto de R$ ${data.refundAmount?.toFixed(2).replace(".", ",") || "0,00"} será processado em até 5 dias úteis na sua conta bancária.`;
                                } else if (data.couponCode) {
                                  message += `\n\nCupom de reembolso: ${data.couponCode}\nValor: R$ ${data.refundAmount?.toFixed(2).replace(".", ",") || "0,00"}`;
                                }
                                alert(message);
                                // Recarregar dados sem recarregar a página
                                await carregarDados();
                                // Disparar evento para atualizar notificações
                                window.dispatchEvent(new CustomEvent("appointment-updated"));
                              } else {
                                alert(data.error || "Erro ao cancelar agendamento");
                              }
                            } catch (err) {
                              console.error("Erro ao cancelar agendamento:", err);
                              alert("Erro ao cancelar agendamento");
                            }
                          }}
                          className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-semibold rounded-lg transition-colors"
                        >
                          ❌ Cancelar Agendamento
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Perguntas Enviadas ao FAQ */}
        <div className="rounded-xl border border-zinc-700 bg-zinc-800/50 p-6">
          <div className="flex justify-between items-center mb-4">
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-bold text-zinc-100">❓ Minhas Perguntas ao FAQ</h2>
              {faqQuestions.filter((p) => p.status === "respondida" && !p.readAt).length > 0 && (
                <span className="flex items-center justify-center min-w-[24px] h-6 px-2 rounded-full bg-red-600 text-white text-xs font-bold">
                  {faqQuestions.filter((p) => p.status === "respondida" && !p.readAt).length}
                </span>
              )}
            </div>
            <button
              onClick={carregarDados}
              className="rounded-lg bg-zinc-700 px-3 py-1 text-sm font-semibold text-zinc-300 hover:bg-zinc-600 transition-colors"
              title="Atualizar perguntas"
            >
              🔄 Atualizar
            </button>
          </div>
          {faqQuestions.length === 0 ? (
            <p className="text-zinc-400">Você não enviou nenhuma pergunta ao FAQ.</p>
          ) : (
            <div className="space-y-4">
              {faqQuestions.map((pergunta) => {
                const isRecusada = pergunta.status === "recusada" || pergunta.blocked;
                return (
                  <div
                    key={pergunta.id}
                    className={`rounded-lg border p-4 ${
                      isRecusada
                        ? "border-red-500/50 bg-red-500/10"
                        : pergunta.status === "pendente"
                        ? "border-orange-500/50 bg-orange-500/10"
                        : "border-green-500/50 bg-green-500/10"
                    }`}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex-1">
                        <h3 className="text-lg font-semibold text-zinc-100 mb-2">{pergunta.question}</h3>
                        <div className="text-xs text-zinc-400">
                          Enviada em: {new Date(pergunta.createdAt).toLocaleString("pt-BR")}
                        </div>
                        {isRecusada ? (
                          <div className="text-xs text-red-400 mt-1 space-y-1">
                            <div>⚠️ Esta pergunta foi recusada pela administração.</div>
                            {pergunta.blockedReason && (
                              <div className="text-red-300 mt-1 pl-2 border-l-2 border-red-500/50">
                                <strong>Motivo:</strong> {pergunta.blockedReason}
                              </div>
                            )}
                          </div>
                        ) : pergunta.published && pergunta.faq ? (
                          <div className="text-xs text-blue-400 mt-1">
                            ✅ Publicada no FAQ público
                          </div>
                        ) : null}
                      </div>
                      <span
                        className={`rounded-full px-3 py-1 text-xs font-semibold ${
                          isRecusada
                            ? "bg-red-500/20 text-red-300"
                            : pergunta.status === "pendente"
                            ? "bg-orange-500/20 text-orange-300"
                            : "bg-green-500/20 text-green-300"
                        }`}
                      >
                        {isRecusada
                          ? "Recusada"
                          : pergunta.status === "pendente"
                          ? "Pendente"
                          : "Respondida"}
                      </span>
                    </div>
                    {pergunta.answer && (
                      <div className="mt-4 p-4 rounded-lg bg-zinc-900/50 border border-zinc-700">
                        <div className="text-sm font-semibold text-zinc-300 mb-2">Resposta:</div>
                        <div className="text-sm text-zinc-200">{pergunta.answer}</div>
                        {pergunta.answeredAt && (
                          <div className="text-xs text-zinc-500 mt-2">
                            Respondida em: {new Date(pergunta.answeredAt).toLocaleString("pt-BR")}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
