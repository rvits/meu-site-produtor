import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/app/lib/prisma";
import { requireAuth } from "@/app/lib/auth";
import { publicContaUpdateZodMessage, updateContaSchema } from "@/app/lib/validations";
import {
  CPF_DUPLICATE_MESSAGE,
  CPF_IMMUTABLE_MESSAGE,
  decideCpfUpdate,
} from "@/app/lib/cpf-validation";
import {
  BIRTH_DATE_IMMUTABLE_MESSAGE,
  civilDateUtc,
  decideBirthDateUpdate,
} from "@/app/lib/birth-date-validation";
import { orientationWriteFields } from "@/app/lib/sexual-orientation";

export async function POST(req: Request) {
  try {
    const user = await requireAuth();
    const rawBody = await req.json();

    const userData = await prisma.user.findUnique({
      where: { id: user.id },
    });

    if (!userData) {
      return NextResponse.json(
        { error: "Usuário não encontrado." },
        { status: 404 }
      );
    }

    const body: Record<string, unknown> =
      rawBody && typeof rawBody === "object" && !Array.isArray(rawBody)
        ? { ...(rawBody as Record<string, unknown>) }
        : {};

    delete body.genero;
    delete body.generoOutro;

    if (typeof body.dataNascimento === "string") {
      const existingCivil = civilDateUtc(userData.dataNascimento);
      const incomingCivil = civilDateUtc(body.dataNascimento);
      if (existingCivil && incomingCivil === existingCivil) {
        delete body.dataNascimento;
      }
    }

    const validation = updateContaSchema.safeParse(body);
    if (!validation.success) {
      console.info(
        JSON.stringify({
          source: "conta-update",
          event: "VALIDATION_FAILED",
          issues: validation.error.issues.map((issue) => ({
            path: issue.path.map(String).join(".") || "(root)",
            code: issue.code,
          })),
        })
      );
      return NextResponse.json(
        { error: publicContaUpdateZodMessage(validation.error) },
        { status: 400 }
      );
    }

    const {
      nomeArtistico,
      nomeSocial,
      email,
      telefone,
      sexo,
      orientacaoSexual,
      orientacaoSexualOutro,
      senha,
      senhaAtual,
      cpf,
      cep,
      dataNascimento,
      pais,
      cidade,
      bairro,
      estado,
      estilosMusicais,
      nacionalidade,
      foto,
    } = validation.data;

    // 🔐 SE MUDOU EMAIL OU SENHA → VALIDAR SENHA ATUAL
    if ((email && email !== userData.email) || senha) {
      if (!senhaAtual) {
        return NextResponse.json(
          { error: "Senha atual obrigatória para alterar dados sensíveis." },
          { status: 400 }
        );
      }

      const senhaOk = await bcrypt.compare(senhaAtual, userData.senha);

      if (!senhaOk) {
        return NextResponse.json(
          { error: "Senha atual incorreta." },
          { status: 401 }
        );
      }
    }

    // Verificar se novo email já existe
    if (email && email !== userData.email) {
      const emailEmUso = await prisma.user.findUnique({
        where: { email },
      });

      if (emailEmUso) {
        return NextResponse.json(
          { error: "Este email já está em uso." },
          { status: 400 }
        );
      }
    }

    // Preparar dados para atualização
    const updateData: any = {};
    if (nomeArtistico) updateData.nomeArtistico = nomeArtistico;
    if (nomeSocial !== undefined) updateData.nomeSocial = nomeSocial || null;
    if (email) updateData.email = email;
    if (telefone) updateData.telefone = telefone;
    if (sexo !== undefined) updateData.sexo = sexo || null;
    if (orientacaoSexual) {
      Object.assign(updateData, orientationWriteFields(orientacaoSexual, orientacaoSexualOutro));
    }
    const cpfDecision = decideCpfUpdate(userData.cpf, cpf);
    if (cpfDecision.action === "reject") {
      const status = cpfDecision.message === CPF_IMMUTABLE_MESSAGE ? 409 : 400;
      return NextResponse.json({ error: cpfDecision.message }, { status });
    }
    if (cpfDecision.action === "set") {
      const cpfEmUso = await prisma.user.findFirst({
        where: { cpf: cpfDecision.cpf, NOT: { id: user.id } },
        select: { id: true },
      });
      if (cpfEmUso) {
        return NextResponse.json({ error: CPF_DUPLICATE_MESSAGE }, { status: 400 });
      }
      updateData.cpf = cpfDecision.cpf;
    }
    if (cep !== undefined) updateData.cep = cep || null;
    if (pais !== undefined) updateData.pais = pais;
    if (cidade !== undefined) updateData.cidade = cidade;
    if (bairro !== undefined) updateData.bairro = bairro;
    if (estado !== undefined) updateData.estado = estado;
    if (estilosMusicais !== undefined) updateData.estilosMusicais = estilosMusicais || null;
    if (nacionalidade !== undefined) updateData.nacionalidade = nacionalidade || null;
    if (foto !== undefined) updateData.foto = foto && String(foto).trim() ? String(foto).trim() : null;
    const birthDecision = decideBirthDateUpdate(userData.dataNascimento, dataNascimento);
    if (birthDecision.action === "reject") {
      return NextResponse.json(
        { error: BIRTH_DATE_IMMUTABLE_MESSAGE },
        { status: 409 }
      );
    }
    if (senha) {
      updateData.senha = await bcrypt.hash(senha, 10);
    }

    /* ✅ UPDATE */
    const updated = await prisma.user.update({
      where: { id: user.id },
      data: updateData,
    });

    return NextResponse.json({
      ok: true,
      user: {
        id: updated.id,
        nomeArtistico: updated.nomeArtistico,
        email: updated.email,
      },
    });
  } catch (err: any) {
    console.error("Erro update conta:", err);
    if (err?.code === "P2002") {
      const target = String((err?.meta as { target?: string[] })?.target?.join(",") || "");
      if (target.includes("cpf")) {
        return NextResponse.json({ error: CPF_DUPLICATE_MESSAGE }, { status: 400 });
      }
    }
    if (err.message === "Não autenticado") {
      return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
    }
    return NextResponse.json(
      { error: "Erro interno no servidor." },
      { status: 500 }
    );
  }
}
