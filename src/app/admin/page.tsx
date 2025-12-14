export default function AdminDashboard() {
  return (
    <>
      <h1 className="mb-6 text-3xl font-bold text-red-400">
        Painel Administrativo
      </h1>

      <p className="mb-8 text-zinc-300">
        Gerencie agendamentos, planos, usuários, pagamentos e comunicação da THouse Rec.
      </p>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {[
          { label: "Agendamentos", desc: "Sessões e horários" },
          { label: "Pagamentos", desc: "Concluídos e pendentes" },
          { label: "Usuários", desc: "Clientes e permissões" },
          { label: "Serviços", desc: "Serviços e valores" },
          { label: "Planos", desc: "Planos ativos" },
          { label: "Chat", desc: "Atendimentos humanos" },
        ].map((c) => (
          <div
            key={c.label}
            className="rounded-xl border border-zinc-800 bg-zinc-900 p-5"
          >
            <h2 className="font-semibold">{c.label}</h2>
            <p className="mt-1 text-xs text-zinc-400">{c.desc}</p>
          </div>
        ))}
      </div>
    </>
  );
}
