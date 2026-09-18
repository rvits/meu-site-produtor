/**
 * Itens do carrinho persistidos em JSON não devem gravar `null` em campos string.
 * `JSON.stringify({ data: null })` produz `"data":null`, que o Zod 3 rejeitava.
 */

export type CartServiceLine = {
  id: string;
  nome?: string;
  quantidade: number;
  preco?: number;
};

export type CartCheckoutItemInput = {
  cartId?: number;
  data?: string | null;
  hora?: string | null;
  duracaoMinutos?: number;
  tipo?: string | null;
  servicos?: CartServiceLine[];
  beats?: CartServiceLine[];
  total: number;
  subtotal?: number;
  discount?: number;
  observacoes?: string | null;
  cupomCode?: string | null;
  cupomAplicado?: unknown;
  somenteCupons?: boolean;
};

function presentString(value: string | null | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

export function toPersistedCartItem(input: CartCheckoutItemInput): Record<string, unknown> {
  const item: Record<string, unknown> = {
    total: input.total,
  };
  if (input.cartId != null) item.cartId = input.cartId;
  const data = presentString(input.data);
  const hora = presentString(input.hora);
  const tipo = presentString(input.tipo);
  const observacoes = presentString(input.observacoes);
  const cupomCode = presentString(input.cupomCode);
  if (data) item.data = data;
  if (hora) item.hora = hora;
  if (input.duracaoMinutos != null) item.duracaoMinutos = input.duracaoMinutos;
  if (tipo) item.tipo = tipo;
  if (input.servicos) item.servicos = input.servicos;
  if (input.beats) item.beats = input.beats;
  if (input.subtotal != null) item.subtotal = input.subtotal;
  if (input.discount != null) item.discount = input.discount;
  if (observacoes) item.observacoes = observacoes;
  if (cupomCode) item.cupomCode = cupomCode;
  if (input.cupomAplicado) item.cupomAplicado = input.cupomAplicado;
  if (input.somenteCupons) item.somenteCupons = true;
  return item;
}

export function sanitizeCartItemsForCheckoutApi(
  items: Array<Record<string, unknown>>
): Array<Record<string, unknown>> {
  return items.map((raw) =>
    toPersistedCartItem({
      data: (raw.data as string | null) ?? null,
      hora: (raw.hora as string | null) ?? null,
      duracaoMinutos:
        typeof raw.duracaoMinutos === "number" ? raw.duracaoMinutos : undefined,
      tipo: (raw.tipo as string | null) ?? null,
      servicos: Array.isArray(raw.servicos) ? (raw.servicos as CartServiceLine[]) : [],
      beats: Array.isArray(raw.beats) ? (raw.beats as CartServiceLine[]) : [],
      total: Number(raw.total) || 0,
      subtotal: typeof raw.subtotal === "number" ? raw.subtotal : undefined,
      discount: typeof raw.discount === "number" ? raw.discount : undefined,
      observacoes: (raw.observacoes as string | null) ?? null,
      cupomCode: (raw.cupomCode as string | null) ?? null,
      somenteCupons: raw.somenteCupons === true,
    })
  );
}
