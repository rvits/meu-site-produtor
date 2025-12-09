import Header from "../components/Header";

export default function ContatoPage() {
  return (
    <>
      <Header />
      <main className="mx-auto max-w-6xl px-6 py-10 text-zinc-100">
        <h1 className="mb-4 text-2xl font-semibold">Contato</h1>
        <p className="mb-6 text-sm text-zinc-300">
          Entre em contato com a THouse rec para dúvidas, orçamentos e
          parcerias.
        </p>

        <div className="space-y-3 text-sm text-zinc-300">
          <p>
            ✉️ E-mail: <strong>vicperra@gmail.com</strong>
          </p>
          <p>
            📱 WhatsApp: <strong>+55 (21) 99129-2544</strong>
          </p>
          <p>
            📍 Cidade/Região: <strong>Rio de Janeiro, RJ</strong>
          </p>
        </div>
      </main>
    </>
  );
}
