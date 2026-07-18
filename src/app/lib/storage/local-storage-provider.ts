/**
 * GO-01.2 — Storage local (comportamento atual: public/uploads/deliveries).
 * Único lugar do app que toca fs / path físico de entrega.
 */
import { mkdir, writeFile, unlink, access } from "fs/promises";
import path from "path";
import type {
  DeliveryWriteInput,
  DeliveryWriteResult,
  StorageProvider,
} from "@/app/lib/storage/types";

const PUBLIC_PREFIX = "/uploads/deliveries/";

function deliveriesDir(): string {
  return path.join(process.cwd(), "public", "uploads", "deliveries");
}

function toStoredName(publicPathOrName: string): string {
  const raw = String(publicPathOrName || "").trim();
  if (raw.startsWith(PUBLIC_PREFIX)) return raw.slice(PUBLIC_PREFIX.length);
  return path.basename(raw);
}

export class LocalStorageProvider implements StorageProvider {
  readonly kind = "local" as const;

  async writeDelivery(input: DeliveryWriteInput): Promise<DeliveryWriteResult> {
    const dir = deliveriesDir();
    await mkdir(dir, { recursive: true });
    const abs = path.join(dir, input.storedName);
    await writeFile(abs, input.bytes);
    return {
      publicPath: `${PUBLIC_PREFIX}${input.storedName}`,
      storedName: input.storedName,
      bytes: input.bytes.length,
    };
  }

  async deleteDelivery(publicPathOrName: string): Promise<void> {
    const name = toStoredName(publicPathOrName);
    if (!name || name.includes("..")) return;
    const abs = path.join(deliveriesDir(), name);
    try {
      await unlink(abs);
    } catch {
      /* inexistente */
    }
  }

  async existsDelivery(publicPathOrName: string): Promise<boolean> {
    const name = toStoredName(publicPathOrName);
    if (!name || name.includes("..")) return false;
    try {
      await access(path.join(deliveriesDir(), name));
      return true;
    } catch {
      return false;
    }
  }
}
