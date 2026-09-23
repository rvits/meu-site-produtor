/**
 * Regressão: slot civil do carrinho → Appointment.data → roundtrip America/Sao_Paulo.
 * Deve passar com TZ=UTC e TZ=America/Sao_Paulo.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  carrinhoItemToAppointmentDate,
} from "../src/app/lib/asaas-carrinho-payment-effects";
import {
  formatStudioDatePtBR,
  formatStudioDateTimePtBR,
  formatStudioTimePtBR,
  getHourStudio,
  hoursCoveredByPresencial,
  parseStudioDateTime,
  toIsoDateStudio,
} from "../src/app/lib/calendar-day-state";

function ok(label: string) {
  console.log("PASS", label);
}

const CARRINHO_SRC = readFileSync(
  join(process.cwd(), "src/app/lib/asaas-carrinho-payment-effects.ts"),
  "utf8"
);

assert.equal(
  CARRINHO_SRC.includes("new Date(`${data}T${hora}:00`)"),
  false,
  "carrinho voltou a construir Date sem offset"
);
assert.match(CARRINHO_SRC, /carrinhoItemToAppointmentDate/);
ok("carrinho source não usa new Date(`${data}T${hora}:00`)");

const DATE = "2026-09-23";

const CASES: Array<{ hora: string; isoUtc: string; brtDate: string; brtHour: string }> = [
  { hora: "00:00", isoUtc: "2026-09-23T03:00:00.000Z", brtDate: "2026-09-23", brtHour: "00:00" },
  { hora: "00:30", isoUtc: "2026-09-23T03:00:00.000Z", brtDate: "2026-09-23", brtHour: "00:00" },
  { hora: "10:00", isoUtc: "2026-09-23T13:00:00.000Z", brtDate: "2026-09-23", brtHour: "10:00" },
  { hora: "16:00", isoUtc: "2026-09-23T19:00:00.000Z", brtDate: "2026-09-23", brtHour: "16:00" },
  { hora: "17:00", isoUtc: "2026-09-23T20:00:00.000Z", brtDate: "2026-09-23", brtHour: "17:00" },
  { hora: "18:00", isoUtc: "2026-09-23T21:00:00.000Z", brtDate: "2026-09-23", brtHour: "18:00" },
  { hora: "19:00", isoUtc: "2026-09-23T22:00:00.000Z", brtDate: "2026-09-23", brtHour: "19:00" },
  { hora: "20:00", isoUtc: "2026-09-23T23:00:00.000Z", brtDate: "2026-09-23", brtHour: "20:00" },
  { hora: "21:00", isoUtc: "2026-09-24T00:00:00.000Z", brtDate: "2026-09-23", brtHour: "21:00" },
  { hora: "22:00", isoUtc: "2026-09-24T01:00:00.000Z", brtDate: "2026-09-23", brtHour: "22:00" },
  { hora: "23:00", isoUtc: "2026-09-24T02:00:00.000Z", brtDate: "2026-09-23", brtHour: "23:00" },
  { hora: "23:30", isoUtc: "2026-09-24T02:00:00.000Z", brtDate: "2026-09-23", brtHour: "23:00" },
];

for (const c of CASES) {
  const fromCart = carrinhoItemToAppointmentDate(DATE, c.hora);
  const fromStudio = parseStudioDateTime(DATE, c.hora);
  assert.equal(fromCart.getTime(), fromStudio.getTime(), `${c.hora} cart !== parseStudioDateTime`);
  assert.equal(fromCart.toISOString(), c.isoUtc, `${c.hora} ISO`);
  assert.equal(toIsoDateStudio(fromCart), c.brtDate, `${c.hora} civil date`);
  assert.equal(getHourStudio(fromCart), c.brtHour, `${c.hora} getHourStudio`);
  const displayedHour = formatStudioTimePtBR(fromCart);
  assert.equal(displayedHour.slice(0, 2), c.brtHour.slice(0, 2), `${c.hora} formatStudioTimePtBR`);
  if (c.hora === "19:00") {
    assert.equal(displayedHour, "19:00");
    assert.equal(fromCart.toISOString(), "2026-09-23T22:00:00.000Z");
    assert.equal(hoursCoveredByPresencial(fromCart, 60).join(","), "19:00");
    assert.notEqual(displayedHour, "16:00");
    assert.notEqual(displayedHour, "17:00");
  }
  if (c.hora === "20:00") {
    assert.equal(displayedHour, "20:00");
    assert.equal(fromCart.toISOString(), "2026-09-23T23:00:00.000Z");
  }
  if (c.hora === "21:00") {
    assert.equal(displayedHour, "21:00");
    assert.equal(fromCart.toISOString(), "2026-09-24T00:00:00.000Z");
    assert.equal(toIsoDateStudio(fromCart), "2026-09-23");
    assert.equal(formatStudioDatePtBR(fromCart), "23/09/2026");
  }
  if (c.hora === "22:00") {
    assert.equal(displayedHour, "22:00");
    assert.equal(fromCart.toISOString(), "2026-09-24T01:00:00.000Z");
    assert.equal(formatStudioDateTimePtBR(fromCart), "23/09/2026 22:00");
  }
  ok(`${DATE} ${c.hora} → ${c.isoUtc} → ${c.brtHour} BRT`);
}

assert.notEqual(
  carrinhoItemToAppointmentDate(DATE, "19:00").toISOString(),
  "2026-09-23T19:00:00.000Z",
  "19:00 não pode ser persistido como 19:00Z"
);
ok("19:00 não persiste como 19:00Z (bug Vercel)");

const apt47 = parseStudioDateTime("2026-09-24", "15:00");
assert.equal(apt47.toISOString(), "2026-09-24T18:00:00.000Z");
assert.equal(formatStudioTimePtBR(apt47), "15:00");
assert.equal(formatStudioDatePtBR(apt47), "24/09/2026");
ok("controle cupom 15:00 BRT → 18:00Z (Appointment 47)");

const master22 = parseStudioDateTime("2026-10-27", "22:00");
assert.equal(master22.toISOString(), "2026-10-28T01:00:00.000Z");
assert.equal(formatStudioTimePtBR(master22), "22:00");
assert.equal(toIsoDateStudio(master22), "2026-10-27");
ok("controle date-only 22:00 BRT → 01:00Z dia seguinte (Appointment 53)");

console.log("TZ process.env.TZ =", process.env.TZ || "(unset)");
console.log("OK carrinho-timezone-smoke");
