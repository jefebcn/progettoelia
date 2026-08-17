import type { Slot } from "./types";

/** "10:00:00" -> "10:00" */
export function formatSlotTime(slotTime: string): string {
  return slotTime.slice(0, 5);
}

/** Numero pass visualizzabile, es. 101 -> "#101" */
export function formatPass(passNumber: number): string {
  return `#${passNumber}`;
}

/** Posti ancora disponibili in uno slot. */
export function remainingSeats(slot: Slot): number {
  return Math.max(0, slot.max_capacity - slot.current_booked);
}

/**
 * Ritorna lo slot "in chiamata" in base all'orario corrente.
 * Uno slot è considerato attivo dalla sua ora fino a +15 minuti.
 */
export function currentSlotTime(now: Date = new Date()): string | null {
  const minutes = now.getHours() * 60 + now.getMinutes();
  const start = 10 * 60; // 10:00
  const end = 17 * 60; // 17:00 (chiusura)
  if (minutes < start || minutes >= end) return null;
  const slotIndex = Math.floor((minutes - start) / 15);
  const slotMinutes = start + slotIndex * 15;
  const hh = String(Math.floor(slotMinutes / 60)).padStart(2, "0");
  const mm = String(slotMinutes % 60).padStart(2, "0");
  return `${hh}:${mm}:00`;
}

/** Etichetta leggibile per lo stato prenotazione. */
export function reservationStatusLabel(
  status: string,
): { label: string; tone: "wait" | "turn" | "done" | "muted" } {
  switch (status) {
    case "checked_in":
      return { label: "Ingresso effettuato", tone: "done" };
    case "manual_entry":
      return { label: "Ingresso registrato", tone: "done" };
    case "no_show":
      return { label: "Non presentato", tone: "muted" };
    default:
      return { label: "In attesa", tone: "wait" };
  }
}
