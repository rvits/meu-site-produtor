/**
 * Contrato HTTP local de orientação sexual.
 * Exige next dev em http://localhost:3000 e PostgreSQL 127.0.0.1:5432/thouse_dev.
 * Não chama Asaas, não faz checkout e apaga só os usuários criados aqui.
 */
import assert from "node:assert/strict";
import fs from "fs";
import path from "path";
import bcrypt from "bcryptjs";
import type { PrismaClient } from "@prisma/client";

const BASE = "http://localhost:3000";
const PASSWORD = "Orientacao@Test1";

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

function assertLocalTargets() {
  const base = new URL(BASE);
  if (base.protocol !== "http:") {
    console.error("REFUSING: BASE não é http local");
    process.exit(1);
  }
  if (base.hostname !== "localhost" && base.hostname !== "127.0.0.1") {
    console.error("REFUSING: BASE não é localhost");
    process.exit(1);
  }

  const url = process.env.DATABASE_URL || "";
  let host = "";
  let database = "";
  let port = "";
  try {
    const parsed = new URL(url);
    host = parsed.hostname;
    database = parsed.pathname.replace(/^\//, "");
    port = parsed.port || "5432";
  } catch {
    console.error("REFUSING: DATABASE_URL ausente ou inválida");
    process.exit(1);
  }
  if (host !== "127.0.0.1" && host !== "localhost") {
    console.error("REFUSING: DATABASE_URL não é localhost");
    process.exit(1);
  }
  if (port !== "5432" || database !== "thouse_dev" || /neon/i.test(url)) {
    console.error("REFUSING: banco não é thouse_dev local");
    process.exit(1);
  }
}

function assertAdminIsReadOnlyStructure() {
  const route = fs.readFileSync(
    path.join(process.cwd(), "src/app/api/admin/pagamentos/route.ts"),
    "utf8"
  );
  const page = fs.readFileSync(
    path.join(process.cwd(), "src/app/admin/pagamentos/page.tsx"),
    "utf8"
  );
  for (const field of [
    "sexo: true",
    "orientacaoSexual: true",
    "orientacaoSexualOutro: true",
    "genero: true",
    "generoOutro: true",
  ]) {
    assert.equal(route.includes(field), true, `admin select sem ${field}`);
  }
  assert.equal(route.includes("payment.create"), false);
  assert.equal(route.includes("payment.update"), false);
  assert.match(page, /Orientação sexual:/);
  assert.match(page, /Gênero \(cadastro anterior\):/);
  assert.match(page, /sexualOrientationLabel/);
}

type Result = { id: string; ok: boolean; detail: string };

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

function randomCpf(): string {
  let digits = "";
  for (let i = 0; i < 11; i++) digits += String(Math.floor(Math.random() * 10));
  if (/^(\d)\1+$/.test(digits)) return randomCpf();
  return digits;
}

async function unusedCpf(prisma: PrismaClient): Promise<string> {
  for (let i = 0; i < 30; i++) {
    const cpf = randomCpf();
    const found = await prisma.user.findFirst({ where: { cpf }, select: { id: true } });
    if (!found) return cpf;
  }
  throw new Error("não foi possível obter CPF de teste livre");
}

async function main() {
  loadEnvFile(".env");
  assertLocalTargets();
  assertAdminIsReadOnlyStructure();

  const { PrismaClient } = await import("@prisma/client");
  const prisma = new PrismaClient();
  const results: Result[] = [];
  const createdIds: string[] = [];
  const stamp = Date.now();
  const hash = await bcrypt.hash(PASSWORD, 10);

  function record(id: string, ok: boolean, detail: string) {
    results.push({ id, ok, detail });
    console.log(`${ok ? "PASS" : "FAIL"} ${id} — ${detail}`);
  }

  async function remember(email: string) {
    const user = await prisma.user.findUnique({ where: { email }, select: { id: true } });
    if (user && !createdIds.includes(user.id)) createdIds.push(user.id);
    return user;
  }

  try {
    const valid = [
      "heterossexual",
      "homossexual",
      "bissexual",
      "pansexual",
      "assexual",
      "prefiro_nao_informar",
    ] as const;

    let loginEmail = "";
    let outroUserId = "";

    for (const code of valid) {
      const email = `orient-reg-${code}-${stamp}@local.test`;
      const cpf = await unusedCpf(prisma);
      const res = await fetch(`${BASE}/api/registro`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nomeCompleto: "Orientacao Teste",
          nomeArtistico: "Orientacao Teste",
          email,
          senha: PASSWORD,
          telefone: "21999990000",
          cpf,
          pais: "Brasil",
          estado: "RJ",
          cidade: "Rio de Janeiro",
          bairro: "Botafogo",
          dataNascimento: "1995-06-15",
          sexo: "feminino",
          orientacaoSexual: code,
          orientacaoSexualOutro: "nao deve gravar",
        }),
      });
      const json = (await res.json().catch(() => null)) as { user?: { id?: string }; error?: string } | null;
      if (json?.user?.id) createdIds.push(json.user.id);
      await remember(email);
      const row = json?.user?.id
        ? await prisma.user.findUnique({ where: { id: json.user.id } })
        : null;
      const ok =
        res.status === 200 &&
        row?.sexo === "feminino" &&
        row.orientacaoSexual === code &&
        row.orientacaoSexualOutro === null &&
        row.genero === null &&
        row.generoOutro === null;
      record(`REG ${code}`, ok, `status=${res.status} sexo=${row?.sexo} orientacao=${row?.orientacaoSexual} outro=${row?.orientacaoSexualOutro} genero=${row?.genero}`);
      if (!loginEmail && ok) loginEmail = email;
    }

    {
      const email = `orient-reg-outro-${stamp}@local.test`;
      const cpf = await unusedCpf(prisma);
      const res = await fetch(`${BASE}/api/registro`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nomeCompleto: "Orientacao Outro",
          nomeArtistico: "Orientacao Outro",
          email,
          senha: PASSWORD,
          telefone: "21999990001",
          cpf,
          pais: "Brasil",
          estado: "RJ",
          cidade: "Rio de Janeiro",
          bairro: "Botafogo",
          dataNascimento: "1994-04-04",
          sexo: "masculino",
          orientacaoSexual: "outro",
          orientacaoSexualOutro: "  demissexual teste  ",
        }),
      });
      const json = (await res.json().catch(() => null)) as { user?: { id?: string } } | null;
      if (json?.user?.id) {
        createdIds.push(json.user.id);
        outroUserId = json.user.id;
      }
      await remember(email);
      const row = outroUserId
        ? await prisma.user.findUnique({ where: { id: outroUserId } })
        : null;
      record(
        "REG outro",
        res.status === 200 &&
          row?.sexo === "masculino" &&
          row.orientacaoSexual === "outro" &&
          row.orientacaoSexualOutro === "demissexual teste" &&
          row.genero === null &&
          row.generoOutro === null,
        `status=${res.status} outro=${row?.orientacaoSexualOutro} genero=${row?.genero}`
      );
      if (!loginEmail && res.status === 200) loginEmail = email;
    }

    for (const code of ["transsexual", "nao_binario"] as const) {
      const email = `orient-bad-${code}-${stamp}@local.test`;
      const cpf = await unusedCpf(prisma);
      const res = await fetch(`${BASE}/api/registro`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nomeCompleto: "Orientacao Invalida",
          nomeArtistico: "Orientacao Invalida",
          email,
          senha: PASSWORD,
          telefone: "21999990002",
          cpf,
          pais: "Brasil",
          estado: "RJ",
          cidade: "Rio de Janeiro",
          bairro: "Botafogo",
          dataNascimento: "1993-03-03",
          sexo: "feminino",
          orientacaoSexual: code,
        }),
      });
      const json = (await res.json().catch(() => null)) as { user?: { id?: string } } | null;
      if (json?.user?.id) createdIds.push(json.user.id);
      const user = await remember(email);
      record(`REJECT ${code}`, res.status === 400 && !user, `status=${res.status} created=${Boolean(user)}`);
    }

    {
      const email = `orient-bad-outro-vazio-${stamp}@local.test`;
      const cpf = await unusedCpf(prisma);
      const res = await fetch(`${BASE}/api/registro`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nomeCompleto: "Orientacao Invalida",
          nomeArtistico: "Orientacao Invalida",
          email,
          senha: PASSWORD,
          telefone: "21999990003",
          cpf,
          pais: "Brasil",
          estado: "RJ",
          cidade: "Rio de Janeiro",
          bairro: "Botafogo",
          dataNascimento: "1993-03-03",
          sexo: "feminino",
          orientacaoSexual: "outro",
          orientacaoSexualOutro: "   ",
        }),
      });
      const json = (await res.json().catch(() => null)) as { user?: { id?: string } } | null;
      if (json?.user?.id) createdIds.push(json.user.id);
      const user = await remember(email);
      record("REJECT outro sem texto", res.status === 400 && !user, `status=${res.status} created=${Boolean(user)}`);
    }

    const cookies = jar();
    const loginRes = await fetch(`${BASE}/api/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: loginEmail, senha: PASSWORD }),
    });
    cookies.store(loginRes);
    const meRes = await fetch(`${BASE}/api/me`, { headers: cookies.header() });
    const meJson = (await meRes.json().catch(() => null)) as { user?: { email?: string } } | null;
    record(
      "LOGIN",
      loginRes.status === 200 &&
        cookies.hasSession() &&
        meRes.status === 200 &&
        meJson?.user?.email === loginEmail,
      `login=${loginRes.status} me=${meRes.status} emailOk=${meJson?.user?.email === loginEmail}`
    );

    const legacyCases: Array<{
      key: string;
      genero: string | null;
      generoOutro: string | null;
    }> = [
      { key: "heterossexual", genero: "heterossexual", generoOutro: null },
      { key: "homossexual", genero: "homossexual", generoOutro: null },
      { key: "bissexual", genero: "bissexual", generoOutro: null },
      { key: "prefiro_nao_informar", genero: "prefiro_nao_informar", generoOutro: null },
      { key: "transsexual", genero: "transsexual", generoOutro: null },
      { key: "nao_binario", genero: "nao_binario", generoOutro: null },
      { key: "outro", genero: "outro", generoOutro: "texto legado teste" },
      { key: "null", genero: null, generoOutro: null },
    ];

    const legacyIds = new Map<string, string>();
    for (const [index, item] of legacyCases.entries()) {
      const email = `orient-legacy-${item.key}-${stamp}@local.test`;
      const user = await prisma.user.create({
        data: {
          nomeCompleto: "Legado Orientacao",
          nomeArtistico: "Legado Orientacao",
          email,
          senha: hash,
          telefone: "21988880000",
          cpf: await unusedCpf(prisma),
          pais: "Brasil",
          estado: "RJ",
          cidade: "Rio de Janeiro",
          bairro: "Centro",
          dataNascimento: new Date("1991-01-15T00:00:00.000Z"),
          sexo: "masculino",
          genero: item.genero,
          generoOutro: item.generoOutro,
          orientacaoSexual: null,
          orientacaoSexualOutro: null,
          role: "USER",
        },
        select: { id: true },
      });
      createdIds.push(user.id);
      legacyIds.set(item.key, user.id);

      const session = jar();
      const logged = await fetch(`${BASE}/api/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, senha: PASSWORD }),
      });
      session.store(logged);
      const conta = await fetch(`${BASE}/api/conta`, { headers: session.header() });
      const contaJson = (await conta.json().catch(() => null)) as {
        genero?: string | null;
        orientacaoSexual?: string | null;
      } | null;
      const cidade = `Cidade${index}`;
      const telefone = `2197000000${index}`;
      const updated = await fetch(`${BASE}/api/conta/update`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...session.header() },
        body: JSON.stringify({ cidade, telefone }),
      });
      const after = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
      record(
        `LEGACY ${item.key}`,
        logged.status === 200 &&
          conta.status === 200 &&
          contaJson?.genero === item.genero &&
          contaJson?.orientacaoSexual == null &&
          updated.status === 200 &&
          after.genero === item.genero &&
          after.generoOutro === item.generoOutro &&
          after.orientacaoSexual === null &&
          after.orientacaoSexualOutro === null &&
          after.cidade === cidade &&
          after.telefone === telefone &&
          after.sexo === "masculino",
        `login=${logged.status} conta=${conta.status} update=${updated.status} genero=${after.genero} orientacao=${after.orientacaoSexual}`
      );
    }

    {
      const id = legacyIds.get("transsexual");
      const email = `orient-legacy-transsexual-${stamp}@local.test`;
      const session = jar();
      const logged = await fetch(`${BASE}/api/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, senha: PASSWORD }),
      });
      session.store(logged);
      const updated = await fetch(`${BASE}/api/conta/update`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...session.header() },
        body: JSON.stringify({ orientacaoSexual: "bissexual" }),
      });
      const after = id ? await prisma.user.findUniqueOrThrow({ where: { id } }) : null;
      record(
        "EXPLICIT transsexual",
        updated.status === 200 &&
          after?.orientacaoSexual === "bissexual" &&
          after.genero === "transsexual" &&
          after.generoOutro === null &&
          after.orientacaoSexualOutro === null,
        `status=${updated.status} orientacao=${after?.orientacaoSexual} genero=${after?.genero}`
      );
    }

    {
      const id = legacyIds.get("outro");
      const email = `orient-legacy-outro-${stamp}@local.test`;
      const session = jar();
      const logged = await fetch(`${BASE}/api/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, senha: PASSWORD }),
      });
      session.store(logged);
      const updated = await fetch(`${BASE}/api/conta/update`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...session.header() },
        body: JSON.stringify({ orientacaoSexual: "pansexual" }),
      });
      const after = id ? await prisma.user.findUniqueOrThrow({ where: { id } }) : null;
      record(
        "EXPLICIT outro legado",
        updated.status === 200 &&
          after?.orientacaoSexual === "pansexual" &&
          after.genero === "outro" &&
          after.generoOutro === "texto legado teste" &&
          after.orientacaoSexualOutro === null,
        `status=${updated.status} orientacao=${after?.orientacaoSexual} generoOutro=${after?.generoOutro}`
      );
    }

    {
      const email = `orient-reg-outro-${stamp}@local.test`;
      const session = jar();
      const logged = await fetch(`${BASE}/api/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, senha: PASSWORD }),
      });
      session.store(logged);
      const keepOutro = await fetch(`${BASE}/api/conta/update`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...session.header() },
        body: JSON.stringify({
          orientacaoSexual: "outro",
          orientacaoSexualOutro: "  texto valido de teste  ",
        }),
      });
      const mid = outroUserId
        ? await prisma.user.findUnique({ where: { id: outroUserId } })
        : null;
      const switched = await fetch(`${BASE}/api/conta/update`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...session.header() },
        body: JSON.stringify({ orientacaoSexual: "heterossexual" }),
      });
      const after = outroUserId
        ? await prisma.user.findUnique({ where: { id: outroUserId } })
        : null;
      record(
        "OUTRO limpa complemento",
        logged.status === 200 &&
          keepOutro.status === 200 &&
          mid?.orientacaoSexual === "outro" &&
          mid.orientacaoSexualOutro === "texto valido de teste" &&
          switched.status === 200 &&
          after?.orientacaoSexual === "heterossexual" &&
          after.orientacaoSexualOutro === null &&
          after.genero === null &&
          after.generoOutro === null,
        `keep=${keepOutro.status} switch=${switched.status} finalOutro=${after?.orientacaoSexualOutro}`
      );
    }
  } finally {
    if (createdIds.length) {
      await prisma.loginLog.deleteMany({ where: { userId: { in: createdIds } } });
      await prisma.session.deleteMany({ where: { userId: { in: createdIds } } });
      await prisma.user.deleteMany({ where: { id: { in: createdIds } } });
    }
    const leftover = await prisma.user.count({
      where: { email: { contains: `-${stamp}@local.test` } },
    });
    if (leftover) {
      console.error(`REFUSING leftover: ${leftover} usuários de teste deste stamp ainda existem`);
      results.push({ id: "CLEANUP", ok: false, detail: `leftover=${leftover}` });
    }
    await prisma.$disconnect();
  }

  const failed = results.filter((item) => !item.ok);
  console.log(JSON.stringify({ ok: failed.length === 0, base: BASE, failed: failed.length, results }, null, 2));
  if (failed.length) process.exit(1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
