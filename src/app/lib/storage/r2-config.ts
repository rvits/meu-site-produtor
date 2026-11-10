/**
 * Configuração R2 só no servidor. O import não exige variáveis.
 * Valores nunca entram em mensagem de erro.
 *
 * R2_DELIVERIES_BUCKET e R2_PORTFOLIO_BUCKET são buckets distintos.
 */

if (typeof window !== "undefined") {
  throw new Error("r2-config só pode ser usado no servidor.");
}

export type R2SharedSettings = {
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
  endpoint: string;
};

export type R2DeliverySettings = R2SharedSettings & {
  deliveriesBucket: string;
};

export type R2PortfolioSettings = R2SharedSettings & {
  portfolioBucket: string;
};

export type R2ConfigResult = { ok: true; settings: R2DeliverySettings } | { ok: false; code: "unconfigured" };
export type R2PortfolioConfigResult =
  | { ok: true; settings: R2PortfolioSettings }
  | { ok: false; code: "unconfigured" };

function clean(value: string | undefined): string {
  return String(value ?? "").trim();
}

function bucketNameOk(name: string): boolean {
  return /^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$/.test(name);
}

function readR2SharedSettings(): { ok: true; settings: R2SharedSettings } | { ok: false; code: "unconfigured" } {
  const accountId = clean(process.env.R2_ACCOUNT_ID);
  const accessKeyId = clean(process.env.R2_ACCESS_KEY_ID);
  const secretAccessKey = clean(process.env.R2_SECRET_ACCESS_KEY);
  if (!accountId || !accessKeyId || !secretAccessKey) {
    return { ok: false, code: "unconfigured" };
  }
  if (!/^[a-z0-9]{8,64}$/i.test(accountId)) return { ok: false, code: "unconfigured" };
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
      endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    },
  };
}

export function readR2DeliverySettings(): R2ConfigResult {
  const shared = readR2SharedSettings();
  if (!shared.ok) return shared;
  const deliveriesBucket = clean(process.env.R2_DELIVERIES_BUCKET);
  if (!deliveriesBucket || !bucketNameOk(deliveriesBucket)) return { ok: false, code: "unconfigured" };
  return {
    ok: true,
    settings: {
      ...shared.settings,
      deliveriesBucket,
    },
  };
}

export function readR2PortfolioSettings(): R2PortfolioConfigResult {
  const shared = readR2SharedSettings();
  if (!shared.ok) return shared;
  const portfolioBucket = clean(process.env.R2_PORTFOLIO_BUCKET);
  if (!portfolioBucket || !bucketNameOk(portfolioBucket)) return { ok: false, code: "unconfigured" };
  return {
    ok: true,
    settings: {
      ...shared.settings,
      portfolioBucket,
    },
  };
}
