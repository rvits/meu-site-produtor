/**
 * Configuração R2 só no servidor. O import não exige variáveis.
 * Valores nunca entram em mensagem de erro.
 */

if (typeof window !== "undefined") {
  throw new Error("r2-config só pode ser usado no servidor.");
}

export type R2DeliverySettings = {
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
  deliveriesBucket: string;
  endpoint: string;
};

export type R2ConfigResult = { ok: true; settings: R2DeliverySettings } | { ok: false; code: "unconfigured" };

function clean(value: string | undefined): string {
  return String(value ?? "").trim();
}

export function readR2DeliverySettings(): R2ConfigResult {
  const accountId = clean(process.env.R2_ACCOUNT_ID);
  const accessKeyId = clean(process.env.R2_ACCESS_KEY_ID);
  const secretAccessKey = clean(process.env.R2_SECRET_ACCESS_KEY);
  const deliveriesBucket = clean(process.env.R2_DELIVERIES_BUCKET);
  if (!accountId || !accessKeyId || !secretAccessKey || !deliveriesBucket) {
    return { ok: false, code: "unconfigured" };
  }
  if (!/^[a-z0-9]{8,64}$/i.test(accountId)) return { ok: false, code: "unconfigured" };
  if (!/^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$/.test(deliveriesBucket)) return { ok: false, code: "unconfigured" };
  if (accessKeyId.length < 8 || accessKeyId.length > 128 || secretAccessKey.length < 8 || secretAccessKey.length > 256) {
    return { ok: false, code: "unconfigured" };
  }
  if (/[\r\n\0]/.test(accessKeyId) || /[\r\n\0]/.test(secretAccessKey)) {
    return { ok: false, code: "unconfigured" };
  }
  return {
    ok: true,
    settings: {
      accountId,
      accessKeyId,
      secretAccessKey,
      deliveriesBucket,
      endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    },
  };
}
