"use client";

import React, { useState, useMemo } from "react";

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
  beneficios: { label: string; included: boolean }[];
};

// ================== DADOS ==================

const SERVICOS_ESTUDIO: Servico[] = [
  { id: "sessao", nome: "Sessão", preco: 40 },
  { id: "captacao", nome: "Captação", preco: 50 },
  { id: "sonoplastia", nome: "Sonoplastia (a partir de)", preco: 320 },
  { id: "mix", nome: "Mixagem", preco: 110 },
  { id: "master", nome: "Masterização", preco: 60 },
  { id: "mix_master", nome: "Mix + Master", preco: 160 },
];

const BEATS_PACOTES: Servico[] = [
  { id: "beat1", nome: "1 Beat", preco: 150 },
  { id: "beat2", nome: "2 Beats", preco: 250 },
  { id: "beat3", nome: "3 Beats", preco: 350 },
  { id: "beat4", nome: "4 Beats", preco: 400 },
  { id: "beat_mix_master", nome: "Beat + Mix + Master", preco: 280 },
  {
    id: "producao_completa",
    nome: "Produção Completa (4h + beat + mix + master)",
    preco: 400,
  },
];

const PLANOS: Plano[] = [
  {
    id: "bronze",
    nome: "Plano Bronze",
    mensal: 149.99,
    anual: 1499.99,
    descricao: "Para quem está começando a gravar com frequência.",
    beneficios: [
      { label: "1h de captação por mês", included: true },
      { label: "1 mix por mês", included: true },
      { label: "1 master por mês", included: true },
      { label: "Prioridade na agenda", included: false },
      { label: "Sessão de direção de produção", included: false },
      { label: "Desconto em beats exclusivos", included: false },
    ],
  },
  {
    id: "prata",
    nome: "Plano Prata",
    mensal: 349.99,
    anual: 3499.99,
    descricao: "Para artistas que lançam com regularidade.",
    beneficios: [
      { label: "2h de captação por mês", included: true },
      { label: "2 mix & master por mês", included: true },
      { label: "1 beat por mês", included: true },
      { label: "Prioridade intermediária na agenda", included: true },
      { label: "Sessão de direção de produção", included: false },
      { label: "Desconto em beats exclusivos", included: false },
    ],
  },
  {
    id: "ouro",
    nome: "Plano Ouro",
    mensal: 549.99,
    anual: 5499.99,
    descricao: "Para quem quer acompanhamento contínuo com o Tremv.",
    beneficios: [
      { label: "4h de captação por mês", included: true },
      { label: "2 produções completas por mês", included: true },
      { label: "2 beats por mês", included: true },
      { label: "Prioridade máxima na agenda", included: true },
      { label: "Sessão de direção de produção", included: true },
      { label: "Desconto em beats exclusivos", included: true },
    ],
  },
];

const HORARIOS_PADRAO = [
  "10:00","11:00","12:00","13:00","14:00","15:00",
  "16:00","17:00","18:00","19:00","20:00","21:00","22:00",
];

// ================== PAGE ==================

export default function AgendamentoPage() {
  const [quantidadesServicos, setQuantidadesServicos] = useState<Record<string, number>>({});
  const [quantidadesBeats, setQuantidadesBeats] = useState<Record<string, number>>({});
  const [comentarios, setComentarios] = useState("");

  const [dataBase, setDataBase] = useState(() => {
    const hoje = new Date();
    return new Date(hoje.getFullYear(), hoje.getMonth(), 1);
  });

  const [dataSelecionada, setDataSelecionada] = useState<string | null>(null);
  const [horaSelecionada, setHoraSelecionada] = useState<string | null>(null);

  const [modoPlano, setModoPlano] = useState<"mensal" | "anual">("mensal");
  const [mostrarPlanos, setMostrarPlanos] = useState(false);
  const [aceiteTermos, setAceiteTermos] = useState(false);

  const horariosOcupadosPorDia: Record<string, Set<string>> = {};

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
  for (let d = 1; d <= ultimoDiaDoMes; d++) dias.push(d);

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

  const dataFormatada = useMemo(() => {
    if (!dataSelecionada) return null;
    const [ano, mes, dia] = dataSelecionada.split("-");
    return new Date(+ano, +mes - 1, +dia).toLocaleDateString("pt-BR");
  }, [dataSelecionada]);

  const handleConfirmar = () => {
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
    
    // Se tudo estiver ok, prosseguir para pagamento
    alert("Agendamento preparado! Pagamento em breve.");
  };

  const handleMesAnterior = () => {
    setDataBase(prev =>
      new Date(prev.getFullYear(), prev.getMonth() - 1, 1)
    );
  };

  const handleProximoMes = () => {
    setDataBase(prev =>
      new Date(prev.getFullYear(), prev.getMonth() + 1, 1)
    );
  };

  return (
    <main className="mx-auto max-w-6xl px-6 py-10 text-zinc-100">
      {/* =========================================================
          TÍTULO / INTRODUÇÃO
      ========================================================== */}
      <section className="mt-12 mb-24 flex flex-col items-center justify-center w-full">
        <h1 className="mb-20 mt-35 text-center text-base font-semibold md:text-4xl lg:text-5xl" style={{ textShadow: "0 4px 20px rgba(0, 0, 0, 0.8), 0 2px 10px rgba(239, 68, 68, 0.3)" }}>
          Crie sua própria música na{" "}
          <span className="text-red-500">THouse Rec</span>
        </h1>
        
        {/* TEXTO DESCRITIVO COM ESTILO PROFISSIONAL */}
        <div className="flex justify-center items-center px-4 w-full max-w-5xl mb-30 mx-auto">
          <div className="relative w-full">
            {/* LINHA SUPERIOR COM FADE */}
            <div 
              className="h-[1px]"
              style={{
                background: "linear-gradient(to right, transparent 0%, rgba(239, 68, 68, 0.3) 15%, rgba(239, 68, 68, 0.6) 50%, rgba(239, 68, 68, 0.3) 85%, transparent 100%)",
                boxShadow: "0 1px 10px rgba(239, 68, 68, 0.4)"
              }}
            />
            
            {/* CONTEÚDO COM FUNDO PRETO */}
            <div 
              className="relative p-6 md:p-8"
              style={{
                background: "linear-gradient(to right, rgba(0,0,0,0) 0%, rgba(0,0,0,0.75) 8%, rgba(0,0,0,0.85) 20%, rgba(0,0,0,0.85) 80%, rgba(0,0,0,0.75) 92%, rgba(0,0,0,0) 100%)",
                backdropFilter: "blur(16px)",
                WebkitBackdropFilter: "blur(16px)",
              }}
            >
              <p className="text-center text-sm leading-relaxed text-white md:text-base" style={{ textShadow: "0 2px 8px rgba(0, 0, 0, 0.8)" }}>
                Aqui você monta sua sessão de estúdio do seu jeito: escolhendo
                serviços avulsos, pacotes de beats, data e horário no calendário. A
                ideia é deixar o agendamento o mais claro e direto possível, para
                que você foque na parte mais importante: a música.
              </p>
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
        </div>
      </section>

      {/* =========================================================
          SERVIÇOS DE ESTÚDIO
      ========================================================== */}
      <section className="mb-16 flex justify-center px-4 mt-40">
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

             {/* GRID FIXO — ORDEM CONTROLADA */}
            <div className="grid gap-4 md:grid-cols-2">
              
              {/* LINHA 1 */}
              <ServicoItem
                id="sessao"
                nome="Sessão"
                preco={40}
                porHora
                quantidade={quantidadesServicos["sessao"] || 0}
                onChange={(d) => handleQuantServico("sessao", d, "estudio")}
              />

              <ServicoItem
                id="captacao"
                nome="Captação"
                preco={50}
                porHora
                quantidade={quantidadesServicos["captacao"] || 0}
                onChange={(d) => handleQuantServico("captacao", d, "estudio")}
              />

              {/* LINHA 2 */}
              <ServicoItem
                id="mix"
                nome="Mixagem"
                preco={110}
                quantidade={quantidadesServicos["mix"] || 0}
                onChange={(d) => handleQuantServico("mix", d, "estudio")}
              />

              <ServicoItem
                id="master"
                nome="Masterização"
                preco={60}
                quantidade={quantidadesServicos["master"] || 0}
                onChange={(d) => handleQuantServico("master", d, "estudio")}
              />

              {/* LINHA 3 */}
              <ServicoItem
                id="mix_master"
                nome="Mix + Master"
                preco={160}
                quantidade={quantidadesServicos["mix_master"] || 0}
                onChange={(d) => handleQuantServico("mix_master", d, "estudio")}
              />

              <ServicoItem
                id="sonoplastia"
                nome="Sonoplastia"
                preco={320}
                subtitulo="(a partir de)"
                quantidade={quantidadesServicos["sonoplastia"] || 0}
                onChange={(d) => handleQuantServico("sonoplastia", d, "estudio")}
              />

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
      <section className="mb-16 flex justify-center px-4">
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
                  <div>
                    <p className="font-semibold text-zinc-100">
                      {s.nome}
                    </p>
                     <p className="text-xs text-red-300">
                      R$ {s.preco.toFixed(2).replace(".", ",")}
                    </p>
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
      <section className="mb-16 flex justify-center px-4">
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
      <section className="mb-16 flex justify-center px-4">
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
                  className="rounded-full border border-zinc-700 px-3 py-1 hover:border-red-500"
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

                  const ocupados =
                    horariosOcupadosPorDia[isoDate] || new Set<string>();

                  let corDia = "border-green-600 bg-green-600/20 text-green-300";

                  if (ocupados.size > 0 && ocupados.size < HORARIOS_PADRAO.length) {
                    corDia =
                      "border-yellow-500 bg-yellow-500/20 text-yellow-300";
                  }

                  if (ocupados.size === HORARIOS_PADRAO.length) {
                    corDia =
                      "border-red-600 bg-red-600/30 text-red-300";
                  }

                  const selecionado = dataSelecionada === isoDate;

                  return (
                    <button
                      key={isoDate}
                      type="button"
                      onClick={() => {
                        setDataSelecionada(isoDate);
                        setHoraSelecionada(null);
                      }}
                      className={[
                        "rounded-md border px-1 py-1 text-center text-xs transition",
                        selecionado
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

                  return (
                    <button
                      key={h}
                      type="button"
                      onClick={() =>
                        !estaOcupado && setHoraSelecionada(h)
                      }
                      className={[
                        "rounded-lg border px-3 py-2 font-medium transition",
                        estaOcupado
                          ? "cursor-not-allowed border-red-700 bg-red-900/60 text-red-200"
                          : selecionado
                          ? "border-green-500 bg-green-600/30 text-green-200"
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
      <section className="mb-16 flex justify-center px-4">
        <div className="relative w-full max-w-5xl border border-yellow-500" style={{ borderWidth: "1px" }}>
          <div
            className="relative p-6 md:p-8"
            style={{
              background: "linear-gradient(to right, rgba(0,0,0,0) 0%, rgba(0,0,0,0.75) 8%, rgba(0,0,0,0.85) 20%, rgba(0,0,0,0.85) 80%, rgba(0,0,0,0.75) 92%, rgba(0,0,0,0) 100%)",
              backdropFilter: "blur(16px)",
              WebkitBackdropFilter: "blur(16px)",
            }}
          >
            <p className="text-xs text-center leading-relaxed text-white md:text-sm" style={{ textShadow: "0 2px 8px rgba(0, 0, 0, 0.8)" }}>
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
      <section className="mb-16 flex justify-center px-4">
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

            <p className="text-center text-xs text-white md:text-sm" style={{ textShadow: "0 2px 8px rgba(0, 0, 0, 0.8)" }}>
              Se você já sabe que quer manter uma rotina de lançamentos, os
              planos da THouse Rec garantem mais horas de estúdio, melhor
              custo-benefício e prioridade na agenda. Produzir com consistência
              muda completamente o ritmo da sua carreira.
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
              <div className="flex justify-center">
                <div className="inline-flex rounded-full border border-red-700/60 bg-zinc-900 p-1 text-[11px]">
                  <button
                    type="button"
                    onClick={() => setModoPlano("mensal")}
                    className={`rounded-full px-4 py-1 font-semibold ${
                      modoPlano === "mensal"
                        ? "bg-red-600 text-white"
                        : "text-zinc-300 hover:text-red-300"
                    }`}
                  >
                    Mensal
                  </button>
                  <button
                    type="button"
                    onClick={() => setModoPlano("anual")}
                    className={`rounded-full px-4 py-1 font-semibold ${
                      modoPlano === "anual"
                        ? "bg-red-600 text-white"
                        : "text-zinc-300 hover:text-red-300"
                    }`}
                  >
                    Anual
                  </button>
                </div>
              </div>

              {/* GRID DOS PLANOS */}
              <div className="grid gap-4 md:grid-cols-3">
                {PLANOS.map((plano) => {
                  const valorBase =
                    modoPlano === "mensal" ? plano.mensal : plano.anual;

                  const precoFormatado =
                    modoPlano === "mensal"
                      ? `R$ ${valorBase.toFixed(2).replace(".", ",")} / mês`
                      : `R$ ${valorBase.toFixed(2).replace(".", ",")} / ano`;

                  return (
                    <div
                      key={plano.id}
                      className="flex flex-col space-y-3 rounded-2xl border border-red-700/40 bg-zinc-900 p-4"
                    >
                      <h3 className="text-center text-sm font-semibold text-red-300">
                        {plano.nome}
                      </h3>
                      <p className="text-center text-lg font-bold text-red-400">
                        {precoFormatado}
                      </p>
                      <p className="text-center text-[11px] text-zinc-400">
                        {plano.descricao}
                      </p>

                      <ul className="space-y-2 text-[11px] text-zinc-200">
                        {plano.beneficios.map((b, idx) => (
                          <li
                            key={idx}
                            className="flex items-center gap-2 rounded-lg bg-zinc-900 px-3 py-2"
                          >
                            <span
                              className={
                                "flex h-4 w-4 items-center justify-center rounded-full text-[10px] font-bold " +
                                (b.included
                                  ? "bg-emerald-500 text-black"
                                  : "bg-red-600 text-black")
                              }
                            >
                              {b.included ? "✓" : "✕"}
                            </span>
                            <span
                              className={
                                b.included
                                  ? "text-emerald-200"
                                  : "text-red-300 line-through"
                              }
                            >
                              {b.label}
                            </span>
                          </li>
                        ))}
                      </ul>

                      <a
                        href="/planos"
                        className="mt-2 inline-block rounded-full border border-red-600 px-3 py-1 text-center text-[11px] font-semibold text-red-300 hover:bg-red-600/20"
                      >
                        Ver este plano em detalhes
                      </a>
                    </div>
                  );
                })}
              </div>

              <p className="mt-1 text-center text-[11px] text-zinc-400">
                A contratação de qualquer plano só poderá ser concluída após a
                leitura e o aceite dos <strong>termos de uso</strong> e do{" "}
                <strong>contrato de prestação de serviço</strong>.
              </p>
            </>
          )}
          </div>
        </div>
      </section>

      {/* =========================================================
          RESUMO / VALOR TOTAL
      ========================================================== */}
      <section className="mb-16 flex justify-center px-4">
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

            <p className="mt-2 text-2xl md:text-3xl font-extrabold text-yellow-300 whitespace-nowrap">
              Total estimado: R$ {totalGeral.toFixed(2).replace(".", ",")}
            </p>
          </div>
            </div>
          </div>
        </div>
      </section>

      {/* =========================================================
          CONFIRMAR E IR PARA PAGAMENTO
      ========================================================== */}
      <section className="mb-16 flex justify-center px-4">
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

            <p className="text-center text-xs text-zinc-300">
              A confirmação implica concordância com os{" "}
              <strong>termos de uso</strong> e com o{" "}
              <strong>contrato de prestação de serviço</strong> da THouse Rec.
            </p>
          </div>
        </div>
      </section>

      {/* =========================================================
          DÚVIDAS / SUPORTE
      ========================================================== */}
      <section className="mb-16 flex justify-center px-4">
        <div className="relative w-full max-w-5xl border border-red-500" style={{ borderWidth: "1px" }}>
          <div
            className="relative space-y-4 p-6 md:p-8"
            style={{
              background: "linear-gradient(to right, rgba(0,0,0,0) 0%, rgba(0,0,0,0.75) 8%, rgba(0,0,0,0.85) 20%, rgba(0,0,0,0.85) 80%, rgba(0,0,0,0.75) 92%, rgba(0,0,0,0) 100%)",
              backdropFilter: "blur(16px)",
              WebkitBackdropFilter: "blur(16px)",
            }}
          >
            <h2 className="text-lg text-center font-semibold text-red-400" style={{ textShadow: "0 2px 4px rgba(0, 0, 0, 0.5)" }}>
              Ficou com alguma dúvida?
            </h2>

            <p className="text-sm text-center text-white md:text-base" style={{ textShadow: "0 2px 8px rgba(0, 0, 0, 0.8)" }}>
              Se ainda restar alguma dúvida sobre horários, valores, planos ou
              funcionamento do estúdio, você pode consultar o FAQ ou falar
              diretamente com a gente.
            </p>

            <div className="flex flex-wrap justify-center gap-4 text-sm">
              <a
                href="/faq"
                className="rounded-full border border-red-600 px-6 py-3 text-sm font-semibold text-red-300 hover:border-red-400 hover:text-red-200 hover:bg-red-600/10 transition-all"
                style={{ textShadow: "0 2px 4px rgba(0, 0, 0, 0.5)" }}
              >
                Ver FAQ
              </a>

              <a
                href="/chat"
                className="rounded-full border border-red-600 px-6 py-3 text-sm font-semibold text-red-300 hover:border-red-400 hover:text-red-200 hover:bg-red-600/10 transition-all"
                style={{ textShadow: "0 2px 4px rgba(0, 0, 0, 0.5)" }}
              >
                Suporte via Chat
              </a>
            </div>

            <div className="mt-4 text-center">
              <a
                href="/contato"
                className="text-xs text-zinc-300 underline-offset-4 hover:text-red-300 hover:underline transition-colors"
              >
                Contato direto
              </a>
            </div>
          </div>
        </div>
      </section>
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
      <div>
        <p className="font-semibold text-zinc-100">{nome}</p>
        {subtitulo && (
          <p className="text-xs text-zinc-400">{subtitulo}</p>
        )}
        <p className="text-xs text-red-300">
          R$ {preco.toFixed(2).replace(".", ",")}
          {porHora && " / hora"}
        </p>
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

