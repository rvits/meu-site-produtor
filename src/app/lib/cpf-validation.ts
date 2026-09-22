export function normalizeCpfDigits(cpf: string | null | undefined): string {
  return String(cpf || "").replace(/\D/g, "");
}

/** null, undefined ou só espaços: ainda não há CPF para proteger. */
export function isCpfAbsent(cpf: string | null | undefined): boolean {
  if (cpf == null) return true;
  return String(cpf).trim() === "";
}

/** Qualquer valor não vazio já gravado conta como estabelecido, mesmo legado ou inválido. */
export function isCpfEstablished(cpf: string | null | undefined): boolean {
  return !isCpfAbsent(cpf);
}

/** 11 dígitos comparáveis. Null quando o texto não é um CPF normalizável com segurança. */
export function usableCpfDigits(cpf: string | null | undefined): string | null {
  const digits = normalizeCpfDigits(cpf);
  return /^\d{11}$/.test(digits) ? digits : null;
}

export const CPF_DUPLICATE_MESSAGE = "O CPF informado já está cadastrado.";

export const CPF_IMMUTABLE_MESSAGE = "CPF não pode ser alterado após o cadastro.";

export const CPF_INVALID_MESSAGE = "Informe um CPF válido com 11 dígitos.";

export type CpfUpdateDecision =
  | { action: "omit" }
  | { action: "set"; cpf: string }
  | { action: "reject"; message: string };

/**
 * CPF ausente pode ser preenchido uma vez com 11 dígitos.
 * CPF já gravado — com pontuação, 11 dígitos ou texto legado — não é substituído nem apagado.
 * O mesmo CPF em outra formatação é no-op e não regrava a coluna.
 * Valor não vazio que não normaliza para 11 dígitos permanece bloqueado.
 */
export function decideCpfUpdate(
  currentCpf: string | null | undefined,
  incoming: string | null | undefined
): CpfUpdateDecision {
  if (incoming === undefined) return { action: "omit" };

  const incomingDigits = normalizeCpfDigits(incoming);

  if (!isCpfEstablished(currentCpf)) {
    if (incomingDigits.length === 0) return { action: "omit" };
    if (!usableCpfDigits(incoming)) {
      return { action: "reject", message: CPF_INVALID_MESSAGE };
    }
    return { action: "set", cpf: incomingDigits };
  }

  const existingUsable = usableCpfDigits(currentCpf);
  if (existingUsable) {
    if (incomingDigits === existingUsable) return { action: "omit" };
    return { action: "reject", message: CPF_IMMUTABLE_MESSAGE };
  }

  const currentTrim = String(currentCpf ?? "").trim();
  const incomingTrim = incoming == null ? "" : String(incoming).trim();
  if (incomingTrim !== "" && incomingTrim === currentTrim) return { action: "omit" };

  const existingDigits = normalizeCpfDigits(currentCpf);
  if (existingDigits.length > 0 && incomingDigits === existingDigits) return { action: "omit" };

  return { action: "reject", message: CPF_IMMUTABLE_MESSAGE };
}
