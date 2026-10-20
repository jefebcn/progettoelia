import { errorCode, query } from "@/lib/server/db";
import {
  asInt,
  asText,
  clientIp,
  isDate,
  isUuid,
  json,
  statusFor,
} from "@/lib/server/http";
import { pinError } from "@/lib/server/pin";
import { getReservation } from "@/lib/server/queries";
import type { Reservation } from "@/lib/types";
import { eventToday } from "@/lib/format";

/** Durata massima del periodo dell'evento, in giorni. */
const MAX_PERIOD_DAYS = 400;

export const dynamic = "force-dynamic";

type Params = Record<string, unknown>;
type Result = { ok: true; data?: unknown } | { ok: false; error: string; data?: unknown };

const ok = (data?: unknown): Result => ({ ok: true, data });
const fail = (error: string): Result => ({ ok: false, error });

/** Azioni operatore. Si chiamano tutte con il PIN valido. */
const ACTIONS: Record<string, (p: Params) => Promise<Result>> = {
  staff_login: async () => ok(),

  // Prenotazioni di un giorno (di default oggi), in ordine di orario.
  staff_list_reservations: async (p) => {
    const date = isDate(p.p_date) ? p.p_date : eventToday();
    return ok(
      await query<Reservation>(
        `select r.*, s.slot_date, s.slot_time
           from reservations r join slots s on s.id = r.slot_id
          where s.slot_date = $1
          order by s.slot_time, r.created_at
          limit 1000`,
        [date],
      ),
    );
  },

  // Riepilogo dei giorni con prenotazioni, da oggi in avanti.
  staff_overview: async () =>
    ok(
      await query(
        `select s.slot_date as date,
                count(*)::int as bookings,
                sum(r.total_people)::int as people,
                count(*) filter (where r.status in ('checked_in', 'manual_entry'))::int as entered
           from reservations r join slots s on s.id = r.slot_id
          where s.slot_date >= $1 and r.status <> 'no_show'
          group by s.slot_date
          order by s.slot_date
          limit 400`,
        [eventToday()],
      ),
    ),

  // Ricerca per nome/cognome o numero pass su tutte le date.
  staff_search: async (p) => {
    const q = asText(p.p_query).trim().slice(0, 60);
    if (q.length < 2) return ok([]);
    const pass = /^#?\d{1,6}$/.test(q) ? Number(q.replace("#", "")) : null;
    const like = `%${q.replace(/[\\%_]/g, (c) => "\\" + c)}%`;
    return ok(
      await query<Reservation>(
        `select r.*, s.slot_date, s.slot_time
           from reservations r join slots s on s.id = r.slot_id
          where r.pass_number = $2
             or (r.first_name || ' ' || r.last_name) ilike $1
             or (r.last_name || ' ' || r.first_name) ilike $1
          order by s.slot_date, s.slot_time, r.created_at
          limit 100`,
        [like, pass],
      ),
    );
  },

  // Periodo prenotabile: crea gli slot dei giorni nuovi, non tocca quelli esistenti.
  staff_set_period: async (p) => {
    if (!isDate(p.p_start) || !isDate(p.p_end) || p.p_start > p.p_end) return fail("INVALID_PERIOD");
    const days = (Date.parse(p.p_end) - Date.parse(p.p_start)) / 86_400_000;
    if (days > MAX_PERIOD_DAYS) return fail("INVALID_PERIOD");
    await query(
      `update system_state
          set event_start = $1, event_end = $2, period_confirmed = true, updated_at = now()
        where id = true`,
      [p.p_start, p.p_end],
    );
    await query(`select ensure_period_slots()`);
    return ok();
  },

  staff_get_reservation: async (p) => {
    if (!isUuid(p.p_id)) return fail("NOT_FOUND");
    const res = await getReservation(p.p_id);
    return res ? ok(res) : fail("NOT_FOUND");
  },

  staff_check_in: async (p) => {
    if (!isUuid(p.p_id)) return fail("NOT_FOUND");
    const [{ r }] = await query<{ r: Result }>(`select staff_check_in($1) as r`, [p.p_id]);
    return r;
  },

  staff_mark_no_show: async (p) => {
    if (!isUuid(p.p_id)) return fail("NOT_FOUND");
    const [{ r }] = await query<{ r: Result }>(`select staff_mark_no_show($1) as r`, [p.p_id]);
    return r;
  },

  staff_set_intake: async (p) => {
    await query(
      `update system_state
          set intake_suspended = $1,
              message = nullif(trim(left($2, 200)), ''),
              updated_at = now()
        where id = true`,
      [p.p_suspended === true, asText(p.p_message)],
    );
    return ok();
  },

  staff_set_slot_suspended: async (p) => {
    if (!isUuid(p.p_slot_id)) return fail("SLOT_NOT_FOUND");
    const rows = await query(
      `update slots
          set status = case
                         when $2 then 'suspended'
                         when current_booked >= max_capacity then 'full'
                         else 'active'
                       end
        where id = $1
        returning id`,
      [p.p_slot_id, p.p_suspended === true],
    );
    return rows.length ? ok() : fail("SLOT_NOT_FOUND");
  },

  staff_quick_entry: async (p) => {
    if (!isUuid(p.p_slot_id)) return fail("SLOT_NOT_FOUND");
    const adults = asInt(p.p_adults);
    const children = asInt(p.p_children);
    if (adults === null) return fail("INVALID_ADULTS");
    if (children === null) return fail("INVALID_CHILDREN");
    const [res] = await query<Reservation>(
      `select * from insert_reservation($1, $2, $3, $4, $5, 'manual_entry', $6)`,
      [p.p_slot_id, asText(p.p_first_name), asText(p.p_last_name), adults, children, p.p_force !== false],
    );
    return ok(res);
  },

  staff_reset_day: async (p) => {
    await query(`select reset_day($1)`, [p.p_reset_numbers !== false]);
    return ok();
  },
};

export async function POST(req: Request) {
  let body: { fn?: unknown; pin?: unknown; params?: unknown };
  try {
    body = await req.json();
  } catch {
    return json({ ok: false, error: "BAD_REQUEST" }, 400);
  }
  const action = typeof body.fn === "string" ? ACTIONS[body.fn] : undefined;
  if (!action) return json({ ok: false, error: "UNKNOWN_ACTION" }, 400);
  const params = (body.params && typeof body.params === "object" ? body.params : {}) as Params;

  try {
    const authError = await pinError(asText(body.pin), clientIp(req));
    if (authError) return json({ ok: false, error: authError }, statusFor(authError));
    return json(await action(params));
  } catch (err) {
    const error = errorCode(err);
    return json({ ok: false, error }, statusFor(error));
  }
}
