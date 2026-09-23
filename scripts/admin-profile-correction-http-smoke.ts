/**
 * Contrato HTTP local da correção administrativa de cadastro.
 *
 * AGUARDA a migration 20260922180000 aplicada somente em PostgreSQL local thouse_dev.
 * Não executar antes disso: o client Prisma passa a selecionar as colunas novas.
 *
 * Exige next dev em http://localhost:3000 e DATABASE_URL 127.0.0.1:5432/thouse_dev.
 * Não chama Asaas, não faz checkout e apaga só os usuários criados aqui.
 */
import assert from "node:assert/strict";
import fs from "fs";
import path from "path";
import bcrypt from "bcryptjs";
import type { PrismaClient } from "@prisma/client";
import {
  CPF_CLEAR_MESSAGE,
  CPF_DUPLICATE_MESSAGE,
  CPF_IMMUTABLE_MESSAGE,
  CPF_INVALID_MESSAGE,
} from "../src/app/lib/cpf-validation";
import {
  BIRTH_DATE_IMMUTABLE_MESSAGE,
  civilDateUtc,
} from "../src/app/lib/birth-date-validation";

const BASE = "http://localhost:3000";

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

function jar() {
  let cookie = "";
  return {
    store(res: Response) {
      const set =
        typeof res.headers.getSetCookie === "function" ? res.headers.getSetCookie() : [];
      const raw = res.headers.get("set-cookie");
      const parts = set.length ? set : raw ? [raw] : [];
      for (const line of parts) {
        const match = line.match(/session_id=([^;]+)/);
        if (match) cookie = `session_id=${match[1]}`;
      }
    },
    header(): Record<string, string> {
      return cookie ? { Cookie: cookie } : {};
    },
  };
}

async function unusedCpf(prisma: PrismaClient, candidate: string): Promise<string> {
  const found = await prisma.user.findFirst({ where: { cpf: candidate }, select: { id: true } });
  if (found) return unusedCpf(prisma, randomCpf());
  return candidate;
}

async function login(email: string, senha: string) {
  const session = jar();
  const res = await fetch(`${BASE}/api/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, senha }),
  });
  session.store(res);
  return session;
}

async function send(session: ReturnType<typeof jar>, url: string, method: string, body?: unknown) {
  const res = await fetch(`${BASE}${url}`, {
    method,
    headers: { "Content-Type": "application/json", ...session.header() },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  return { status: res.status, json };
}

type Result = { id: string; ok: boolean; detail: string };

async function main() {
  loadEnvFile(".env");
  assertLocalDatabase();
  const { PrismaClient } = await import("@prisma/client");
  const prisma = new PrismaClient();
  const results: Result[] = [];
  const createdIds: string[] = [];
  const orphanLogIds: string[] = [];
  const stamp = Date.now();
  const password = "AdminCorr@Test1";
  const hash = await bcrypt.hash(password, 10);
  const birth = new Date("1991-07-19T00:00:00.000Z");

  function record(id: string, ok: boolean, detail: string) {
    results.push({ id, ok, detail });
    console.log(`${ok ? "PASS" : "FAIL"} ${id} — ${detail}`);
  }

  try {
    const cpfUser = await unusedCpf(prisma, randomCpf());
    const cpfOther = await unusedCpf(prisma, randomCpf());
    const cpfTaken = await unusedCpf(prisma, randomCpf());
    const base = {
      nomeCompleto: "Pessoa Correcao",
      nomeArtistico: "Correcao",
      telefone: "21988887777",
      pais: "Brasil",
      estado: "RJ",
      cidade: "Rio de Janeiro",
      bairro: "Centro",
      dataNascimento: birth,
      senha: hash,
      sexo: "feminino",
      genero: "transsexual",
      generoOutro: "texto-legado",
      orientacaoSexual: "outro",
      orientacaoSexualOutro: "demissexual",
    };

    const user = await prisma.user.create({
      data: { ...base, email: `corr-user-${stamp}@local.test`, cpf: cpfUser, role: "USER" },
    });
    const other = await prisma.user.create({
      data: { ...base, email: `corr-other-${stamp}@local.test`, cpf: cpfTaken, role: "USER" },
    });
    const admin = await prisma.user.create({
      data: {
        ...base,
        email: `corr-admin-${stamp}@local.test`,
        cpf: cpfOther,
        role: "ADMIN",
        nomeArtistico: "Admin Correcao",
      },
    });
    createdIds.push(user.id, other.id, admin.id);

    const userJar = await login(user.email, password);
    const adminJar = await login(admin.email, password);

    const sameUserCpf = await send(userJar, "/api/conta/update", "POST", { cpf: cpfUser });
    const afterSameUserCpf = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    record(
      "user-flag-false-mesmo-cpf",
      sameUserCpf.status === 200 && afterSameUserCpf.cpf === cpfUser,
      `status=${sameUserCpf.status}`
    );

    const diffUserCpf = await send(userJar, "/api/conta/update", "POST", { cpf: cpfOther });
    const afterDiffUserCpf = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    record(
      "user-flag-false-cpf-diferente",
      diffUserCpf.status === 409 &&
        diffUserCpf.json?.error === CPF_IMMUTABLE_MESSAGE &&
        afterDiffUserCpf.cpf === cpfUser,
      `status=${diffUserCpf.status}`
    );

    const sameBirth = await send(userJar, "/api/conta/update", "POST", {
      dataNascimento: "1991-07-19",
    });
    const afterSameBirth = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    record(
      "user-flag-false-mesmo-dia",
      sameBirth.status === 200 && afterSameBirth.dataNascimento.getTime() === birth.getTime(),
      `status=${sameBirth.status}`
    );

    const diffBirth = await send(userJar, "/api/conta/update", "POST", {
      dataNascimento: "1996-01-01",
    });
    const afterDiffBirth = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    record(
      "user-flag-false-dia-diferente",
      diffBirth.status === 409 &&
        diffBirth.json?.error === BIRTH_DATE_IMMUTABLE_MESSAGE &&
        afterDiffBirth.dataNascimento.getTime() === birth.getTime(),
      `status=${diffBirth.status}`
    );

    const userEdit = await send(userJar, `/api/admin/usuarios/cadastro?id=${user.id}`, "PATCH", {
      cidade: "Niterói",
    });
    record("user-403-cadastro", userEdit.status === 403, `status=${userEdit.status}`);

    const userFlag = await send(userJar, `/api/admin/usuarios/correcao?id=${user.id}`, "PATCH", {
      cpfEditavelPeloUsuario: true,
    });
    record("user-403-flag", userFlag.status === 403, `status=${userFlag.status}`);

    const beforeLogs = await prisma.adminAuditLog.count({ where: { targetUserId: user.id } });
    const noop = await send(adminJar, `/api/admin/usuarios/cadastro?id=${user.id}`, "PATCH", {
      cpf: cpfUser,
      dataNascimento: "1991-07-19",
      cidade: "Rio de Janeiro",
    });
    const afterNoop = await prisma.adminAuditLog.count({ where: { targetUserId: user.id } });
    record(
      "admin-noop-sem-log",
      noop.status === 200 &&
        Array.isArray(noop.json?.changed) &&
        noop.json.changed.length === 0 &&
        afterNoop === beforeLogs,
      `status=${noop.status} logs=${afterNoop}`
    );

    const edited = await send(adminJar, `/api/admin/usuarios/cadastro?id=${user.id}`, "PATCH", {
      nomeCompleto: "Nome Corrigido Admin",
      nomeArtistico: "Artista Corrigido",
      telefone: "21977776666",
      cidade: "Niterói",
      sexo: "masculino",
    });
    const reloaded = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    const cityLog = await prisma.adminAuditLog.findFirst({
      where: { targetUserId: user.id, action: "profile_update", field: "cidade" },
    });
    record(
      "admin-edita-sem-mexer-senha-role-genero",
      edited.status === 200 &&
        reloaded.nomeCompleto === "Nome Corrigido Admin" &&
        reloaded.nomeArtistico === "Artista Corrigido" &&
        reloaded.telefone === "21977776666" &&
        reloaded.cidade === "Niterói" &&
        reloaded.sexo === "masculino" &&
        reloaded.senha === hash &&
        reloaded.role === "USER" &&
        reloaded.genero === "transsexual" &&
        reloaded.generoOutro === "texto-legado" &&
        reloaded.cpfEditavelPeloUsuario === false &&
        reloaded.dataNascimentoEditavelPeloUsuario === false &&
        Boolean(cityLog),
      `status=${edited.status}`
    );

    const badCpf = await send(adminJar, `/api/admin/usuarios/cadastro?id=${user.id}`, "PATCH", {
      cpf: "123",
    });
    record("admin-cpf-invalido", badCpf.status === 400 && badCpf.json?.error === CPF_INVALID_MESSAGE, `status=${badCpf.status}`);

    const clearCpf = await send(adminJar, `/api/admin/usuarios/cadastro?id=${user.id}`, "PATCH", {
      cpf: "",
    });
    record("admin-cpf-vazio", clearCpf.status === 409 && clearCpf.json?.error === CPF_CLEAR_MESSAGE, `status=${clearCpf.status}`);

    const dup = await send(adminJar, `/api/admin/usuarios/cadastro?id=${user.id}`, "PATCH", {
      cpf: cpfTaken,
    });
    const afterDup = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    record(
      "admin-cpf-duplicado",
      dup.status === 400 && dup.json?.error === CPF_DUPLICATE_MESSAGE && afterDup.cpf === cpfUser,
      `status=${dup.status}`
    );

    const nextCpf = await unusedCpf(prisma, randomCpf());
    const cpfEdit = await send(adminJar, `/api/admin/usuarios/cadastro?id=${user.id}`, "PATCH", {
      cpf: nextCpf,
    });
    const cpfLog = await prisma.adminAuditLog.findFirst({
      where: { targetUserId: user.id, action: "profile_update", field: "cpf" },
    });
    const cpfLogJson = JSON.stringify(cpfLog);
    record(
      "admin-cpf-sem-valor-no-log",
      cpfEdit.status === 200 &&
        Boolean(cpfLog) &&
        !cpfLogJson.includes(nextCpf) &&
        !cpfLogJson.includes(cpfUser),
      `status=${cpfEdit.status}`
    );

    const birthEdit = await send(adminJar, `/api/admin/usuarios/cadastro?id=${user.id}`, "PATCH", {
      dataNascimento: "1994-02-02",
    });
    const birthLog = await prisma.adminAuditLog.findFirst({
      where: { targetUserId: user.id, action: "profile_update", field: "dataNascimento" },
    });
    record(
      "admin-nascimento-sem-valor-no-log",
      birthEdit.status === 200 && Boolean(birthLog) && !JSON.stringify(birthLog).includes("1994-02-02"),
      `status=${birthEdit.status}`
    );

    const outroVazio = await send(adminJar, `/api/admin/usuarios/cadastro?id=${user.id}`, "PATCH", {
      orientacaoSexual: "outro",
      orientacaoSexualOutro: "   ",
    });
    record("admin-outro-exige-texto", outroVazio.status === 400, `status=${outroVazio.status}`);

    const outroOk = await send(adminJar, `/api/admin/usuarios/cadastro?id=${user.id}`, "PATCH", {
      orientacaoSexual: "outro",
      orientacaoSexualOutro: "demissexual",
    });
    const pan = await send(adminJar, `/api/admin/usuarios/cadastro?id=${user.id}`, "PATCH", {
      orientacaoSexual: "pansexual",
    });
    const afterOrient = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    record(
      "admin-outro-depois-pansexual-limpa-complemento",
      outroOk.status === 200 &&
        pan.status === 200 &&
        afterOrient.orientacaoSexual === "pansexual" &&
        afterOrient.orientacaoSexualOutro === null &&
        afterOrient.genero === "transsexual" &&
        afterOrient.generoOutro === "texto-legado" &&
        afterOrient.senha === hash &&
        afterOrient.role === "USER",
      `outro=${outroOk.status} pan=${pan.status}`
    );

    const enableCpf = await send(adminJar, `/api/admin/usuarios/correcao?id=${user.id}`, "PATCH", {
      cpfEditavelPeloUsuario: true,
    });
    const enableBirth = await send(adminJar, `/api/admin/usuarios/correcao?id=${user.id}`, "PATCH", {
      dataNascimentoEditavelPeloUsuario: true,
    });
    const flags = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    record(
      "admin-libera-flags",
      enableCpf.status === 200 &&
        enableBirth.status === 200 &&
        flags.cpfEditavelPeloUsuario === true &&
        flags.dataNascimentoEditavelPeloUsuario === true,
      `cpf=${enableCpf.status} nasc=${enableBirth.status}`
    );

    const userBad = await send(userJar, "/api/conta/update", "POST", { cpf: "123" });
    const userEmpty = await send(userJar, "/api/conta/update", "POST", { cpf: "" });
    const userNull = await send(userJar, "/api/conta/update", "POST", { cpf: null });
    const userDup = await send(userJar, "/api/conta/update", "POST", { cpf: cpfTaken });
    const beforeUserCpf = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    record(
      "user-flag-true-rejeita-invalido-vazio-duplicado",
      userBad.status === 400 &&
        userBad.json?.error === CPF_INVALID_MESSAGE &&
        userEmpty.status === 409 &&
        userEmpty.json?.error === CPF_CLEAR_MESSAGE &&
        userNull.status === 409 &&
        userNull.json?.error === CPF_CLEAR_MESSAGE &&
        userDup.status === 400 &&
        userDup.json?.error === CPF_DUPLICATE_MESSAGE &&
        beforeUserCpf.cpf === nextCpf,
      `bad=${userBad.status} empty=${userEmpty.status} dup=${userDup.status}`
    );

    const userCpf = await unusedCpf(prisma, randomCpf());
    const userUpdate = await send(userJar, "/api/conta/update", "POST", {
      cpf: userCpf,
      dataNascimento: "1993-03-03",
      cpfEditavelPeloUsuario: false,
      dataNascimentoEditavelPeloUsuario: false,
    });
    const afterUser = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    record(
      "usuario-corrige-sem-auto-lock-e-sem-controlar-flag",
      userUpdate.status === 200 &&
        afterUser.cpf === userCpf &&
        afterUser.cpfEditavelPeloUsuario === true &&
        afterUser.dataNascimentoEditavelPeloUsuario === true,
      `status=${userUpdate.status}`
    );

    const birthStamp = afterUser.dataNascimento.getTime();
    const sameCivil = await send(userJar, "/api/conta/update", "POST", {
      dataNascimento: "1993-03-03",
    });
    const afterSameCivil = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    record(
      "user-mesmo-dia-nao-regrava-timestamp",
      sameCivil.status === 200 &&
        afterSameCivil.dataNascimento.getTime() === birthStamp &&
        civilDateUtc(afterSameCivil.dataNascimento) === "1993-03-03" &&
        afterSameCivil.cpfEditavelPeloUsuario === true &&
        afterSameCivil.dataNascimentoEditavelPeloUsuario === true,
      `status=${sameCivil.status}`
    );

    await send(adminJar, `/api/admin/usuarios/correcao?id=${user.id}`, "PATCH", {
      cpfEditavelPeloUsuario: false,
      dataNascimentoEditavelPeloUsuario: false,
    });
    const lockedCpf = await send(userJar, "/api/conta/update", "POST", { cpf: cpfOther });
    const lockedBirth = await send(userJar, "/api/conta/update", "POST", {
      dataNascimento: "1995-05-05",
    });
    const afterLock = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    record(
      "bloquear-volta-a-rejeitar",
      lockedCpf.status === 409 &&
        lockedCpf.json?.error === CPF_IMMUTABLE_MESSAGE &&
        lockedBirth.status === 409 &&
        lockedBirth.json?.error === "Data de nascimento não pode ser alterada após o cadastro." &&
        afterLock.cpf === userCpf,
      `cpf=${lockedCpf.status} nasc=${lockedBirth.status}`
    );

    const forbiddenBodies = [
      { senha: "outra-senha" },
      { role: "ADMIN" },
      { genero: "heterossexual" },
      { generoOutro: "texto" },
      { cpfEditavelPeloUsuario: true },
      { dataNascimentoEditavelPeloUsuario: true },
    ];
    let forbiddenOk = true;
    for (const body of forbiddenBodies) {
      const forbidden = await send(adminJar, `/api/admin/usuarios/cadastro?id=${user.id}`, "PATCH", body);
      if (forbidden.status !== 400) forbiddenOk = false;
    }
    const afterForbidden = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    record(
      "formulario-rejeita-campos-proibidos",
      forbiddenOk &&
        afterForbidden.senha === hash &&
        afterForbidden.role === "USER" &&
        afterForbidden.genero === "transsexual" &&
        afterForbidden.generoOutro === "texto-legado",
      `ok=${forbiddenOk}`
    );

    const logs = await prisma.adminAuditLog.findMany({ where: { targetUserId: user.id } });
    const logJson = JSON.stringify(logs);
    const actions = new Set(logs.map((row) => `${row.action}:${row.field || ""}`));
    record(
      "audit-acoes-sem-pii",
      actions.has("cpf_edit_enabled:cpf") &&
        actions.has("cpf_edit_disabled:cpf") &&
        actions.has("birth_date_edit_enabled:dataNascimento") &&
        actions.has("birth_date_edit_disabled:dataNascimento") &&
        actions.has("profile_update:cpf") &&
        actions.has("profile_update:dataNascimento") &&
        actions.has("profile_update:nomeCompleto") &&
        actions.has("profile_update:telefone") &&
        actions.has("profile_update:sexo") &&
        actions.has("profile_update:orientacaoSexual") &&
        !logJson.includes(userCpf) &&
        !logJson.includes(nextCpf) &&
        !logJson.includes(cpfUser) &&
        !logJson.includes("1993-03-03") &&
        !logJson.includes("1994-02-02") &&
        !logJson.includes(hash),
      `actions=${logs.length}`
    );

    const me = await send(userJar, "/api/me", "GET");
    record(
      "login-continua-apos-correcao",
      me.status === 200 && me.json?.user?.email === user.email,
      `status=${me.status}`
    );

    const setNullCpfAdmin = await unusedCpf(prisma, randomCpf());
    const setNullCpfTarget = await unusedCpf(prisma, randomCpf());
    const setNullAdmin = await prisma.user.create({
      data: {
        ...base,
        email: `corr-setnull-admin-${stamp}@local.test`,
        cpf: setNullCpfAdmin,
        role: "ADMIN",
        nomeArtistico: "Admin SetNull",
      },
    });
    const setNullTarget = await prisma.user.create({
      data: {
        ...base,
        email: `corr-setnull-target-${stamp}@local.test`,
        cpf: setNullCpfTarget,
        role: "USER",
      },
    });
    createdIds.push(setNullAdmin.id, setNullTarget.id);
    const setNullLog = await prisma.adminAuditLog.create({
      data: {
        adminId: setNullAdmin.id,
        targetUserId: setNullTarget.id,
        action: "profile_update",
        field: "cidade",
      },
    });
    orphanLogIds.push(setNullLog.id);
    await prisma.user.delete({ where: { id: setNullAdmin.id } });
    const afterAdminGone = await prisma.adminAuditLog.findUniqueOrThrow({ where: { id: setNullLog.id } });
    const auditApi = await send(adminJar, `/api/admin/usuarios/auditoria?id=${setNullTarget.id}`, "GET");
    const auditJson = JSON.stringify(auditApi.json);
    record(
      "set-null-admin-api-tolera",
      afterAdminGone.adminId === null &&
        afterAdminGone.targetUserId === setNullTarget.id &&
        auditApi.status === 200 &&
        auditJson.includes("Administrador removido") &&
        !auditJson.includes(setNullAdmin.id) &&
        !auditJson.includes(setNullCpfAdmin),
      `status=${auditApi.status}`
    );
    await prisma.user.delete({ where: { id: setNullTarget.id } });
    const afterBothGone = await prisma.adminAuditLog.findUniqueOrThrow({ where: { id: setNullLog.id } });
    record(
      "set-null-target-preserva-log",
      afterBothGone.adminId === null && afterBothGone.targetUserId === null && afterBothGone.field === "cidade",
      `admin=${afterBothGone.adminId} target=${afterBothGone.targetUserId}`
    );
    await prisma.adminAuditLog.delete({ where: { id: setNullLog.id } });
  } finally {
    if (createdIds.length) {
      // SET NULL preservaria a linha. O teste apaga só os logs dos IDs que ele criou.
      await prisma.adminAuditLog.deleteMany({
        where: {
          OR: [
            { id: { in: orphanLogIds.length ? orphanLogIds : ["__none__"] } },
            { targetUserId: { in: createdIds } },
            { adminId: { in: createdIds } },
          ],
        },
      });
      await prisma.session.deleteMany({ where: { userId: { in: createdIds } } });
      await prisma.loginLog.deleteMany({ where: { userId: { in: createdIds } } });
      await prisma.user.deleteMany({ where: { id: { in: createdIds } } });
    }
    await prisma.$disconnect();
  }

  const failed = results.filter((item) => !item.ok);
  if (failed.length) {
    console.error(`\n${failed.length} falha(s)`);
    process.exit(1);
  }
  console.log(`\n${results.length} HTTP asserts OK`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
