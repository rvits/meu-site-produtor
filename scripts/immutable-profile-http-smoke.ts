/**
 * Contrato HTTP local de POST /api/conta/update.
 * Exige next dev em http://localhost:3000 e PostgreSQL 127.0.0.1:5432/thouse_dev.
 * Não chama Asaas, não faz checkout e apaga só os usuários criados aqui.
 */
import assert from "node:assert/strict";
import fs from "fs";
import path from "path";
import bcrypt from "bcryptjs";
import type { PrismaClient } from "@prisma/client";
import {
  CPF_IMMUTABLE_MESSAGE,
  isCpfEstablished,
  usableCpfDigits,
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

function formatCpf(digits: string): string {
  return digits.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
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
    hasSession() {
      return cookie.startsWith("session_id=");
    },
  };
}

type Result = { id: string; ok: boolean; detail: string };

async function main() {
  loadEnvFile(".env");
  assertLocalDatabase();

  const profileSrc = fs.readFileSync(
    path.join(process.cwd(), "src/app/minha-conta/portal-ui/ProfileSection.tsx"),
    "utf8"
  );
  const cartSrc = fs.readFileSync(path.join(process.cwd(), "src/app/carrinho/page.tsx"), "utf8");
  const loginSrc = fs.readFileSync(path.join(process.cwd(), "src/app/api/login/route.ts"), "utf8");
  assert.match(profileSrc, /isCpfEstablished\(data\.cpf\)/);
  assert.match(cartSrc, /isCpfEstablished\(data\.cpf\)/);
  assert.equal(profileSrc.includes("normalizeCpfDigits(data.cpf).length === 11"), false);
  assert.equal(cartSrc.includes("cpfDigits.length === 11"), false);
  assert.match(loginSrc, /where: \{ email \}/);
  assert.match(loginSrc, /bcrypt\.compare/);

  const { PrismaClient } = await import("@prisma/client");
  const prisma = new PrismaClient();
  const results: Result[] = [];
  const createdIds: string[] = [];
  const stamp = Date.now();
  const password = "ImmutableHttp@Test1";
  const hash = await bcrypt.hash(password, 10);
  const birth = new Date("1992-03-21T01:00:00.000Z");
  const civil = civilDateUtc(birth);
  assert.equal(civil, "1992-03-21");

  function record(id: string, ok: boolean, detail: string) {
    results.push({ id, ok, detail });
    console.log(`${ok ? "PASS" : "FAIL"} ${id} — ${detail}`);
  }

  try {
    const cpfPlain = await unusedCpf(prisma, randomCpf);
    const cpfFormattedDigits = await unusedCpf(prisma, randomCpf);
    const cpfOther = await unusedCpf(prisma, randomCpf);
    const cpfFirstFill = await unusedCpf(prisma, randomCpf);
    const formattedStored = formatCpf(cpfFormattedDigits);
    const weird = "LEGADO-XYZ";

    const plain = await prisma.user.create({
      data: baseUser(`http-plain-${stamp}@local.test`, hash, cpfPlain, birth),
    });
    const formatted = await prisma.user.create({
      data: baseUser(`http-fmt-${stamp}@local.test`, hash, formattedStored, birth),
    });
    const strange = await prisma.user.create({
      data: baseUser(`http-weird-${stamp}@local.test`, hash, weird, birth),
    });
    const absent = await prisma.user.create({
      data: baseUser(`http-absent-${stamp}@local.test`, hash, null, birth),
    });
    createdIds.push(plain.id, formatted.id, strange.id, absent.id);

    const plainJar = await login(plain.email, password);
    record("A", plainJar.hasSession(), "login devolveu session_id");
    record("B", plainJar.hasSession(), "cookie session_id capturado");

    const me = await api(plainJar, "/api/me");
    const conta = await api(plainJar, "/api/conta");
    record(
      "C",
      me.status === 200 &&
        me.json?.user?.email === plain.email &&
        conta.status === 200 &&
        conta.json?.email === plain.email &&
        conta.json?.cpf === cpfPlain &&
        conta.json?.dataNascimento === civil,
      `me=${me.status} conta=${conta.status} civil=${conta.json?.dataNascimento}`
    );

    const sameCpf = await update(plainJar, {
      nomeArtistico: "HTTP Plain",
      telefone: "21911111111",
      cpf: cpfPlain,
    });
    const afterSame = await reload(prisma, plain.id);
    record(
      "D",
      sameCpf.status === 200 && afterSame.cpf === cpfPlain && afterSame.telefone === "21911111111",
      `status=${sameCpf.status} cpfPreserved=${afterSame.cpf === cpfPlain}`
    );

    const formattedSame = await update(plainJar, { cpf: formatCpf(cpfPlain) });
    const afterFormattedSame = await reload(prisma, plain.id);
    record(
      "E",
      formattedSame.status === 200 &&
        afterFormattedSame.cpf === cpfPlain &&
        afterFormattedSame.dataNascimento.getTime() === birth.getTime(),
      `status=${formattedSame.status} storedUnchanged=${afterFormattedSame.cpf === cpfPlain}`
    );

    const different = await update(plainJar, { cpf: cpfOther, telefone: "21922222222" });
    const afterDifferent = await reload(prisma, plain.id);
    record(
      "F",
      different.status === 409 &&
        different.json?.error === CPF_IMMUTABLE_MESSAGE &&
        afterDifferent.cpf === cpfPlain &&
        afterDifferent.telefone === "21911111111",
      `status=${different.status} cpfPreserved=${afterDifferent.cpf === cpfPlain}`
    );

    const clearEmpty = await update(plainJar, { cpf: "", telefone: "21933333333" });
    const afterEmpty = await reload(prisma, plain.id);
    record(
      "G",
      clearEmpty.status === 409 &&
        clearEmpty.json?.error === CPF_IMMUTABLE_MESSAGE &&
        afterEmpty.cpf === cpfPlain &&
        afterEmpty.telefone === "21911111111",
      `status=${clearEmpty.status}`
    );

    const clearNull = await update(plainJar, { cpf: null, telefone: "21933333333" });
    const afterNull = await reload(prisma, plain.id);
    record(
      "H",
      clearNull.status === 409 &&
        clearNull.json?.error === CPF_IMMUTABLE_MESSAGE &&
        afterNull.cpf === cpfPlain,
      `status=${clearNull.status}`
    );

    const sameBirth = await update(plainJar, {
      dataNascimento: civil,
      telefone: "21944444444",
    });
    const afterSameBirth = await reload(prisma, plain.id);
    record(
      "I",
      sameBirth.status === 200 &&
        afterSameBirth.dataNascimento.getTime() === birth.getTime() &&
        civilDateUtc(afterSameBirth.dataNascimento) === civil &&
        afterSameBirth.telefone === "21944444444",
      `status=${sameBirth.status} timestampPreserved=${afterSameBirth.dataNascimento.getTime() === birth.getTime()}`
    );

    const otherBirth = await update(plainJar, {
      dataNascimento: "1993-08-01",
      telefone: "21955555555",
    });
    const afterOtherBirth = await reload(prisma, plain.id);
    record(
      "J",
      otherBirth.status === 409 &&
        otherBirth.json?.error === BIRTH_DATE_IMMUTABLE_MESSAGE &&
        afterOtherBirth.dataNascimento.getTime() === birth.getTime() &&
        afterOtherBirth.telefone === "21944444444" &&
        afterOtherBirth.cpf === cpfPlain &&
        afterOtherBirth.email === plain.email &&
        afterOtherBirth.senha === hash,
      `status=${otherBirth.status} birthPreserved=${afterOtherBirth.dataNascimento.getTime() === birth.getTime()}`
    );

    const fmtJar = await login(formatted.email, password);
    const fmtConta = await api(fmtJar, "/api/conta");
    const fmtSame = await update(fmtJar, {
      cpf: cpfFormattedDigits,
      cidade: "Niterói",
    });
    const afterFmtSame = await reload(prisma, formatted.id);
    const fmtOther = await update(fmtJar, { cpf: cpfOther, cidade: "Petrópolis" });
    const afterFmtOther = await reload(prisma, formatted.id);
    record(
      "FMT",
      isCpfEstablished(fmtConta.json?.cpf) &&
        usableCpfDigits(formattedStored) === cpfFormattedDigits &&
        fmtSame.status === 200 &&
        afterFmtSame.cpf === formattedStored &&
        afterFmtSame.cidade === "Niterói" &&
        fmtOther.status === 409 &&
        afterFmtOther.cpf === formattedStored &&
        afterFmtOther.cidade === "Niterói",
      `same=${fmtSame.status} other=${fmtOther.status} punctuationPreserved=${afterFmtOther.cpf === formattedStored}`
    );

    const weirdJar = await login(strange.email, password);
    const weirdConta = await api(weirdJar, "/api/conta");
    const weirdReplace = await update(weirdJar, { cpf: cpfOther, cidade: "Cabo Frio" });
    const weirdClear = await update(weirdJar, { cpf: "" });
    const weirdNull = await update(weirdJar, { cpf: null });
    const weirdSame = await update(weirdJar, { cpf: weird, cidade: "Maricá" });
    const afterWeird = await reload(prisma, strange.id);
    record(
      "WEIRD",
      isCpfEstablished(weirdConta.json?.cpf) &&
        usableCpfDigits(weird) === null &&
        weirdReplace.status === 409 &&
        weirdClear.status === 409 &&
        weirdNull.status === 409 &&
        weirdSame.status === 200 &&
        afterWeird.cpf === weird &&
        afterWeird.cidade === "Maricá",
      `replace=${weirdReplace.status} clear=${weirdClear.status} null=${weirdNull.status} same=${weirdSame.status}`
    );

    const absentJar = await login(absent.email, password);
    const absentBefore = await api(absentJar, "/api/conta");
    const fill = await update(absentJar, { cpf: cpfFirstFill });
    const afterFill = await reload(prisma, absent.id);
    const fillAgain = await update(absentJar, { cpf: cpfOther });
    const afterFillAgain = await reload(prisma, absent.id);
    record(
      "ABSENT",
      !isCpfEstablished(absentBefore.json?.cpf) &&
        fill.status === 200 &&
        afterFill.cpf === cpfFirstFill &&
        fillAgain.status === 409 &&
        afterFillAgain.cpf === cpfFirstFill,
      `fill=${fill.status} second=${fillAgain.status}`
    );
  } finally {
    if (createdIds.length) {
      await prisma.session.deleteMany({ where: { userId: { in: createdIds } } });
      await prisma.user.deleteMany({ where: { id: { in: createdIds } } });
    }
    await prisma.$disconnect();
  }

  const failed = results.filter((item) => !item.ok);
  console.log(JSON.stringify({ ok: failed.length === 0, base: BASE, results }, null, 2));
  if (failed.length) process.exit(1);
}

async function login(email: string, senha: string) {
  const cookies = jar();
  const res = await fetch(`${BASE}/api/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, senha }),
  });
  cookies.store(res);
  if (!res.ok || !cookies.hasSession()) {
    const text = await res.text();
    throw new Error(`Login falhou status=${res.status} body=${text.slice(0, 300)}`);
  }
  return cookies;
}

async function api(cookies: ReturnType<typeof jar>, pathname: string) {
  const res = await fetch(`${BASE}${pathname}`, { headers: cookies.header() });
  const json = await res.json().catch(() => null);
  return { status: res.status, json };
}

async function update(cookies: ReturnType<typeof jar>, body: Record<string, unknown>) {
  const res = await fetch(`${BASE}/api/conta/update`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...cookies.header() },
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => null);
  return { status: res.status, json };
}

function reload(prisma: PrismaClient, id: string) {
  return prisma.user.findUniqueOrThrow({ where: { id } });
}

function baseUser(email: string, hash: string, cpf: string | null, birth: Date) {
  return {
    nomeCompleto: "HTTP Immutable",
    nomeArtistico: "HTTP Immutable",
    email,
    senha: hash,
    telefone: "21999999999",
    cpf,
    pais: "Brasil",
    estado: "RJ",
    cidade: "Rio de Janeiro",
    bairro: "Botafogo",
    dataNascimento: birth,
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
