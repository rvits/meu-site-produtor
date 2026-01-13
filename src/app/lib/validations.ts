import { z } from "zod";

export const loginSchema = z.object({
  email: z.string().email("Email inválido"),
  senha: z.string().min(6, "Senha deve ter no mínimo 6 caracteres"),
});

export const registroSchema = z.object({
  nomeArtistico: z.string().min(2, "Nome deve ter no mínimo 2 caracteres"),
  email: z.string().email("Email inválido"),
  senha: z.string().min(6, "Senha deve ter no mínimo 6 caracteres"),
  telefone: z.string().min(1, "Telefone é obrigatório"),
  pais: z.string().min(1, "País é obrigatório"),
  estado: z.string().min(1, "Estado é obrigatório"),
  cidade: z.string().min(1, "Cidade é obrigatória"),
  bairro: z.string().min(1, "Bairro é obrigatório"),
  dataNascimento: z.string(),
  estilosMusicais: z.string().optional(),
  nacionalidade: z.string().optional(),
});

export const agendamentoSchema = z.object({
  data: z.string(),
  hora: z.string().regex(/^\d{2}:\d{2}$/, "Hora inválida"),
  duracaoMinutos: z.number().int().min(30).max(480),
  tipo: z.string().min(1, "Tipo é obrigatório"),
  observacoes: z.string().optional(),
});

export const updateContaSchema = z.object({
  nomeArtistico: z.string().min(2).optional(),
  email: z.string().email().optional(),
  telefone: z.string().optional(),
  senha: z.string().min(6).optional(),
  senhaAtual: z.string().optional(),
});

export const checkoutSchema = z.object({
  planId: z.string(),
  modo: z.enum(["mensal", "anual"]),
});

export const chatSchema = z.object({
  message: z.string().optional(),
  sessionId: z.string().optional(),
  messages: z.array(z.any()).optional(),
});

export const faqSchema = z.object({
  question: z.string().min(5, "Pergunta muito curta"),
  answer: z.string().min(10, "Resposta muito curta"),
});
