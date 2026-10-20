import { query } from "@/lib/server/db";
import { errorResponse, isUuid, json } from "@/lib/server/http";
import { getReservation } from "@/lib/server/queries";
import type { Slot } from "@/lib/types";

export const dynamic = "force-dynamic";

/** Il pass si legge solo conoscendo il suo UUID (non indovinabile). */
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  if (!isUuid(params.id)) return json({ error: "NOT_FOUND" }, 404);
  try {
    const reservation = await getReservation(params.id);
    if (!reservation) return json({ error: "NOT_FOUND" }, 404);
    const [slot] = await query<Slot>(`select * from slots where id = $1`, [reservation.slot_id]);
    return json({ reservation, slot: slot ?? null });
  } catch (err) {
    return errorResponse(err);
  }
}
