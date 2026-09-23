export const BIRTH_DATE_MIN_YEAR = 1900;

/** Menor idade permitida — ano máximo = ano atual menos esta idade. */
export const BIRTH_DATE_MIN_AGE = 12;

/** Maior idade aceita (idade máxima). */
export const BIRTH_DATE_MAX_AGE = 120;

export function getBirthDateMaxYear(): number {
  return new Date().getFullYear() - BIRTH_DATE_MIN_AGE;
}

/** Ano mínimo compatível com a idade máxima. */
export function getBirthDateMinYear(): number {
  return Math.max(BIRTH_DATE_MIN_YEAR, new Date().getFullYear() - BIRTH_DATE_MAX_AGE);
}

function ageFromParts(year: number, month: number, day: number, today = new Date()): number {
  let age = today.getFullYear() - year;
  const m = today.getMonth() + 1 - month;
  if (m < 0 || (m === 0 && today.getDate() < day)) age--;
  return age;
}

export const BIRTH_DATE_IMMUTABLE_MESSAGE =
  "Data de nascimento não pode ser alterada após o cadastro.";

/**
 * Dia civil no mesmo critério de GET /api/conta: `Date#toISOString().slice(0, 10)`.
 * Uma string YYYY-MM-DD é usada como está, sem `new Date`, para não deslocar o dia.
 */
export function civilDateUtc(value: Date | string | null | undefined): string | null {
  if (value == null || value === "") return null;
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return null;
    return value.toISOString().slice(0, 10);
  }
  const match = /^(\d{4}-\d{2}-\d{2})/.exec(String(value).trim());
  return match ? match[1] : null;
}

export type BirthDateUpdateDecision =
  | { action: "omit" }
  | { action: "set"; civil: string }
  | { action: "reject"; message: string };

/**
 * Data já gravada não é substituída, salvo quando `allowChange` está ligado.
 * O mesmo dia civil é no-op. null/undefined significam campo omitido.
 */
export function decideBirthDateUpdate(
  current: Date | string | null | undefined,
  incoming: string | null | undefined,
  options?: { allowChange?: boolean }
): BirthDateUpdateDecision {
  if (incoming === undefined || incoming === null) return { action: "omit" };

  const existingCivil = civilDateUtc(current);
  const incomingCivil = civilDateUtc(incoming);
  if (existingCivil && incomingCivil === existingCivil) return { action: "omit" };

  if (!options?.allowChange) {
    return { action: "reject", message: BIRTH_DATE_IMMUTABLE_MESSAGE };
  }

  if (!incomingCivil) {
    return { action: "reject", message: "Data de nascimento inválida." };
  }

  const checked = validateBirthDateString(incomingCivil);
  if (!checked.valid) {
    return { action: "reject", message: checked.error };
  }

  return { action: "set", civil: incomingCivil };
}

export function civilDateToUtcDate(civil: string): Date {
  return new Date(`${civil}T00:00:00.000Z`);
}

/** DD/MM/YYYY a partir do dia civil. Não usa o fuso do navegador. */
export function formatCivilDateBr(value: Date | string | null | undefined): string {
  const civil = civilDateUtc(value);
  if (!civil) return "";
  const [year, month, day] = civil.split("-");
  return `${day}/${month}/${year}`;
}

export function validateBirthDateString(
  dateStr: string
): { valid: true } | { valid: false; error: string } {
  const trimmed = String(dateStr || "").trim();
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trimmed);
  if (!match) {
    return { valid: false, error: "Data de nascimento inválida." };
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);

  const minYear = getBirthDateMinYear();
  const maxYear = getBirthDateMaxYear();

  if (!Number.isFinite(year) || year < minYear || year > maxYear) {
    return {
      valid: false,
      error: `Ano de nascimento deve estar entre ${minYear} e ${maxYear}.`,
    };
  }

  if (month < 1 || month > 12 || day < 1 || day > 31) {
    return { valid: false, error: "Data de nascimento inválida." };
  }

  const parsed = new Date(year, month - 1, day);
  if (
    parsed.getFullYear() !== year ||
    parsed.getMonth() !== month - 1 ||
    parsed.getDate() !== day
  ) {
    return { valid: false, error: "Data de nascimento inválida." };
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  if (parsed > today) {
    return { valid: false, error: "Data de nascimento não pode ser futura." };
  }

  const age = ageFromParts(year, month, day, today);
  if (age < BIRTH_DATE_MIN_AGE) {
    return {
      valid: false,
      error: `Idade mínima permitida: ${BIRTH_DATE_MIN_AGE} anos.`,
    };
  }
  if (age > BIRTH_DATE_MAX_AGE) {
    return {
      valid: false,
      error: `Idade máxima permitida: ${BIRTH_DATE_MAX_AGE} anos.`,
    };
  }

  return { valid: true };
}
