export type SlotStatus = "active" | "suspended" | "full";

export type ReservationStatus =
  | "booked"
  | "checked_in"
  | "no_show"
  | "manual_entry";

export interface Slot {
  id: string;
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
}

export interface SystemState {
  id: boolean;
  intake_suspended: boolean;
  message: string | null;
  updated_at: string;
}
