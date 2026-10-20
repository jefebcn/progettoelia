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

/** Dimensione massima di un gruppo (= capienza di uno slot). */
export const MAX_GROUP_SIZE = 15;

/** Fuso orario dell'evento: l'orario non dipende dal telefono/tablet. */
export const EVENT_TIME_ZONE = "Europe/Rome";

/** Minuti trascorsi dalla mezzanotte, nell'ora dell'evento (Europe/Rome). */
export function eventMinutesNow(now: Date = new Date()): number {
  const parts = new Intl.DateTimeFormat("it-IT", {
    timeZone: EVENT_TIME_ZONE,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const h = Number(parts.find((p) => p.type === "hour")?.value ?? 0);
  const m = Number(parts.find((p) => p.type === "minute")?.value ?? 0);
  return h * 60 + m;
}

/** "10:15:00" -> 615 */
export function slotMinutes(slotTime: string): number {
  const [h, m] = slotTime.split(":").map(Number);
  return h * 60 + m;
}

/** Data di oggi nell'ora dell'evento, "YYYY-MM-DD". */
export function eventToday(now: Date = new Date()): string {
  // en-CA formatta le date come YYYY-MM-DD.
  return new Intl.DateTimeFormat("en-CA", { timeZone: EVENT_TIME_ZONE }).format(now);
}

/** Uno slot è concluso quando sono passati i suoi 15 minuti (giorno compreso). */
export function isSlotPast(
  slot: Pick<Slot, "slot_time" | "slot_date">,
  now: Date = new Date(),
): boolean {
  const today = eventToday(now);
  if (slot.slot_date !== today) return slot.slot_date < today;
  return slotMinutes(slot.slot_time) + 15 <= eventMinutesNow(now);
}

// Le date "YYYY-MM-DD" si formattano a mezzogiorno UTC: nessun fuso le sposta.
const atNoon = (d: string) => new Date(`${d}T12:00:00Z`);

/** "2026-12-20" -> "domenica 20 dicembre" */
export function formatDayLong(d: string): string {
  return new Intl.DateTimeFormat("it-IT", {
    timeZone: "UTC",
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(atNoon(d));
}

/** "2026-12-20" -> { weekday: "dom", day: "20", month: "dic" } */
export function formatDayParts(d: string) {
  const f = (o: Intl.DateTimeFormatOptions) =>
    new Intl.DateTimeFormat("it-IT", { timeZone: "UTC", ...o }).format(atNoon(d)).replace(".", "");
  return { weekday: f({ weekday: "short" }), day: f({ day: "numeric" }), month: f({ month: "short" }) };
}

/** "2026-12-20" -> "20/12/2026" */
export function formatDayShort(d: string): string {
  const [y, m, day] = d.split("-");
  return `${day}/${m}/${y}`;
}

/** Sposta una data "YYYY-MM-DD" di n giorni. */
export function addDays(d: string, n: number): string {
  const x = atNoon(d);
  x.setUTCDate(x.getUTCDate() + n);
  return x.toISOString().slice(0, 10);
}

/**
 * Ritorna lo slot "in chiamata" in base all'orario corrente (ora di Roma).
 * Uno slot è considerato attivo dalla sua ora fino a +15 minuti.
 */
export function currentSlotTime(now: Date = new Date()): string | null {
  const minutes = eventMinutesNow(now);
  const start = 10 * 60; // 10:00
  const end = 17 * 60; // 17:00 (chiusura)
  if (minutes < start || minutes >= end) return null;
  const slotIndex = Math.floor((minutes - start) / 15);
  const slotMins = start + slotIndex * 15;
  const hh = String(Math.floor(slotMins / 60)).padStart(2, "0");
  const mm = String(slotMins % 60).padStart(2, "0");
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
