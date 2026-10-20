import { getSlots, getSystem, recentEntries } from "@/lib/server/queries";
import { errorResponse, json } from "@/lib/server/http";

export const dynamic = "force-dynamic";

const ENTRY_VISIBLE_MIN = 10;

/** Dati per lo schermo pubblico in sala. */
export async function GET() {
  try {
    const [slots, system, entries] = await Promise.all([
      getSlots(),
      getSystem(),
      recentEntries(ENTRY_VISIBLE_MIN, 8),
    ]);
    return json({ slots, system, entries });
  } catch (err) {
    return errorResponse(err);
  }
}
