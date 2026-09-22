/**
 * Trava de CPF e data de nascimento — somente banco local thouse_dev.
 * Não chama Asaas, não faz checkout e não altera outros usuários.
 */
import assert from "node:assert/strict";
import fs from "fs";
import path from "path";
import bcrypt from "bcryptjs";
import type { PrismaClient } from "@prisma/client";
import {
  CPF_DUPLICATE_MESSAGE,
  CPF_IMMUTABLE_MESSAGE,
  decideCpfUpdate,
  isCpfEstablished,
} from "../src/app/lib/cpf-validation";
import {
  BIRTH_DATE_IMMUTABLE_MESSAGE,
  civilDateUtc,
  decideBirthDateUpdate,
} from "../src/app/lib/birth-date-validation";
import { updateContaSchema } from "../src/app/lib/validations";

function loadEnvFile(file: string) {
  const full = path.resolve(process.cwd(), file);
  if (!fs.existsSync(full)) return;
  for (const line of fs.readFileSync(full, "utf8").split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const i = t.indexOf("=");
    if (i < 0) continue;
    const key = t.slice(0, i).trim();
    let val = t.slice(i + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = val;
  }
}

function assertLocalDatabase() {
  const url = process.env.DATABASE_URL || "";
  let host = "";
  let database = "";
  try {
    const parsed = new URL(url);
    host = parsed.hostname;
    database = parsed.pathname.replace(/^\//, "");
  } catch {
    console.error("REFUSING: DATABASE_URL ausente ou inválida");
    process.exit(1);
  }
  if (host !== "127.0.0.1" && host !== "localhost") {
    console.error("REFUSING: DATABASE_URL não é localhost");
    process.exit(1);
  }
  if (database !== "thouse_dev") {
    console.error("REFUSING: banco não é thouse_dev");
    process.exit(1);
  }
  if (/neon/i.test(url)) {
    console.error("REFUSING: URL de Neon");
    process.exit(1);
  }
}

function randomCpf(): string {
  let digits = "";
  for (let i = 0; i < 11; i++) digits += String(Math.floor(Math.random() * 10));
  if (/^(\d)\1+$/.test(digits)) return randomCpf();
  return digits;
}

function formatCpf(digits: string): string {
  return digits.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
}

type Result = { id: string; ok: boolean; detail: string };

async function main() {
  loadEnvFile(".env");
  assertLocalDatabase();

  const { PrismaClient } = await import("@prisma/client");
  const prisma = new PrismaClient();
  const results: Result[] = [];
  const createdIds: string[] = [];

  function record(id: string, ok: boolean, detail: string) {
    results.push({ id, ok, detail });
    console.log(`${ok ? "PASS" : "FAIL"} ${id} — ${detail}`);
  }

  const stamp = Date.now();
  const password = "Immutable@Test1";
  const hash = await bcrypt.hash(password, 10);
  const birth = new Date("1992-03-20T00:00:00.000Z");
  const civil = "1992-03-20";
  const otherCivil = "1993-08-01";

  try {
    const cpfA = await unusedCpf(prisma, randomCpf);
    const cpfE = await unusedCpf(prisma, randomCpf);
    const cpfOther = await unusedCpf(prisma, randomCpf);
    const cpfFormatted = await unusedCpf(prisma, randomCpf);

    const userA = await prisma.user.create({
      data: baseUser({
        email: `immutable-a-${stamp}@local.test`,
        hash,
        cpf: cpfA,
        birth,
      }),
    });
    createdIds.push(userA.id);

    const userB = await prisma.user.create({
      data: baseUser({
        email: `immutable-b-${stamp}@local.test`,
        hash,
        cpf: null,
        birth,
      }),
    });
    createdIds.push(userB.id);

    const beforeA = await prisma.user.findUniqueOrThrow({ where: { id: userA.id } });

    const same = decideCpfUpdate(beforeA.cpf, cpfA);
    record("A", same.action === "omit", `action=${same.action}`);

    const formatted = decideCpfUpdate(beforeA.cpf, formatCpf(cpfA));
    record("B", formatted.action === "omit", `action=${formatted.action}`);

    const different = decideCpfUpdate(beforeA.cpf, cpfOther);
    const afterDifferent = await prisma.user.findUniqueOrThrow({ where: { id: userA.id } });
    record(
      "C",
      different.action === "reject" &&
        different.action === "reject" &&
        different.message === CPF_IMMUTABLE_MESSAGE &&
        afterDifferent.cpf === cpfA,
      `action=${different.action} cpfPreserved=${afterDifferent.cpf === cpfA}`
    );

    const clearedEmpty = decideCpfUpdate(beforeA.cpf, "");
    const clearedNull = decideCpfUpdate(beforeA.cpf, null);
    const afterClear = await prisma.user.findUniqueOrThrow({ where: { id: userA.id } });
    record(
      "D",
      clearedEmpty.action === "reject" &&
        clearedNull.action === "reject" &&
        clearedEmpty.action === "reject" &&
        clearedEmpty.message === CPF_IMMUTABLE_MESSAGE &&
        clearedNull.message === CPF_IMMUTABLE_MESSAGE &&
        afterClear.cpf === cpfA,
      `empty=${clearedEmpty.action} null=${clearedNull.action} cpfPreserved=${afterClear.cpf === cpfA}`
    );

    const firstFill = decideCpfUpdate(null, cpfE);
    assert.equal(firstFill.action, "set");
    if (firstFill.action === "set") {
      const taken = await prisma.user.findFirst({
        where: { cpf: firstFill.cpf, NOT: { id: userB.id } },
        select: { id: true },
      });
      assert.equal(taken, null);
      await prisma.user.update({
        where: { id: userB.id },
        data: { cpf: firstFill.cpf },
      });
    }
    const afterFill = await prisma.user.findUniqueOrThrow({ where: { id: userB.id } });
    record("E", afterFill.cpf === cpfE, `filled=${afterFill.cpf === cpfE}`);

    const second = decideCpfUpdate(afterFill.cpf, cpfOther);
    const afterSecond = await prisma.user.findUniqueOrThrow({ where: { id: userB.id } });
    record(
      "F",
      second.action === "reject" &&
        second.action === "reject" &&
        second.message === CPF_IMMUTABLE_MESSAGE &&
        afterSecond.cpf === cpfE,
      `action=${second.action} cpfPreserved=${afterSecond.cpf === cpfE}`
    );

    const duplicateAttempt = decideCpfUpdate(null, cpfA);
    const duplicateOwner = await prisma.user.findFirst({
      where: { cpf: cpfA, NOT: { id: userB.id } },
      select: { id: true },
    });
    record(
      "U",
      duplicateAttempt.action === "set" && duplicateOwner?.id === userA.id,
      "unicidade continua consultada antes de gravar; userB não recebeu o CPF de A"
    );
    const userBStill = await prisma.user.findUniqueOrThrow({ where: { id: userB.id } });
    assert.equal(userBStill.cpf, cpfE);

    const formattedStored = formatCpf(cpfFormatted);
    const formattedUser = await prisma.user.create({
      data: baseUser({
        email: `immutable-fmt-${stamp}@local.test`,
        hash,
        cpf: formattedStored,
        birth,
      }),
    });
    createdIds.push(formattedUser.id);
    const sameDigits = decideCpfUpdate(formattedStored, cpfFormatted);
    const otherOnFormatted = decideCpfUpdate(formattedStored, cpfOther);
    const formattedRow = await prisma.user.findUniqueOrThrow({ where: { id: formattedUser.id } });
    record(
      "FMT",
      isCpfEstablished(formattedStored) &&
        sameDigits.action === "omit" &&
        otherOnFormatted.action === "reject" &&
        otherOnFormatted.action === "reject" &&
        otherOnFormatted.message === CPF_IMMUTABLE_MESSAGE &&
        formattedRow.cpf === formattedStored,
      "CPF com pontuação é estabelecido; mesmos dígitos são no-op; outro CPF não regrava"
    );

    const weird = "LEGADO-XYZ";
    const weirdUser = await prisma.user.create({
      data: baseUser({
        email: `immutable-weird-${stamp}@local.test`,
        hash,
        cpf: weird,
        birth,
      }),
    });
    createdIds.push(weirdUser.id);
    const weirdReplace = decideCpfUpdate(weird, cpfOther);
    const weirdClear = decideCpfUpdate(weird, "");
    const weirdNull = decideCpfUpdate(weird, null);
    const weirdSame = decideCpfUpdate(weird, weird);
    const partial = decideCpfUpdate("12.345", cpfOther);
    const partialSameDigits = decideCpfUpdate("12.345", "12345");
    const weirdRow = await prisma.user.findUniqueOrThrow({ where: { id: weirdUser.id } });
    record(
      "WEIRD",
      isCpfEstablished(weird) &&
        isCpfEstablished("12.345") &&
        !isCpfEstablished(null) &&
        !isCpfEstablished("   ") &&
        weirdReplace.action === "reject" &&
        weirdClear.action === "reject" &&
        weirdNull.action === "reject" &&
        weirdSame.action === "omit" &&
        partial.action === "reject" &&
        partialSameDigits.action === "omit" &&
        weirdRow.cpf === weird,
      "valor não normalizável permanece bloqueado e não é substituído"
    );

    const sameDay = decideBirthDateUpdate(beforeA.dataNascimento, civil);
    const nearMidnight = new Date("1992-03-21T01:00:00.000Z");
    const displayedSameDay = decideBirthDateUpdate(nearMidnight, civilDateUtc(nearMidnight)!);
    const afterSameDay = await prisma.user.findUniqueOrThrow({ where: { id: userA.id } });
    record(
      "G",
      sameDay.action === "omit" &&
        displayedSameDay.action === "omit" &&
        civilDateUtc(afterSameDay.dataNascimento) === civil &&
        afterSameDay.dataNascimento.getTime() === birth.getTime(),
      `action=${sameDay.action} civil=${civilDateUtc(afterSameDay.dataNascimento)}`
    );

    const otherDay = decideBirthDateUpdate(beforeA.dataNascimento, otherCivil);
    const parsedOther = updateContaSchema.safeParse({ dataNascimento: otherCivil });
    const afterOtherDay = await prisma.user.findUniqueOrThrow({ where: { id: userA.id } });
    record(
      "H",
      otherDay.action === "reject" &&
        otherDay.action === "reject" &&
        otherDay.message === BIRTH_DATE_IMMUTABLE_MESSAGE &&
        parsedOther.success &&
        afterOtherDay.dataNascimento.getTime() === birth.getTime(),
      `action=${otherDay.action} preserved=${afterOtherDay.dataNascimento.getTime() === birth.getTime()}`
    );

    const loginSrc = fs.readFileSync(
      path.join(process.cwd(), "src/app/api/login/route.ts"),
      "utf8"
    );
    const passwordOk = await bcrypt.compare(password, afterOtherDay.senha);
    const session = await prisma.session.create({
      data: { userId: userA.id, expiresAt: new Date(Date.now() + 60_000) },
    });
    const sessionRow = await prisma.session.findUnique({ where: { id: session.id } });
    await prisma.session.delete({ where: { id: session.id } });
    record(
      "I",
      loginSrc.includes("where: { email }") &&
        loginSrc.includes("bcrypt.compare") &&
        !loginSrc.includes("decideCpfUpdate") &&
        !loginSrc.includes("dataNascimento") &&
        passwordOk &&
        afterOtherDay.email === beforeA.email &&
        afterOtherDay.senha === beforeA.senha &&
        sessionRow?.userId === userA.id,
      "login segue por email/senha; hash e Session intactos neste teste"
    );

    const schema = fs.readFileSync(path.join(process.cwd(), "prisma/schema.prisma"), "utf8");
    const userBlock = schema.slice(schema.indexOf("model User {"), schema.indexOf("model UserNotification"));
    const relations = [
      "appointments",
      "sessions",
      "loginLogs",
      "payments",
      "userPlans",
      "subscriptions",
      "services",
      "serviceOrders",
      "assignedCoupons",
    ];
    const counts = await prisma.user.findUniqueOrThrow({
      where: { id: userA.id },
      include: {
        _count: {
          select: {
            appointments: true,
            sessions: true,
            payments: true,
            userPlans: true,
            services: true,
            subscriptions: true,
          },
        },
      },
    });
    record(
      "J",
      relations.every((name) => userBlock.includes(name)) &&
        schema.includes("orientacaoSexual") &&
        schema.includes("orientacaoSexualOutro") &&
        schema.includes("genero") &&
        schema.includes("generoOutro") &&
        schema.includes("sexo") &&
        counts._count.appointments === 0 &&
        counts._count.sessions === 0 &&
        counts._count.payments === 0 &&
        counts._count.userPlans === 0 &&
        counts._count.services === 0 &&
        counts._count.subscriptions === 0,
      "relações do model User preservadas; usuário de teste sem vínculos"
    );

    const cartBody: Record<string, unknown> = {
      nomeArtistico: "Artista Local",
      dataNascimento: civil,
      cpf: formatCpf(cpfA),
      pais: "Brasil",
      cidade: "Rio de Janeiro",
      bairro: "Botafogo",
      cep: "22000000",
    };
    if (
      civilDateUtc(beforeA.dataNascimento) &&
      civilDateUtc(cartBody.dataNascimento as string) === civilDateUtc(beforeA.dataNascimento)
    ) {
      delete cartBody.dataNascimento;
    }
    const parsedCart = updateContaSchema.safeParse(cartBody);
    const cartCpf = parsedCart.success ? decideCpfUpdate(beforeA.cpf, parsedCart.data.cpf) : null;
    const cartBirth = parsedCart.success
      ? decideBirthDateUpdate(beforeA.dataNascimento, parsedCart.data.dataNascimento)
      : null;
    record(
      "CART",
      parsedCart.success && cartCpf?.action === "omit" && cartBirth?.action === "omit",
      "reenvio do carrinho com o mesmo CPF e o mesmo dia passa como no-op"
    );

    const nullCpfSchema = updateContaSchema.safeParse({ cpf: null });
    const nullBirthSchema = updateContaSchema.safeParse({ dataNascimento: null });
    record(
      "SCHEMA",
      nullCpfSchema.success &&
        nullCpfSchema.data.cpf === null &&
        nullBirthSchema.success &&
        nullBirthSchema.data.dataNascimento === undefined,
      "cpf null permanece visível ao handler; nascimento null continua omitido"
    );
  } finally {
    if (createdIds.length) {
      await prisma.session.deleteMany({ where: { userId: { in: createdIds } } });
      await prisma.user.deleteMany({ where: { id: { in: createdIds } } });
    }
    await prisma.$disconnect();
  }

  const failed = results.filter((item) => !item.ok);
  console.log(JSON.stringify({ ok: failed.length === 0, results }, null, 2));
  if (failed.length) process.exit(1);
}

function baseUser(input: {
  email: string;
  hash: string;
  cpf: string | null;
  birth: Date;
}) {
  return {
    nomeCompleto: "Immutable Smoke",
    nomeArtistico: "Immutable",
    email: input.email,
    senha: input.hash,
    telefone: "21999999999",
    cpf: input.cpf,
    pais: "Brasil",
    estado: "RJ",
    cidade: "Rio de Janeiro",
    bairro: "Botafogo",
    dataNascimento: input.birth,
    role: "USER",
  };
}

async function unusedCpf(prisma: PrismaClient, next: () => string) {
  for (let i = 0; i < 20; i++) {
    const cpf = next();
    const found = await prisma.user.findFirst({ where: { cpf }, select: { id: true } });
    if (!found) return cpf;
  }
  throw new Error("Não foi possível gerar CPF livre no banco local");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
