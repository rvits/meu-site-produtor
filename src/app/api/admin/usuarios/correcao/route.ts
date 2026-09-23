import { NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";
import { requireAdmin } from "@/app/lib/auth";
import { buildAdminAuditEntry } from "@/app/lib/admin-audit";
import { adminCorrecaoSchema, flagAuditAction } from "@/app/lib/admin-profile-edit";

function denied(err: unknown) {
  const message = err instanceof Error ? err.message : "";
  if (message === "Acesso negado" || message === "Não autenticado") {
    return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
  }
  return null;
}

export async function PATCH(req: Request) {
  try {
    const admin = await requireAdmin();
    const id = new URL(req.url).searchParams.get("id");
    if (!id) {
      return NextResponse.json({ error: "ID é obrigatório" }, { status: 400 });
    }

    const parsed = adminCorrecaoSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || "Dados inválidos" },
        { status: 400 }
      );
    }

    const current = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        cpfEditavelPeloUsuario: true,
        dataNascimentoEditavelPeloUsuario: true,
      },
    });
    if (!current) {
      return NextResponse.json({ error: "Usuário não encontrado." }, { status: 404 });
    }

    const data: {
      cpfEditavelPeloUsuario?: boolean;
      dataNascimentoEditavelPeloUsuario?: boolean;
    } = {};
    const logs: Array<{ action: string; field: string }> = [];

    if (
      parsed.data.cpfEditavelPeloUsuario !== undefined &&
      parsed.data.cpfEditavelPeloUsuario !== current.cpfEditavelPeloUsuario
    ) {
      data.cpfEditavelPeloUsuario = parsed.data.cpfEditavelPeloUsuario;
      logs.push({
        action: flagAuditAction("cpf", parsed.data.cpfEditavelPeloUsuario),
        field: "cpf",
      });
    }

    if (
      parsed.data.dataNascimentoEditavelPeloUsuario !== undefined &&
      parsed.data.dataNascimentoEditavelPeloUsuario !== current.dataNascimentoEditavelPeloUsuario
    ) {
      data.dataNascimentoEditavelPeloUsuario = parsed.data.dataNascimentoEditavelPeloUsuario;
      logs.push({
        action: flagAuditAction("nascimento", parsed.data.dataNascimentoEditavelPeloUsuario),
        field: "dataNascimento",
      });
    }

    if (logs.length === 0) {
      return NextResponse.json({
        ok: true,
        cpfEditavelPeloUsuario: current.cpfEditavelPeloUsuario,
        dataNascimentoEditavelPeloUsuario: current.dataNascimentoEditavelPeloUsuario,
      });
    }

    const updated = await prisma.$transaction(async (tx) => {
      const user = await tx.user.update({
        where: { id },
        data,
        select: {
          cpfEditavelPeloUsuario: true,
          dataNascimentoEditavelPeloUsuario: true,
        },
      });
      await tx.adminAuditLog.createMany({
        data: logs.map((entry) =>
          buildAdminAuditEntry({
            adminId: admin.id,
            targetUserId: id,
            action: entry.action,
            field: entry.field,
          })
        ),
      });
      return user;
    });

    return NextResponse.json({ ok: true, ...updated });
  } catch (err: unknown) {
    const blocked = denied(err);
    if (blocked) return blocked;
    console.error("[Admin correcao]", err);
    return NextResponse.json({ error: "Erro ao atualizar permissão." }, { status: 500 });
  }
}
