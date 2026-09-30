import type {
  BetterAuthOptions,
  DBAdapter,
  DBTransactionAdapter,
} from "better-auth";
import {
  type OidcConfigFields,
  sealOidcConfigJson,
  unsealOidcConfigJson,
} from "@/core/lib/auth/oidc-config-seal";

const SSO_PROVIDER_MODEL = "ssoProvider";
const ENC_PREFIX = "enc:v1:";

type AdapterFactory = (options: BetterAuthOptions) => DBAdapter;

function isSealedSecret(value: string) {
  return value.startsWith(ENC_PREFIX);
}

/** Decrypt oidcConfig.clientSecret in the returned row only (never write back). */
function unsealSsoProviderRow<T>(row: T): T {
  if (!row || typeof row !== "object") {
    return row;
  }
  const record = row as Record<string, unknown>;
  if (typeof record.oidcConfig !== "string") {
    return row;
  }
  return {
    ...record,
    oidcConfig: unsealOidcConfigJson(record.oidcConfig),
  } as T;
}

/** Seal plaintext clientSecret before any DB write from Better Auth. */
function sealOidcConfigField(oidcConfig: unknown): unknown {
  if (typeof oidcConfig !== "string" || !oidcConfig.trim()) {
    return oidcConfig;
  }
  try {
    const parsed = JSON.parse(oidcConfig) as OidcConfigFields;
    if (
      typeof parsed.clientSecret === "string" &&
      parsed.clientSecret.trim() &&
      !isSealedSecret(parsed.clientSecret)
    ) {
      return sealOidcConfigJson(parsed);
    }
  } catch {
    return oidcConfig;
  }
  return oidcConfig;
}

function sealSsoProviderWriteData(
  model: string,
  data: Record<string, unknown>
): Record<string, unknown> {
  if (model !== SSO_PROVIDER_MODEL || typeof data.oidcConfig !== "string") {
    return data;
  }
  return {
    ...data,
    oidcConfig: sealOidcConfigField(data.oidcConfig),
  };
}

function wrapAdapterUnsealOidc(
  adapter: DBAdapter | DBTransactionAdapter
): DBAdapter {
  const wrapped: DBAdapter = {
    ...adapter,
    count: (data) => adapter.count(data),
    create: async (data) => {
      const nextData = {
        ...data,
        data: sealSsoProviderWriteData(
          data.model,
          data.data as Record<string, unknown>
        ) as typeof data.data,
      };
      return await adapter.create(nextData);
    },
    createSchema: adapter.createSchema?.bind(adapter),
    delete: (data) => adapter.delete(data),
    deleteMany: (data) => adapter.deleteMany(data),
    findMany: async <T>(data: {
      model: string;
      where?: Parameters<DBAdapter["findMany"]>[0]["where"];
      limit?: number;
      select?: string[];
      sortBy?: Parameters<DBAdapter["findMany"]>[0]["sortBy"];
      offset?: number;
      join?: Parameters<DBAdapter["findMany"]>[0]["join"];
    }) => {
      const results = await adapter.findMany<T>(data);
      if (data.model !== SSO_PROVIDER_MODEL) {
        return results;
      }
      return results.map((row) => unsealSsoProviderRow(row));
    },
    findOne: async <T>(data: {
      model: string;
      where: Parameters<DBAdapter["findOne"]>[0]["where"];
      select?: string[];
      join?: Parameters<DBAdapter["findOne"]>[0]["join"];
    }) => {
      const result = await adapter.findOne<T>(data);
      if (data.model !== SSO_PROVIDER_MODEL || !result) {
        return result;
      }
      return unsealSsoProviderRow(result);
    },
    id: adapter.id,
    options: adapter.options,
    transaction: async (callback) => {
      if (!("transaction" in adapter) || !adapter.transaction) {
        return await callback(wrapped as DBTransactionAdapter);
      }
      return await adapter.transaction(async (trx) =>
        callback(wrapAdapterUnsealOidc(trx) as DBTransactionAdapter)
      );
    },
    update: async (data) => {
      const nextUpdate = sealSsoProviderWriteData(
        data.model,
        data.update as Record<string, unknown>
      );
      return await adapter.update({
        ...data,
        update: nextUpdate,
      });
    },
    updateMany: async (data) => {
      const nextUpdate = sealSsoProviderWriteData(
        data.model,
        data.update as Record<string, unknown>
      );
      return await adapter.updateMany({
        ...data,
        update: nextUpdate,
      });
    },
  };
  return wrapped;
}

/**
 * Wrap Better Auth's DB adapter so SSO oidcConfig.clientSecret is decrypted
 * only in memory on read, and re-sealed on any write. Avoids temporarily
 * persisting plaintext secrets in Postgres during SSO.
 */
export function withUnsealedSsoOidcAdapter(
  base: AdapterFactory | DBAdapter
): AdapterFactory {
  return (options) => {
    const adapter =
      typeof base === "function" ? base(options) : (base as DBAdapter);
    return wrapAdapterUnsealOidc(adapter);
  };
}
