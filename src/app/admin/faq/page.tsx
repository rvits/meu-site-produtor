"use client";

import { useEffect, useState } from "react";

interface FAQ {
  id: string;
  question: string;
  answer: string;
  views: number;
  createdAt: string;
}

interface UserQuestion {
  id: string;
  question: string;
  userName?: string;
  userEmail?: string;
  userId?: string;
  status: string;
  answer?: string;
  answeredAt?: string;
  createdAt: string;
  published: boolean;
  blocked?: boolean;
  faqId?: string;
  user?: {
    nomeArtistico?: string;
    nomeCompleto?: string;
    email?: string;
  };
  faq?: {
    id: string;
    question: string;
  };
}

export default function AdminFaqPage() {
  const [abaAtiva, setAbaAtiva] = useState<"faqs" | "perguntas" | "recusadas">("faqs");
  const [faqs, setFaqs] = useState<FAQ[]>([]);
  const [perguntas, setPerguntas] = useState<UserQuestion[]>([]);
  const [perguntasRecusadas, setPerguntasRecusadas] = useState<UserQuestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [busca, setBusca] = useState("");
  const [mostrarTodas, setMostrarTodas] = useState(false); // Por padrão, mostrar apenas as 5 mais visualizadas
  
  // Estados para criar nova FAQ
  const [novaPergunta, setNovaPergunta] = useState("");
  const [novaResposta, setNovaResposta] = useState("");
  const [mostrarForm, setMostrarForm] = useState(false);
  
  // Estados para editar FAQ
  const [editandoFaq, setEditandoFaq] = useState<FAQ | null>(null);
  const [editPergunta, setEditPergunta] = useState("");
  const [editResposta, setEditResposta] = useState("");
  
  // Estados para responder pergunta
  const [respondendoPergunta, setRespondendoPergunta] = useState<UserQuestion | null>(null);
  const [respostaTexto, setRespostaTexto] = useState("");
  const [filtroStatus, setFiltroStatus] = useState<"pendente" | "respondida" | "todas">("pendente");

  useEffect(() => {
    if (abaAtiva === "faqs") {
      carregarFAQs();
    } else if (abaAtiva === "perguntas") {
      carregarPerguntas();
    } else if (abaAtiva === "recusadas") {
      carregarPerguntasRecusadas();
    }
  }, [abaAtiva, busca, mostrarTodas, filtroStatus]);

  async function carregarFAQs() {
    try {
      setLoading(true);
      const url = `/api/admin/faq?todas=${mostrarTodas}${busca ? `&q=${encodeURIComponent(busca)}` : ""}`;
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        setFaqs(data.faqs || []);
      }
    } catch (err) {
      console.error("Erro ao carregar FAQs", err);
    } finally {
      setLoading(false);
    }
  }

  async function carregarPerguntas() {
    try {
      setLoading(true);
      const url = `/api/admin/faq/pendentes?status=${filtroStatus}`;
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        setPerguntas(data.perguntas || []);
      }
    } catch (err) {
      console.error("Erro ao carregar perguntas", err);
    } finally {
      setLoading(false);
    }
  }

  async function carregarPerguntasRecusadas() {
    try {
      setLoading(true);
      const res = await fetch("/api/admin/faq/recusadas");
      if (res.ok) {
        const data = await res.json();
        setPerguntasRecusadas(data.perguntas || []);
      }
    } catch (err) {
      console.error("Erro ao carregar perguntas recusadas", err);
    } finally {
      setLoading(false);
    }
  }

  async function criarFAQ() {
    if (!novaPergunta || !novaResposta) return;

    try {
      const res = await fetch("/api/admin/faq", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: novaPergunta, answer: novaResposta }),
      });

      if (res.ok) {
        setNovaPergunta("");
        setNovaResposta("");
        setMostrarForm(false);
        await carregarFAQs();
      }
    } catch (err) {
      console.error("Erro ao criar FAQ", err);
    }
  }

  async function deletarFAQ(id: string) {
    if (!confirm("Tem certeza que deseja deletar esta FAQ?")) return;

    try {
      const res = await fetch(`/api/admin/faq?id=${id}`, {
        method: "DELETE",
      });

      if (res.ok) {
        await carregarFAQs();
      }
    } catch (err) {
      console.error("Erro ao deletar FAQ", err);
    }
  }

  function iniciarEdicao(faq: FAQ) {
    setEditandoFaq(faq);
    setEditPergunta(faq.question);
    setEditResposta(faq.answer);
  }

  function cancelarEdicao() {
    setEditandoFaq(null);
    setEditPergunta("");
    setEditResposta("");
  }

  async function salvarEdicao() {
    if (!editandoFaq || !editPergunta.trim() || !editResposta.trim()) {
      alert("Preencha pergunta e resposta");
      return;
    }

    try {
      const res = await fetch(`/api/admin/faq?id=${editandoFaq.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: editPergunta,
          answer: editResposta,
        }),
      });

      if (res.ok) {
        await carregarFAQs();
        cancelarEdicao();
      } else {
        const data = await res.json();
        alert(data.error || "Erro ao atualizar FAQ");
      }
    } catch (err) {
      console.error("Erro ao atualizar FAQ", err);
      alert("Erro ao atualizar FAQ. Tente novamente.");
    }
  }

  function iniciarResposta(pergunta: UserQuestion) {
    setRespondendoPergunta(pergunta);
    setRespostaTexto(pergunta.answer || "");
  }

  function cancelarResposta() {
    setRespondendoPergunta(null);
    setRespostaTexto("");
  }

  async function salvarResposta() {
    if (!respondendoPergunta || !respostaTexto.trim()) {
      alert("Digite uma resposta");
      return;
    }

    try {
      const res = await fetch("/api/admin/faq/responder", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          questionId: respondendoPergunta.id,
          answer: respostaTexto,
        }),
      });

      if (res.ok) {
        await carregarPerguntas();
        cancelarResposta();
        alert("Resposta enviada com sucesso!");
      } else {
        const data = await res.json();
        alert(data.error || "Erro ao responder pergunta");
      }
    } catch (err) {
      console.error("Erro ao responder pergunta", err);
      alert("Erro ao responder pergunta. Tente novamente.");
    }
  }

  async function toggleBanco(pergunta: UserQuestion) {
    // Se já está no banco, remover
    if (pergunta.published && (pergunta.faqId || pergunta.faq?.id)) {
      if (!confirm(`Deseja REMOVER esta pergunta do banco de FAQs?\n\nPergunta: ${pergunta.question}\n\nEla será removida do banco público, mas a resposta permanecerá.`)) {
        return;
      }

      try {
        const res = await fetch("/api/admin/faq/remover-do-banco", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            questionId: pergunta.id,
          }),
        });

        if (res.ok) {
          await carregarPerguntas();
          await carregarFAQs(); // Atualizar também a lista de FAQs do banco
          alert("Pergunta removida do banco de FAQs com sucesso!");
        } else {
          const data = await res.json();
          alert(data.error || "Erro ao remover do banco");
        }
      } catch (err) {
        console.error("Erro ao remover do banco", err);
        alert("Erro ao remover do banco. Tente novamente.");
      }
    } else {
      // Se não está no banco, adicionar
      if (!pergunta.answer) {
        alert("A pergunta precisa ter uma resposta antes de ser adicionada ao banco");
        return;
      }

      if (!confirm(`Deseja adicionar esta pergunta ao banco de FAQs?\n\nPergunta: ${pergunta.question}\nResposta: ${pergunta.answer.substring(0, 100)}...`)) {
        return;
      }

      try {
        const res = await fetch("/api/admin/faq/adicionar-ao-banco", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            questionId: pergunta.id,
            question: pergunta.question,
            answer: pergunta.answer,
          }),
        });

        if (res.ok) {
          await carregarPerguntas();
          await carregarFAQs(); // Atualizar também a lista de FAQs do banco
          alert("Pergunta adicionada ao banco de FAQs com sucesso!");
        } else {
          const data = await res.json();
          alert(data.error || "Erro ao adicionar ao banco");
        }
      } catch (err) {
        console.error("Erro ao adicionar ao banco", err);
        alert("Erro ao adicionar ao banco. Tente novamente.");
      }
    }
  }

  async function associarPerguntaAoUsuario(pergunta: UserQuestion) {
    if (pergunta.userEmail) {
      const mensagem = pergunta.userId 
        ? `Reassociar esta pergunta ao usuário com email ${pergunta.userEmail}?\n\nIsso atualizará a associação e fará com que a pergunta apareça na página "Minha Conta" do usuário.`
        : `Associar esta pergunta ao usuário com email ${pergunta.userEmail}?\n\nIsso fará com que a pergunta apareça na página "Minha Conta" do usuário.`;
      
      if (confirm(mensagem)) {
        await associarPerguntaPorEmail(pergunta.id, pergunta.userEmail);
      }
    } else {
      alert("Esta pergunta não tem email associado. Não é possível associar automaticamente.");
    }
  }

  async function associarPerguntaPorEmail(questionId: string, userEmail: string) {
    try {
      const res = await fetch("/api/admin/faq/associar-pergunta-por-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          questionId,
          userEmail,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        await carregarPerguntas();
        alert(`✅ Pergunta associada ao usuário ${data.pergunta.userEmail} com sucesso!\n\nA pergunta agora deve aparecer na página "Minha Conta" do usuário.`);
        console.log(`[Admin FAQ] Pergunta associada:`, data.pergunta);
      } else {
        const errorData = await res.json();
        alert(errorData.error || "Erro ao associar pergunta");
        console.error("[Admin FAQ] Erro ao associar:", errorData);
      }
    } catch (err) {
      console.error("Erro ao associar pergunta", err);
      alert("Erro ao associar pergunta. Tente novamente.");
    }
  }

  async function associarPergunta(questionId: string, userId: string) {
    try {
      const res = await fetch("/api/admin/faq/associar-pergunta", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          questionId,
          userId,
        }),
      });

      if (res.ok) {
        await carregarPerguntas();
        alert("Pergunta associada ao usuário com sucesso!");
      } else {
        const data = await res.json();
        alert(data.error || "Erro ao associar pergunta");
      }
    } catch (err) {
      console.error("Erro ao associar pergunta", err);
      alert("Erro ao associar pergunta. Tente novamente.");
    }
  }

  async function recusarPergunta(pergunta: UserQuestion) {
    const motivo = prompt("Motivo da recusa (opcional):");
    if (motivo === null) return; // Usuário cancelou

    try {
      const res = await fetch("/api/admin/faq/recusar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          questionId: pergunta.id,
          motivo: motivo || undefined,
        }),
      });

      if (res.ok) {
        await carregarPerguntas();
        await carregarPerguntasRecusadas(); // Atualizar lista de recusadas também
        alert("Pergunta recusada com sucesso!");
      } else {
        const data = await res.json();
        alert(data.error || "Erro ao recusar pergunta");
      }
    } catch (err) {
      console.error("Erro ao recusar pergunta", err);
      alert("Erro ao recusar pergunta. Tente novamente.");
    }
  }

  async function excluirPergunta(pergunta: UserQuestion) {
    if (!confirm(`Tem certeza que deseja EXCLUIR permanentemente esta pergunta?\n\n"${pergunta.question.substring(0, 50)}..."\n\nEsta ação não pode ser desfeita!`)) {
      return;
    }

    try {
      const res = await fetch(`/api/admin/faq/excluir?id=${pergunta.id}`, {
        method: "DELETE",
      });

      if (res.ok) {
        if (abaAtiva === "recusadas") {
          await carregarPerguntasRecusadas();
        } else {
          await carregarPerguntas();
        }
        alert("Pergunta excluída com sucesso!");
      } else {
        const data = await res.json();
        alert(data.error || "Erro ao excluir pergunta");
      }
    } catch (err) {
      console.error("Erro ao excluir pergunta", err);
      alert("Erro ao excluir pergunta. Tente novamente.");
    }
  }

  async function reaceitarPergunta(pergunta: UserQuestion) {
    if (!confirm(`Deseja reaceitar esta pergunta?\n\n"${pergunta.question.substring(0, 50)}..."\n\nA pergunta voltará a aparecer na lista de pendentes.`)) {
      return;
    }

    try {
      const res = await fetch("/api/admin/faq/reaceitar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          questionId: pergunta.id,
        }),
      });

      if (res.ok) {
        await carregarPerguntasRecusadas();
        alert("Pergunta reaceita com sucesso! Ela voltou para a lista de pendentes.");
      } else {
        const data = await res.json();
        alert(data.error || "Erro ao reaceitar pergunta");
      }
    } catch (err) {
      console.error("Erro ao reaceitar pergunta", err);
      alert("Erro ao reaceitar pergunta. Tente novamente.");
    }
  }

  if (loading && faqs.length === 0 && perguntas.length === 0) {
    return <p className="text-zinc-400">Carregando...</p>;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-zinc-100 mb-2">FAQ</h1>
          <p className="text-zinc-400">Gerenciar perguntas frequentes e responder solicitações</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-zinc-700">
        <button
          onClick={() => setAbaAtiva("faqs")}
          className={`px-4 py-2 font-semibold transition-colors ${
            abaAtiva === "faqs"
              ? "text-red-400 border-b-2 border-red-400"
              : "text-zinc-400 hover:text-zinc-300"
          }`}
        >
          FAQs do Banco ({faqs.length})
        </button>
        <button
          onClick={() => setAbaAtiva("perguntas")}
          className={`px-4 py-2 font-semibold transition-colors ${
            abaAtiva === "perguntas"
              ? "text-red-400 border-b-2 border-red-400"
              : "text-zinc-400 hover:text-zinc-300"
          }`}
        >
          Perguntas Enviadas ({perguntas.filter(p => p.status === "pendente" && !(p.blocked ?? false)).length} pendentes)
        </button>
        <button
          onClick={() => setAbaAtiva("recusadas")}
          className={`px-4 py-2 font-semibold transition-colors ${
            abaAtiva === "recusadas"
              ? "text-red-400 border-b-2 border-red-400"
              : "text-zinc-400 hover:text-zinc-300"
          }`}
        >
          Recusadas ({perguntasRecusadas.length})
        </button>
      </div>

      {/* Conteúdo da Aba FAQs */}
      {abaAtiva === "faqs" && (
        <>
          {/* Busca e Controles */}
          <div className="flex gap-3 items-center">
            <input
              type="text"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar por pergunta ou resposta..."
              className="flex-1 rounded-lg border border-zinc-600 bg-zinc-900 px-4 py-2 text-zinc-100 placeholder-zinc-500 focus:border-red-500 focus:outline-none"
            />
            <button
              onClick={() => setMostrarTodas(!mostrarTodas)}
              className={`rounded-lg px-4 py-2 text-sm font-semibold transition-colors ${
                mostrarTodas
                  ? "bg-blue-600 text-white hover:bg-blue-500"
                  : "bg-zinc-700 text-zinc-300 hover:bg-zinc-600"
              }`}
            >
              {mostrarTodas ? "👁️ Ocultar Todas" : "👁️ Mostrar Todas"}
            </button>
            <button
              onClick={() => setMostrarForm(!mostrarForm)}
              className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-500"
            >
              {mostrarForm ? "Cancelar" : "+ Nova FAQ"}
            </button>
          </div>

          {mostrarForm && (
            <div className="rounded-xl border border-zinc-700 bg-zinc-800/50 p-6 space-y-4">
              <h3 className="text-lg font-semibold text-zinc-100">Criar Nova FAQ</h3>
              <div className="space-y-2">
                <label className="block text-sm font-medium text-zinc-300">Pergunta</label>
                <input
                  type="text"
                  value={novaPergunta}
                  onChange={(e) => setNovaPergunta(e.target.value)}
                  className="w-full rounded-lg border border-zinc-600 bg-zinc-900 px-4 py-2 text-zinc-100"
                  placeholder="Digite a pergunta"
                />
              </div>
              <div className="space-y-2">
                <label className="block text-sm font-medium text-zinc-300">Resposta</label>
                <textarea
                  value={novaResposta}
                  onChange={(e) => setNovaResposta(e.target.value)}
                  rows={4}
                  className="w-full rounded-lg border border-zinc-600 bg-zinc-900 px-4 py-2 text-zinc-100"
                  placeholder="Digite a resposta"
                />
              </div>
              <button
                onClick={criarFAQ}
                className="rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-500"
              >
                Criar FAQ
              </button>
            </div>
          )}

          {/* Lista de FAQs */}
          <div className="space-y-4">
            {faqs.length === 0 ? (
              <div className="rounded-xl border border-zinc-700 bg-zinc-800/50 p-6 text-center text-zinc-400">
                {busca ? "Nenhuma FAQ encontrada para esta busca." : "Nenhuma FAQ encontrada. Crie a primeira!"}
              </div>
            ) : (
              faqs.map((faq) => (
                <div key={faq.id} className="rounded-xl border border-zinc-700 bg-zinc-800/50 p-6">
                  {editandoFaq?.id === faq.id ? (
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <label className="block text-sm font-medium text-zinc-300">Pergunta</label>
                        <input
                          type="text"
                          value={editPergunta}
                          onChange={(e) => setEditPergunta(e.target.value)}
                          className="w-full rounded-lg border border-zinc-600 bg-zinc-900 px-4 py-2 text-zinc-100"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="block text-sm font-medium text-zinc-300">Resposta</label>
                        <textarea
                          value={editResposta}
                          onChange={(e) => setEditResposta(e.target.value)}
                          rows={4}
                          className="w-full rounded-lg border border-zinc-600 bg-zinc-900 px-4 py-2 text-zinc-100"
                        />
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={salvarEdicao}
                          className="rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-500"
                        >
                          Salvar
                        </button>
                        <button
                          onClick={cancelarEdicao}
                          className="rounded-lg bg-zinc-600 px-4 py-2 text-sm font-semibold text-white hover:bg-zinc-500"
                        >
                          Cancelar
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="flex justify-between items-start mb-4">
                        <div className="flex-1">
                          <h3 className="text-lg font-semibold text-zinc-100 mb-2">{faq.question}</h3>
                          <p className="text-sm text-zinc-300">{faq.answer}</p>
                          <div className="mt-2 text-xs text-zinc-400">
                            👁️ {faq.views} visualizações
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={() => iniciarEdicao(faq)}
                            className="rounded px-3 py-1 text-xs font-semibold bg-blue-600 text-white hover:bg-blue-500"
                          >
                            Editar
                          </button>
                          <button
                            onClick={() => deletarFAQ(faq.id)}
                            className="rounded px-3 py-1 text-xs font-semibold bg-red-600 text-white hover:bg-red-500"
                          >
                            Deletar
                          </button>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              ))
            )}
          </div>
        </>
      )}

      {/* Conteúdo da Aba Perguntas Enviadas */}
      {abaAtiva === "perguntas" && (
        <>
          {/* Filtro de Status */}
          <div className="flex gap-2">
            <button
              onClick={() => setFiltroStatus("pendente")}
              className={`rounded-lg px-4 py-2 text-sm font-semibold transition-colors ${
                filtroStatus === "pendente"
                  ? "bg-orange-600 text-white"
                  : "bg-zinc-700 text-zinc-300 hover:bg-zinc-600"
              }`}
            >
              Pendentes ({perguntas.filter(p => p.status === "pendente").length})
            </button>
            <button
              onClick={() => setFiltroStatus("respondida")}
              className={`rounded-lg px-4 py-2 text-sm font-semibold transition-colors ${
                filtroStatus === "respondida"
                  ? "bg-green-600 text-white"
                  : "bg-zinc-700 text-zinc-300 hover:bg-zinc-600"
              }`}
            >
              Respondidas ({perguntas.filter(p => p.status === "respondida").length})
            </button>
            <button
              onClick={() => setFiltroStatus("todas")}
              className={`rounded-lg px-4 py-2 text-sm font-semibold transition-colors ${
                filtroStatus === "todas"
                  ? "bg-blue-600 text-white"
                  : "bg-zinc-700 text-zinc-300 hover:bg-zinc-600"
              }`}
            >
              Todas ({perguntas.length})
            </button>
          </div>

          {/* Lista de Perguntas */}
          <div className="space-y-4">
            {perguntas.length === 0 ? (
              <div className="rounded-xl border border-zinc-700 bg-zinc-800/50 p-6 text-center text-zinc-400">
                Nenhuma pergunta encontrada.
              </div>
            ) : (
              perguntas.map((pergunta) => (
                <div
                  key={pergunta.id}
                  className={`rounded-xl border p-6 ${
                    pergunta.status === "pendente"
                      ? "border-orange-500/50 bg-orange-500/10"
                      : "border-zinc-700 bg-zinc-800/50"
                  }`}
                >
                  <div className="flex justify-between items-start mb-4">
                    <div className="flex-1">
                      <h3 className="text-lg font-semibold text-zinc-100 mb-2">{pergunta.question}</h3>
                      <div className="text-sm text-zinc-400 space-y-1">
                        <div>
                          {pergunta.userName || pergunta.user?.nomeArtistico || pergunta.user?.nomeCompleto || "Usuário anônimo"}
                          {pergunta.userEmail || pergunta.user?.email ? ` (${pergunta.userEmail || pergunta.user?.email})` : ""}
                        </div>
                        <div>{new Date(pergunta.createdAt).toLocaleString("pt-BR")}</div>
                        {pergunta.status === "respondida" && pergunta.answeredAt && (
                          <div className="text-green-400">
                            Respondida em: {new Date(pergunta.answeredAt).toLocaleString("pt-BR")}
                          </div>
                        )}
                        {pergunta.published && pergunta.faq && (
                          <div className="text-blue-400">
                            ✅ Publicada no FAQ: {pergunta.faq.question.substring(0, 50)}...
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <span
                        className={`rounded-full px-3 py-1 text-xs font-semibold ${
                          pergunta.status === "pendente"
                            ? "bg-orange-500/20 text-orange-300"
                            : "bg-green-500/20 text-green-300"
                        }`}
                      >
                        {pergunta.status === "pendente" ? "Pendente" : "Respondida"}
                      </span>
                    </div>
                  </div>

                  {pergunta.answer && (
                    <div className="mt-4 p-4 rounded-lg bg-zinc-900/50 border border-zinc-700">
                      <div className="text-sm font-semibold text-zinc-300 mb-2">Resposta:</div>
                      <div className="text-sm text-zinc-200">{pergunta.answer}</div>
                    </div>
                  )}

                  <div className="mt-4 flex gap-2 flex-wrap">
                    {pergunta.status === "pendente" && (
                      <button
                        onClick={() => iniciarResposta(pergunta)}
                        className="rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-500"
                      >
                        {pergunta.answer ? "Editar Resposta" : "Responder"}
                      </button>
                    )}
                    {pergunta.status === "pendente" && (
                      <button
                        onClick={() => recusarPergunta(pergunta)}
                        className="rounded-lg bg-orange-600 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-500"
                        title="Recusar esta solicitação"
                      >
                        ❌ Recusar
                      </button>
                    )}
                    <button
                      onClick={() => excluirPergunta(pergunta)}
                      className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-500"
                      title="Excluir permanentemente esta pergunta"
                    >
                      🗑️ Excluir
                    </button>
                    {pergunta.status === "respondida" && (
                      <button
                        onClick={() => toggleBanco(pergunta)}
                        className={`rounded-lg px-4 py-2 text-sm font-semibold text-white transition-colors ${
                          pergunta.published && (pergunta.faqId || pergunta.faq?.id)
                            ? "bg-red-600 hover:bg-red-500"
                            : "bg-blue-600 hover:bg-blue-500"
                        }`}
                      >
                        {pergunta.published && (pergunta.faqId || pergunta.faq?.id) ? "➖ Remover do Banco" : "➕ Adicionar ao Banco"}
                      </button>
                    )}
                    {pergunta.userEmail && (
                      <button
                        onClick={() => associarPerguntaAoUsuario(pergunta)}
                        className="rounded-lg bg-yellow-600 px-4 py-2 text-sm font-semibold text-white hover:bg-yellow-500"
                        title="Associar/Reassociar esta pergunta ao usuário correto para que apareça na 'Minha Conta'"
                      >
                        🔗 {pergunta.userId ? "Reassociar ao Usuário" : "Associar ao Usuário"}
                      </button>
                    )}
                    {respondendoPergunta?.id === pergunta.id && (
                      <div className="flex-1 space-y-2">
                        <textarea
                          value={respostaTexto}
                          onChange={(e) => setRespostaTexto(e.target.value)}
                          rows={4}
                          className="w-full rounded-lg border border-zinc-600 bg-zinc-900 px-4 py-2 text-zinc-100"
                          placeholder="Digite a resposta..."
                        />
                        <div className="flex gap-2">
                          <button
                            onClick={salvarResposta}
                            className="rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-500"
                          >
                            Salvar Resposta
                          </button>
                          <button
                            onClick={cancelarResposta}
                            className="rounded-lg bg-zinc-600 px-4 py-2 text-sm font-semibold text-white hover:bg-zinc-500"
                          >
                            Cancelar
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </>
      )}

      {/* Conteúdo da Aba Recusadas */}
      {abaAtiva === "recusadas" && (
        <>
          <div className="rounded-xl border border-zinc-700 bg-zinc-800/50 p-4">
            <p className="text-zinc-400 text-sm">
              Perguntas recusadas (bloqueadas). Você pode reaceitar ou excluir permanentemente.
            </p>
          </div>

          <div className="space-y-4">
            {perguntasRecusadas.length === 0 ? (
              <div className="rounded-xl border border-zinc-700 bg-zinc-800/50 p-6 text-center text-zinc-400">
                Nenhuma pergunta recusada encontrada.
              </div>
            ) : (
              perguntasRecusadas.map((pergunta) => (
                <div
                  key={pergunta.id}
                  className="rounded-xl border border-red-500/50 bg-red-500/10 p-6"
                >
                  <div className="flex justify-between items-start mb-4">
                    <div className="flex-1">
                      <h3 className="text-lg font-semibold text-zinc-100 mb-2">{pergunta.question}</h3>
                      <div className="text-sm text-zinc-400 space-y-1">
                        <div>
                          {pergunta.userName || pergunta.user?.nomeArtistico || pergunta.user?.nomeCompleto || "Usuário anônimo"}
                          {pergunta.userEmail || pergunta.user?.email ? ` (${pergunta.userEmail || pergunta.user?.email})` : ""}
                        </div>
                        <div>{new Date(pergunta.createdAt).toLocaleString("pt-BR")}</div>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <span className="rounded-full px-3 py-1 text-xs font-semibold bg-red-500/20 text-red-300">
                        Recusada
                      </span>
                    </div>
                  </div>

                  <div className="mt-4 flex gap-2">
                    <button
                      onClick={() => reaceitarPergunta(pergunta)}
                      className="rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-500"
                      title="Reaceitar esta pergunta (voltar para pendentes)"
                    >
                      ✅ Reaceitar
                    </button>
                    <button
                      onClick={() => excluirPergunta(pergunta)}
                      className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-500"
                      title="Excluir permanentemente esta pergunta"
                    >
                      🗑️ Excluir
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </>
      )}
    </div>
  );
}
