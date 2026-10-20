import { query } from "@/lib/server/db";
import { asInt, asText, errorResponse, isUuid, json } from "@/lib/server/http";
import type { Reservation } from "@/lib/types";

export const dynamic = "force-dynamic";

/** Prenotazione self-service dal telefono del visitatore. */
export async function POST(req: Request) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return json({ error: "BAD_REQUEST" }, 400);
  }
  if (!isUuid(body.slotId)) return json({ error: "SLOT_NOT_FOUND" }, 404);
  const adults = asInt(body.adults);
  const children = asInt(body.children);
  if (adults === null) return json({ error: "INVALID_ADULTS" }, 400);
  if (children === null) return json({ error: "INVALID_CHILDREN" }, 400);

  try {
    const [reservation] = await query<Reservation>(
      `select * from insert_reservation($1, $2, $3, $4, $5, 'booked', false)`,
      [body.slotId, asText(body.firstName), asText(body.lastName), adults, children],
    );
    return json({ reservation });
  } catch (err) {
    return errorResponse(err);
  }
}
