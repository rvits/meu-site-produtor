/**
 * Portal do Cliente (GO-03D) — helpers de apresentação.
 * A classificação de cupons e nomes de serviço reproduz exatamente a
 * lógica que já existia na página Minha Conta (sem mudança de regra).
 */

import { resolveCanonicalCouponType } from "@/app/lib/domain/coupon-types";
import type { Cupom } from "./types";

export function isPlanFamilyCoupon(c: Cupom): boolean {
  const t = c.canonicalCouponType || resolveCanonicalCouponType(c);
  return t === "PLAN" || t === "DISCOUNT" || (t === "TEST" && Boolean(c.userPlanId));
}

export function isRefundFamilyCoupon(c: Cupom): boolean {
  const t = c.canonicalCouponType || resolveCanonicalCouponType(c);
  return t === "REFUND";
}

export function isServiceFamilyCoupon(c: Cupom): boolean {
  const t = c.canonicalCouponType || resolveCanonicalCouponType(c);
  if (t === "SERVICE" || t === "REBOOK") return true;
  if (
    (t === "TEST" || t === "PLAN" || t === "BONUS" || t === "REFUND") &&
    c.discountType === "service" &&
    c.serviceType &&
    !String(c.serviceType).startsWith("percent_")
  ) {
    return true;
  }
  return false;
}

/** Rota de resgate do cupom — mesma regra da página original. */
export function couponScheduleHref(c: Cupom): string {
  if (isServiceFamilyCoupon(c)) {
    return `/agendamento/cupom/${encodeURIComponent(c.code)}`;
  }
  return `/agendamento?cupom=${encodeURIComponent(c.code)}`;
}

export function getServiceName(
  serviceType: string,
  cupons: Cupom[],
  couponCode?: string
): string {
  const coupon = cupons.find((c) => c.code === couponCode);
  const isTeste = coupon ? resolveCanonicalCouponType(coupon) === "TEST" : false;
  const names: Record<string, string> = {
    sessao: isTeste ? "Sessão Teste" : "Sessão",
    captacao: isTeste ? "Captação Teste" : "Captação",
    sonoplastia: isTeste ? "Sonoplastia Teste" : "Sonoplastia",
    mix: isTeste ? "Mixagem Teste" : "Mixagem",
    master: isTeste ? "Masterização Teste" : "Masterização",
    mix_master: isTeste ? "Mix + Master Teste" : "Mix + Master",
    beat1: isTeste ? "1 Beat Teste" : "1 Beat",
    beat2: isTeste ? "2 Beats Teste" : "2 Beats",
    beat3: isTeste ? "3 Beats Teste" : "3 Beats",
    beat4: isTeste ? "4 Beats Teste" : "4 Beats",
    beat_mix_master: isTeste ? "Beat + Mix + Master Teste" : "Beat + Mix + Master",
    producao_completa: isTeste ? "Produção Completa Teste" : "Produção Completa",
    percent_servicos: "10% em serviços avulsos",
    percent_beats: "10% em beats",
  };
  return names[serviceType] || (isTeste ? `${serviceType} (Teste)` : serviceType);
}

/** Copia texto com fallback para navegadores antigos (mesmo comportamento anterior). */
export async function copyToClipboard(text: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const textArea = document.createElement("textarea");
    textArea.value = text;
    textArea.style.position = "fixed";
    textArea.style.opacity = "0";
    document.body.appendChild(textArea);
    textArea.select();
    document.execCommand("copy");
    document.body.removeChild(textArea);
  }
}

/** Bytes de uma entrega não estão disponíveis no payload; retorna extensão amigável. */
export function deliveryTypeLabel(format: string | null, url: string): string {
  const fmt = (format || "").toLowerCase();
  if (fmt === "wav") return "WAV";
  if (fmt === "mp3") return "MP3";
  if (fmt === "zip" || /\.zip(\?|$)/i.test(url)) return "ZIP";
  const m = url.match(/\.(\w{2,4})(\?|$)/);
  return m ? m[1].toUpperCase() : "Arquivo";
}

export function isAudioDelivery(format: string | null, url: string): boolean {
  const fmt = (format || "").toLowerCase();
  return (fmt === "wav" || fmt === "mp3") && !/\.zip(\?|$)/i.test(url);
}
