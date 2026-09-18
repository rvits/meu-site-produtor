/**
 * Validação de entrada do checkout de agendamento/carrinho.
 *
 * JSON serializa campos opcionais ausentes como `null` (não como `undefined`).
 * Em Zod 3, `z.string().optional()` rejeita `null` com
 * "Expected string, received null" — mensagem interna que não deve ir ao cliente.
 */
import { z, type ZodError } from "zod";
import {
  countAgendamentoItemLines,
  exigeAgendamentoHora,
  exigeAgendamentoNoCheckout,
} from "@/app/lib/agendamento-payment-rules";

const PAYMENT_METHODS = ["cartao_credito", "cartao_debito", "pix", "boleto"] as const;

/** Aceita string, null, undefined ou "" e normaliza para string ausente. */
export const optionalCheckoutString = z
  .union([z.string(), z.null()])
  .optional()
  .transform((value) => {
    if (value == null) return undefined;
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : undefined;
  });

/** JSON `null` em número opcional — mesmo problema do Zod 3, tipo number. */
export const optionalCheckoutNumber = z
  .union([z.number(), z.null()])
  .optional()
  .transform((value) => (value == null ? undefined : value));

const checkoutLineSchema = z.object({
  id: z.string().min(1, "Serviço inválido no carrinho."),
  quantidade: z.number().int().min(1).max(20),
  nome: optionalCheckoutString,
  preco: optionalCheckoutNumber,
});

export const carrinhoCheckoutItemSchema = z.object({
  data: optionalCheckoutString,
  hora: optionalCheckoutString,
  somenteCupons: z
    .union([z.boolean(), z.null()])
    .optional()
    .transform((value) => value ?? undefined),
  duracaoMinutos: optionalCheckoutNumber,
  tipo: optionalCheckoutString,
  servicos: z.array(checkoutLineSchema).optional(),
  beats: z.array(checkoutLineSchema).optional(),
  observacoes: optionalCheckoutString,
  cupomCode: optionalCheckoutString,
});

export const carrinhoCheckoutSchema = z.object({
  items: z.array(carrinhoCheckoutItemSchema).min(1, "Carrinho deve ter pelo menos um agendamento"),
  paymentMethod: z
    .enum(PAYMENT_METHODS, {
      errorMap: () => ({ message: "Selecione uma forma de pagamento válida." }),
    })
    .nullish()
    .transform((value) => value ?? undefined),
});

export const agendamentoCheckoutSchema = z
  .object({
    servicos: z.array(checkoutLineSchema).optional(),
    beats: z.array(checkoutLineSchema).optional(),
    data: optionalCheckoutString,
    hora: optionalCheckoutString,
    duracaoMinutos: optionalCheckoutNumber,
    tipo: optionalCheckoutString,
    observacoes: optionalCheckoutString,
    paymentMethod: z
      .enum(PAYMENT_METHODS, {
        errorMap: () => ({ message: "Selecione uma forma de pagamento válida." }),
      })
      .nullish()
      .transform((value) => value ?? undefined),
    cupomCode: optionalCheckoutString,
    symbolicAgendamento: z
      .union([z.boolean(), z.null()])
      .optional()
      .transform((value) => value ?? undefined),
  })
  .superRefine((payload, ctx) => {
    const lines = countAgendamentoItemLines(payload.servicos, payload.beats);
    if (lines === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Selecione ao menos um serviço ou pacote.",
      });
    }
    if (!exigeAgendamentoNoCheckout(payload.servicos, payload.beats)) return;
    if (!payload.data?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Selecione a data do agendamento.",
        path: ["data"],
      });
    }
    if (exigeAgendamentoHora(payload.servicos, payload.beats) && !payload.hora?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Selecione o horário do agendamento.",
        path: ["hora"],
      });
    }
  });

export type CarrinhoCheckoutInput = z.infer<typeof carrinhoCheckoutSchema>;
export type AgendamentoCheckoutInput = z.infer<typeof agendamentoCheckoutSchema>;

export function publicCheckoutZodMessage(error: ZodError): string {
  const issue = error.issues[0];
  if (!issue) return "Dados do checkout inválidos.";
  const path = issue.path.map(String).join(".");
  const raw = issue.message || "";
  const leaksInternalType =
    /expected/i.test(raw) || /received/i.test(raw) || /invalid_type/i.test(raw);

  if (path.includes("paymentMethod")) {
    return "Selecione uma forma de pagamento válida.";
  }
  if (path.includes("cupomCode")) {
    return "Cupom inválido. Remova o cupom ou aplique um código válido.";
  }
  if (path.includes("servicos") || path.includes("beats") || path.endsWith("id")) {
    return "Há um serviço inválido no carrinho. Remova os itens e selecione novamente.";
  }
  if (path.includes("data") || path.includes("hora")) {
    return "Data ou horário do agendamento inválidos. Volte ao agendamento e selecione novamente.";
  }
  if (!leaksInternalType && raw.trim()) return raw;
  return "Não foi possível iniciar o pagamento. Verifique os dados do agendamento e tente novamente.";
}

export function checkoutZodIssueSummaries(error: ZodError): Array<{ path: string; code: string }> {
  return error.issues.map((issue) => ({
    path: issue.path.map(String).join(".") || "(root)",
    code: issue.code,
  }));
}

export function publicCheckoutFailureMessage(err: unknown): string {
  const message = err instanceof Error ? err.message : String(err);
  if (message === "Não autenticado") return message;
  if (message.includes("operationId é obrigatório")) {
    return "Não foi possível iniciar o pagamento. Tente novamente.";
  }
  if (
    message.includes("Asaas") ||
    message.includes("checkout Asaas") ||
    message.includes("Infinity Pay")
  ) {
    return "Não foi possível iniciar o pagamento no momento. Tente novamente em instantes.";
  }
  return "Não foi possível iniciar o pagamento. Verifique seus dados e tente novamente.";
}

/**
 * `JSON.stringify` grava `null` em campos opcionais do carrinho.
 * Tratar `null` como campo ausente (não como string vazia).
 */
export function omitCheckoutJsonNulls(value: unknown): unknown {
  if (value === null) return undefined;
  if (Array.isArray(value)) return value.map(omitCheckoutJsonNulls);
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
      if (nested === null) continue;
      const cleaned = omitCheckoutJsonNulls(nested);
      if (cleaned !== undefined) out[key] = cleaned;
    }
    return out;
  }
  return value;
}

export function logCheckoutEvent(
  route: "carrinho" | "agendamento" | "plano",
  event: string,
  extra?: Record<string, unknown>
): void {
  console.info(
    JSON.stringify({
      source: "checkout",
      route,
      event,
      ...extra,
    })
  );
}
