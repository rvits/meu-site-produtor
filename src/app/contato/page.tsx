export default function ContatoPage() {
  return (
    <main className="mx-auto max-w-6xl px-6 py-16 text-zinc-100">
      {/* =========================================================
          TÍTULO
      ========================================================== */}
      <section className="mt-10 mb-20">
        <h1 className="text-center text-4xl font-bold text-red-500 md:text-5xl">
          Contato
        </h1>
      </section>

      {/* =========================================================
          TEXTO EXPLICATIVO
      ========================================================== */}
      <section className="mb-16">
        <p className="mx-auto max-w-6xl text-center text-sm leading-loose text-zinc-300 md:text-base">
          A área de contato da THouse Rec existe para facilitar a comunicação
          direta entre artistas e o estúdio. Utilize este espaço para tirar
          dúvidas, solicitar orçamentos, alinhar projetos ou tratar de assuntos
          relacionados a serviços, agendamentos e parcerias. Todo contato deve
          ser feito de forma respeitosa, considerando os termos de uso e o
          contrato de prestação de serviço do estúdio. Essas diretrizes garantem
          uma relação profissional, organizada e clara para ambas as partes.
          <br /><br />
          O atendimento acontece exclusivamente dentro do horário de
          funcionamento do estúdio. Mensagens enviadas fora desse período serão
          respondidas assim que possível, dentro do expediente. O responsável
          pelo estúdio não possui obrigação de responder contatos fora do
          horário de funcionamento.
        </p>
      </section>

      {/* =========================================================
          CAIXA DE CONTATO
      ========================================================== */}
      <section className="mt-10 mb-16">
        <div className="mx-auto max-w-xl space-y-6 rounded-2xl border border-red-700/40 bg-zinc-950 p-8 text-center">
          <h2 className="text-xl font-semibold text-red-400">
            Informações de contato
          </h2>

          <div className="space-y-3 text-sm text-zinc-300 md:text-base">
            <p>
              ✉️ E-mail:{" "}
              <strong className="text-zinc-100">
                tremv03021@gmail.com
              </strong>
            </p>

            <p>
              📱 WhatsApp:{" "}
              <strong className="text-zinc-100">
                +55 (21) 99129-2544
              </strong>
            </p>

            <p>
              📍 Cidade / Região:{" "}
              <strong className="text-zinc-100">
                Rio de Janeiro (RJ) — Botafogo
              </strong>
            </p>
          </div>
        </div>
      </section>

      {/* =========================================================
          TEXTO DE AGRADECIMENTO
      ========================================================== */}
      <section>
        <p className="mx-auto max-w-5xl text-center text-sm leading-relaxed text-zinc-300 md:text-base">
          A THouse Rec agradece pela confiança, pela escolha e pela
          oportunidade de estar sendo considerada para qualquer tipo de
          serviço. Cada contato representa uma chance de construir algo único,
          com dedicação, cuidado e respeito pela música e pela trajetória de
          cada artista.
          <br /><br />
          Será um prazer conversar, entender suas ideias e, se fizer sentido
          para ambos os lados, transformar essa troca em trabalho, som e
          identidade.
        </p>
      </section>
    </main>
  );
}
