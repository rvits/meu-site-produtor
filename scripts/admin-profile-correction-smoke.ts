/**
 * Correção administrativa de cadastro — testes puros.
 * Não abre banco, não chama HTTP e não aplica migration.
 */
import assert from "node:assert/strict";
import fs from "fs";
import path from "path";
import {
  CPF_CLEAR_MESSAGE,
  CPF_IMMUTABLE_MESSAGE,
  CPF_INVALID_MESSAGE,
  decideCpfUpdate,
} from "../src/app/lib/cpf-validation";
import {
  BIRTH_DATE_IMMUTABLE_MESSAGE,
  civilDateToUtcDate,
  civilDateUtc,
  decideBirthDateUpdate,
  formatCivilDateBr,
} from "../src/app/lib/birth-date-validation";
import { adminAuditActorLabel, buildAdminAuditEntry } from "../src/app/lib/admin-audit";
import {
  adminCadastroSchema,
  adminCorrecaoSchema,
  flagAuditAction,
  planAdminProfileUpdate,
  type AdminProfileSnapshot,
} from "../src/app/lib/admin-profile-edit";

const STORED_CPF = "12345678901";
const OTHER_CPF = "10987654321";
const BIRTH = new Date("1990-06-15T00:00:00.000Z");
const OTHER_BIRTH = "1992-04-03";

let passed = 0;

function check(name: string, ok: boolean) {
  assert.equal(ok, true, name);
  passed += 1;
  console.log(`PASS ${name}`);
}

function snapshot(over: Partial<AdminProfileSnapshot> = {}): AdminProfileSnapshot {
  return {
    nomeCompleto: "Nome Completo",
    nomeArtistico: "Artista",
    nomeSocial: null,
    telefone: "21999999999",
    pais: "Brasil",
    estado: "RJ",
    cidade: "Rio de Janeiro",
    bairro: "Centro",
    cep: "20000000",
    cpf: STORED_CPF,
    dataNascimento: BIRTH,
    sexo: "feminino",
    orientacaoSexual: "outro",
    orientacaoSexualOutro: "demissexual",
    senha: "hash-secreto-nao-logar",
    role: "USER",
    genero: "transsexual",
    generoOutro: "texto-legado",
    ...over,
  };
}

function rejectMessage(decision: { action: string; message?: string }) {
  return decision.action === "reject" ? decision.message : undefined;
}

check("cpf false + mesmo", decideCpfUpdate(STORED_CPF, STORED_CPF).action === "omit");
check(
  "cpf false + mesmo formatado",
  decideCpfUpdate(STORED_CPF, "123.456.789-01").action === "omit"
);
check(
  "cpf false + diferente",
  rejectMessage(decideCpfUpdate(STORED_CPF, OTHER_CPF)) === CPF_IMMUTABLE_MESSAGE
);
{
  const allowed = decideCpfUpdate(STORED_CPF, OTHER_CPF, { allowEstablishedChange: true });
  check("cpf true + diferente válido", allowed.action === "set" && allowed.cpf === OTHER_CPF);
}
check(
  "cpf true + inválido",
  rejectMessage(decideCpfUpdate(STORED_CPF, "123", { allowEstablishedChange: true })) ===
    CPF_INVALID_MESSAGE
);
check(
  "cpf true + vazio",
  rejectMessage(decideCpfUpdate(STORED_CPF, "", { allowEstablishedChange: true })) === CPF_CLEAR_MESSAGE
);
check(
  "cpf true + null",
  rejectMessage(decideCpfUpdate(STORED_CPF, null, { allowEstablishedChange: true })) === CPF_CLEAR_MESSAGE
);
check(
  "cpf bloquear novamente",
  rejectMessage(decideCpfUpdate(OTHER_CPF, STORED_CPF, { allowEstablishedChange: false })) ===
    CPF_IMMUTABLE_MESSAGE
);

check(
  "nascimento false + mesmo",
  decideBirthDateUpdate(BIRTH, "1990-06-15").action === "omit"
);
check(
  "nascimento false + diferente",
  rejectMessage(decideBirthDateUpdate(BIRTH, OTHER_BIRTH)) === BIRTH_DATE_IMMUTABLE_MESSAGE
);
{
  const allowed = decideBirthDateUpdate(BIRTH, OTHER_BIRTH, { allowChange: true });
  check(
    "nascimento true + diferente válido",
    allowed.action === "set" && allowed.civil === OTHER_BIRTH
  );
  if (allowed.action === "set") {
    check(
      "nascimento grava meia-noite UTC",
      civilDateUtc(civilDateToUtcDate(allowed.civil)) === OTHER_BIRTH
    );
  }
}
check(
  "nascimento mesmo dia civil",
  decideBirthDateUpdate(BIRTH, "1990-06-15T15:00:00.000Z", { allowChange: true }).action === "omit"
);
check(
  "nascimento bloquear novamente",
  rejectMessage(decideBirthDateUpdate(civilDateToUtcDate(OTHER_BIRTH), "1990-06-15")) ===
    BIRTH_DATE_IMMUTABLE_MESSAGE
);

const current = snapshot();
{
  const noop = planAdminProfileUpdate(current, {
    cpf: "123.456.789-01",
    dataNascimento: "1990-06-15",
    cidade: "Rio de Janeiro",
    orientacaoSexual: "outro",
    orientacaoSexualOutro: "demissexual",
  });
  check("no-op não gera campos", noop.ok === true && noop.fields.length === 0);
}
{
  const changed = planAdminProfileUpdate(current, { cidade: "Niterói" });
  check(
    "admin altera só o campo enviado",
    changed.ok === true &&
      changed.fields.join(",") === "cidade" &&
      changed.data.cidade === "Niterói" &&
      !("senha" in changed.data) &&
      !("role" in changed.data) &&
      !("genero" in changed.data) &&
      !("generoOutro" in changed.data)
  );
}
{
  const cpf = planAdminProfileUpdate(current, { cpf: OTHER_CPF });
  check(
    "admin cpf direto",
    cpf.ok === true && cpf.fields.join(",") === "cpf" && cpf.data.cpf === OTHER_CPF
  );
}
{
  const birth = planAdminProfileUpdate(current, { dataNascimento: OTHER_BIRTH });
  const birthValue = birth.ok ? birth.data.dataNascimento : null;
  check(
    "admin nascimento direto",
    birth.ok === true &&
      birth.fields.join(",") === "dataNascimento" &&
      birthValue instanceof Date &&
      civilDateUtc(birthValue) === OTHER_BIRTH
  );
}
check(
  "admin não apaga cpf",
  planAdminProfileUpdate(current, { cpf: "" }).ok === false
);
check(
  "outro exige complemento",
  planAdminProfileUpdate(current, { orientacaoSexual: "outro", orientacaoSexualOutro: "  " }).ok ===
    false
);
{
  const left = planAdminProfileUpdate(current, {
    orientacaoSexual: "heterossexual",
    orientacaoSexualOutro: "demissexual",
  });
  check(
    "sair de outro limpa complemento",
    left.ok === true &&
      left.data.orientacaoSexual === "heterossexual" &&
      left.data.orientacaoSexualOutro === null &&
      left.fields.includes("orientacaoSexual") &&
      left.fields.includes("orientacaoSexualOutro") &&
      !("genero" in left.data) &&
      !("generoOutro" in left.data)
  );
}

for (const extra of [
  { senha: "nova-senha" },
  { role: "ADMIN" },
  { genero: "heterossexual" },
  { generoOutro: "x" },
  { email: "outro@local.test" },
  { cpfEditavelPeloUsuario: true },
  { dataNascimentoEditavelPeloUsuario: true },
  { blocked: true },
]) {
  check(`cadastro rejeita ${Object.keys(extra)[0]}`, !adminCadastroSchema.safeParse(extra).success);
}

check(
  "flag cpf isolada",
  adminCorrecaoSchema.safeParse({ cpfEditavelPeloUsuario: true }).success
);
check(
  "flag nascimento isolada",
  adminCorrecaoSchema.safeParse({ dataNascimentoEditavelPeloUsuario: false }).success
);
check("flag vazia rejeitada", !adminCorrecaoSchema.safeParse({}).success);
check(
  "flag rejeita senha",
  !adminCorrecaoSchema.safeParse({ cpfEditavelPeloUsuario: true, senha: "x" }).success
);
check("acao liberar cpf", flagAuditAction("cpf", true) === "cpf_edit_enabled");
check("acao bloquear cpf", flagAuditAction("cpf", false) === "cpf_edit_disabled");
check("acao liberar nascimento", flagAuditAction("nascimento", true) === "birth_date_edit_enabled");
check(
  "acao bloquear nascimento",
  flagAuditAction("nascimento", false) === "birth_date_edit_disabled"
);

const audit = buildAdminAuditEntry({
  adminId: "admin-1",
  targetUserId: "user-1",
  action: "profile_update",
  field: "cpf",
});
const auditJson = JSON.stringify(audit);
check("audit não contém cpf", !auditJson.includes(STORED_CPF) && !auditJson.includes(OTHER_CPF));
check("audit não contém nascimento", !auditJson.includes("1990-06-15") && !auditJson.includes(OTHER_BIRTH));
check("audit não contém senha", !auditJson.includes("hash-secreto"));
check(
  "audit só identifica a ação",
  audit.action === "profile_update" && audit.field === "cpf" && Object.keys(audit).length === 4
);
check("admin removido não expõe id", adminAuditActorLabel(null) === "Administrador removido");
check("admin presente usa o nome", adminAuditActorLabel("  Admin Correcao  ") === "Admin Correcao");

const root = process.cwd();
const orientationSql = fs.readFileSync(
  path.join(root, "prisma/migrations/20260922140200_add_sexual_orientation/migration.sql"),
  "utf8"
);
const correctionSql = fs.readFileSync(
  path.join(root, "prisma/migrations/20260922180000_admin_profile_correction/migration.sql"),
  "utf8"
);
const cadastroRoute = fs.readFileSync(
  path.join(root, "src/app/api/admin/usuarios/cadastro/route.ts"),
  "utf8"
);
const correcaoRoute = fs.readFileSync(
  path.join(root, "src/app/api/admin/usuarios/correcao/route.ts"),
  "utf8"
);
const schema = fs.readFileSync(path.join(root, "prisma/schema.prisma"), "utf8");
const auditoriaRoute = fs.readFileSync(
  path.join(root, "src/app/api/admin/usuarios/auditoria/route.ts"),
  "utf8"
);
const resetSrc = fs.readFileSync(path.join(root, "src/app/lib/launch/reset.ts"), "utf8");
const updateRoute = fs.readFileSync(path.join(root, "src/app/api/conta/update/route.ts"), "utf8");

check(
  "migration de orientação intacta",
  orientationSql.includes('ADD COLUMN IF NOT EXISTS "orientacaoSexual"') &&
    !/DROP|UPDATE|genero|senha/i.test(orientationSql)
);
check(
  "nova migration aditiva",
  correctionSql.includes('"cpfEditavelPeloUsuario" BOOLEAN NOT NULL DEFAULT false') &&
    correctionSql.includes('"dataNascimentoEditavelPeloUsuario" BOOLEAN NOT NULL DEFAULT false') &&
    correctionSql.includes('CREATE TABLE IF NOT EXISTS "AdminAuditLog"') &&
    correctionSql.includes('"adminId" TEXT,') &&
    correctionSql.includes('"targetUserId" TEXT,') &&
    !correctionSql.includes('"adminId" TEXT NOT NULL') &&
    !correctionSql.includes('"targetUserId" TEXT NOT NULL') &&
    correctionSql.includes('ON DELETE SET NULL') &&
    !correctionSql.includes("ON DELETE RESTRICT") &&
    !/\bDROP\b/i.test(correctionSql) &&
    !/\bUPDATE\s+"/i.test(correctionSql)
);
check(
  "schema com relações opcionais",
  schema.includes("adminId      String?") &&
    schema.includes("targetUserId String?") &&
    schema.includes('User?    @relation("AdminAuditActor"') &&
    schema.includes("onDelete: SetNull") &&
    !schema.includes("onDelete: Restrict")
);
check(
  "auditoria tolera admin removido",
  auditoriaRoute.includes("adminAuditActorLabel(row.admin?.nomeArtistico)") &&
    !auditoriaRoute.includes("row.admin.nomeArtistico")
);
check(
  "reset apaga o histórico administrativo",
  resetSrc.includes("tx.adminAuditLog.deleteMany({})")
);
check("cadastro exige admin", cadastroRoute.includes("requireAdmin()"));
check("flags exigem admin", correcaoRoute.includes("requireAdmin()"));
check("cadastro trata cpf duplicado", cadastroRoute.includes("CPF_DUPLICATE_MESSAGE"));
check(
  "usuario não controla os flags",
  updateRoute.includes("delete body.cpfEditavelPeloUsuario") &&
    updateRoute.includes("delete body.dataNascimentoEditavelPeloUsuario")
);
{
  const iso = "1990-06-15T00:00:00.000Z";
  const shown = formatCivilDateBr(iso);
  const local = new Date(iso);
  const localLabel = `${String(local.getDate()).padStart(2, "0")}/${String(local.getMonth() + 1).padStart(2, "0")}/${local.getFullYear()}`;
  check("1990-06-15T00:00:00.000Z -> 15/06/1990", shown === "15/06/1990");
  check("1990-06-15 -> 15/06/1990", formatCivilDateBr("1990-06-15") === "15/06/1990");
  check(
    "exibição civil independe do fuso local",
    shown === "15/06/1990" && (localLabel === "15/06/1990" || shown !== localLabel)
  );
}
const adminUsuariosPage = fs.readFileSync(
  path.join(root, "src/app/admin/usuarios/page.tsx"),
  "utf8"
);
check(
  "cartão admin usa data civil",
  adminUsuariosPage.includes("formatCivilDateBr(u.dataNascimento)") &&
    !adminUsuariosPage.includes("new Date(u.dataNascimento).toLocaleDateString")
);

console.log(`\n${passed} asserts OK`);
