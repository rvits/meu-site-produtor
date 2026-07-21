import { redirect } from "next/navigation";

/** GO-03A — rota legada. Serviços Selecionados agora vivem em /admin/servicos-selecionados. */
export default function AdminServicosSolicitadosLegacyRedirect() {
  redirect("/admin/servicos-selecionados/todos");
}
