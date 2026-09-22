import { z } from "zod";

export const SEXUAL_ORIENTATION_OPTIONS = [
  { value: "heterossexual", label: "Heterossexual" },
  { value: "homossexual", label: "Homossexual" },
  { value: "bissexual", label: "Bissexual" },
  { value: "pansexual", label: "Pansexual" },
  { value: "assexual", label: "Assexual" },
  { value: "outro", label: "Outro" },
  { value: "prefiro_nao_informar", label: "Prefiro não informar" },
] as const;

export type SexualOrientation = (typeof SEXUAL_ORIENTATION_OPTIONS)[number]["value"];

const SEXUAL_ORIENTATION_CODES = SEXUAL_ORIENTATION_OPTIONS.map((option) => option.value) as [
  SexualOrientation,
  ...SexualOrientation[],
];

export const sexualOrientationEnum = z.enum(SEXUAL_ORIENTATION_CODES, {
  errorMap: () => ({ message: "Selecione a orientação sexual." }),
});

/** Códigos antigos de `genero` que já eram orientação. Não grava `orientacaoSexual`. */
const UNAMBIGUOUS_LEGACY_GENERO = [
  "heterossexual",
  "homossexual",
  "bissexual",
  "prefiro_nao_informar",
] as const;

export type LegacyOrientationPresentation =
  | { kind: "none" }
  | { kind: "unambiguous"; label: string }
  | { kind: "unconverted" };

export function sexualOrientationLabel(code: string | null | undefined): string {
  const found = SEXUAL_ORIENTATION_OPTIONS.find((option) => option.value === code);
  return found?.label ?? "";
}

export function normalizeOrientationOther(value: string | null | undefined): string | null {
  const trimmed = String(value ?? "").trim();
  return trimmed ? trimmed : null;
}

/** Campos graváveis. `outro` guarda o texto; as demais opções zeram o complemento. */
export function orientationWriteFields(
  orientacaoSexual: SexualOrientation,
  orientacaoSexualOutro: string | null | undefined
): { orientacaoSexual: SexualOrientation; orientacaoSexualOutro: string | null } {
  return {
    orientacaoSexual,
    orientacaoSexualOutro:
      orientacaoSexual === "outro" ? normalizeOrientationOther(orientacaoSexualOutro) : null,
  };
}

/**
 * Nota de tela para cadastro antigo. Não escolhe nem persiste orientação sexual.
 * Não devolve `generoOutro`.
 */
export function legacyOrientationPresentation(
  genero: string | null | undefined
): LegacyOrientationPresentation {
  const code = String(genero ?? "").trim();
  if (!code) return { kind: "none" };
  const match = UNAMBIGUOUS_LEGACY_GENERO.find((item) => item === code);
  if (!match) return { kind: "unconverted" };
  return { kind: "unambiguous", label: sexualOrientationLabel(match) };
}
