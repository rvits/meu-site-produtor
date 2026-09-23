import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/app/lib/prisma";
import { requireAdmin } from "@/app/lib/auth";
import { CPF_DUPLICATE_MESSAGE } from "@/app/lib/cpf-validation";
import { ADMIN_AUDIT_PROFILE_UPDATE, buildAdminAuditEntry } from "@/app/lib/admin-audit";
import { adminCadastroSchema, planAdminProfileUpdate } from "@/app/lib/admin-profile-edit";

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

    const parsed = adminCadastroSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || "Dados inválidos" },
        { status: 400 }
      );
    }

    const current = await prisma.user.findUnique({ where: { id } });
    if (!current) {
      return NextResponse.json({ error: "Usuário não encontrado." }, { status: 404 });
    }

    const plan = planAdminProfileUpdate(current, parsed.data);
    if (!plan.ok) {
      return NextResponse.json({ error: plan.message }, { status: plan.status });
    }

    if (plan.fields.length === 0) {
      return NextResponse.json({ ok: true, changed: [] });
    }

    if (typeof plan.data.cpf === "string") {
      const taken = await prisma.user.findFirst({
        where: { cpf: plan.data.cpf, NOT: { id } },
        select: { id: true },
      });
      if (taken) {
        return NextResponse.json({ error: CPF_DUPLICATE_MESSAGE }, { status: 400 });
      }
    }

    await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id },
        data: plan.data as Prisma.UserUpdateInput,
      });
      await tx.adminAuditLog.createMany({
        data: plan.fields.map((field) =>
          buildAdminAuditEntry({
            adminId: admin.id,
            targetUserId: id,
            action: ADMIN_AUDIT_PROFILE_UPDATE,
            field,
          })
        ),
      });
    });

    return NextResponse.json({ ok: true, changed: plan.fields });
  } catch (err: unknown) {
    const blocked = denied(err);
    if (blocked) return blocked;
    const code = typeof err === "object" && err && "code" in err ? String(err.code) : "";
    if (code === "P2002") {
      return NextResponse.json({ error: CPF_DUPLICATE_MESSAGE }, { status: 400 });
    }
    console.error("[Admin cadastro]", err);
    return NextResponse.json({ error: "Erro ao atualizar cadastro." }, { status: 500 });
  }
}
