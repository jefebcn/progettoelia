import { getSlots, getSystem, recentEntries } from "@/lib/server/queries";
import { errorResponse, json } from "@/lib/server/http";
import { eventToday } from "@/lib/format";

export const dynamic = "force-dynamic";

const ENTRY_VISIBLE_MIN = 10;

/** Dati per lo schermo pubblico in sala: sempre il giorno corrente. */
export async function GET() {
  try {
    const [slots, system, entries] = await Promise.all([
      getSlots(eventToday()),
      getSystem(),
      recentEntries(ENTRY_VISIBLE_MIN, 8),
    ]);
    return json({ slots, system, entries });
  } catch (err) {
    return errorResponse(err);
  }
}
