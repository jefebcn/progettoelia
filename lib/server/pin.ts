import { createHash, timingSafeEqual } from "node:crypto";
import { query } from "./db";

const MAX_FAILURES = 10;
const WINDOW = "15 minutes";

export function isPinConfigured(): boolean {
  return (process.env.STAFF_PIN ?? "").length >= 6;
}

const digest = (s: string) => createHash("sha256").update(s, "utf8").digest();

/**
 * Verifica il PIN operatore (variabile d'ambiente STAFF_PIN).
 * Ritorna null se valido, altrimenti il codice d'errore.
 * Massimo 10 tentativi errati ogni 15 minuti per IP.
 */
export async function pinError(pin: string, ip: string): Promise<string | null> {
  if (!isPinConfigured()) return "PIN_NOT_SET";

  const [{ n }] = await query<{ n: number }>(
    `select count(*)::int as n from pin_failures
      where client_ip = $1 and at > now() - $2::interval`,
    [ip, WINDOW],
  );
  if (n >= MAX_FAILURES) return "TOO_MANY_ATTEMPTS";

  if (timingSafeEqual(digest(pin), digest(process.env.STAFF_PIN as string))) return null;

  await query(`insert into pin_failures (client_ip) values ($1)`, [ip]);
  await query(`delete from pin_failures where at < now() - interval '1 day'`);
  await new Promise((r) => setTimeout(r, 700)); // rallenta i tentativi a raffica
  return "BAD_PIN";
}
