export type SlotStatus = "active" | "suspended" | "full";

export type ReservationStatus =
  | "booked"
  | "checked_in"
  | "no_show"
  | "manual_entry";

export interface Slot {
  id: string;
  /** Giorno dello slot, "YYYY-MM-DD". */
  slot_date: string;
  /** Formato "HH:MM:SS" restituito da PostgreSQL. */
  slot_time: string;
  max_capacity: number;
  current_booked: number;
  status: SlotStatus;
  created_at: string;
}

export interface Reservation {
  id: string;
  pass_number: number;
  slot_id: string;
  first_name: string;
  last_name: string;
  adults_count: number;
  children_count: number;
  total_people: number;
  status: ReservationStatus;
  created_at: string;
  checked_in_at: string | null;
  /** Presenti quando la prenotazione arriva insieme al suo slot. */
  slot_date?: string;
  slot_time?: string;
}

export interface SystemState {
  intake_suspended: boolean;
  message: string | null;
  /** Periodo dell'evento, "YYYY-MM-DD" (estremi inclusi). */
  event_start: string;
  event_end: string;
  /** false finché lo staff non ha impostato il periodo (è quello provvisorio). */
  period_confirmed: boolean;
}

/** Riepilogo di un giorno prenotabile: posti ancora liberi negli slot futuri. */
export interface DaySummary {
  date: string;
  free: number;
  /** Slot non ancora conclusi: 0 = giorno chiuso (es. oggi dopo l'ultimo turno). */
  upcoming: number;
}
