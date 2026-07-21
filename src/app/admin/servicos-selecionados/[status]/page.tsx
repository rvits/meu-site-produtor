import { Suspense } from "react";
import { notFound } from "next/navigation";
import { ServicosBoard } from "@/app/admin/servicos-ui/ServicosBoard";
import { BoardSkeleton } from "@/app/admin/servicos-ui/States";
import { STATUS_BY_SLUG } from "@/app/admin/servicos-ui/meta";

/**
 * GO-03A — Serviços Selecionados por status:
 * /admin/servicos-selecionados/todos|pendentes|aceitos|em-andamento|concluidos|cancelados|recusados
 * Mesma arquitetura e componente dos Serviços Gerais.
 */
export default async function AdminServicosSelecionadosStatusPage({
  params,
}: {
  params: Promise<{ status: string }>;
}) {
  const { status } = await params;
  const meta = STATUS_BY_SLUG.get(status);
  if (!meta) notFound();
  return (
    <Suspense fallback={<BoardSkeleton />}>
      <ServicosBoard variant="selecionados" status={meta.key} />
    </Suspense>
  );
}
