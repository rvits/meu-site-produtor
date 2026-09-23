import { z } from "zod";
import { CPF_INVALID_MESSAGE, decideCpfUpdate } from "@/app/lib/cpf-validation";
import {
  BIRTH_DATE_IMMUTABLE_MESSAGE,
  civilDateToUtcDate,
  decideBirthDateUpdate,
} from "@/app/lib/birth-date-validation";
import {
  normalizeOrientationOther,
  orientationWriteFields,
  sexualOrientationEnum,
  type SexualOrientation,
} from "@/app/lib/sexual-orientation";

const sexoEnum = z.enum(["masculino", "feminino", "prefiro_nao_declarar"], {
  errorMap: () => ({ message: "Selecione o sexo." }),
});

export const adminCadastroSchema = z
  .object({
    nomeCompleto: z.string().trim().min(2).optional(),
    nomeArtistico: z.string().trim().min(2).optional(),
    nomeSocial: z.string().trim().nullable().optional(),
    telefone: z.string().trim().min(1).optional(),
    pais: z.string().trim().min(1).optional(),
    estado: z.string().trim().min(1).optional(),
    cidade: z.string().trim().min(1).optional(),
    bairro: z.string().trim().min(1).optional(),
    cep: z.string().trim().nullable().optional(),
    cpf: z.string().optional(),
    dataNascimento: z.string().optional(),
    sexo: sexoEnum.optional(),
    orientacaoSexual: sexualOrientationEnum.optional(),
    orientacaoSexualOutro: z.string().nullable().optional(),
  })
  .strict();

export const adminCorrecaoSchema = z
  .object({
    cpfEditavelPeloUsuario: z.boolean().optional(),
    dataNascimentoEditavelPeloUsuario: z.boolean().optional(),
  })
  .strict()
  .refine(
    (data) =>
      data.cpfEditavelPeloUsuario !== undefined ||
      data.dataNascimentoEditavelPeloUsuario !== undefined,
    { message: "Informe a permissão de CPF ou de data de nascimento." }
  );

export type AdminCadastroInput = z.infer<typeof adminCadastroSchema>;

export type AdminProfileSnapshot = {
  nomeCompleto: string;
  nomeArtistico: string;
  nomeSocial: string | null;
  telefone: string;
  pais: string;
  estado: string;
  cidade: string;
  bairro: string;
  cep: string | null;
  cpf: string | null;
  dataNascimento: Date;
  sexo: string | null;
  orientacaoSexual: string | null;
  orientacaoSexualOutro: string | null;
  senha: string;
  role: string;
  genero: string | null;
  generoOutro: string | null;
};

export type AdminProfilePlan =
  | { ok: false; status: number; message: string }
  | { ok: true; data: Record<string, unknown>; fields: string[] };

function textChanged(current: string | null | undefined, incoming: string | null): boolean {
  return String(current ?? "").trim() !== String(incoming ?? "").trim();
}

export function planAdminProfileUpdate(
  current: AdminProfileSnapshot,
  input: AdminCadastroInput
): AdminProfilePlan {
  const data: Record<string, unknown> = {};
  const fields: string[] = [];

  const assignText = (
    field: "nomeCompleto" | "nomeArtistico" | "telefone" | "pais" | "estado" | "cidade" | "bairro",
    incoming: string | undefined
  ) => {
    if (incoming === undefined) return;
    if (!textChanged(current[field], incoming)) return;
    data[field] = incoming.trim();
    fields.push(field);
  };

  assignText("nomeCompleto", input.nomeCompleto);
  assignText("nomeArtistico", input.nomeArtistico);
  assignText("telefone", input.telefone);
  assignText("pais", input.pais);
  assignText("estado", input.estado);
  assignText("cidade", input.cidade);
  assignText("bairro", input.bairro);

  if (input.nomeSocial !== undefined) {
    const next = input.nomeSocial?.trim() ? input.nomeSocial.trim() : null;
    if (textChanged(current.nomeSocial, next)) {
      data.nomeSocial = next;
      fields.push("nomeSocial");
    }
  }

  if (input.cep !== undefined) {
    const next = input.cep?.trim() ? input.cep.trim() : null;
    if (textChanged(current.cep, next)) {
      data.cep = next;
      fields.push("cep");
    }
  }

  if (input.sexo !== undefined && input.sexo !== current.sexo) {
    data.sexo = input.sexo;
    fields.push("sexo");
  }

  if (input.cpf !== undefined) {
    const decision = decideCpfUpdate(current.cpf, input.cpf, { allowEstablishedChange: true });
    if (decision.action === "reject") {
      const status = decision.message === CPF_INVALID_MESSAGE ? 400 : 409;
      return { ok: false, status, message: decision.message };
    }
    if (decision.action === "set") {
      data.cpf = decision.cpf;
      fields.push("cpf");
    }
  }

  if (input.dataNascimento !== undefined) {
    const decision = decideBirthDateUpdate(current.dataNascimento, input.dataNascimento, {
      allowChange: true,
    });
    if (decision.action === "reject") {
      const status = decision.message === BIRTH_DATE_IMMUTABLE_MESSAGE ? 409 : 400;
      return { ok: false, status, message: decision.message };
    }
    if (decision.action === "set") {
      data.dataNascimento = civilDateToUtcDate(decision.civil);
      fields.push("dataNascimento");
    }
  }

  if (input.orientacaoSexual !== undefined) {
    if (input.orientacaoSexual === "outro" && !normalizeOrientationOther(input.orientacaoSexualOutro)) {
      return { ok: false, status: 400, message: "Especifique sua orientação sexual." };
    }
    const written = orientationWriteFields(
      input.orientacaoSexual as SexualOrientation,
      input.orientacaoSexualOutro
    );
    if (written.orientacaoSexual !== current.orientacaoSexual) {
      data.orientacaoSexual = written.orientacaoSexual;
      fields.push("orientacaoSexual");
    }
    if ((written.orientacaoSexualOutro ?? null) !== (current.orientacaoSexualOutro ?? null)) {
      data.orientacaoSexualOutro = written.orientacaoSexualOutro;
      fields.push("orientacaoSexualOutro");
    }
  }

  if ("senha" in data || "role" in data || "genero" in data || "generoOutro" in data) {
    return { ok: false, status: 400, message: "Campo não permitido." };
  }

  return { ok: true, data, fields };
}

export function flagAuditAction(flag: "cpf" | "nascimento", enabled: boolean): string {
  if (flag === "cpf") return enabled ? "cpf_edit_enabled" : "cpf_edit_disabled";
  return enabled ? "birth_date_edit_enabled" : "birth_date_edit_disabled";
}
