/**
 * Validação pura de orientação sexual.
 * Não abre banco, não chama HTTP e não grava usuário.
 */
import assert from "node:assert/strict";
import { registroSchema, updateContaSchema, legacyGeneroEnum } from "../src/app/lib/validations";
import {
  legacyOrientationPresentation,
  orientationWriteFields,
  sexualOrientationEnum,
  type SexualOrientation,
} from "../src/app/lib/sexual-orientation";

const VALID = [
  "heterossexual",
  "homossexual",
  "bissexual",
  "pansexual",
  "assexual",
  "prefiro_nao_informar",
] as const satisfies readonly SexualOrientation[];

const base = {
  nomeCompleto: "Pessoa Teste",
  nomeArtistico: "Artista",
  email: "orientacao@teste.local",
  senha: "senha123",
  telefone: "21999999999",
  cpf: "12345678901",
  pais: "Brasil",
  estado: "RJ",
  cidade: "Rio de Janeiro",
  bairro: "Botafogo",
  dataNascimento: "1995-06-15",
  sexo: "feminino" as const,
};

let passed = 0;

function check(name: string, ok: boolean) {
  assert.equal(ok, true, name);
  passed += 1;
  console.log(`PASS ${name}`);
}

for (const code of VALID) {
  const parsed = registroSchema.safeParse({ ...base, orientacaoSexual: code, orientacaoSexualOutro: "ignorar" });
  check(`registro ${code}`, parsed.success);
  check(`enum ${code}`, sexualOrientationEnum.safeParse(code).success);
  const written = orientationWriteFields(code, "texto que não deve ser copiado");
  check(`${code} não grava complemento`, written.orientacaoSexualOutro === null);
}

{
  const parsed = registroSchema.safeParse({
    ...base,
    orientacaoSexual: "outro",
    orientacaoSexualOutro: "  demissexual  ",
  });
  check("outro com texto", parsed.success && parsed.data.orientacaoSexualOutro?.trim() === "demissexual");
  const written = orientationWriteFields("outro", "  demissexual  ");
  check("outro grava texto trimado", written.orientacaoSexualOutro === "demissexual");
}

for (const bad of [undefined, null, "", "   "]) {
  const parsed = registroSchema.safeParse({
    ...base,
    orientacaoSexual: "outro",
    orientacaoSexualOutro: bad,
  });
  check(`outro sem texto (${JSON.stringify(bad)})`, !parsed.success);
}

for (const bad of ["transsexual", "nao_binario", "desconhecido", ""]) {
  check(`orientação rejeita ${bad || "(vazio)"}`, !sexualOrientationEnum.safeParse(bad).success);
  const parsed = registroSchema.safeParse({ ...base, orientacaoSexual: bad });
  check(`registro rejeita ${bad || "(vazio)"}`, !parsed.success);
}

check("legado ainda aceita transsexual", legacyGeneroEnum.safeParse("transsexual").success);
check("legado ainda aceita nao_binario", legacyGeneroEnum.safeParse("nao_binario").success);
check("orientação não aceita transsexual", !sexualOrientationEnum.safeParse("transsexual").success);

for (const code of ["heterossexual", "homossexual", "bissexual", "prefiro_nao_informar"] as const) {
  const note = legacyOrientationPresentation(code);
  check(
    `nota inequívoca ${code}`,
    note.kind === "unambiguous" && note.label.length > 0 && !("orientacaoSexual" in note)
  );
}

for (const code of ["transsexual", "nao_binario", "outro", "valor_antigo"]) {
  const note = legacyOrientationPresentation(code);
  check(`não converte ${code}`, note.kind === "unconverted" && !("label" in note));
}

check("genero null sem nota", legacyOrientationPresentation(null).kind === "none");
check("genero vazio sem nota", legacyOrientationPresentation("   ").kind === "none");

{
  const kept = updateContaSchema.safeParse({
    nomeArtistico: "Artista",
    genero: "transsexual",
    generoOutro: "texto legado",
  });
  check("update ignora genero legado", kept.success && !("genero" in kept.data) && !("generoOutro" in kept.data));
  check("update sem orientação é válido", updateContaSchema.safeParse({ nomeArtistico: "Artista" }).success);
  check(
    "update outro sem texto é inválido",
    !updateContaSchema.safeParse({ orientacaoSexual: "outro" }).success
  );
  check(
    "update pansexual é válido",
    updateContaSchema.safeParse({ orientacaoSexual: "pansexual", orientacaoSexualOutro: "nao gravar" }).success
  );
}

console.log(`\n${passed} asserts OK`);
