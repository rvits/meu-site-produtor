"use client";

import { useEffect, useState } from "react";

interface PagamentoConfirmado {
  id: string;
  amount: number;
  status: string;
  paymentMethod: string | null;
  asaasId: string | null;
  createdAt: string;
}

interface CupomAssociado {
  code: string;
  serviceType: string | null;
  discountType: string;
  used: boolean;
}

interface Agendamento {
  id: number;
  data: string;
  duracaoMinutos: number;
  tipo: string;
  observacoes?: string;
  status: string;
  blocked: boolean;
  blockedAt?: string;
  blockedReason?: string;
  cancelReason?: string | null;
  cancelledAt?: string | null;
  cancelRefundOption?: string | null;
  refundProcessedAt?: string | null;
  refundCouponId?: string | null;
  user: {
    nomeArtistico: string;
    email: string;
  };
  createdAt: string;
  pagamentoConfirmado: PagamentoConfirmado | null;
  cupomAssociado: CupomAssociado | null;
}

export default function AdminAgendamentosPage() {
  const [agendamentos, setAgendamentos] = useState<Agendamento[]>([]);
  const [agendamentosFiltrados, setAgendamentosFiltrados] = useState<Agendamento[]>([]);
  const [busca, setBusca] = useState("");
  const [loading, setLoading] = useState(true);
  const [cancelModal, setCancelModal] = useState<{ id: number } | null>(null);
  const [cancelJustificativa, setCancelJustificativa] = useState("");
  const [cancelSubmitting, setCancelSubmitting] = useState(false);

  useEffect(() => {
    carregarAgendamentos();
  }, []);

  useEffect(() => {
    if (busca.trim() === "") {
      setAgendamentosFiltrados(agendamentos);
    } else {
      const termo = busca.toLowerCase();
      const filtrados = agendamentos.filter(
        (a) =>
          a.user.nomeArtistico.toLowerCase().includes(termo) ||
          a.user.email.toLowerCase().includes(termo)
      );
      setAgendamentosFiltrados(filtrados);
    }
  }, [busca, agendamentos]);

  async function carregarAgendamentos() {
    try {
      const res = await fetch("/api/admin/agendamentos");
      if (res.ok) {
        const data = await res.json();
        setAgendamentos(data.agendamentos || []);
        setAgendamentosFiltrados(data.agendamentos || []);
      }
    } catch (err) {
      console.error("Erro ao carregar agendamentos", err);
    } finally {
      setLoading(false);
    }
  }

  async function atualizarAgendamento(id: number, updates: { status?: string; blocked?: boolean; blockedReason?: string }) {
    try {
      const res = await fetch(`/api/admin/agendamentos?id=${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });

      if (res.ok) {
        await carregarAgendamentos();
      }
    } catch (err) {
      console.error("Erro ao atualizar agendamento", err);
    }
  }

  function abrirModalCancelar(id: number) {
    setCancelModal({ id });
    setCancelJustificativa("");
  }

  function fecharModalCancelar() {
    setCancelModal(null);
    setCancelJustificativa("");
    setCancelSubmitting(false);
  }

  async function confirmarCancelamento() {
    if (!cancelModal) return;
    const justificativa = cancelJustificativa.trim();
    if (justificativa.length < 3) {
      alert("Justificativa é obrigatória (mínimo 3 caracteres).");
      return;
    }
    setCancelSubmitting(true);
    try {
      const res = await fetch(`/api/admin/agendamentos/cancelar?id=${cancelModal.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cancellationComment: justificativa }),
      });

      if (res.ok) {
        fecharModalCancelar();
        await carregarAgendamentos();
        alert("Agendamento cancelado. O usuário poderá escolher reembolso ou cupom na Minha Conta.");
      } else {
        const data = await res.json().catch(() => ({}));
        const msg = typeof data?.error === "string" ? data.error : "Erro ao cancelar agendamento.";
        alert(msg);
      }
    } catch (err) {
      console.error("Erro ao cancelar agendamento", err);
      alert("Erro ao cancelar agendamento.");
    } finally {
      setCancelSubmitting(false);
    }
  }

  async function reverterCancelamento(id: number) {
    if (!confirm("Tem certeza que deseja reverter o cancelamento? O horário será reservado novamente.")) {
      return;
    }

    try {
      const res = await fetch(`/api/admin/agendamentos/reverter-cancelamento?id=${id}`, {
        method: "POST",
      });

      if (res.ok) {
        await carregarAgendamentos();
        alert("Cancelamento revertido com sucesso! O horário foi reservado novamente.");
      } else {
        const error = await res.json();
        alert(error.error || "Erro ao reverter cancelamento.");
      }
    } catch (err) {
      console.error("Erro ao reverter cancelamento", err);
      alert("Erro ao reverter cancelamento.");
    }
  }

  async function excluirAgendamento(id: number) {
    if (!confirm("Tem certeza que deseja excluir este agendamento? Esta ação não pode ser desfeita.")) {
      return;
    }

    try {
      const res = await fetch(`/api/admin/agendamentos?id=${id}`, {
        method: "DELETE",
      });

      if (res.ok) {
        await carregarAgendamentos();
        alert("Agendamento excluído com sucesso!");
      } else {
        const error = await res.json();
        alert(error.error || "Erro ao excluir agendamento.");
      }
    } catch (err) {
      console.error("Erro ao excluir agendamento", err);
      alert("Erro ao excluir agendamento.");
    }
  }

  if (loading) {
    return <p className="text-zinc-400">Carregando agendamentos...</p>;
  }

  const agendamentosPendentes = agendamentosFiltrados.filter(a => a.status === "pendente");
  const agendamentosAceitos = agendamentosFiltrados.filter(a => a.status === "aceito" || a.status === "confirmado");
  const agendamentosCancelados = agendamentosFiltrados.filter(a => a.status === "cancelado");
  const agendamentosRecusados = agendamentosFiltrados.filter(a => a.status === "recusado");

  function getStatusColor(status: string) {
    if (status === "pendente") return "bg-orange-500";
    if (status === "aceito" || status === "confirmado") return "bg-green-500";
    if (status === "recusado" || status === "cancelado") return "bg-red-500";
    return "bg-gray-500";
  }

  function getStatusLabel(status: string) {
    if (status === "pendente") return "Pendente";
    if (status === "aceito" || status === "confirmado") return "Aceito";
    if (status === "cancelado") return "Cancelado";
    if (status === "recusado") return "Recusado";
    return status;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-zinc-100 mb-2">Agendamentos</h1>
        <p className="text-zinc-400">Solicitações pendentes, aceitas e recusadas</p>
      </div>

      {/* Estatísticas rápidas */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
        <div className="rounded-xl border border-zinc-700 bg-zinc-800/50 p-4">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-orange-500"></div>
            <span className="text-zinc-300">Pendentes</span>
          </div>
          <div className="text-2xl font-bold text-orange-400 mt-2">{agendamentosPendentes.length}</div>
        </div>
        <div className="rounded-xl border border-zinc-700 bg-zinc-800/50 p-4">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-green-500"></div>
            <span className="text-zinc-300">Aceitos</span>
          </div>
          <div className="text-2xl font-bold text-green-400 mt-2">{agendamentosAceitos.length}</div>
        </div>
        <div className="rounded-xl border border-zinc-700 bg-zinc-800/50 p-4">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-red-500"></div>
            <span className="text-zinc-300">Cancelados</span>
          </div>
          <div className="text-2xl font-bold text-red-400 mt-2">{agendamentosCancelados.length}</div>
        </div>
        <div className="rounded-xl border border-zinc-700 bg-zinc-800/50 p-4">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-gray-500"></div>
            <span className="text-zinc-300">Recusados</span>
          </div>
          <div className="text-2xl font-bold text-gray-400 mt-2">{agendamentosRecusados.length}</div>
        </div>
        <div className="rounded-xl border border-zinc-700 bg-zinc-800/50 p-4">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-blue-500"></div>
            <span className="text-zinc-300">Em andamento</span>
          </div>
          <div className="text-2xl font-bold text-blue-400 mt-2">{agendamentosPendentes.length}</div>
        </div>
        <div className="rounded-xl border border-zinc-700 bg-zinc-800/50 p-4">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-purple-500"></div>
            <span className="text-zinc-300">Concluídos</span>
          </div>
          <div className="text-2xl font-bold text-purple-400 mt-2">{agendamentosAceitos.length}</div>
        </div>
      </div>

      {/* Input de Busca */}
      <div className="rounded-xl border border-zinc-700 bg-zinc-800/50 p-4">
        <input
          type="text"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Buscar por nome ou email do usuário..."
          className="w-full rounded-lg border border-zinc-600 bg-zinc-900 px-4 py-2 text-zinc-100 placeholder-zinc-500 focus:border-red-500 focus:outline-none"
        />
        {busca && (
          <p className="mt-2 text-sm text-zinc-400">
            {agendamentosFiltrados.length} agendamento(s) encontrado(s)
          </p>
        )}
      </div>

      {agendamentosFiltrados.length === 0 ? (
        <div className="rounded-xl border border-zinc-700 bg-zinc-800/50 p-6 text-center text-zinc-400">
          Nenhum agendamento encontrado.
        </div>
      ) : (
        <div className="space-y-4">
          {agendamentosFiltrados.map((a) => (
            <div
              key={a.id}
              className={`rounded-xl border ${
                a.blocked ? "border-red-700/50 bg-red-950/10" : "border-zinc-700 bg-zinc-800/50"
              } p-6`}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1 space-y-2">
                  <div className="flex items-center gap-3">
                    <div className={`w-4 h-4 rounded-full ${getStatusColor(a.status)}`}></div>
                    <h3 className="text-lg font-bold text-zinc-100">{a.user.nomeArtistico}</h3>
                    <span className={`rounded-full px-3 py-1 text-xs font-semibold ${
                      a.status === "pendente"
                        ? "bg-orange-500/20 text-orange-300"
                        : a.status === "aceito" || a.status === "confirmado"
                        ? "bg-green-500/20 text-green-300"
                        : a.status === "cancelado"
                        ? "bg-red-500/20 text-red-300"
                        : "bg-gray-500/20 text-gray-300"
                    }`}>
                      {getStatusLabel(a.status)}
                    </span>
                  </div>
                  <div className="text-sm text-zinc-400 space-y-1">
                    <div><strong className="text-zinc-300">Email:</strong> {a.user.email}</div>
                    <div><strong className="text-zinc-300">Data/Hora:</strong> {new Date(a.data).toLocaleString("pt-BR")}</div>
                    <div><strong className="text-zinc-300">Serviço:</strong> {a.tipo}</div>
                    <div><strong className="text-zinc-300">Duração:</strong> {a.duracaoMinutos} minutos</div>
                    {a.observacoes && (
                      <div><strong className="text-zinc-300">Observações:</strong> {a.observacoes}</div>
                    )}
                    <div><strong className="text-zinc-300">Criado em:</strong> {new Date(a.createdAt).toLocaleString("pt-BR")}</div>
                    {/* Status de Pagamento */}
                    <div className="mt-3 pt-3 border-t border-zinc-700">
                      {a.cupomAssociado ? (
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full bg-green-500"></div>
                          <span className="text-green-400 font-semibold">✅ Pago com Cupom</span>
                        </div>
                      ) : a.pagamentoConfirmado ? (
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full bg-green-500"></div>
                          <span className="text-green-400 font-semibold">✅ Pagamento Confirmado</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full bg-red-500"></div>
                          <span className="text-red-400 font-semibold">⚠️ Pagamento Não Confirmado</span>
                        </div>
                      )}
                      {a.cupomAssociado && (
                        <div className="mt-2 ml-4 text-xs text-zinc-500 space-y-1">
                          <div><strong>Cupom:</strong> {a.cupomAssociado.code}</div>
                          {a.cupomAssociado.serviceType && (
                            <div><strong>Serviço:</strong> {a.cupomAssociado.serviceType}</div>
                          )}
                          <div><strong>Status do Cupom:</strong> {a.cupomAssociado.used ? "Usado" : "Pendente"}</div>
                        </div>
                      )}
                      {a.pagamentoConfirmado && (
                        <div className="mt-2 ml-4 text-xs text-zinc-500 space-y-1">
                          <div><strong>Valor:</strong> R$ {a.pagamentoConfirmado.amount.toFixed(2)}</div>
                          <div><strong>Método:</strong> {a.pagamentoConfirmado.paymentMethod || "Não informado"}</div>
                          <div><strong>ID Asaas:</strong> {a.pagamentoConfirmado.asaasId || "N/A"}</div>
                          <div><strong>Confirmado em:</strong> {new Date(a.pagamentoConfirmado.createdAt).toLocaleString("pt-BR")}</div>
                        </div>
                      )}
                    </div>
                    {/* Cancelamento: justificativa e opção escolhida */}
                    {a.status === "cancelado" && (a.cancelReason || a.cancelRefundOption) && (
                      <div className="mt-3 pt-3 border-t border-zinc-700 text-sm">
                        {a.cancelReason && (
                          <div className="mb-2">
                            <strong className="text-zinc-300">Justificativa:</strong>
                            <p className="text-zinc-400 mt-1">{a.cancelReason}</p>
                          </div>
                        )}
                        {a.cancelledAt && (
                          <div className="text-zinc-500 text-xs">Cancelado em: {new Date(a.cancelledAt).toLocaleString("pt-BR")}</div>
                        )}
                        {a.cancelRefundOption === "reembolso" && (
                          <div className="text-blue-300 mt-1">Reembolso direto (Asaas) solicitado{a.refundProcessedAt ? ` em ${new Date(a.refundProcessedAt).toLocaleString("pt-BR")}` : ""}</div>
                        )}
                        {a.cancelRefundOption === "cupom" && (
                          <div className="text-amber-300 mt-1">Cupom de reembolso gerado para o cliente</div>
                        )}
                        {!a.cancelRefundOption && a.pagamentoConfirmado && (
                          <div className="text-zinc-500 text-xs">Aguardando cliente escolher reembolso ou cupom na Minha Conta</div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex flex-col gap-2 ml-4">
                  {a.status === "pendente" && (
                    <>
                      <button
                        onClick={() => atualizarAgendamento(a.id, { status: "aceito" })}
                        className="rounded bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-500 transition"
                      >
                        Aceitar
                      </button>
                      <button
                        onClick={() => atualizarAgendamento(a.id, { status: "recusado" })}
                        className="rounded bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-500 transition"
                      >
                        Recusar
                      </button>
                    </>
                  )}
                  {(a.status === "aceito" || a.status === "confirmado") && (
                    <>
                      <select
                        value={a.status}
                        onChange={(e) => atualizarAgendamento(a.id, { status: e.target.value })}
                        className="rounded bg-zinc-900 border border-zinc-600 px-3 py-2 text-sm text-zinc-300"
                      >
                        <option value="pendente">Pendente</option>
                        <option value="aceito">Aceito</option>
                        <option value="cancelado">Cancelado</option>
                        <option value="recusado">Recusado</option>
                      </select>
                      <button
                        onClick={() => abrirModalCancelar(a.id)}
                        className="rounded bg-orange-600 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-500 transition"
                      >
                        ❌ Cancelar Agendamento
                      </button>
                    </>
                  )}
                  {a.status === "cancelado" && (
                    <>
                      <select
                        value={a.status}
                        onChange={(e) => atualizarAgendamento(a.id, { status: e.target.value })}
                        className="rounded bg-zinc-900 border border-zinc-600 px-3 py-2 text-sm text-zinc-300"
                      >
                        <option value="cancelado">Cancelado</option>
                        <option value="aceito">Aceito</option>
                        <option value="pendente">Pendente</option>
                        <option value="recusado">Recusado</option>
                      </select>
                      <button
                        onClick={() => reverterCancelamento(a.id)}
                        className="rounded bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-500 transition"
                      >
                        ✅ Reverter Cancelamento
                      </button>
                      <button
                        onClick={() => excluirAgendamento(a.id)}
                        className="rounded bg-red-800 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 transition"
                      >
                        🗑️ Excluir
                      </button>
                    </>
                  )}
                  {a.status === "recusado" && (
                    <>
                      <select
                        value={a.status}
                        onChange={(e) => atualizarAgendamento(a.id, { status: e.target.value })}
                        className="rounded bg-zinc-900 border border-zinc-600 px-3 py-2 text-sm text-zinc-300"
                      >
                        <option value="recusado">Recusado</option>
                        <option value="pendente">Pendente</option>
                        <option value="aceito">Aceito</option>
                        <option value="cancelado">Cancelado</option>
                      </select>
                      <button
                        onClick={() => excluirAgendamento(a.id)}
                        className="rounded bg-red-800 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 transition"
                      >
                        🗑️ Excluir
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal Justificativa Cancelamento */}
      {cancelModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="bg-zinc-800 border border-zinc-600 rounded-xl shadow-xl max-w-md w-full p-6">
            <h3 className="text-lg font-bold text-zinc-100 mb-2">Cancelar agendamento</h3>
            <p className="text-zinc-400 text-sm mb-4">
              Justificativa é obrigatória. O usuário verá essa justificativa na Minha Conta e poderá escolher reembolso direto ou cupom para remarcar.
            </p>
            <textarea
              value={cancelJustificativa}
              onChange={(e) => setCancelJustificativa(e.target.value)}
              placeholder="Ex.: Cliente solicitou remarcação por conflito de agenda..."
              className="w-full rounded-lg border border-zinc-600 bg-zinc-900 px-3 py-2 text-zinc-200 placeholder-zinc-500 min-h-[100px]"
              rows={4}
              minLength={3}
            />
            <div className="flex gap-3 mt-4">
              <button
                onClick={confirmarCancelamento}
                disabled={cancelSubmitting || cancelJustificativa.trim().length < 3}
                className="flex-1 rounded-lg bg-orange-600 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {cancelSubmitting ? "Cancelando..." : "Confirmar cancelamento"}
              </button>
              <button
                onClick={fecharModalCancelar}
                disabled={cancelSubmitting}
                className="rounded-lg bg-zinc-600 px-4 py-2 text-sm font-semibold text-zinc-200 hover:bg-zinc-500"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
