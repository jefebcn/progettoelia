import { supabase } from "./supabase";

const PIN_KEY = "elia-staff-pin";

export function getStoredPin(): string | null {
  try {
    return sessionStorage.getItem(PIN_KEY);
  } catch {
    return null;
  }
}

export function storePin(pin: string | null) {
  try {
    if (pin) sessionStorage.setItem(PIN_KEY, pin);
    else sessionStorage.removeItem(PIN_KEY);
  } catch {
    /* storage non disponibile: il PIN resta solo in memoria */
  }
}

export type StaffResult<T> = { ok: true; data: T } | { ok: false; error: string };

/**
 * Chiama una funzione SQL staff_* passando il PIN.
 * Le funzioni staff ritornano sempre { ok, data } oppure { ok:false, error }.
 */
export async function staffRpc<T = unknown>(
  fn: string,
  pin: string,
  params: Record<string, unknown> = {},
): Promise<StaffResult<T>> {
  try {
    const { data, error } = await supabase.rpc(fn, { p_pin: pin, ...params });
    if (error) return { ok: false, error: error.message || "UNKNOWN" };
    const res = data as { ok: boolean; data?: T; error?: string } | null;
    if (!res) return { ok: false, error: "UNKNOWN" };
    if (!res.ok) return { ok: false, error: res.error ?? "UNKNOWN" };
    return { ok: true, data: res.data as T };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "NETWORK" };
  }
}
