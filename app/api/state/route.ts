import { getDays, getSlots, getSystem } from "@/lib/server/queries";
import { errorResponse, isDate, json } from "@/lib/server/http";
import { eventToday } from "@/lib/format";

export const dynamic = "force-dynamic";

/**
 * Stato per form, check-in e display: periodo, giorni prenotabili con i posti
 * liberi e gli slot di un giorno (?date=YYYY-MM-DD). Senza data sceglie il
 * primo giorno con posti liberi.
 */
export async function GET(req: Request) {
  const asked = new URL(req.url).searchParams.get("date");
  try {
    const today = eventToday();
    const [system, days] = await Promise.all([getSystem(), getDays(today)]);
    const date = isDate(asked)
      ? asked
      : (days.find((d) => d.free > 0) ?? days[0])?.date ?? today;
    const slots = await getSlots(date);
    return json({ today, date, system, days, slots });
  } catch (err) {
    return errorResponse(err);
  }
}
