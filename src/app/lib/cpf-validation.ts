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

export const CPF_CLEAR_MESSAGE = "CPF não pode ser apagado.";

export const CPF_INVALID_MESSAGE = "Informe um CPF válido com 11 dígitos.";

export type CpfUpdateDecision =
  | { action: "omit" }
  | { action: "set"; cpf: string }
  | { action: "reject"; message: string };

/**
 * CPF ausente pode ser preenchido uma vez com 11 dígitos.
 * CPF já gravado — com pontuação, 11 dígitos ou texto legado — não é substituído nem apagado,
 * salvo quando `allowEstablishedChange` está ligado. Nesse caso um CPF novo de 11 dígitos
 * pode substituir o atual. Vazio continua rejeitado. O mesmo CPF em outra formatação é no-op.
 */
export function decideCpfUpdate(
  currentCpf: string | null | undefined,
  incoming: string | null | undefined,
  options?: { allowEstablishedChange?: boolean }
): CpfUpdateDecision {
  if (incoming === undefined) return { action: "omit" };

  const incomingDigits = normalizeCpfDigits(incoming);
  const incomingTrim = incoming == null ? "" : String(incoming).trim();
  const allowChange = options?.allowEstablishedChange === true;

  if (!isCpfEstablished(currentCpf)) {
    if (incomingDigits.length === 0) return { action: "omit" };
    if (!usableCpfDigits(incoming)) {
      return { action: "reject", message: CPF_INVALID_MESSAGE };
    }
    return { action: "set", cpf: incomingDigits };
  }

  const existingUsable = usableCpfDigits(currentCpf);
  if (existingUsable && incomingDigits === existingUsable) return { action: "omit" };

  const currentTrim = String(currentCpf ?? "").trim();
  if (!existingUsable && incomingTrim !== "" && incomingTrim === currentTrim) {
    return { action: "omit" };
  }

  const existingDigits = normalizeCpfDigits(currentCpf);
  if (!existingUsable && existingDigits.length > 0 && incomingDigits === existingDigits) {
    return { action: "omit" };
  }

  if (!allowChange) {
    return { action: "reject", message: CPF_IMMUTABLE_MESSAGE };
  }

  if (incomingTrim === "") {
    return { action: "reject", message: CPF_CLEAR_MESSAGE };
  }

  const nextDigits = usableCpfDigits(incoming);
  if (!nextDigits) {
    return { action: "reject", message: CPF_INVALID_MESSAGE };
  }

  return { action: "set", cpf: nextDigits };
}
