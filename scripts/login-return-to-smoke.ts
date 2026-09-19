/**
 * Return-to pós-login: reusa sanitizeInternalRedirect (sem open redirect).
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  loginHrefWithInternalReturn,
  resolvePostLoginRedirect,
  sanitizeInternalRedirect,
} from "../src/app/lib/safe-redirect";

function pass(label: string) {
  console.log("PASS", label);
}

const visao = "/minha-conta?tab=visao-geral";
assert.equal(sanitizeInternalRedirect(visao), visao);
assert.equal(
  resolvePostLoginRedirect(new URLSearchParams(`redirect=${encodeURIComponent(visao)}`)),
  visao
);
assert.equal(
  loginHrefWithInternalReturn(visao),
  `/login?redirect=${encodeURIComponent(visao)}`
);
pass("minha-conta?tab=visao-geral volta após login");

assert.equal(sanitizeInternalRedirect("https://example.com"), "/minha-conta");
assert.equal(sanitizeInternalRedirect("//example.com"), "/minha-conta");
assert.equal(sanitizeInternalRedirect("javascript:alert(1)"), "/minha-conta");
assert.equal(sanitizeInternalRedirect("data:text/html,hi"), "/minha-conta");
assert.equal(sanitizeInternalRedirect("https://site-malicioso.com"), "/minha-conta");
pass("rejeita URL externa / protocol-relative / javascript / data");

const loginPage = fs.readFileSync(
  path.join(__dirname, "../src/app/login/page.tsx"),
  "utf8"
);
assert.match(loginPage, /resolvePostLoginRedirect\(searchParams\)/);
assert.match(loginPage, /router\.push\(redirectTo\)/);
pass("login page usa resolvePostLoginRedirect existente");

const portal = fs.readFileSync(
  path.join(__dirname, "../src/app/minha-conta/portal-ui/ClientPortal.tsx"),
  "utf8"
);
assert.match(portal, /loginHrefWithInternalReturn/);
pass("ClientPortal envia redirect interno");

console.log(JSON.stringify({ reportId: "login-return-to-smoke", pass: true }, null, 2));
