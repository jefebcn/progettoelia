import { getSlots, getSystem } from "@/lib/server/queries";
import { errorResponse, json } from "@/lib/server/http";

export const dynamic = "force-dynamic";

/** Slot e stato globale: servono a form, check-in e display. */
export async function GET() {
  try {
    const [slots, system] = await Promise.all([getSlots(), getSystem()]);
    return json({ slots, system });
  } catch (err) {
    return errorResponse(err);
  }
}
