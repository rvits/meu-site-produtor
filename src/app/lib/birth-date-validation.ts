export const BIRTH_DATE_MIN_YEAR = 1900;

/** Menor idade permitida — ano máximo = ano atual menos esta idade. */
export const BIRTH_DATE_MIN_AGE = 12;

export function getBirthDateMaxYear(): number {
  return new Date().getFullYear() - BIRTH_DATE_MIN_AGE;
}

export function validateBirthDateString(dateStr: string): { valid: true } | { valid: false; error: string } {
  const trimmed = String(dateStr || "").trim();
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trimmed);
  if (!match) {
    return { valid: false, error: "Data de nascimento inválida." };
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);

  if (year < BIRTH_DATE_MIN_YEAR || year > getBirthDateMaxYear()) {
    return {
      valid: false,
      error: `Data de nascimento deve estar entre ${BIRTH_DATE_MIN_YEAR} e ${getBirthDateMaxYear()}.`,
    };
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

  return { valid: true };
}
