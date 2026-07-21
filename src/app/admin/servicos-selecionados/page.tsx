import { Suspense } from "react";
import { ServicosBoard } from "@/app/admin/servicos-ui/ServicosBoard";
import { BoardSkeleton } from "@/app/admin/servicos-ui/States";

/** GO-03A — Serviços Selecionados (visão "Todos"). */
export default function AdminServicosSelecionadosPage() {
  return (
    <Suspense fallback={<BoardSkeleton />}>
      <ServicosBoard variant="selecionados" status="todos" />
    </Suspense>
  );
}
