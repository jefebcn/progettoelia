import { isDbConfigured, query } from "@/lib/server/db";
import { json } from "@/lib/server/http";
import { isPinConfigured } from "@/lib/server/pin";

export const dynamic = "force-dynamic";

/** Diagnosi: database collegato e raggiungibile, PIN operatore impostato. */
export async function GET() {
  const staffPin = isPinConfigured();
  if (!isDbConfigured()) return json({ db: "not_configured", staffPin }, 503);
  try {
    const [{ slots }] = await query<{ slots: number }>(`select count(*)::int as slots from slots`);
    return json({ db: "ok", slots, staffPin });
  } catch (err) {
    console.error("[health]", err);
    return json({ db: "error", staffPin }, 503);
  }
}
