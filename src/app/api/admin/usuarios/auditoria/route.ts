import { NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";
import { requireAdmin } from "@/app/lib/auth";
import { adminAuditActorLabel } from "@/app/lib/admin-audit";

function denied(err: unknown) {
  const message = err instanceof Error ? err.message : "";
  if (message === "Acesso negado" || message === "Não autenticado") {
    return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
  }
  return null;
}

const ACTION_LABELS: Record<string, string> = {
  profile_update: "Cadastro alterado",
  cpf_edit_enabled: "Edição de CPF liberada para o usuário",
  cpf_edit_disabled: "Edição de CPF bloqueada",
  birth_date_edit_enabled: "Edição de nascimento liberada para o usuário",
  birth_date_edit_disabled: "Edição de nascimento bloqueada",
};

const FIELD_LABELS: Record<string, string> = {
  nomeCompleto: "Nome completo",
  nomeArtistico: "Nome artístico",
  nomeSocial: "Nome social",
  telefone: "Telefone",
  pais: "País",
  estado: "Estado",
  cidade: "Cidade",
  bairro: "Bairro",
  cep: "CEP",
  cpf: "CPF",
  dataNascimento: "Data de nascimento",
  sexo: "Sexo",
  orientacaoSexual: "Orientação sexual",
  orientacaoSexualOutro: "Complemento da orientação sexual",
};

export async function GET(req: Request) {
  try {
    await requireAdmin();
    const id = new URL(req.url).searchParams.get("id");
    if (!id) {
      return NextResponse.json({ error: "ID é obrigatório" }, { status: 400 });
    }

    const rows = await prisma.adminAuditLog.findMany({
      where: { targetUserId: id },
      orderBy: { createdAt: "desc" },
      take: 20,
      select: {
        id: true,
        action: true,
        field: true,
        createdAt: true,
        admin: { select: { nomeArtistico: true } },
      },
    });

    return NextResponse.json({
      historico: rows.map((row) => ({
        id: row.id,
        action: row.action,
        field: row.field,
        createdAt: row.createdAt,
        admin: adminAuditActorLabel(row.admin?.nomeArtistico),
        label:
          row.action === "profile_update"
            ? `${ACTION_LABELS.profile_update}: ${FIELD_LABELS[row.field || ""] || row.field || "campo"}`
            : ACTION_LABELS[row.action] || row.action,
      })),
    });
  } catch (err: unknown) {
    const blocked = denied(err);
    if (blocked) return blocked;
    console.error("[Admin auditoria]", err);
    return NextResponse.json({ error: "Erro ao buscar histórico." }, { status: 500 });
  }
}
