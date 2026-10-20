import { query } from "./db";
import type { Reservation, Slot, SystemState } from "@/lib/types";

export async function getSlots(): Promise<Slot[]> {
  return query<Slot>(`select * from slots order by slot_time`);
}

export async function getSystem(): Promise<SystemState> {
  const [row] = await query<SystemState>(
    `select intake_suspended, message from system_state where id = true`,
  );
  return row ?? { intake_suspended: false, message: null };
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

export async function getReservation(id: string): Promise<Reservation | null> {
  const [row] = await query<Reservation>(`select * from reservations where id = $1`, [id]);
  return row ?? null;
}
