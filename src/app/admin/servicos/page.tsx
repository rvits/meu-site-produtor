import { redirect } from "next/navigation";

/** HS-02B: página paralela removida — Serviços Gerais = /admin/servicos-aceitos */
export default function AdminServicosLegacyRedirect() {
  redirect("/admin/servicos-aceitos");
}
