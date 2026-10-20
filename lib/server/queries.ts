import { query } from "./db";
import type { DaySummary, Reservation, Slot, SystemState } from "@/lib/types";

export async function getSlots(date: string): Promise<Slot[]> {
  return query<Slot>(`select * from slots where slot_date = $1 order by slot_time`, [date]);
}

export async function getSystem(): Promise<SystemState> {
  const [row] = await query<SystemState>(
    `select intake_suspended, message, event_start, event_end, period_confirmed
       from system_state where id = true`,
  );
  return row;
}

/** Giorni prenotabili da oggi alla fine del periodo, con i posti liberi negli slot futuri. */
export async function getDays(today: string): Promise<DaySummary[]> {
  return query<DaySummary>(
    `select s.slot_date as date,
            coalesce(sum(greatest(0, s.max_capacity - s.current_booked))
              filter (where s.status = 'active'
                        and s.slot_date + s.slot_time + interval '15 minutes'
                            > now() at time zone 'Europe/Rome'), 0)::int as free,
            count(*) filter (where s.slot_date + s.slot_time + interval '15 minutes'
                                   > now() at time zone 'Europe/Rome')::int as upcoming
       from slots s
       join system_state st on st.id = true
      where s.slot_date between greatest(st.event_start, $1::date) and st.event_end
      group by s.slot_date
      order by s.slot_date`,
    [today],
  );
}

/** Display pubblico: solo numero pass, nome e iniziale del cognome. */
export async function recentEntries(minutes: number, limit: number) {
  return query<{
    pass_number: number;
    first_name: string;
    last_initial: string;
    checked_in_at: string;
  }>(
    `select pass_number, first_name, left(last_name, 1) as last_initial, checked_in_at
       from reservations
      where status in ('checked_in', 'manual_entry')
        and checked_in_at > now() - make_interval(mins => $1)
      order by checked_in_at desc
      limit $2`,
    [minutes, limit],
  );
}

/** Prenotazione con giorno e orario del suo slot. */
export async function getReservation(id: string): Promise<Reservation | null> {
  const [row] = await query<Reservation>(
    `select r.*, s.slot_date, s.slot_time
       from reservations r join slots s on s.id = r.slot_id
      where r.id = $1`,
    [id],
  );
  return row ?? null;
}
