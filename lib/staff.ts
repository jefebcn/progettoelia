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
 * Esegue un'azione operatore sul server (/api/staff) passando il PIN.
 * Il server ritorna sempre { ok, data } oppure { ok:false, error }.
 */
export async function staffRpc<T = unknown>(
  fn: string,
  pin: string,
  params: Record<string, unknown> = {},
): Promise<StaffResult<T>> {
  try {
    const res = await fetch("/api/staff", {
      method: "POST",
      cache: "no-store",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fn, pin, params }),
    });
    let body: { ok?: boolean; data?: T; error?: string } | null = null;
    try {
      body = await res.json();
    } catch {
      /* corpo non JSON */
    }
    if (!body) return { ok: false, error: res.status >= 500 ? "SERVER_ERROR" : "NETWORK" };
    if (!body.ok) return { ok: false, error: body.error ?? "UNKNOWN" };
    return { ok: true, data: body.data as T };
  } catch {
    return { ok: false, error: "NETWORK" };
  }
}
