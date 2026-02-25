"use client";

import React, { useState, useMemo, useEffect, useCallback, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "../context/AuthContext";
import DuvidasBox from "../components/DuvidasBox";
import { useIntelligentRefresh } from "../hooks/useIntelligentRefresh";

type Servico = {
  id: string;
  nome: string;
  preco: number;
  descricao?: string;
};

type Plano = {
  id: string;
  nome: string;
  mensal: number;
  anual: number;
  descricao: string;
  beneficios: { label: string; included: boolean; useTilde?: boolean }[];
};

// ================== DADOS ==================

const SERVICOS_ESTUDIO: Servico[] = [
  { id: "sessao", nome: "Sessão", preco: 40 },
  { id: "captacao", nome: "Captação", preco: 65 },
  { id: "sonoplastia", nome: "Sonoplastia (a partir de)", preco: 350 },
  { id: "mix", nome: "Mixagem", preco: 110 },
  { id: "master", nome: "Masterização", preco: 80 },
  { id: "mix_master", nome: "Mix + Master", preco: 170 },
];

const BEATS_PACOTES: Servico[] = [
  { id: "beat1", nome: "1 Beat", preco: 150 },
  { id: "beat2", nome: "2 Beats", preco: 250 },
  { id: "beat3", nome: "3 Beats", preco: 350 },
  { id: "beat4", nome: "4 Beats", preco: 400 },
  { id: "beat_mix_master", nome: "Beat + Mix + Master", preco: 320 },
  {
    id: "producao_completa",
    nome: "Produção Completa (4h + beat + mix + master)",
    preco: 450,
  },
];

const PLANOS: Plano[] = [
  {
    id: "bronze",
    nome: "Plano Bronze",
    mensal: 249.99,
    anual: 2499.90,
    descricao: "Para quem está começando a gravar com frequência.",
    beneficios: [
      { label: "1 sessão por mês", included: true },
      { label: "2h de captação por mês", included: true },
      { label: "1 Mix por mês", included: true },
      { label: "10% de desconto em serviços avulsos", included: true },
      { label: "Sem Beats personalizados", included: false },
      { label: "Sem acesso a descontos promocionais", included: false },
      { label: "Não tem acompanhamento artístico", included: false },
    ],
  },
  {
    id: "prata",
    nome: "Plano Prata",
    mensal: 449.99,
    anual: 4499.90,
    descricao: "Para artistas que lançam com regularidade e já possuem músicas próprias.",
    beneficios: [
      { label: "1 sessão por mês", included: true },
      { label: "2h de captação por mês", included: true },
      { label: "1 Mix & Master por mês", included: true },
      { label: "1 beat por mês", included: true },
      { label: "Acesso a descontos promocionais do site", included: true },
      { label: "Não tem desconto em Serviços ou Beats", included: false },
      { label: "Não tem acompanhamento artístico", included: false },
    ],
  },
  {
    id: "ouro",
    nome: "Plano Ouro",
    mensal: 799.99,
    anual: 7999.90,
    descricao: "Acompanhamento artístico contínuo com o Tremv e 2 Produções completas por mês.",
    beneficios: [
      { label: "2 sessões por mês", included: true },
      { label: "4h de captação por mês", included: true },
      { label: "2 Mix & Master por mês", included: true },
      { label: "2 Beats por mês", included: true },
      { label: "Desconto de 10% em serviços avulsos", included: true },
      { label: "Desconto de 10% em Beats", included: true },
      { label: "Acesso a descontos promocionais do site", included: true },
      { label: "Acompanhamento artístico", included: true },
    ],
  },
];

const HORARIOS_PADRAO = [
  "10:00","11:00","12:00","13:00","14:00","15:00",
  "16:00","17:00","18:00","19:00","20:00","21:00","22:00",
];

const AGENDAMENTO_DRAFT_KEY = "agendamento_draft";
const AGENDAMENTO_CHECKOUT_KEY = "agendamento_checkout";

// ================== PAGE ==================

function AgendamentoContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user } = useAuth();
  const [quantidadesServicos, setQuantidadesServicos] = useState<Record<string, number>>({});
  const [quantidadesBeats, setQuantidadesBeats] = useState<Record<string, number>>({});
  const [comentarios, setComentarios] = useState("");

  // Data mínima: 1 de janeiro do ano atual
  const DATA_MINIMA = new Date(new Date().getFullYear(), 0, 1); // 1 de janeiro do ano atual

  const [dataBase, setDataBase] = useState(() => {
    const hoje = new Date();
    const primeiroDia = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
    // Se o primeiro dia do mês atual for antes de 1 de janeiro, usar 1 de janeiro
    return primeiroDia < DATA_MINIMA ? DATA_MINIMA : primeiroDia;
  });

  const [dataSelecionada, setDataSelecionada] = useState<string | null>(null);
  const [horaSelecionada, setHoraSelecionada] = useState<string | null>(null);

  const [modoPlano, setModoPlano] = useState<"mensal" | "anual">("mensal");
  const [mostrarPlanos, setMostrarPlanos] = useState(false);
  const [aceiteTermos, setAceiteTermos] = useState(false);
  const [blockedSlots, setBlockedSlots] = useState<Array<{ data: string; hora: string }>>([]);
  const [agendamentos, setAgendamentos] = useState<any[]>([]);
  const [loadingHorarios, setLoadingHorarios] = useState(true);
  const [cupomCode, setCupomCode] = useState("");
  const [cupomAplicado, setCupomAplicado] = useState<{ code: string; discount: number; couponType: string } | null>(null);
  const [validandoCupom, setValidandoCupom] = useState(false);

  // Função helper para verificar se uma data já passou (comparando apenas dia/mês/ano)
  const isDataPassada = (isoDate: string): boolean => {
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0); // Zerar horas para comparar apenas a data
    
    const dataComparar = new Date(isoDate + "T00:00:00");
    dataComparar.setHours(0, 0, 0, 0);
    
    return dataComparar < hoje;
  };

  // Função helper para verificar se um horário já passou (comparando data + hora com agora)
  const isHorarioPassado = (isoDate: string, hora: string): boolean => {
    const agora = new Date();
    
    // Converter hora "HH:MM" para horas e minutos
    const [horas, minutos] = hora.split(":").map(Number);
    
    // Criar data/hora do agendamento
    const dataHoraAgendamento = new Date(isoDate + `T${hora}:00`);
    dataHoraAgendamento.setHours(horas, minutos, 0, 0);
    
    return dataHoraAgendamento < agora;
  };

  // Função para carregar horários bloqueados e agendamentos (usando useCallback para evitar recriações)
  const carregarHorarios = useCallback(async () => {
    try {
      setLoadingHorarios(true);
      
      // Fazer requisições separadas para melhor tratamento de erros
      try {
        const resSlots = await fetch("/api/blocked-slots?" + new Date().getTime());
        const data = await resSlots.json().catch(() => ({ slots: [] }));
        
        // Sempre usar slots do response, mesmo se houver erro
        if (data.slots && Array.isArray(data.slots)) {
          setBlockedSlots(data.slots);
        } else {
          console.warn("Formato inesperado de slots:", data);
          setBlockedSlots([]);
        }
        
        // Log apenas se houver erro, mas não quebrar o fluxo
        if (!resSlots.ok && data.error) {
          console.warn("Aviso ao carregar slots bloqueados:", data.error, data.message);
        }
      } catch (err) {
        console.error("Erro ao buscar slots bloqueados:", err);
        setBlockedSlots([]);
      }

      try {
        const resAgendamentos = await fetch("/api/agendamentos/disponibilidade?" + new Date().getTime());
        if (resAgendamentos.ok) {
          const data = await resAgendamentos.json();
          if (data.agendamentos && Array.isArray(data.agendamentos)) {
            setAgendamentos(data.agendamentos);
          } else {
            console.warn("Formato inesperado de agendamentos:", data);
            setAgendamentos([]);
          }
        } else {
          const errorData = await resAgendamentos.json().catch(() => ({}));
          console.error("Erro ao carregar agendamentos:", resAgendamentos.status, errorData);
          setAgendamentos([]); // Continuar com array vazio em caso de erro
        }
      } catch (err) {
        console.error("Erro ao buscar agendamentos:", err);
        setAgendamentos([]);
      }
    } catch (err) {
      console.error("Erro geral ao carregar horários:", err);
    } finally {
      setLoadingHorarios(false);
    }
  }, []); // Sem dependências - função pura que só usa setters

  // Carregar horários quando mudar o mês
  useEffect(() => {
    carregarHorarios();
  }, [dataBase, carregarHorarios]); // Recarregar quando mudar o mês

  // Restaurar rascunho ao voltar da página de pagamentos (link Voltar ou botão Voltar do navegador)
  useEffect(() => {
    if (typeof window === "undefined") return;
    const restore = searchParams.get("restore") === "1";
    const ref = document.referrer || "";
    const fromPagamentos = ref.includes("pagamentos");
    // Só limpar quando vier explicitamente de outra página do site que NÃO seja pagamentos
    const veioDeOutraPaginaDoSite = ref.length > 0 && (ref.includes(window.location.host) || ref.includes("localhost"));
    const deveLimparRascunho = veioDeOutraPaginaDoSite && !ref.includes("pagamentos");

    const raw = sessionStorage.getItem(AGENDAMENTO_DRAFT_KEY);
    const draft = raw ? (() => { try { return JSON.parse(raw); } catch { return null; } })() : null;

    // Restaurar: (1) link com restore=1, (2) veio de pagamentos, (3) tem draft e referrer vazio (botão Voltar do navegador)
    const deveRestaurar = draft && (restore || fromPagamentos || (ref.length === 0 && raw));

    if (deveRestaurar) {
      if (draft.quantidadesServicos) setQuantidadesServicos(draft.quantidadesServicos);
      if (draft.quantidadesBeats) setQuantidadesBeats(draft.quantidadesBeats);
      if (draft.comentarios != null) setComentarios(draft.comentarios);
      if (draft.dataSelecionada != null) setDataSelecionada(draft.dataSelecionada);
      if (draft.horaSelecionada != null) setHoraSelecionada(draft.horaSelecionada);
      if (draft.dataBase) setDataBase(new Date(draft.dataBase));
      if (draft.aceiteTermos != null) setAceiteTermos(draft.aceiteTermos);
      if (draft.cupomCode != null) setCupomCode(draft.cupomCode);
      if (draft.cupomAplicado != null) setCupomAplicado(draft.cupomAplicado);
      if (restore) {
        window.history.replaceState({}, "", "/agendamento");
      }
    } else if (deveLimparRascunho) {
      sessionStorage.removeItem(AGENDAMENTO_DRAFT_KEY);
    }
  }, [searchParams]);

  // Usar hook de atualização inteligente (atualiza a cada 5 min, mas garante atualização no início de cada hora)
  useIntelligentRefresh(carregarHorarios, [dataBase]);

  // Calcular horários ocupados por dia
  const horariosOcupadosPorDia: Record<string, Set<string>> = useMemo(() => {
    const ocupados: Record<string, Set<string>> = {};

    // Horários bloqueados pelo admin (prioridade - estes são sempre ocupados)
    blockedSlots.forEach((slot) => {
      if (!ocupados[slot.data]) ocupados[slot.data] = new Set();
      
      // Garantir formato consistente HH:00
      let horaFormatada = slot.hora || "";
      
      if (!horaFormatada || !horaFormatada.includes(":")) {
        // Se não tiver ":", assumir que é só a hora
        const horaNum = parseInt(horaFormatada || "0", 10);
        horaFormatada = `${String(horaNum).padStart(2, "0")}:00`;
      } else {
        // Se tiver ":", normalizar para HH:00
        const partes = horaFormatada.split(":");
        if (partes.length >= 2) {
          const horas = parseInt(partes[0] || "0", 10);
          horaFormatada = `${String(horas).padStart(2, "0")}:00`;
        }
      }
      
      ocupados[slot.data].add(horaFormatada);
    });

    // Agendamentos aceitos/confirmados
    agendamentos.forEach((a) => {
      // Converter data para string no formato YYYY-MM-DD
      let dataStr: string;
      if (typeof a.data === "string") {
        // Se já for string, usar diretamente (assumindo formato ISO ou YYYY-MM-DD)
        const dateObj = new Date(a.data);
        dataStr = `${dateObj.getFullYear()}-${String(dateObj.getMonth() + 1).padStart(2, "0")}-${String(dateObj.getDate()).padStart(2, "0")}`;
      } else {
        // Se for Date object
        const data = new Date(a.data);
        dataStr = `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, "0")}-${String(data.getDate()).padStart(2, "0")}`;
      }
      
      if (!ocupados[dataStr]) ocupados[dataStr] = new Set();
      
      // Processar horário e duração
      const dataObj = typeof a.data === "string" ? new Date(a.data) : new Date(a.data);
      const horaInicio = dataObj.getHours();
      const minutoInicio = dataObj.getMinutes();
      const duracaoMinutos = a.duracaoMinutos || 60; // Default 1 hora
      
      // Calcular todos os horários ocupados baseado na duração
      // Se começa às 10:00 e dura 2 horas, ocupa 10:00 e 11:00
      const horasOcupadas = Math.ceil(duracaoMinutos / 60);
      for (let i = 0; i < horasOcupadas; i++) {
        const horaOcupada = horaInicio + i;
        // Formato HH:00 para corresponder aos HORARIOS_PADRAO
        const horaFormatada = `${String(horaOcupada).padStart(2, "0")}:00`;
        ocupados[dataStr].add(horaFormatada);
      }
    });

    return ocupados;
  }, [agendamentos, blockedSlots]);

  const ultimoDiaDoMes = new Date(
    dataBase.getFullYear(),
    dataBase.getMonth() + 1,
    0
  ).getDate();

  const primeiroDiaSemana = new Date(
    dataBase.getFullYear(),
    dataBase.getMonth(),
    1
  ).getDay();

  const dias: (number | null)[] = [];
  for (let i = 0; i < primeiroDiaSemana; i++) dias.push(null);
  
  // Adicionar apenas dias a partir de 1 de janeiro
  for (let d = 1; d <= ultimoDiaDoMes; d++) {
    const dataDia = new Date(dataBase.getFullYear(), dataBase.getMonth(), d);
    // Só adicionar se a data for >= 1 de janeiro
    if (dataDia >= DATA_MINIMA) {
      dias.push(d);
    } else {
      dias.push(null); // Preencher com null para manter o layout
    }
  }

  const handleQuantServico = (
    id: string,
    delta: number,
    tipo: "estudio" | "beat"
  ) => {
    if (tipo === "estudio") {
      setQuantidadesServicos(prev => ({
        ...prev,
        [id]: Math.max(0, (prev[id] || 0) + delta),
      }));
    } else {
      setQuantidadesBeats(prev => ({
        ...prev,
        [id]: Math.max(0, (prev[id] || 0) + delta),
      }));
    }
  };

  const totalServicos = SERVICOS_ESTUDIO.reduce(
    (acc, s) => acc + (quantidadesServicos[s.id] || 0) * s.preco,
    0
  );

  const totalBeats = BEATS_PACOTES.reduce(
    (acc, s) => acc + (quantidadesBeats[s.id] || 0) * s.preco,
    0
  );

  const totalGeral = totalServicos + totalBeats;

  // Calcular desconto do cupom e total com desconto
  const descontoCupom = useMemo(() => {
    if (!cupomAplicado) return 0;
    return cupomAplicado.discount || 0;
  }, [cupomAplicado]);

  const totalComDesconto = useMemo(() => {
    return Math.max(0, totalGeral - descontoCupom);
  }, [totalGeral, descontoCupom]);

  const dataFormatada = useMemo(() => {
    if (!dataSelecionada) return null;
    const [ano, mes, dia] = dataSelecionada.split("-");
    return new Date(+ano, +mes - 1, +dia).toLocaleDateString("pt-BR");
  }, [dataSelecionada]);

  const handleConfirmar = async () => {
    // 🔒 Verificar se usuário está logado (exceto admin que pode testar)
    if (!user) {
      alert("Você precisa estar logado para fazer um agendamento.");
      router.push("/login?redirect=/agendamento");
      return;
    }
    
    // Verificar se há algum serviço ou pacote selecionado
    if (totalGeral <= 0) {
      alert("Nenhum serviço selecionado");
      return;
    }
    
    // Verificar se a data foi selecionada
    if (!dataSelecionada) {
      alert("O dia não foi selecionado");
      return;
    }
    
    // Verificar se a hora foi selecionada
    if (!horaSelecionada) {
      alert("A hora não foi selecionada");
      return;
    }
    
    // Verificar se os termos foram aceitos
    if (!aceiteTermos) {
      alert("É preciso marcar a declaração dos Termos de Contrato antes de confirmar o pagamento.");
      return;
    }
    
    // Preparar dados do agendamento
    const servicos = SERVICOS_ESTUDIO
      .filter(s => quantidadesServicos[s.id] > 0)
      .map(s => ({
        id: s.id,
        nome: s.nome,
        quantidade: quantidadesServicos[s.id],
        preco: s.preco,
      }));

    const beats = BEATS_PACOTES
      .filter(b => quantidadesBeats[b.id] > 0)
      .map(b => ({
        id: b.id,
        nome: b.nome,
        quantidade: quantidadesBeats[b.id],
        preco: b.preco,
      }));

    // Calcular duração total (mínimo 1 hora, baseado nos serviços)
    // Se tiver captação, usar 1h por captação, senão usar 1h padrão
    let duracaoMinutos = 60;
    if (servicos.length > 0) {
      const captacaoQtd = quantidadesServicos["captacao"] || 0;
      const sessaoQtd = quantidadesServicos["sessao"] || 0;
      if (captacaoQtd > 0 || sessaoQtd > 0) {
        duracaoMinutos = Math.max(60, (captacaoQtd + sessaoQtd) * 60);
      } else {
        duracaoMinutos = 60; // Para outros serviços, usar 1h padrão
      }
    }

    // Se cupom de serviço foi aplicado e o total com desconto é 0, criar agendamento diretamente sem pagamento
    if (cupomAplicado && totalComDesconto === 0) {
      console.log("[Agendamento] Tentando criar agendamento com cupom de serviço:", {
        cupomCode: cupomAplicado.code,
        totalComDesconto,
        servicos,
        beats,
        data: dataSelecionada,
        hora: horaSelecionada,
      });
      try {
        const res = await fetch("/api/agendamentos/com-cupom", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            data: dataSelecionada,
            hora: horaSelecionada,
            duracaoMinutos,
            tipo: "sessao",
            servicos,
            beats,
            observacoes: comentarios,
            cupomCode: cupomAplicado.code,
          }),
        });

        const data = await res.json();
        if (res.ok && data.success) {
          alert("Agendamento criado com sucesso! Aguarde a confirmação por email.");
          // Limpar formulário
          setQuantidadesServicos({});
          setQuantidadesBeats({});
          setComentarios("");
          setDataSelecionada(null);
          setHoraSelecionada(null);
          setCupomAplicado(null);
          setCupomCode("");
          setAceiteTermos(false);
          // Recarregar página para atualizar horários
          window.location.reload();
          return;
        } else {
          const errorMessage = data.error || "Erro ao criar agendamento com cupom";
          console.error("[Agendamento] Erro ao criar com cupom:", errorMessage, data);
          alert(errorMessage);
          return;
        }
      } catch (err: any) {
        console.error("[Agendamento] Erro ao criar agendamento com cupom:", err);
        alert(`Erro ao criar agendamento: ${err.message || "Tente novamente."}`);
        return;
      }
    }

    // Se não for cupom de serviço ou se ainda há valor a pagar, seguir fluxo normal de pagamento
    const agendamentoData = {
      data: dataSelecionada,
      hora: horaSelecionada,
      duracaoMinutos,
      tipo: "sessao",
      servicos,
      beats,
      total: totalComDesconto, // Usar total com desconto se cupom foi aplicado
      observacoes: comentarios,
      cupomCode: cupomAplicado?.code || undefined, // Incluir código do cupom se aplicado
    };

    // Salvar rascunho para restaurar se o usuário voltar da página de pagamento
    try {
      sessionStorage.setItem(AGENDAMENTO_DRAFT_KEY, JSON.stringify({
        quantidadesServicos,
        quantidadesBeats,
        comentarios,
        dataSelecionada,
        horaSelecionada,
        dataBase: dataBase.toISOString(),
        aceiteTermos,
        cupomCode,
        cupomAplicado,
      }));
    } catch (e) {
      console.warn("[Agendamento] Não foi possível salvar rascunho:", e);
    }

    // Salvar payload completo em sessionStorage para a página de pagamento (evita URL truncada)
    try {
      sessionStorage.setItem(AGENDAMENTO_CHECKOUT_KEY, JSON.stringify(agendamentoData));
    } catch (e) {
      console.warn("[Agendamento] Não foi possível salvar payload para pagamento:", e);
    }

    // Redirecionar para página de pagamentos (dados completos vêm do sessionStorage)
    router.push("/pagamentos?tipo=agendamento");
  };

  const handleMesAnterior = () => {
    setDataBase(prev => {
      const novoMes = new Date(prev.getFullYear(), prev.getMonth() - 1, 1);
      // Não permitir ir antes de 1 de janeiro
      return novoMes < DATA_MINIMA ? DATA_MINIMA : novoMes;
    });
  };

  // Verificar se pode ir para o mês anterior
  const podeIrMesAnterior = () => {
    const mesAnterior = new Date(dataBase.getFullYear(), dataBase.getMonth() - 1, 1);
    return mesAnterior >= DATA_MINIMA;
  };

  const handleProximoMes = () => {
    setDataBase(prev =>
      new Date(prev.getFullYear(), prev.getMonth() + 1, 1)
    );
  };

  return (
    <main className="relative mx-auto max-w-6xl px-4 sm:px-6 py-6 sm:py-10 text-zinc-100 overflow-x-hidden">
      {/* Imagem de fundo da página de agendamento */}
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
      {/* Área de entrada: mesmo espaço para a imagem de fundo aparecer como “título” de entrada (sem texto) */}
      <section className="mt-12 mb-8 sm:mb-12 w-full min-h-[60vh] sm:min-h-[70vh]" aria-hidden />

      {/* =========================================================
          SERVIÇOS DE ESTÚDIO
      ========================================================== */}
      <section className="mb-16 flex justify-center px-4 mt-32 sm:mt-40 md:mt-48">
        <div className="relative w-full max-w-5xl border border-red-500" style={{ borderWidth: "1px" }}>
          <div
            className="relative space-y-3 p-6 md:p-8"
            style={{
              background: "linear-gradient(to right, rgba(0,0,0,0) 0%, rgba(0,0,0,0.75) 8%, rgba(0,0,0,0.85) 20%, rgba(0,0,0,0.85) 80%, rgba(0,0,0,0.75) 92%, rgba(0,0,0,0) 100%)",
              backdropFilter: "blur(16px)",
              WebkitBackdropFilter: "blur(16px)",
            }}
          >
            <h2 className="text-center text-3xl font-semibold text-red-400" style={{ textShadow: "0 2px 4px rgba(0, 0, 0, 0.5)" }}>
              Serviços de Estúdio e Avulsos
            </h2>

            <p className="mt-5 mb-10 text-center text-sm leading-relaxed text-white md:text-base" style={{ textShadow: "0 2px 8px rgba(0, 0, 0, 0.8)" }}>
            Selecione os serviços que você deseja para essa sessão. Você pode
            combinar captação, mix, master, sonoplastia e outras opções para
            montar um fluxo de trabalho completo ou apenas o que precisa no
            momento.
          </p>

             {/* GRID FIXO — ORDEM CONTROLADA (preços vêm de SERVICOS_ESTUDIO) */}
            <div className="grid gap-4 md:grid-cols-2">
              {(["sessao", "captacao", "mix", "master", "mix_master", "sonoplastia"] as const).map((id) => {
                const s = SERVICOS_ESTUDIO.find((x) => x.id === id);
                if (!s) return null;
                const isPorHora = id === "sessao" || id === "captacao";
                const nome = id === "sonoplastia" ? "Sonoplastia" : s.nome;
                const subtitulo = id === "sonoplastia" ? "(a partir de)" : undefined;
                return (
                  <ServicoItem
                    key={s.id}
                    id={s.id}
                    nome={nome}
                    preco={s.preco}
                    subtitulo={subtitulo}
                    porHora={isPorHora}
                    quantidade={quantidadesServicos[s.id] || 0}
                    onChange={(d) => handleQuantServico(s.id, d, "estudio")}
                  />
                );
              })}
            </div>
          </div>
          
          {/* LINHA INFERIOR COM FADE */}
          <div 
            className="h-[1px]"
            style={{
              background: "linear-gradient(to right, transparent 0%, rgba(239, 68, 68, 0.3) 15%, rgba(239, 68, 68, 0.6) 50%, rgba(239, 68, 68, 0.3) 85%, transparent 100%)",
              boxShadow: "0 1px 10px rgba(239, 68, 68, 0.4)"
            }}
          />
        </div>
      </section>

      {/* =========================================================
          BEATS E PACOTES
      ========================================================== */}
      <section className="mb-16 flex justify-center px-4 mt-16">
        <div className="relative w-full max-w-5xl border border-red-500" style={{ borderWidth: "1px" }}>
          <div
            className="relative space-y-3 p-6 md:p-8"
            style={{
              background: "linear-gradient(to right, rgba(0,0,0,0) 0%, rgba(0,0,0,0.75) 8%, rgba(0,0,0,0.85) 20%, rgba(0,0,0,0.85) 80%, rgba(0,0,0,0.75) 92%, rgba(0,0,0,0) 100%)",
              backdropFilter: "blur(16px)",
              WebkitBackdropFilter: "blur(16px)",
            }}
          >
            <h2 className="text-center text-3xl font-semibold text-red-400" style={{ textShadow: "0 2px 4px rgba(0, 0, 0, 0.5)" }}>
              Beats e Pacotes Especiais
            </h2>

            <p className="mb-5 text-center text-sm leading-relaxed text-white md:text-base" style={{ textShadow: "0 2px 8px rgba(0, 0, 0, 0.8)" }}>
              Se você já tem uma ideia de sonoridade ou quer um beat exclusivo,
              pode selecionar aqui os pacotes de beats e produções completas.
            </p>

          <div className="grid gap-4 md:grid-cols-2">
          {BEATS_PACOTES.map((s) => {
            const qtd = quantidadesBeats[s.id] || 0;

              return (
                <div
                  key={s.id}
                  className="flex items-center justify-between rounded-xl border border-red-700/40 bg-zinc-900 p-4 text-sm"
                >
                  <div className="flex flex-wrap items-baseline gap-2">
                    <p className="font-semibold text-zinc-100">
                      {s.nome}
                    </p>
                    <span className="text-xs text-red-300">
                      R$ {s.preco.toFixed(2).replace(".", ",")}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        handleQuantServico(s.id, -1, "beat")
                      }
                      className="flex h-7 w-7 items-center justify-center rounded-full border border-zinc-600 text-xs hover:border-red-500"
                    >
                      -
                    </button>

                    <span className="w-6 text-center text-sm">
                      {qtd}
                    </span>

                    <button
                      type="button"
                      onClick={() =>
                        handleQuantServico(s.id, 1, "beat")
                      }
                      className="flex h-7 w-7 items-center justify-center rounded-full border border-red-600 text-xs hover:bg-red-600 hover:text-white"
                    >
                      +
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
          </div>
          
          {/* LINHA INFERIOR COM FADE */}
          <div 
            className="h-[1px]"
            style={{
              background: "linear-gradient(to right, transparent 0%, rgba(239, 68, 68, 0.3) 15%, rgba(239, 68, 68, 0.6) 50%, rgba(239, 68, 68, 0.3) 85%, transparent 100%)",
              boxShadow: "0 1px 10px rgba(239, 68, 68, 0.4)"
            }}
          />
        </div>
      </section>

      {/* =========================================================
          COMENTÁRIOS ADICIONAIS
      ========================================================== */}
      <section className="mb-16 flex justify-center px-4 mt-16">
        <div className="relative w-full max-w-5xl border border-red-500" style={{ borderWidth: "1px" }}>
          <div
            className="relative space-y-3 p-6 md:p-8"
            style={{
              background: "linear-gradient(to right, rgba(0,0,0,0) 0%, rgba(0,0,0,0.75) 8%, rgba(0,0,0,0.85) 20%, rgba(0,0,0,0.85) 80%, rgba(0,0,0,0.75) 92%, rgba(0,0,0,0) 100%)",
              backdropFilter: "blur(16px)",
              WebkitBackdropFilter: "blur(16px)",
            }}
          >
            <h2 className="text-center text-lg font-semibold text-red-400" style={{ textShadow: "0 2px 4px rgba(0, 0, 0, 0.5)" }}>
              Comentários adicionais sobre o seu projeto
            </h2>

            <p className="text-center text-sm text-white md:text-base" style={{ textShadow: "0 2px 8px rgba(0, 0, 0, 0.8)" }}>
              Use este espaço para descrever o que você quer fazer: estilo,
              referências, clima da música e objetivos da sessão.
            </p>

            <textarea
              value={comentarios}
              onChange={(e) => setComentarios(e.target.value)}
              rows={4}
              className="w-full rounded-xl border border-zinc-700 bg-zinc-900 p-3 text-sm text-zinc-100 outline-none focus:border-red-500"
              placeholder="Descreva o projeto, referências, mood, tipo de beat..."
            />
          </div>
        </div>
      </section>

      {/* =========================================================
          AGENDAMENTO VIRTUAL (CALENDÁRIO + HORÁRIOS)
      ========================================================== */}
      <section className="mb-16 flex justify-center px-4 mt-16">
        <div className="relative w-full max-w-5xl border border-red-500" style={{ borderWidth: "1px" }}>
          <div
            className="relative space-y-6 p-6 md:p-8"
            style={{
              background: "linear-gradient(to right, rgba(0,0,0,0) 0%, rgba(0,0,0,0.75) 8%, rgba(0,0,0,0.85) 20%, rgba(0,0,0,0.85) 80%, rgba(0,0,0,0.75) 92%, rgba(0,0,0,0) 100%)",
              backdropFilter: "blur(16px)",
              WebkitBackdropFilter: "blur(16px)",
            }}
          >
            <h2 className="text-center text-3xl font-semibold text-red-400" style={{ textShadow: "0 2px 4px rgba(0, 0, 0, 0.5)" }}>
              Agendamento virtual
            </h2>

            <p className="text-center text-sm leading-relaxed text-white md:text-base" style={{ textShadow: "0 2px 8px rgba(0, 0, 0, 0.8)" }}>
              Escolha o dia e o horário da sua sessão.  
              <br />
              <span className="text-green-400 font-semibold">Verde</span>: todos os horários livres ·{" "}
              <span className="text-yellow-400 font-semibold">Amarelo</span>: alguns horários ocupados ·{" "}
              <span className="text-red-400 font-semibold">Vermelho</span>: agenda cheia
            </p>

            <div className="grid gap-6 md:grid-cols-[1.2fr,1fr]">
            {/* ===================== CALENDÁRIO ===================== */}
            <div>
              <div className="mb-3 flex items-center justify-between text-base font-semibold text-zinc-200">
                <button
                  type="button"
                  onClick={handleMesAnterior}
                  disabled={!podeIrMesAnterior()}
                  className={`rounded-full border border-zinc-700 px-3 py-1 transition ${
                    podeIrMesAnterior()
                      ? "hover:border-red-500 cursor-pointer"
                      : "opacity-50 cursor-not-allowed"
                  }`}
                >
                  ◀
                </button>

                <span>
                  {dataBase.toLocaleDateString("pt-BR", {
                    month: "long",
                    year: "numeric",
                  })}
                </span>

                <button
                  type="button"
                  onClick={handleProximoMes}
                  className="rounded-full border border-zinc-700 px-3 py-1 hover:border-red-500"
                >
                  ▶
                </button>
              </div>

              <div className="grid grid-cols-7 gap-1 text-[10px] text-zinc-400">
                {["D", "S", "T", "Q", "Q", "S", "S"].map((d, i) => (
                  <div key={i} className="py-1 text-center">
                    {d}
                  </div>
                ))}

                {dias.map((dia, idx) => {
                  if (!dia) return <div key={idx} />;

                  const isoDate = `${dataBase.getFullYear()}-${String(
                    dataBase.getMonth() + 1
                  ).padStart(2, "0")}-${String(dia).padStart(2, "0")}`;
                  
                  // Verificar se a data é válida (>= 1 de janeiro)
                  const dataDia = new Date(dataBase.getFullYear(), dataBase.getMonth(), dia);
                  if (dataDia < DATA_MINIMA) {
                    return <div key={idx} />;
                  }

                  const ocupados =
                    horariosOcupadosPorDia[isoDate] || new Set<string>();

                  // Contar quantos horários padrão estão ocupados
                  const horariosOcupadosCount = HORARIOS_PADRAO.filter((h) =>
                    ocupados.has(h)
                  ).length;

                  const totalHorarios = HORARIOS_PADRAO.length;
                  
                  // Verificar se a data já passou
                  const diaPassado = isDataPassada(isoDate);
                  
                  // Debug: apenas para o dia específico mencionado pelo usuário
                  if (isoDate === "2026-01-01" || isoDate === "2026-01-02") {
                    console.log(`[DEBUG] ${isoDate}:`, {
                      ocupados: Array.from(ocupados),
                      horariosOcupadosCount,
                      totalHorarios,
                      diaPassado,
                      blockedSlots: blockedSlots.filter(s => s.data === isoDate),
                      agendamentos: agendamentos.filter(a => {
                        const aDate = new Date(a.data);
                        const aStr = `${aDate.getFullYear()}-${String(aDate.getMonth() + 1).padStart(2, "0")}-${String(aDate.getDate()).padStart(2, "0")}`;
                        return aStr === isoDate;
                      }),
                    });
                  }
                  
                  let corDia = "border-green-600 bg-green-600/20 text-green-300";

                  // VERMELHO: Se o dia já passou, sempre vermelho
                  if (diaPassado) {
                    corDia = "border-red-600 bg-red-600/30 text-red-300 opacity-60";
                  }
                  // Vermelho: todos os horários ocupados/bloqueados
                  else if (horariosOcupadosCount >= totalHorarios) {
                    corDia = "border-red-600 bg-red-600/30 text-red-300";
                  }
                  // Amarelo: alguns horários ocupados (mas não todos)
                  else if (horariosOcupadosCount > 0) {
                    corDia = "border-yellow-500 bg-yellow-500/20 text-yellow-300";
                  }
                  // Verde: todos os horários livres (já está definido acima)

                  const selecionado = dataSelecionada === isoDate;

                  return (
                    <button
                      key={isoDate}
                      type="button"
                      onClick={() => {
                        // Não permitir selecionar dias passados
                        if (diaPassado) return;
                        
                        if (selecionado) {
                          setDataSelecionada(null);
                          setHoraSelecionada(null);
                        } else {
                          setDataSelecionada(isoDate);
                          setHoraSelecionada(null);
                        }
                      }}
                      disabled={diaPassado}
                      className={[
                        "rounded-md border px-1 py-1 text-center text-xs transition",
                        diaPassado
                          ? "cursor-not-allowed opacity-60"
                          : selecionado
                          ? "border-white bg-white/10 text-white"
                          : corDia,
                      ].join(" ")}
                    >
                      {dia}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* ===================== HORÁRIOS ===================== */}
            <div className="space-y-3 text-xs">
              <p className="font-semibold text-zinc-200">
                Horários do dia{" "}
                {dataSelecionada
                  ? new Date(
                      `${dataSelecionada}T12:00:00`
                    ).toLocaleDateString("pt-BR")
                  : "(selecione um dia)"}
              </p>

              <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                {HORARIOS_PADRAO.map((h) => {
                  const ocupados =
                    horariosOcupadosPorDia[dataSelecionada || ""] ||
                    new Set<string>();

                  const estaOcupado = ocupados.has(h);
                  const selecionado = horaSelecionada === h;
                  
                  // Verificar se o horário já passou (se a data selecionada já passou ou se é hoje e o horário já passou)
                  const horarioPassado = dataSelecionada 
                    ? (isDataPassada(dataSelecionada) || isHorarioPassado(dataSelecionada, h))
                    : false;

                  return (
                    <button
                      key={h}
                      type="button"
                      onClick={() => {
                        // Não permitir selecionar horários ocupados ou passados
                        if (estaOcupado || horarioPassado) return;
                        
                        if (selecionado) {
                          setHoraSelecionada(null);
                        } else {
                          setHoraSelecionada(h);
                        }
                      }}
                      disabled={estaOcupado || horarioPassado}
                      className={[
                        "rounded-lg border px-3 py-2 font-medium transition",
                        estaOcupado || horarioPassado
                          ? "cursor-not-allowed border-red-700 bg-red-900/60 text-red-200 opacity-60"
                          : selecionado
                          ? "border-white bg-white/10 text-white"
                          : "border-green-700 bg-green-900/20 hover:border-green-500",
                      ].join(" ")}
                    >
                      {h}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
          </div>
          
          {/* LINHA INFERIOR COM FADE */}
          <div 
            className="h-[1px]"
            style={{
              background: "linear-gradient(to right, transparent 0%, rgba(239, 68, 68, 0.3) 15%, rgba(239, 68, 68, 0.6) 50%, rgba(239, 68, 68, 0.3) 85%, transparent 100%)",
              boxShadow: "0 1px 10px rgba(239, 68, 68, 0.4)"
            }}
          />
        </div>
      </section>

      {/* =========================================================
          TRABALHOS EXTERNOS
      ========================================================== */}
      <section className="mb-16 flex justify-center px-4 mt-16">
        <div className="relative w-full max-w-5xl border border-yellow-500" style={{ borderWidth: "1px" }}>
          <div
            className="relative p-6 md:p-8"
            style={{
              background: "linear-gradient(to right, rgba(0,0,0,0) 0%, rgba(0,0,0,0.75) 8%, rgba(0,0,0,0.85) 20%, rgba(0,0,0,0.85) 80%, rgba(0,0,0,0.75) 92%, rgba(0,0,0,0) 100%)",
              backdropFilter: "blur(16px)",
              WebkitBackdropFilter: "blur(16px)",
            }}
          >
            <p className="text-xs md:text-sm text-white leading-relaxed text-justify md:text-center px-2 md:px-0" style={{ textShadow: "0 2px 8px rgba(0, 0, 0, 0.8)" }}>
              Qualquer trabalho à parte, como <strong className="text-yellow-300">técnico de som</strong>,{" "}
              <strong className="text-yellow-300">técnico de mixagem</strong>,{" "}
              <strong className="text-yellow-300">mestre de cerimônia</strong> e outras funções relacionadas
              podem ser solicitados diretamente com o estúdio. Para combinar esse
              tipo de serviço, envie uma mensagem pela página de{" "}
              <a
                href="/contato"
                className="font-semibold text-yellow-400 underline underline-offset-4 hover:text-yellow-300"
              >
                contato
              </a>
              .
            </p>
          </div>
        </div>
      </section>

      {/* =========================================================
          PLANOS (COLAPSÁVEL)
      ========================================================== */}
      <section className="mb-16 flex justify-center px-4 mt-16">
        <div className="relative w-full max-w-5xl border border-red-500" style={{ borderWidth: "1px" }}>
          <div
            className="relative space-y-4 p-6 md:p-8 text-sm"
            style={{
              background: "linear-gradient(to right, rgba(0,0,0,0) 0%, rgba(0,0,0,0.75) 8%, rgba(0,0,0,0.85) 20%, rgba(0,0,0,0.85) 80%, rgba(0,0,0,0.75) 92%, rgba(0,0,0,0) 100%)",
              backdropFilter: "blur(16px)",
              WebkitBackdropFilter: "blur(16px)",
            }}
          >
            <h2 className="text-center text-lg font-semibold text-red-400" style={{ textShadow: "0 2px 4px rgba(0, 0, 0, 0.5)" }}>
              Quer aprofundar e produzir com frequência?
            </h2>

            <p className="text-xs md:text-sm text-white text-justify md:text-center px-2 md:px-0" style={{ textShadow: "0 2px 8px rgba(0, 0, 0, 0.8)" }}>
              Se você já sabe que quer manter uma rotina de lançamentos, os planos da THouse Rec garantem mais horas de estúdio, melhor custo-benefício e prioridade na agenda. Produzir com consistência muda completamente o ritmo da sua carreira.
            </p>

          <div className="flex justify-center">
            <button
              type="button"
              onClick={() => setMostrarPlanos((v) => !v)}
              className="inline-flex items-center gap-2 rounded-full border border-red-600 bg-red-600/10 px-4 py-2 text-xs font-semibold text-red-300 hover:bg-red-600/20"
            >
              {mostrarPlanos ? "Fechar planos" : "Ver planos disponíveis"}
            </button>
          </div>

          {mostrarPlanos && (
            <>
              {/* Toggle Mensal / Anual */}
              <div className="flex justify-center items-center px-4 w-full mb-3">
                <div className="inline-flex rounded-full border border-red-700/60 bg-zinc-900 p-1">
                  <button
                    type="button"
                    onClick={() => setModoPlano("mensal")}
                    className={`px-5 py-2 rounded-full text-sm font-semibold transition-all ${
                      modoPlano === "mensal"
                        ? "bg-red-600 text-white shadow-[0_0_15px_rgba(239,68,68,0.5)]"
                        : "text-zinc-300 hover:text-red-300 hover:bg-black/40"
                    }`}
                  >
                    Mensal
                  </button>
                  <button
                    type="button"
                    onClick={() => setModoPlano("anual")}
                    className={`px-5 py-2 rounded-full text-sm font-semibold transition-all ${
                      modoPlano === "anual"
                        ? "bg-red-600 text-white shadow-[0_0_15px_rgba(239,68,68,0.5)]"
                        : "text-zinc-300 hover:text-red-300 hover:bg-black/40"
                    }`}
                  >
                    Anual
                  </button>
                </div>
              </div>

              {/* GRID DOS PLANOS */}
              <div className="grid grid-cols-1 gap-6 md:grid-cols-3 md:items-stretch">
                {PLANOS.map((plano) => {
                  const valorBase =
                    modoPlano === "mensal" ? plano.mensal : plano.anual;

                  const precoFormatado =
                    modoPlano === "mensal"
                      ? `R$ ${valorBase.toFixed(2).replace(".", ",")} / mês`
                      : `R$ ${valorBase.toFixed(2).replace(".", ",")} / ano`;

                  const borderColor = plano.id === "bronze" 
                    ? "border-amber-600/80" 
                    : plano.id === "prata" 
                    ? "border-gray-400/80" 
                    : "border-yellow-400/80";
                  const hoverBorderColor = plano.id === "bronze"
                    ? "hover:border-amber-500"
                    : plano.id === "prata"
                    ? "hover:border-gray-300"
                    : "hover:border-yellow-300";

                  return (
                    <div
                      key={plano.id}
                      className={`flex h-full flex-col rounded-2xl border ${borderColor} bg-black/50 backdrop-blur-sm p-6 transition-all ${hoverBorderColor} hover:bg-black/70`}
                      style={{ 
                        textShadow: "0 2px 4px rgba(0, 0, 0, 0.5)", 
                        borderWidth: "1px",
                        boxShadow: plano.id === "bronze" 
                          ? "0 0 20px rgba(217, 119, 6, 0.4), 0 0 10px rgba(217, 119, 6, 0.2)"
                          : plano.id === "prata"
                          ? "0 0 20px rgba(156, 163, 175, 0.4), 0 0 10px rgba(156, 163, 175, 0.2)"
                          : "0 0 20px rgba(234, 179, 8, 0.4), 0 0 10px rgba(234, 179, 8, 0.2)"
                      }}
                    >
                      <div className="flex flex-col h-full">
                        <div className="flex-1 flex flex-col">
                          <div className="space-y-6">
                            <h3 className="text-center text-lg font-semibold">
                              {plano.id === "bronze" ? (
                                <span className="text-amber-600">Plano Bronze</span>
                              ) : plano.id === "prata" ? (
                                <span className="text-gray-400">Plano Prata</span>
                              ) : plano.id === "ouro" ? (
                                <span className="text-yellow-400">Plano Ouro</span>
                              ) : (
                                <span className="text-red-300">{plano.nome}</span>
                              )}
                            </h3>

                            <p className="text-center text-2xl font-bold text-red-400">
                              {precoFormatado}
                            </p>

                            <p className="text-center text-xs text-zinc-400">
                              {plano.descricao}
                            </p>
                          </div>

                          <ul className="mt-10 space-y-2 mb-6 text-xs text-zinc-200">
                            {plano.beneficios.map((b, idx) => {
                              const useTilde = b.useTilde && b.included;
                              const isPriorityIntermediate = (b.label === "Prioridade intermediária" || b.label === "Prioridade intermediária na agenda") && b.included;
                              const iconColor = b.included 
                                ? (isPriorityIntermediate ? "bg-yellow-500" : "bg-emerald-500") 
                                : "bg-red-600";
                              const textColor = b.included 
                                ? (isPriorityIntermediate ? "text-yellow-200" : "text-emerald-200") 
                                : "text-red-300";
                              const boxBgColor = isPriorityIntermediate ? "bg-yellow-950/40" : "bg-zinc-900";
                              const boxBorderColor = isPriorityIntermediate ? "border-yellow-500/60" : "";
                              
                              return (
                                <li
                                  key={idx}
                                  className={`flex items-center gap-2 rounded-lg px-4 py-2 ${boxBgColor} ${boxBorderColor} ${boxBorderColor ? "border" : ""}`}
                                >
                                  <span
                                    className={`flex h-4 w-4 items-center justify-center rounded-full text-[10px] font-bold ${iconColor} text-black`}
                                  >
                                    {useTilde ? "~" : (b.included ? "✓" : "✕")}
                                  </span>
                                  <span className={b.included ? textColor : "text-red-300"}>
                                    {b.label}
                                  </span>
                                </li>
                              );
                            })}
                          </ul>
                        </div>

                        <a
                          href="/planos"
                          className="mt-auto w-full rounded-full border border-red-600 px-5 py-3 text-sm font-semibold text-red-300 hover:bg-red-600/20 transition-all text-center"
                          style={{ textShadow: "0 2px 4px rgba(0, 0, 0, 0.5)" }}
                        >
                          Ver este plano em detalhes
                        </a>
                      </div>
                    </div>
                  );
                })}
              </div>

              <p className="mt-1 text-[11px] text-zinc-400 text-justify md:text-center px-2 md:px-0">
                A contratação de qualquer plano está sujeita à confirmação do pagamento e ao aceite dos{" "}
                <a href="/termos-contratos" className="!text-blue-400 underline underline-offset-2 hover:!text-blue-300 transition-colors" style={{ color: '#60a5fa' }}>termos de uso</a>
                <span className="hidden md:inline"><br />e </span>
                <span className="md:hidden"> e </span>
                <a href="/termos-contratos" className="!text-blue-400 underline underline-offset-2 hover:!text-blue-300 transition-colors" style={{ color: '#60a5fa' }}>contrato de prestação de serviço</a> da THouse Rec.
              </p>
            </>
          )}
          </div>
        </div>
      </section>

      {/* =========================================================
          CUPOM DE DESCONTO
      ========================================================== */}
      <section className="mb-16 flex justify-center px-4 mt-16">
        <div className="relative w-full max-w-5xl border border-red-500" style={{ borderWidth: "1px" }}>
          <div
            className="relative space-y-3 p-6 md:p-8"
            style={{
              background: "linear-gradient(to right, rgba(0,0,0,0) 0%, rgba(0,0,0,0.75) 8%, rgba(0,0,0,0.85) 20%, rgba(0,0,0,0.85) 80%, rgba(0,0,0,0.75) 92%, rgba(0,0,0,0) 100%)",
              backdropFilter: "blur(16px)",
              WebkitBackdropFilter: "blur(16px)",
            }}
          >
            <h2 className="text-center text-lg font-semibold text-red-400" style={{ textShadow: "0 2px 4px rgba(0, 0, 0, 0.5)" }}>
              Cupom de Desconto
            </h2>

            <p className="text-center text-sm text-white md:text-base" style={{ textShadow: "0 2px 8px rgba(0, 0, 0, 0.8)" }}>
              Se você possui um cupom de desconto ou cupom de plano, insira o código abaixo para aplicar o desconto automaticamente.
            </p>

            <div className="flex flex-col sm:flex-row gap-2">
              <input
                type="text"
                value={cupomCode}
                onChange={(e) => setCupomCode(e.target.value.toUpperCase())}
                placeholder="Digite o código do cupom"
                disabled={validandoCupom || !!cupomAplicado}
                className="flex-1 rounded-xl border border-zinc-700 bg-zinc-900 px-3 md:px-4 py-2 md:py-3 text-xs md:text-sm text-zinc-100 placeholder-zinc-500 outline-none focus:border-red-500 disabled:opacity-50 disabled:cursor-not-allowed"
              />
              {!cupomAplicado ? (
                <button
                  type="button"
                  onClick={async () => {
                    if (!cupomCode.trim()) {
                      alert("Digite um código de cupom");
                      return;
                    }
                    if (totalGeral <= 0) {
                      alert("Selecione pelo menos um serviço antes de aplicar o cupom");
                      return;
                    }
                    setValidandoCupom(true);
                    try {
                      const servicosParaValidar = SERVICOS_ESTUDIO
                        .filter((s) => (quantidadesServicos[s.id] || 0) > 0)
                        .map((s) => ({
                          id: s.id,
                          nome: s.nome,
                          quantidade: quantidadesServicos[s.id] || 0,
                          preco: s.preco,
                        }));
                      const beatsParaValidar = BEATS_PACOTES
                        .filter((b) => (quantidadesBeats[b.id] || 0) > 0)
                        .map((b) => ({
                          id: b.id,
                          nome: b.nome,
                          quantidade: quantidadesBeats[b.id] || 0,
                          preco: b.preco,
                        }));
                      const res = await fetch("/api/coupons/validate", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                          code: cupomCode,
                          total: totalGeral,
                          servicos: servicosParaValidar,
                          beats: beatsParaValidar,
                        }),
                      });
                      const data = await res.json();
                      if (data.valid) {
                        setCupomAplicado({
                          code: cupomCode,
                          discount: data.discount,
                          couponType: data.couponType,
                        });
                      } else {
                        alert(data.error || "Cupom inválido ou inexistente");
                      }
                    } catch (err) {
                      alert("Erro ao validar cupom. Tente novamente.");
                    } finally {
                      setValidandoCupom(false);
                    }
                  }}
                  disabled={validandoCupom || totalGeral <= 0}
                  className="rounded-xl bg-red-600 px-4 md:px-6 py-2 md:py-3 text-xs md:text-sm font-semibold text-white hover:bg-red-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
                >
                  {validandoCupom ? "Validando..." : "Aplicar"}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setCupomAplicado(null);
                    setCupomCode("");
                  }}
                  className="rounded-xl bg-red-600 px-4 md:px-6 py-2 md:py-3 text-xs md:text-sm font-semibold text-white hover:bg-red-500 transition-colors whitespace-nowrap"
                >
                  Remover
                </button>
              )}
            </div>
            {cupomAplicado && (
              <p className="mt-2 text-center text-sm text-green-400">
                ✓ Cupom {cupomAplicado.couponType === "reembolso" ? "de reembolso" : "de plano"} aplicado com sucesso! Desconto de R$ {cupomAplicado.discount.toFixed(2).replace(".", ",")}
              </p>
            )}
          </div>
        </div>
      </section>

      {/* =========================================================
          RESUMO / VALOR TOTAL
      ========================================================== */}
      <section className="mb-16 flex justify-center px-4 mt-16">
        <div className="relative w-full max-w-5xl border border-red-500" style={{ borderWidth: "1px" }}>
          <div
            className="relative p-6 md:p-8"
            style={{
              background: "linear-gradient(to right, rgba(0,0,0,0) 0%, rgba(0,0,0,0.75) 8%, rgba(0,0,0,0.85) 20%, rgba(0,0,0,0.85) 80%, rgba(0,0,0,0.75) 92%, rgba(0,0,0,0) 100%)",
              backdropFilter: "blur(16px)",
              WebkitBackdropFilter: "blur(16px)",
            }}
          >
            <h2 className="mb-6 text-center text-2xl font-semibold text-red-400" style={{ textShadow: "0 2px 4px rgba(0, 0, 0, 0.5)" }}>
              Resumo do seu agendamento
            </h2>

            <div className="flex flex-col gap-8 md:flex-row md:items-end">
          {/* COLUNA ESQUERDA – SERVIÇOS */}
          <div className="flex-1">
            <h3 className="mb-3 text-xl font-semibold text-zinc-200">
                Serviços selecionados
            </h3>

            <ul className="space-y-1 text-sm text-zinc-300">
              {SERVICOS_ESTUDIO.map((s) => {
                const q = quantidadesServicos[s.id] || 0;
                if (!q) return null;
                return (
                  <li key={s.id}>
                    {q}x {s.nome} — R$ {(q * s.preco).toFixed(2).replace(".", ",")}
                  </li>
                );
              })}

              {BEATS_PACOTES.map((s) => {
                const q = quantidadesBeats[s.id] || 0;
                if (!q) return null;
                return (
                  <li key={s.id}>
                    {q}x {s.nome} — R$ {(q * s.preco).toFixed(2).replace(".", ",")}
                    </li>
                );
              })}

              {totalGeral === 0 && (
                <li className="text-zinc-500">
                  Nenhum serviço selecionado ainda.
                </li>
              )}
            </ul>
          </div>

          {/* COLUNA DIREITA – DATA / HORA / TOTAL */}
          <div className="flex flex-col items-end gap-2 text-right">
            <p className="text-base md:text-xl font-extrabold text-zinc-300 whitespace-nowrap">
              Horário:{" "}
              <span className="font-extrabold">
                {horaSelecionada || "—"}
              </span>
            </p>

            <p className="text-base md:text-xl font-extrabold text-zinc-300 whitespace-nowrap">
              Data:{" "}
              <span className="font-extrabold">
                {dataSelecionada
                  ? new Date(`${dataSelecionada}T12:00:00`).toLocaleDateString(
                      "pt-BR"
                    )
                  : "—"}
              </span>
            </p>

            <div className="mt-2 space-y-1">
              <p className="text-2xl md:text-3xl font-extrabold text-yellow-300 whitespace-nowrap">
                Total estimado: R$ {totalGeral.toFixed(2).replace(".", ",")}
              </p>
              {cupomAplicado && descontoCupom > 0 && (
                <>
                  <p className="text-sm text-green-400 whitespace-nowrap">
                    Cupom {cupomAplicado.code}: -R$ {descontoCupom.toFixed(2).replace(".", ",")}
                  </p>
                  <p className="text-xl md:text-2xl font-extrabold text-yellow-200 whitespace-nowrap">
                    Total com desconto: R$ {totalComDesconto.toFixed(2).replace(".", ",")}
                  </p>
                </>
              )}
            </div>
          </div>
            </div>
          </div>
        </div>
      </section>

      {/* =========================================================
          CONFIRMAR E IR PARA PAGAMENTO
      ========================================================== */}
      <section className="mb-16 flex justify-center px-4 mt-16">
        <div className="relative w-full max-w-5xl border border-red-500" style={{ borderWidth: "1px" }}>
          <div
            className="relative space-y-3 p-6 md:p-8 text-sm"
            style={{
              background: "linear-gradient(to right, rgba(0,0,0,0) 0%, rgba(0,0,0,0.75) 8%, rgba(0,0,0,0.85) 20%, rgba(0,0,0,0.85) 80%, rgba(0,0,0,0.75) 92%, rgba(0,0,0,0) 100%)",
              backdropFilter: "blur(16px)",
              WebkitBackdropFilter: "blur(16px)",
            }}
          >
            <p className="text-center text-white md:text-base" style={{ textShadow: "0 2px 8px rgba(0, 0, 0, 0.8)" }}>
              Ao confirmar, você declara estar ciente de que o agendamento só será
              efetivado após a confirmação do pagamento e que ajustes finais
              podem ser alinhados diretamente com o estúdio.
            </p>

            {/* CHECKBOX DE ACEITE DOS TERMOS */}
            <div className="mt-6 flex items-center justify-center gap-2">
              <input
                type="checkbox"
                id="aceite-termos"
                checked={aceiteTermos}
                onChange={(e) => setAceiteTermos(e.target.checked)}
                className="h-4 w-4 cursor-pointer rounded border-zinc-600 bg-zinc-900 text-red-600 focus:ring-2 focus:ring-red-500 focus:ring-offset-0"
              />
              <label
                htmlFor="aceite-termos"
                className="text-sm text-white cursor-pointer"
                style={{ textShadow: "0 2px 8px rgba(0, 0, 0, 0.8)" }}
              >
                Declaro estar ciente dos{" "}
                <a
                  href="/termos-contratos"
                  className="text-blue-400 underline underline-offset-2 hover:text-blue-300 transition-colors"
                >
                  termos de contrato
                </a>
              </label>
            </div>

            <div className="mt-8 flex justify-center">
              <button
                type="button"
                onClick={handleConfirmar}
                className="w-full max-w-6xl rounded-full bg-red-600 px-6 py-3 text-sm font-semibold text-white hover:bg-red-500 transition-all"
                style={{ textShadow: "0 2px 4px rgba(0, 0, 0, 0.5)" }}
              >
                Confirmar agendamento e ir para pagamentos
              </button>
            </div>

            <p className="text-xs text-zinc-300 text-justify md:text-center px-2 md:px-0">
              A confirmação implica concordância com os{" "}
              <a href="/termos-contratos" className="!text-blue-400 underline underline-offset-2 hover:!text-blue-300 transition-colors" style={{ color: '#60a5fa' }}>termos de uso</a> e com o{" "}
              <a href="/termos-contratos" className="!text-blue-400 underline underline-offset-2 hover:!text-blue-300 transition-colors" style={{ color: '#60a5fa' }}>contrato de prestação de serviço</a> da THouse Rec.
            </p>
          </div>
        </div>
      </section>

      {/* =========================================================
          BOX DE TESTE - APENAS PARA ADMIN
      ========================================================== */}
      {user && (user.email === "thouse.rec.tremv@gmail.com" || user.role === "ADMIN") && (
        <section className="mb-16 flex justify-center px-4 mt-16">
          <div className="relative w-full max-w-5xl border-2 border-yellow-500 rounded-2xl bg-yellow-950/20 backdrop-blur-sm p-6">
            <div className="space-y-4">
              <h3 className="text-xl font-semibold text-yellow-400 text-center">
                🧪 Pagamento de Teste - Agendamento (Apenas Admin)
              </h3>
              <p className="text-sm text-yellow-200 text-center">
                Use esta opção para testar o fluxo de pagamento. Preencha apenas data, horário e comentário. 
                O agendamento será criado apenas após o pagamento ser confirmado (R$ 5,00).
              </p>
              
              {/* Formulário de Teste Simplificado */}
              <div className="space-y-4 mt-6">
                {/* Data */}
                <div>
                  <label className="block text-sm font-medium text-yellow-300 mb-2">
                    Data do Agendamento *
                  </label>
                  <input
                    type="date"
                    value={dataSelecionada || ""}
                    onChange={(e) => setDataSelecionada(e.target.value || null)}
                    min={new Date().toISOString().split('T')[0]}
                    className="w-full rounded-lg border border-yellow-600 bg-zinc-900 px-4 py-2 text-sm text-zinc-100 focus:border-yellow-400 focus:outline-none"
                  />
                </div>

                {/* Horário */}
                <div>
                  <label className="block text-sm font-medium text-yellow-300 mb-2">
                    Horário *
                  </label>
                  <select
                    value={horaSelecionada || ""}
                    onChange={(e) => setHoraSelecionada(e.target.value || null)}
                    className="w-full rounded-lg border border-yellow-600 bg-zinc-900 px-4 py-2 text-sm text-zinc-100 focus:border-yellow-400 focus:outline-none appearance-none"
                    style={{
                      backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%23ffffff' d='M6 9L1 4h10z'/%3E%3C/svg%3E")`,
                      backgroundRepeat: 'no-repeat',
                      backgroundPosition: 'right 0.75rem center',
                      paddingRight: '2.5rem',
                    }}
                  >
                    <option value="">Selecione um horário</option>
                    {HORARIOS_PADRAO.map((h) => (
                      <option key={h} value={h}>
                        {h}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Campo de Cupom */}
                <div>
                  <label className="block text-sm font-medium text-yellow-300 mb-2">
                    Cupom de Desconto (Opcional)
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={cupomCode}
                      onChange={(e) => setCupomCode(e.target.value.toUpperCase())}
                      placeholder="Digite o código do cupom"
                      disabled={validandoCupom || !!cupomAplicado}
                      className="flex-1 rounded-lg border border-yellow-600 bg-zinc-900 px-4 py-2 text-sm text-zinc-100 placeholder-zinc-500 focus:border-yellow-400 focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed"
                    />
                    {!cupomAplicado ? (
                      <button
                        type="button"
                        onClick={async () => {
                          if (!cupomCode.trim()) {
                            alert("Digite um código de cupom");
                            return;
                          }
                          if (totalGeral <= 0) {
                            alert("Selecione pelo menos um serviço antes de aplicar o cupom");
                            return;
                          }
                          setValidandoCupom(true);
                          try {
                            const servicosParaValidar = SERVICOS_ESTUDIO
                              .filter((s) => (quantidadesServicos[s.id] || 0) > 0)
                              .map((s) => ({
                                id: s.id,
                                nome: s.nome,
                                quantidade: quantidadesServicos[s.id] || 0,
                                preco: s.preco,
                              }));
                            const beatsParaValidar = BEATS_PACOTES
                              .filter((b) => (quantidadesBeats[b.id] || 0) > 0)
                              .map((b) => ({
                                id: b.id,
                                nome: b.nome,
                                quantidade: quantidadesBeats[b.id] || 0,
                                preco: b.preco,
                              }));
                            const res = await fetch("/api/coupons/validate", {
                              method: "POST",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({
                                code: cupomCode,
                                total: totalGeral,
                                servicos: servicosParaValidar,
                                beats: beatsParaValidar,
                              }),
                            });
                            const data = await res.json();
                            if (data.valid) {
                              setCupomAplicado({
                                code: cupomCode,
                                discount: data.discount,
                                couponType: data.couponType,
                              });
                            } else {
                              alert(data.error || "Cupom inválido");
                            }
                          } catch (err) {
                            alert("Erro ao validar cupom");
                          } finally {
                            setValidandoCupom(false);
                          }
                        }}
                        disabled={validandoCupom || totalGeral <= 0}
                        className="rounded-lg bg-yellow-600 px-4 py-2 text-sm font-semibold text-white hover:bg-yellow-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {validandoCupom ? "Validando..." : "Aplicar"}
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => {
                          setCupomAplicado(null);
                          setCupomCode("");
                        }}
                        className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-500 transition-colors"
                      >
                        Remover
                      </button>
                    )}
                  </div>
                  {cupomAplicado && (
                    <p className="mt-2 text-xs text-green-400">
                      ✓ Cupom {cupomAplicado.couponType === "reembolso" ? "de reembolso" : "de plano"} aplicado com sucesso!
                    </p>
                  )}
                </div>

                {/* Comentários */}
                <div>
                  <label className="block text-sm font-medium text-yellow-300 mb-2">
                    Comentários / Observações *
                  </label>
                  <textarea
                    value={comentarios}
                    onChange={(e) => setComentarios(e.target.value)}
                    placeholder="Descreva o que você precisa para esta sessão..."
                    rows={3}
                    className="w-full rounded-lg border border-yellow-600 bg-zinc-900 px-4 py-2 text-sm text-zinc-100 focus:border-yellow-400 focus:outline-none resize-none"
                  />
                </div>

                {/* Checkbox de Aceite */}
                <div className="flex items-start gap-2">
                  <input
                    type="checkbox"
                    id="aceite-termos-teste"
                    checked={aceiteTermos}
                    onChange={(e) => setAceiteTermos(e.target.checked)}
                    className="mt-1 h-4 w-4 cursor-pointer rounded border-yellow-600 bg-zinc-900 text-yellow-600 focus:ring-2 focus:ring-yellow-500 focus:ring-offset-0"
                  />
                  <label
                    htmlFor="aceite-termos-teste"
                    className="text-sm text-yellow-200 cursor-pointer"
                  >
                    Declaro estar ciente dos{" "}
                    <a
                      href="/termos-contratos"
                      className="text-blue-400 underline underline-offset-2 hover:text-blue-300 transition-colors"
                    >
                      termos de contrato
                    </a>
                  </label>
                </div>

                {/* Botão de Teste */}
                <button
                  type="button"
                  onClick={async () => {
                    // Validações
                    if (!dataSelecionada) {
                      alert("Por favor, selecione uma data.");
                      return;
                    }
                    
                    if (!horaSelecionada) {
                      alert("Por favor, selecione um horário.");
                      return;
                    }
                    
                    if (!comentarios.trim()) {
                      alert("Por favor, preencha o campo de comentários.");
                      return;
                    }
                    
                    if (!aceiteTermos) {
                      alert("É preciso marcar a declaração dos Termos de Contrato antes de confirmar o pagamento.");
                      return;
                    }

                    // Verificar se a data/hora não passou
                    const dataHoraISO = new Date(`${dataSelecionada}T${horaSelecionada}:00`);
                    if (dataHoraISO < new Date()) {
                      alert("Não é possível agendar para uma data/hora que já passou.");
                      return;
                    }

                    try {
                      const res = await fetch("/api/test-payment", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ 
                          tipo: "agendamento",
                          data: dataSelecionada,
                          hora: horaSelecionada,
                          observacoes: comentarios,
                          duracaoMinutos: 60,
                        }),
                      });

                      if (!res.ok) {
                        const error = await res.json();
                        let errorMessage = error.error || "Erro ao criar pagamento de teste";
                        
                      // Mensagens mais amigáveis para erros comuns
                      if (error.details?.tipo === "permissao_insuficiente") {
                        errorMessage = `❌ Permissão Insuficiente\n\n${error.error}\n\n${error.details.solucao}\n\n${error.details.guia || ""}`;
                      } else if (error.details?.tipo === "token_invalido") {
                        errorMessage = `❌ Token Inválido\n\n${error.error}\n\n${error.details.solucao}`;
                      } else if (error.details?.tipo === "ambiente_invalido") {
                        errorMessage = `❌ Ambiente Inválido\n\n${error.error}\n\n${error.details.solucao}`;
                      } else if (error.details?.tipo === "dominio_nao_configurado") {
                        errorMessage = `❌ Domínio Não Configurado\n\n${error.error}\n\n${error.details.solucao}\n\n📖 ${error.details.guia || ""}`;
                      }
                        
                        alert(errorMessage);
                        console.error("[Test Payment Frontend] Erro completo:", error);
                        return;
                      }

                      const data = await res.json();
                      if (data.initPoint) {
                        window.location.href = data.initPoint;
                      } else {
                        alert("Não foi possível obter o link de pagamento de teste.");
                      }
                    } catch (e) {
                      console.error(e);
                      alert("Erro inesperado ao iniciar pagamento de teste.");
                    }
                  }}
                  className="w-full rounded-full bg-yellow-600 px-6 py-3 text-sm font-semibold text-white hover:bg-yellow-500 transition-all"
                  style={{ textShadow: "0 2px 4px rgba(0, 0, 0, 0.5)" }}
                >
                  Testar Pagamento - R$ 5,00
                </button>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* =========================================================
          DÚVIDAS / SUPORTE
      ========================================================== */}
      <DuvidasBox />
      </div>
    </main>
  );
}

/* ===============================
   COMPONENTE AUXILIAR
================================ */

type ServicoItemProps = {
  id: string;
  nome: string;
  preco: number;
  subtitulo?: string;
  porHora?: boolean;
  quantidade: number;
  onChange: (delta: number) => void;
};

function ServicoItem({
  nome,
  preco,
  subtitulo,
  porHora = false,
  quantidade,
  onChange,
}: ServicoItemProps) {
  return (
    <div className="flex items-center justify-between rounded-xl border border-red-700/40 bg-zinc-900 p-4 text-sm">
      <div className="flex flex-wrap items-baseline gap-2">
        <p className="font-semibold text-zinc-100">{nome}</p>
        {subtitulo && (
          <span className="text-xs text-zinc-400">{subtitulo}</span>
        )}
        <span className="text-xs text-red-300">
          R$ {preco.toFixed(2).replace(".", ",")}
          {porHora && " / hora"}
        </span>
      </div>

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => onChange(-1)}
          className="flex h-7 w-7 items-center justify-center rounded-full border border-zinc-600 text-xs hover:border-red-500"
        >
          -
        </button>

        <span className="w-6 text-center text-sm">{quantidade}</span>

        <button
          type="button"
          onClick={() => onChange(1)}
          className="flex h-7 w-7 items-center justify-center rounded-full border border-red-600 text-xs hover:bg-red-600 hover:text-white"
        >
          +
        </button>
      </div>
    </div>
  );
}

export default function AgendamentoPage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen flex items-center justify-center text-zinc-400 bg-zinc-950">
          Carregando...
        </main>
      }
    >
      <AgendamentoContent />
    </Suspense>
  );
}
