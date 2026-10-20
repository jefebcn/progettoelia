import { Pool } from "pg";
import { SCHEMA_SQL, SCHEMA_VERSION } from "./schema";

/**
 * Connessione al Postgres (Neon via Vercel). Solo lato server: la stringa di
 * connessione non arriva mai al browser.
 *
 * Vercel + Neon impostano DATABASE_URL in automatico; POSTGRES_URL è il nome
 * usato dalla vecchia integrazione "Vercel Postgres".
 */
function connectionString(): string | null {
  return process.env.DATABASE_URL || process.env.POSTGRES_URL || null;
}

export function isDbConfigured(): boolean {
  return connectionString() !== null;
}

export class DbNotConfiguredError extends Error {
  constructor() {
    super("DB_NOT_CONFIGURED");
  }
}

let pool: Pool | null = null;

function getPool(): Pool {
  if (pool) return pool;
  const raw = connectionString();
  if (!raw) throw new DbNotConfiguredError();

  // SSL lo configuriamo noi in modo esplicito: i parametri sslmode/channel_binding
  // delle stringhe Neon non sono interpretati in modo uniforme da node-postgres.
  const url = new URL(raw);
  url.searchParams.delete("sslmode");
  url.searchParams.delete("channel_binding");
  const local = ["localhost", "127.0.0.1", "::1"].includes(url.hostname);

  pool = new Pool({
    connectionString: url.toString(),
    ssl: local ? false : { rejectUnauthorized: true },
    max: 5,
    idleTimeoutMillis: 5_000,
    // Neon "addormentato" si risveglia da solo, ma la prima connessione può
    // richiedere qualche secondo.
    connectionTimeoutMillis: 15_000,
  });
  // Senza listener un errore su una connessione inattiva farebbe crashare il processo.
  pool.on("error", (err) => console.error("[db] errore connessione inattiva", err));
  return pool;
}

let schemaReady: Promise<void> | null = null;

/** Crea/aggiorna le tabelle una volta per istanza del server. */
export function ensureSchema(): Promise<void> {
  if (!schemaReady) {
    schemaReady = migrate().catch((err) => {
      schemaReady = null; // al prossimo tentativo riprova
      throw err;
    });
  }
  return schemaReady;
}

async function migrate(): Promise<void> {
  const client = await getPool().connect();
  try {
    // Controllo veloce (una query per istanza) prima di riapplicare lo schema.
    // Postgres valida la tabella anche dentro un CASE, quindi servono due query.
    const meta = await client.query<{ present: boolean }>(
      `select to_regclass('public.app_meta') is not null as present`,
    );
    if (meta.rows[0]?.present) {
      const { rows } = await client.query<{ value: string }>(
        `select value from app_meta where key = 'schema_version'`,
      );
      if (rows[0]?.value === String(SCHEMA_VERSION)) return;
    }

    await client.query("begin");
    // Due istanze che partono insieme non applicano lo schema in parallelo.
    await client.query("select pg_advisory_xact_lock(727001)");
    await client.query(SCHEMA_SQL);
    await client.query(
      `insert into app_meta (key, value) values ('schema_version', $1)
       on conflict (key) do update set value = excluded.value`,
      [String(SCHEMA_VERSION)],
    );
    await client.query("commit");
  } catch (err) {
    await client.query("rollback").catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

export async function query<T extends object = Record<string, unknown>>(
  text: string,
  params: unknown[] = [],
): Promise<T[]> {
  await ensureSchema();
  const res = await getPool().query<T>(text, params);
  return res.rows;
}

/**
 * Converte un errore del database in un codice sicuro da mostrare al client.
 * Le funzioni SQL sollevano eccezioni con codici come 'SLOT_FULL' (sqlstate
 * P0001); tutto il resto diventa SERVER_ERROR senza dettagli interni.
 */
export function errorCode(err: unknown): string {
  if (err instanceof DbNotConfiguredError) return "DB_NOT_CONFIGURED";
  const e = err as { code?: string; message?: string };
  if (e?.code === "P0001" && e.message && /^[A-Z_]+$/.test(e.message)) return e.message;
  console.error("[db]", err);
  return "SERVER_ERROR";
}
