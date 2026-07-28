import postgres from "postgres";
import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import { envNumber } from "@ragtime/core";
import * as schema from "./schema.js";

export type Db = PostgresJsDatabase<typeof schema>;

let _db: Db | null = null;
let _client: ReturnType<typeof postgres> | null = null;

const LOOPBACK_HOSTS = new Set(["localhost", "127.0.0.1", "::1", "[::1]"]);

type SslOption = false | { rejectUnauthorized: boolean; ca?: string };

/**
 * Chooses the Postgres TLS posture. Anything crossing an untrusted network is
 * verified: accepting any certificate lets a host on the path impersonate the
 * database. DATABASE_SSL_MODE overrides the default.
 *
 *   verify     verify against the system store, or DATABASE_CA_CERT
 *   no-verify  encrypt but accept any certificate
 *   disable    no TLS
 */
export function resolveSslOption(url: string): SslOption {
  const mode = process.env.DATABASE_SSL_MODE ?? defaultSslMode(url);
  switch (mode) {
    case "disable":
      return false;
    case "no-verify":
      return { rejectUnauthorized: false };
    case "verify": {
      const ca = process.env.DATABASE_CA_CERT;
      // Supplying `ca` replaces the system store, so only set it when present.
      return ca ? { rejectUnauthorized: true, ca } : { rejectUnauthorized: true };
    }
    default:
      throw new Error(
        `DATABASE_SSL_MODE must be verify, no-verify, or disable (got "${mode}")`
      );
  }
}

/**
 * Loopback needs no TLS. A bare hostname with no dots is a private-network
 * endpoint (Render's internal Postgres host looks like `dpg-abc123-a`) whose
 * self-signed certificate cannot chain to a public CA, so encrypt it without
 * verifying. Every routable host is verified.
 */
function defaultSslMode(url: string): "verify" | "no-verify" | "disable" {
  const host = hostnameOf(url);
  if (host == null) return "verify";
  if (LOOPBACK_HOSTS.has(host)) return "disable";
  return host.includes(".") ? "verify" : "no-verify";
}

function hostnameOf(url: string): string | null {
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return null;
  }
}

export function getDb(): Db {
  if (_db) return _db;
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is required");
  _client = postgres(url, {
    ssl: resolveSslOption(url),
    max: envNumber("DB_POOL_MAX", 3),
    idle_timeout: 20,
    connect_timeout: 30,
  });
  _db = drizzle(_client, { schema });
  return _db;
}

export async function closeDb(): Promise<void> {
  if (_client) {
    await _client.end();
    _client = null;
    _db = null;
  }
}

export { schema };
