import { z } from "zod";
import { validateBirthDateString } from "@/app/lib/birth-date-validation";

const sexoEnum = z.enum(["masculino", "feminino", "prefiro_nao_declarar"], {
  errorMap: () => ({ message: "Selecione o sexo." }),
});

const generoEnum = z.enum(
  [
    "heterossexual",
    "homossexual",
    "bissexual",
    "transsexual",
    "nao_binario",
    "outro",
    "prefiro_nao_informar",
  ],
  { errorMap: () => ({ message: "Selecione o gênero." }) }
);

const birthDateSchema = z
  .string()
  .min(1, "Data de nascimento é obrigatória.")
  .superRefine((val, ctx) => {
    const result = validateBirthDateString(val);
    if (!result.valid) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: result.error });
    }
  });

export const loginSchema = z.object({
  email: z.string().email("Email inválido"),
  senha: z.string().min(6, "Senha deve ter no mínimo 6 caracteres"),
});

export const registroSchema = z.object({
  nomeCompleto: z.string().min(2, "Nome completo deve ter no mínimo 2 caracteres"),
  nomeArtistico: z.string().min(2, "Nome deve ter no mínimo 2 caracteres"),
  nomeSocial: z.string().optional().nullable(),
  email: z.string().email("Email inválido"),
  senha: z.string().min(6, "Senha deve ter no mínimo 6 caracteres"),
  telefone: z.string().min(1, "Telefone é obrigatório"),
  cpf: z.string().regex(/^\d{11}$/, "CPF deve conter 11 dígitos numéricos"),
  pais: z.string().min(1, "País é obrigatório"),
  estado: z.string().min(1, "Estado é obrigatório"),
  cidade: z.string().min(1, "Cidade é obrigatória"),
  bairro: z.string().min(1, "Bairro é obrigatório"),
  dataNascimento: birthDateSchema,
  sexo: sexoEnum,
  genero: generoEnum,
  generoOutro: z.string().optional().nullable(),
  estilosMusicais: z.string().optional().nullable(),
  nacionalidade: z.string().optional().nullable(),
});

export const agendamentoSchema = z.object({
  data: z.string(),
  hora: z.string().regex(/^\d{2}:\d{2}$/, "Hora inválida"),
  duracaoMinutos: z.number().int().min(30).max(480),
  tipo: z.string().min(1, "Tipo é obrigatório"),
  observacoes: z.string().optional(),
});

/**
 * PATCH de conta: JSON `null` significa "não alterar", não "string vazia".
 * Zod 3 `z.string().optional()` rejeita null com "Expected string, received null".
 */
const omitNullKeepString = z
  .union([z.string(), z.null()])
  .optional()
  .transform((value) => (value === null ? undefined : value));

export const updateContaSchema = z.object({
  nomeArtistico: omitNullKeepString.pipe(z.string().min(2).optional()),
  nomeSocial: omitNullKeepString,
  email: omitNullKeepString.pipe(z.string().email().optional()),
  telefone: omitNullKeepString,
  sexo: sexoEnum.nullish(),
  genero: generoEnum.nullish(),
  generoOutro: omitNullKeepString,
  senha: omitNullKeepString.pipe(z.string().min(6).optional()),
  senhaAtual: omitNullKeepString,
  cpf: omitNullKeepString,
  cep: omitNullKeepString,
  dataNascimento: z
    .union([birthDateSchema, z.null()])
    .optional()
    .transform((value) => (value === null ? undefined : value)),
  pais: omitNullKeepString,
  cidade: omitNullKeepString,
  bairro: omitNullKeepString,
  estado: omitNullKeepString,
  estilosMusicais: z.string().optional().nullable(),
  nacionalidade: z.string().optional().nullable(),
  /** URL pública do avatar (https ou path /uploads/…). Vazio limpa a foto. */
  foto: z
    .string()
    .max(2048)
    .optional()
    .nullable()
    .refine(
      (v) =>
        v == null ||
        v === "" ||
        v.startsWith("https://") ||
        v.startsWith("/uploads/"),
      { message: "URL da foto inválida" }
    ),
});

export const checkoutSchema = z.object({
  planId: z.string().optional(),
  modo: z.enum(["mensal", "anual"]).optional(),
  tipo: z.enum(["plano", "agendamento"]).optional(),
  paymentMethod: z.enum(["cartao_credito", "cartao_debito", "pix", "boleto"]).optional(),
});

export const pagamentoInfoSchema = z.object({
  nome: z.string().min(2, "Nome deve ter no mínimo 2 caracteres"),
  dataNascimento: birthDateSchema,
  cpf: z.string().regex(/^\d{11}$/, "CPF deve conter 11 dígitos"),
  pais: z.string().min(1, "País é obrigatório"),
  cidade: z.string().min(1, "Cidade é obrigatória"),
  bairro: z.string().min(1, "Bairro é obrigatório"),
  cep: z.string().regex(/^\d{8}$/, "CEP deve conter 8 dígitos"),
  aceiteTermos: z.boolean().refine((val) => val === true, {
    message: "É necessário aceitar os termos de contrato",
  }),
});

export const chatSchema = z.object({
  message: z.string().optional().nullable(),
  sessionId: z.string().optional().nullable(),
  messages: z.array(z.object({
    id: z.string().optional(),
    role: z.string(),
    content: z.string(),
  })).optional().nullable(),
}).refine(
  (data) => data.message || (data.messages && data.messages.length > 0),
  {
    message: "É necessário fornecer 'message' ou 'messages'",
  }
);

export const faqSchema = z.object({
  question: z.string().min(5, "Pergunta muito curta"),
  answer: z.string().min(10, "Resposta muito curta"),
});

export function publicContaUpdateZodMessage(error: z.ZodError): string {
  const issue = error.issues[0];
  if (!issue) return "Não foi possível salvar seus dados. Verifique os campos e tente novamente.";
  const path = issue.path.map(String).join(".");
  const raw = issue.message || "";
  const leaksInternalType =
    /expected/i.test(raw) || /received/i.test(raw) || /invalid_type/i.test(raw);

  if (path.includes("cpf")) return "Informe um CPF válido com 11 dígitos.";
  if (path.includes("cep")) return "Informe um CEP válido.";
  if (path.includes("dataNascimento")) {
    return leaksInternalType ? "Informe uma data de nascimento válida." : raw;
  }
  if (path.includes("email")) return "Informe um e-mail válido.";
  if (path.includes("nomeArtistico") || path.includes("nome")) {
    return "Informe um nome com no mínimo 2 caracteres.";
  }
  if (!leaksInternalType && raw.trim()) return raw;
  return "Não foi possível salvar seus dados. Verifique nome, CPF, CEP e data de nascimento.";
}
