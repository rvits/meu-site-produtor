"use client";

import { useState } from "react";
import Link from "next/link";
import { useAuth } from "@/app/context/AuthContext";
import ProfessionalBox from "@/app/components/ProfessionalBox";

// ID do vídeo do YouTube - Substitua pelo ID real do vídeo
// Para obter o ID: pegue a URL do YouTube (ex: https://www.youtube.com/watch?v=VIDEO_ID)
// e use apenas a parte após "v=" (antes do primeiro & se houver)
const YOUTUBE_VIDEO_ID = "UPY_DfdiGK4"; // ID do vídeo (apenas a parte após v=)

/* =========================
   SERVICO CARD
========================= */
type ServicoCardProps = {
  titulo: string;
  preco: string;
  subtitulo?: string;
  destaque?: boolean;
};

function ServicoCard({
  titulo,
  preco,
  subtitulo,
  destaque = false,
}: ServicoCardProps) {
  return (
    <Link
      href="/agendamento"
      className={
        "flex min-h-[120px] flex-col items-center justify-center rounded-xl border p-4 text-center transition-all cursor-pointer " +
        (destaque
          ? "border-red-500/60 bg-black/60 backdrop-blur-sm shadow-[0_0_20px_rgba(239,68,68,0.3)]"
          : "border-red-700/40 bg-black/50 backdrop-blur-sm hover:border-red-500/60 hover:bg-black/70")
      }
      style={{
        textShadow: "0 2px 4px rgba(0, 0, 0, 0.5)",
      }}
    >
      <p className="text-sm font-medium text-white">{titulo}</p>
      {subtitulo && <p className="text-xs text-zinc-300">{subtitulo}</p>}
      <p className="mt-1 text-xl font-bold text-red-400">{preco}</p>
    </Link>
  );
}

/* =========================
   PLANOS
========================= */
type Plano = {
  id: string;
  nome: string;
  mensal: number;
  anual: number;
  descricao: string;
  beneficios: { label: string; included: boolean; useTilde?: boolean }[];
};

const PLANOS: Plano[] = [
  {
    id: "bronze",
    nome: "Plano Bronze",
    mensal: 197.00,
    anual: 1970.00,
    descricao: "Para quem está começando a gravar com frequência.",
    beneficios: [
      { label: "2h de captação por mês", included: true },
      { label: "1 Mix & Master", included: true },
      { label: "10% de desconto em serviços avulsos", included: true },
      { label: "Sem beats personalizados", included: false },
      { label: "Sem acesso a descontos promocionais", included: false },
      { label: "Não possui acompanhamento artístico", included: false },
    ],
  },
  {
    id: "prata",
    nome: "Plano Prata",
    mensal: 347.00,
    anual: 3470.00,
    descricao: "Para artistas que gravam com regularidade e já possuem músicas próprias.",
    beneficios: [
      { label: "2h de captação por mês", included: true },
      { label: "2 Mix & Master por mês", included: true },
      { label: "1 Beat por mês", included: true },
      { label: "Acesso a descontos promocionais do site", included: true },
      { label: "Prioridade intermediária", included: true, useTilde: true },
      { label: "Não tem desconto em serviços ou beats", included: false },
      { label: "Não tem acompanhamento artístico", included: false },
    ],
  },
  {
    id: "ouro",
    nome: "Plano Ouro",
    mensal: 547.00,
    anual: 5470.00,
    descricao: "Acompanhamento profissional contínuo com TremV e 1 Produção completa por mês.",
    beneficios: [
      { label: "4 horas de captação por mês", included: true },
      { label: "2 mix & master por mês", included: true },
      { label: "2 Beat", included: true },
      { label: "Desconto de 10% em serviços avulsos", included: true },
      { label: "Desconto de 10% em beats", included: true },
      { label: "Acesso a descontos promocionais do site", included: true },
      { label: "Acompanhamento artístico", included: true },
    ],
  },
];

export default function Home() {
  const { user } = useAuth();
  const [modoPlano, setModoPlano] = useState<"mensal" | "anual">("mensal");

  return (
    <main className="mx-auto max-w-6xl px-4 sm:px-6 py-6 sm:py-10 text-zinc-100 overflow-x-hidden">

        {/* =========================================================
            INTRODUÇÃO / HERO
        ========================================================== */}
        <section
          id="inicio"
          className="flex min-h-[calc(100vh-72px)] items-center justify-center text-center pt-[72px]"
        >
          <div className="w-full max-w-7xl space-y-5 px-6">

            {/* TÍTULO */}
            <h1 className="text-5xl sm:text-6xl md:text-6xl lg:text-8xl xl:text-9xl font-extrabold tracking-tight" style={{ textShadow: "0 4px 20px rgba(0, 0, 0, 0.8), 0 2px 10px rgba(239, 68, 68, 0.3)" }}>
              <span className="text-red-500">T</span>House Rec
            </h1>

            {/* TEXTO DE SERVIÇOS - SEM FUNDO */}
            <div className="mt-4 text-center">
              <p 
                className="text-xs sm:text-sm md:text-base uppercase tracking-[0.2em] sm:tracking-[0.35em] text-red-500 font-bold leading-relaxed inline-block px-2"
                style={{ 
                  textShadow: "0 2px 8px rgba(0, 0, 0, 0.8), 0 4px 12px rgba(0, 0, 0, 0.6)",
                  fontWeight: 700
                }}
              >
                ESTÚDIO • PRODUÇÃO • MIX &amp; MASTER • SONOPLASTIA • BEATMAKING
              </p>
            </div>

            {/* TEXTO DESCRITIVO SEM BOX */}
            <section className="mt-6 sm:mt-8 md:mt-10 flex justify-center px-2 sm:px-4">
              <p className="text-center text-xs sm:text-sm md:text-base leading-relaxed text-zinc-300 px-4 max-w-4xl" style={{ textShadow: "0 2px 8px rgba(0, 0, 0, 0.8)" }}>
                      Crie sua música com identidade e qualidade profissional em um estúdio pensado para artistas independentes.
                    </p>
            </section>
          </div>
        </section>

        {/* INTRODUÇÃO EM CAIXA */}
        <section className="mt-6 md:mt-16 flex justify-center px-4">
          <ProfessionalBox>
            {/* Versão Mobile: 8 parágrafos separados */}
            <div className="space-y-3 md:hidden text-xs leading-relaxed text-white" style={{ textShadow: "0 2px 8px rgba(0, 0, 0, 0.8)" }}>
              <p>
                A THouse Rec é o estúdio independente criado por Victor Pereira Ramos — o <strong className="text-red-400">Tremv</strong> — produtor musical, artista e engenheiro de áudio nascido em Botafogo, no Rio de Janeiro.
              </p>

              <p>
                Sua trajetória começou nas batalhas de rima, rodas de freestyle e na cena independente, explorando o FL Studio e construindo uma estética própria.
              </p>

              <p>
                Além da vivência prática, Victor está cursando <strong className="text-red-400">Produção Fonográfica (bacharelado) na Estácio</strong>, atualmente no <strong className="text-red-400">5º período</strong>, com previsão de formatura para <strong className="text-red-400">dezembro de 2026</strong>.
              </p>

              <p>
                Essa formação acadêmica se soma à experiência de estúdio, trazendo uma base técnica sólida para cada projeto que passa pela THouse Rec.
              </p>

              <p>
                Com o tempo, Tremv passou a produzir artistas, mixar, masterizar, trabalhar com sonoplastia e desenvolver uma visão completa de projeto: do beat a música finalizada.
              </p>

              <p>
                O estúdio nasceu para ser um espaço criativo, acessível e profissional, onde cada artista é tratado com atenção e cuidado.
              </p>

              <p>
                Hoje, a THouse Rec reúne produções lançadas no YouTube, Spotify e SoundCloud, direção de shows, trabalhos como mestre de cerimônia e consultorias musicais.
              </p>

              <p>
                A ideia é simples: transformar suas referências e ideias em sons que tenham força, sentimento e qualidade de lançamento.
              </p>
            </div>

            {/* Versão Desktop: 3 parágrafos agrupados */}
            <div className="hidden md:block space-y-1.5 text-sm leading-relaxed text-white text-base" style={{ textShadow: "0 2px 8px rgba(0, 0, 0, 0.8)" }}>
              <p>
                A THouse Rec é o estúdio independente criado por Victor Pereira Ramos — o <strong className="text-red-400">Tremv</strong> — produtor musical, artista e engenheiro de áudio nascido em Botafogo, no Rio de Janeiro. Sua trajetória começou nas batalhas de rima, rodas de freestyle e na cena independente, explorando o FL Studio e construindo uma estética própria. Além da vivência prática, Victor está cursando <strong className="text-red-400">Produção Fonográfica (bacharelado) na Estácio</strong>, atualmente no <strong className="text-red-400">5º período</strong>, com previsão de formatura para <strong className="text-red-400">dezembro de 2026</strong>.
              </p>

              <p>
                Essa formação acadêmica se soma à experiência de estúdio, trazendo uma base técnica sólida para cada projeto que passa pela THouse Rec. Com o tempo, Tremv passou a produzir artistas, mixar, masterizar, trabalhar com sonoplastia e desenvolver uma visão completa de projeto: do beat a música finalizada. O estúdio nasceu para ser um espaço criativo, acessível e profissional, onde cada artista é tratado com atenção e cuidado.
              </p>

              <p>
                Hoje, a THouse Rec reúne produções lançadas no YouTube, Spotify e SoundCloud, direção de shows, trabalhos como mestre de cerimônia e consultorias musicais. A ideia é simples: transformar suas referências e ideias em sons que tenham força, sentimento e qualidade de lançamento.
              </p>
            </div>
          </ProfessionalBox>
        </section>

          {/* =========================================================
              VÍDEO - CLIPE DO ARTISTA
          ========================================================== */}
        <section className="mt-10 flex justify-center px-4">
          <div className="flex flex-col items-center space-y-4 w-full max-w-5xl">
            <h2 className="text-base md:text-lg font-bold uppercase tracking-[0.15em] text-red-400" style={{ textShadow: "0 2px 8px rgba(239, 68, 68, 0.5)" }}>
              Reprogramação — Dizzy (Prod. Tremv)
            </h2>

            <div className="aspect-video w-full max-w-5xl overflow-hidden rounded-xl border border-red-500 bg-zinc-900" style={{ borderWidth: "1px" }}>
              {YOUTUBE_VIDEO_ID ? (
                <iframe
                  src={`https://www.youtube.com/embed/${YOUTUBE_VIDEO_ID}?rel=0&modestbranding=1&playsinline=1`}
                  title="Clipe THouse Rec - Reprogramação — Dizzy (Prod. Tremv)"
                  className="h-full w-full"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                  allowFullScreen
                  loading="lazy"
                  style={{ border: "none" }}
                />
              ) : (
                <div className="flex h-full items-center justify-center text-zinc-400">
                  <div className="text-center">
                    <p className="text-lg font-semibold mb-2">Vídeo não configurado</p>
                    <p className="text-sm">Configure o ID do vídeo do YouTube no arquivo page.tsx</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </section>

        {/* =========================================================
            TEXTO EXPLICATIVO ANTES DOS SERVIÇOS
        ========================================================== */}
        <section className="mt-10 mb-16 flex justify-center px-4">
          <div className="relative w-full max-w-5xl border border-red-500" style={{ borderWidth: "1px" }}>
            <div
              className="relative p-6 md:p-8"
              style={{
                background:
                  "linear-gradient(to right, rgba(0,0,0,0) 0%, rgba(0,0,0,0.75) 8%, rgba(0,0,0,0.85) 20%, rgba(0,0,0,0.85) 80%, rgba(0,0,0,0.75) 92%, rgba(0,0,0,0) 100%)",
                backdropFilter: "blur(16px)",
                WebkitBackdropFilter: "blur(16px)",
              }}
            >
              <p className="text-xs md:text-sm leading-relaxed text-white md:text-base text-justify md:text-left px-4 md:px-0" style={{ textShadow: "0 2px 8px rgba(0, 0, 0, 0.8)" }}>
            Você pode contratar serviços avulsos ou combinar diferentes etapas da produção para montar a sessão ideal: captação, mix, master, sonoplastia e beats. Cada item pode ser usado separadamente ou em conjunto, dependendo da fase em que o seu som está e do tipo de suporte que você precisa no estúdio.
          </p>
            </div>
          </div>
        </section>

        {/* =========================================================
            CAIXA: SERVIÇOS DE ESTÚDIO
        ========================================================== */}
        {/* SERVIÇOS DE ESTÚDIO */}
        <section className="mb-16 flex justify-center px-4">
          <div className="relative w-full max-w-5xl">
            <div
              className="relative space-y-8 p-6 md:p-8 border border-red-500"
              style={{
                background:
                  "linear-gradient(to right, rgba(0,0,0,0) 0%, rgba(0,0,0,0.75) 8%, rgba(0,0,0,0.85) 20%, rgba(0,0,0,0.85) 80%, rgba(0,0,0,0.75) 92%, rgba(0,0,0,0) 100%)",
                backdropFilter: "blur(16px)",
                WebkitBackdropFilter: "blur(16px)",
                borderWidth: "1px",
              }}
            >
              <h2 className="text-center text-xl font-semibold text-red-400 mb-6" style={{ textShadow: "0 2px 4px rgba(0, 0, 0, 0.5)" }}>
              Serviços de Estúdio
            </h2>

            {/* LINHA 1 */}
            <div className="grid grid-cols-3 gap-3 md:gap-6">
              <Link href="/agendamento" className="flex min-h-[110px] flex-col items-center justify-center rounded-xl border border-red-700/40 bg-black/50 backdrop-blur-sm p-3 md:p-4 text-center transition-all hover:border-red-500/60 hover:bg-black/70 cursor-pointer" style={{ textShadow: "0 2px 4px rgba(0, 0, 0, 0.5)" }}>
                <p className="text-xs md:text-sm font-medium text-white">Sessão</p>
                <p className="mt-1 text-base md:text-xl font-bold text-red-400">R$ 40 / h</p>
              </Link>

              <Link href="/agendamento" className="flex min-h-[110px] flex-col items-center justify-center rounded-xl border border-red-700/40 bg-black/50 backdrop-blur-sm p-3 md:p-4 text-center transition-all hover:border-red-500/60 hover:bg-black/70 cursor-pointer" style={{ textShadow: "0 2px 4px rgba(0, 0, 0, 0.5)" }}>
                <p className="text-xs md:text-sm font-medium text-white">Captação</p>
                <p className="mt-1 text-base md:text-xl font-bold text-red-400">R$ 50 / h</p>
              </Link>

              <Link href="/agendamento" className="flex min-h-[110px] flex-col items-center justify-center rounded-xl border border-red-700/40 bg-black/50 backdrop-blur-sm p-3 md:p-4 text-center transition-all hover:border-red-500/60 hover:bg-black/70 cursor-pointer" style={{ textShadow: "0 2px 4px rgba(0, 0, 0, 0.5)" }}>
                <p className="text-xs md:text-sm font-medium text-white">Mixagem</p>
                <p className="mt-1 text-base md:text-xl font-bold text-red-400">R$ 110</p>
              </Link>
            </div>

            {/* LINHA 2 */}
            <div className="grid grid-cols-3 gap-3 md:gap-6">
              <Link href="/agendamento" className="flex min-h-[110px] flex-col items-center justify-center rounded-xl border border-red-700/40 bg-black/50 backdrop-blur-sm p-3 md:p-4 text-center transition-all hover:border-red-500/60 hover:bg-black/70 cursor-pointer" style={{ textShadow: "0 2px 4px rgba(0, 0, 0, 0.5)" }}>
                <p className="text-xs md:text-sm font-medium text-white">Masterização</p>
                <p className="mt-1 text-base md:text-xl font-bold text-red-400">R$ 60</p>
              </Link>

              <Link href="/agendamento" className="flex min-h-[110px] flex-col items-center justify-center rounded-xl border border-red-700/40 bg-black/50 backdrop-blur-sm p-3 md:p-4 text-center transition-all hover:border-red-500/60 hover:bg-black/70 cursor-pointer" style={{ textShadow: "0 2px 4px rgba(0, 0, 0, 0.5)" }}>
                <p className="text-xs md:text-sm font-medium text-white">Mix + Master</p>
                <p className="mt-1 text-base md:text-xl font-bold text-red-400">R$ 160</p>
              </Link>

              <Link href="/agendamento" className="flex min-h-[110px] flex-col items-center justify-center rounded-xl border border-red-700/40 bg-black/50 backdrop-blur-sm p-3 md:p-4 text-center transition-all hover:border-red-500/60 hover:bg-black/70 cursor-pointer" style={{ textShadow: "0 2px 4px rgba(0, 0, 0, 0.5)" }}>
                <p className="text-xs md:text-sm font-medium text-white">Sonoplastia</p>
                <p className="text-[10px] md:text-xs text-zinc-300">(a partir de)</p>
                <p className="mt-1 text-base md:text-xl font-bold text-red-400">R$ 320</p>
              </Link>
            </div>
            </div>
          </div>
        </section>

        {/* =========================================================
            CAIXA: BEATS E PACOTES
        ========================================================== */}
        <section className="mb-16 flex justify-center px-4">
          <div className="relative w-full max-w-5xl">
            <div
              className="relative space-y-8 p-6 md:p-8 border border-red-500"
              style={{
                background:
                  "linear-gradient(to right, rgba(0,0,0,0) 0%, rgba(0,0,0,0.75) 8%, rgba(0,0,0,0.85) 20%, rgba(0,0,0,0.85) 80%, rgba(0,0,0,0.75) 92%, rgba(0,0,0,0) 100%)",
                backdropFilter: "blur(16px)",
                WebkitBackdropFilter: "blur(16px)",
                borderWidth: "1px",
              }}
            >
              <h2 className="text-center text-xl font-semibold text-red-400 mb-6" style={{ textShadow: "0 2px 4px rgba(0, 0, 0, 0.5)" }}>
              Beats e Pacotes Especiais
            </h2>

            {/* LINHA 1 */}
            <div className="grid grid-cols-3 gap-3 md:gap-6">
              {/* 1 beat */}
              <Link href="/agendamento" className="flex min-h-[110px] flex-col items-center justify-center rounded-xl border border-red-700/40 bg-black/50 backdrop-blur-sm p-3 md:p-4 text-center transition-all hover:border-red-500/60 hover:bg-black/70 cursor-pointer" style={{ textShadow: "0 2px 4px rgba(0, 0, 0, 0.5)" }}>
                <p className="text-xs md:text-sm font-medium text-white">1 Beat</p>
                <p className="mt-1 text-base md:text-xl font-bold text-red-400">R$ 150</p>
              </Link>

              {/* 2 beats */}
              <Link href="/agendamento" className="flex min-h-[110px] flex-col items-center justify-center rounded-xl border border-red-700/40 bg-black/50 backdrop-blur-sm p-3 md:p-4 text-center transition-all hover:border-red-500/60 hover:bg-black/70 cursor-pointer" style={{ textShadow: "0 2px 4px rgba(0, 0, 0, 0.5)" }}>
                <p className="text-xs md:text-sm font-medium text-white">2 Beats</p>
                <p className="mt-1 text-base md:text-xl font-bold text-red-400">R$ 250</p>
              </Link>

              {/* 3 beats */}
              <Link href="/agendamento" className="flex min-h-[110px] flex-col items-center justify-center rounded-xl border border-red-700/40 bg-black/50 backdrop-blur-sm p-3 md:p-4 text-center transition-all hover:border-red-500/60 hover:bg-black/70 cursor-pointer" style={{ textShadow: "0 2px 4px rgba(0, 0, 0, 0.5)" }}>
                <p className="text-xs md:text-sm font-medium text-white">3 Beats</p>
                <p className="mt-1 text-base md:text-xl font-bold text-red-400">R$ 350</p>
              </Link>
            </div>

            {/* LINHA 2 */}
            <div className="grid grid-cols-3 gap-3 md:gap-6">
              {/* 4 beats */}
              <Link href="/agendamento" className="flex min-h-[110px] flex-col items-center justify-center rounded-xl border border-red-700/40 bg-black/50 backdrop-blur-sm p-3 md:p-4 text-center transition-all hover:border-red-500/60 hover:bg-black/70 cursor-pointer" style={{ textShadow: "0 2px 4px rgba(0, 0, 0, 0.5)" }}>
                <p className="text-xs md:text-sm font-medium text-white">4 Beats</p>
                <p className="mt-1 text-base md:text-xl font-bold text-red-400">R$ 400</p>
              </Link>

              {/* beat + mix + master */}
              <Link href="/agendamento" className="flex min-h-[110px] flex-col items-center justify-center rounded-xl border border-red-700/40 bg-black/50 backdrop-blur-sm p-3 md:p-4 text-center transition-all hover:border-red-500/60 hover:bg-black/70 cursor-pointer" style={{ textShadow: "0 2px 4px rgba(0, 0, 0, 0.5)" }}>
                <p className="text-xs md:text-sm font-medium text-white">
                  Beat + Mix + Master
                </p>
                <p className="mt-1 text-base md:text-xl font-bold text-red-400">R$ 280</p>
              </Link>

              {/* produção completa */}
              <Link href="/agendamento" className="flex min-h-[110px] flex-col items-center justify-center rounded-xl border border-red-700/40 bg-black/50 backdrop-blur-sm p-3 md:p-4 text-center transition-all hover:border-red-500/60 hover:bg-black/70 cursor-pointer" style={{ textShadow: "0 2px 4px rgba(0, 0, 0, 0.5)" }}>
                <p className="text-xs md:text-sm font-medium text-white">
                  Produção Completa
                </p>
                <p className="mt-1 text-base md:text-xl font-bold text-red-400">R$ 400</p>
                <p className="mt-1 text-[10px] md:text-xs text-zinc-300">
                  4h captação + beat + mix + master
                </p>
              </Link>
            </div>
            </div>
          </div>
        </section>

        {/* =========================================================
            LEMBRETE IMPORTANTE
        ========================================================== */}
        <section className="mb-16 flex justify-center px-4">
          <div className="relative w-full max-w-5xl border border-yellow-500" style={{ borderWidth: "1px" }}>
            <div
              className="relative p-6 md:p-8"
              style={{
                background:
                  "linear-gradient(to right, rgba(0,0,0,0) 0%, rgba(0,0,0,0.75) 8%, rgba(0,0,0,0.85) 20%, rgba(0,0,0,0.85) 80%, rgba(0,0,0,0.75) 92%, rgba(0,0,0,0) 100%)",
                backdropFilter: "blur(16px)",
                WebkitBackdropFilter: "blur(16px)",
              }}
            >
              <p className="text-xs md:text-sm leading-relaxed text-yellow-100 md:text-base text-justify md:text-left px-2 md:px-0" style={{ textShadow: "0 2px 8px rgba(0, 0, 0, 0.8)" }}>
                <strong className="text-yellow-300">Lembrete importante:</strong> o agendamento só é liberado após o pagamento da sessão ou da captação. Para serviços de beats, mix e master, você terá acesso a uma área do usuário (em desenvolvimento) para acompanhar prazos, pagamentos, andamento do projeto e download dos arquivos finalizados.
            </p>
            </div>
          </div>
        </section>

        {/* =========================================================
            PLANOS — COM TOGGLE MENSAL / ANUAL
        ========================================================== */}
        <section id="planos" className="mb-16 flex justify-center px-4">
          <div className="relative w-full max-w-5xl">
            <div
              className="relative space-y-6 p-6 md:p-8 border border-red-500"
              style={{
                background:
                  "linear-gradient(to right, rgba(0,0,0,0) 0%, rgba(0,0,0,0.75) 8%, rgba(0,0,0,0.85) 20%, rgba(0,0,0,0.85) 80%, rgba(0,0,0,0.75) 92%, rgba(0,0,0,0) 100%)",
                backdropFilter: "blur(16px)",
                WebkitBackdropFilter: "blur(16px)",
                borderWidth: "1px",
              }}
            >
              <h2 className="text-center text-xl font-semibold text-red-400 mb-6" style={{ textShadow: "0 2px 4px rgba(0, 0, 0, 0.5)" }}>
              Quer aprofundar e produzir com frequência?
            </h2>

              <p className="mx-auto max-w-3xl text-center text-sm text-white md:text-base" style={{ textShadow: "0 2px 8px rgba(0, 0, 0, 0.8)" }}>
              Os planos da THouse Rec foram pensados para artistas que desejam
              manter uma rotina de lançamentos, garantir prioridade na agenda e
              ter o melhor custo-benefício em relação aos serviços avulsos.
            </p>

            {/* Toggle Mensal / Anual */}
            <div className="flex justify-center">
              <div className="inline-flex rounded-full border border-red-700/60 bg-black/60 backdrop-blur-sm p-1 text-xs" style={{ boxShadow: "0 2px 10px rgba(239, 68, 68, 0.2)" }}>
                <button
                  type="button"
                  onClick={() => setModoPlano("mensal")}
                  className={`rounded-full px-4 py-1 font-semibold transition-all ${
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
                  className={`rounded-full px-4 py-1 font-semibold transition-all ${
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
                  ? "border-amber-600/60" 
                  : plano.id === "prata" 
                  ? "border-gray-400/60" 
                  : "border-yellow-400/60";
                const hoverBorderColor = plano.id === "bronze"
                  ? "hover:border-amber-500/80"
                  : plano.id === "prata"
                  ? "hover:border-gray-300/80"
                  : "hover:border-yellow-300/80";

                return (
                  <div
                    key={plano.id}
                    className={`flex h-full flex-col rounded-2xl border ${borderColor} bg-black/50 backdrop-blur-sm p-6 transition-all ${hoverBorderColor} hover:bg-black/70`}
                    style={{ textShadow: "0 2px 4px rgba(0, 0, 0, 0.5)", borderWidth: "1px" }}
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
                        const isPriorityIntermediate = b.label === "Prioridade intermediária" && b.included;
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
                      className="mt-auto inline-block rounded-full border border-red-600 px-4 py-2 text-center text-sm font-semibold text-red-300 hover:bg-red-600/20"
                    >
                      Ver este plano em detalhes
                    </a>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Aviso sobre termos de uso e contrato */}
            <p className="mt-4 md:mt-6 text-center text-xs text-zinc-400 max-w-4xl mx-auto px-4">
              A confirmação implica concordância com os{" "}
              <a href="/termos-contratos" className="!text-blue-400 underline underline-offset-2 hover:!text-blue-300 transition-colors" style={{ color: '#60a5fa' }}>termos de uso</a> e com o{" "}
              <a href="/termos-contratos" className="!text-blue-400 underline underline-offset-2 hover:!text-blue-300 transition-colors" style={{ color: '#60a5fa' }}>contrato de prestação de serviço</a> da THouse Rec.
            </p>
            </div>
          </div>
        </section>

        {/* =========================================================
            SHOPPING
        ========================================================== */}
        <section className="mb-16 flex justify-center px-4">
          <div className="relative w-full max-w-5xl border border-red-500" style={{ borderWidth: "1px" }}>
            <div
              className="relative space-y-6 p-6 md:p-8"
              style={{
                background:
                  "linear-gradient(to right, rgba(0,0,0,0) 0%, rgba(0,0,0,0.75) 8%, rgba(0,0,0,0.85) 20%, rgba(0,0,0,0.85) 80%, rgba(0,0,0,0.75) 92%, rgba(0,0,0,0) 100%)",
                backdropFilter: "blur(16px)",
                WebkitBackdropFilter: "blur(16px)",
              }}
            >
              <h2 className="text-center text-2xl md:text-3xl font-semibold text-red-400 mb-6" style={{ textShadow: "0 2px 4px rgba(0, 0, 0, 0.5)" }}>
            Loja Digital THouse Rec (em desenvolvimento)
          </h2>

              <div className="space-y-4">
                <p className="text-xs md:text-sm leading-relaxed text-white md:text-base text-justify md:text-center px-4 md:px-0" style={{ textShadow: "0 2px 8px rgba(0, 0, 0, 0.8)" }}>
              Em breve você poderá adquirir camisetas, moletons, bonés e outros itens personalizados exclusivos da THouse Rec.
            </p>

                <p className="text-xs md:text-sm leading-relaxed text-white md:text-base text-justify md:text-center px-4 md:px-0" style={{ textShadow: "0 2px 8px rgba(0, 0, 0, 0.8)" }}>
                  A aba <strong className="text-red-300">Shopping</strong> está em construção e será atualizada conforme os produtos forem lançados, sempre alinhados à estética e à identidade do estúdio.
            </p>
              </div>

              <div className="flex justify-center">
                <a
                  href="/shopping"
                  className="max-w-2xl w-full rounded-full bg-red-600 py-3 text-base font-semibold text-white text-center hover:bg-red-500 transition-all"
                  style={{ textShadow: "0 2px 4px rgba(0, 0, 0, 0.5)" }}
                >
                  Acessar Shopping
                </a>
              </div>
            </div>
            {/* Linha vermelha inferior */}
            <div
              className="h-[1px] w-full"
              style={{
                background: "rgba(239, 68, 68, 0.6)",
                boxShadow: "0 1px 10px rgba(239, 68, 68, 0.4)",
              }}
            />
          </div>
        </section>

        {/* =========================================================
            CHAMADA FINAL
        ========================================================== */}
        <section className="mb-16 flex justify-center px-4">
          <div className="relative w-full max-w-5xl border border-red-500" style={{ borderWidth: "1px" }}>
            <div
              className="relative space-y-6 p-6 md:p-8"
              style={{
                background:
                  "linear-gradient(to right, rgba(0,0,0,0) 0%, rgba(0,0,0,0.75) 8%, rgba(0,0,0,0.85) 20%, rgba(0,0,0,0.85) 80%, rgba(0,0,0,0.75) 92%, rgba(0,0,0,0) 100%)",
                backdropFilter: "blur(16px)",
                WebkitBackdropFilter: "blur(16px)",
              }}
            >
              <h2 className="text-center text-2xl md:text-3xl font-semibold text-red-400 mb-4" style={{ textShadow: "0 2px 4px rgba(0, 0, 0, 0.5)" }}>
            Pronto para começar sua próxima faixa?
          </h2>

              <p className="mx-auto max-w-5xl text-xs md:text-sm leading-relaxed text-white md:text-base mb-6 px-4 md:px-8 text-justify md:text-center" style={{ textShadow: "0 2px 8px rgba(0, 0, 0, 0.8)" }}>
            A THouse Rec existe para transformar ideias em música real. Se você tem um projeto, um verso, um beat ou apenas vontade de começar, esse pode ser o momento perfeito para dar o próximo passo com estrutura, apoio e qualidade de estúdio.
          </p>

              <div className="flex justify-center">
                <a
                  href="/agendamento"
                  className="max-w-2xl w-full rounded-full bg-red-600 py-3 text-base font-semibold text-white text-center hover:bg-red-500 transition-all"
                  style={{ textShadow: "0 2px 4px rgba(0, 0, 0, 0.5)" }}
                >
                  Agendar sessão
                </a>
              </div>
            </div>
          </div>
        </section>

        {/* =========================================================
            DÚVIDAS / SUPORTE
        ========================================================== */}
        <section className="mb-16 flex justify-center px-4">
          <div className="relative w-full max-w-5xl border border-red-500" style={{ borderWidth: "1px" }}>
            <div
              className="relative space-y-6 p-6 md:p-8"
              style={{
                background:
                  "linear-gradient(to right, rgba(0,0,0,0) 0%, rgba(0,0,0,0.75) 8%, rgba(0,0,0,0.85) 20%, rgba(0,0,0,0.85) 80%, rgba(0,0,0,0.75) 92%, rgba(0,0,0,0) 100%)",
                backdropFilter: "blur(16px)",
                WebkitBackdropFilter: "blur(16px)",
              }}
            >
              <h2 className="text-center text-xl md:text-2xl font-semibold text-red-400 mb-4" style={{ textShadow: "0 2px 4px rgba(0, 0, 0, 0.5)" }}>
            Ficou com alguma dúvida?
          </h2>

              <p className="mx-auto max-w-5xl text-xs md:text-sm leading-relaxed text-white md:text-base mb-6 px-4 md:px-8 text-justify md:text-center" style={{ textShadow: "0 2px 8px rgba(0, 0, 0, 0.8)" }}>
            Se ainda restar alguma dúvida sobre sessões, prazos, valores ou questões técnicas, você pode consultar o FAQ ou falar diretamente com o suporte pelo chat. Estamos aqui para te ajudar a tirar o máximo proveito de cada sessão.
          </p>

              <div className="flex flex-wrap justify-center items-center gap-4">
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

            <a
              href="/contato"
                  className="rounded-full border border-red-600 px-6 py-3 text-sm font-semibold text-red-300 hover:border-red-400 hover:text-red-200 hover:bg-red-600/10 transition-all"
                  style={{ textShadow: "0 2px 4px rgba(0, 0, 0, 0.5)" }}
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
