import type { Reservation, Slot, SystemState } from "./types";

export type ApiResult<T> = { ok: true; data: T } | { ok: false; error: string };

export type RecentEntry = {
  pass_number: number;
  first_name: string;
  last_initial: string;
  checked_in_at: string;
};

export type Health = { db: "ok" | "not_configured" | "error"; staffPin: boolean };

/** Chiamata alle API dell'app. Non lancia mai: ritorna { ok:false, error }. */
async function request<T>(path: string, init?: RequestInit): Promise<ApiResult<T>> {
  try {
    const res = await fetch(path, {
      cache: "no-store",
      ...init,
      headers: { "Content-Type": "application/json", ...init?.headers },
    });
    let body: unknown = null;
    try {
      body = await res.json();
    } catch {
      /* corpo non JSON (es. pagina d'errore della piattaforma) */
    }
    const error = (body as { error?: string } | null)?.error;
    if (!res.ok || error) {
      return { ok: false, error: error ?? (res.status >= 500 ? "SERVER_ERROR" : "NETWORK") };
    }
    return { ok: true, data: body as T };
  } catch {
    return { ok: false, error: "NETWORK" };
  }
}

export const api = {
  state: () => request<{ slots: Slot[]; system: SystemState }>("/api/state"),

  book: (p: {
    slotId: string;
    firstName: string;
    lastName: string;
    adults: number;
    children: number;
  }) =>
    request<{ reservation: Reservation }>("/api/book", {
      method: "POST",
      body: JSON.stringify(p),
    }),

  pass: (id: string) =>
    request<{ reservation: Reservation; slot: Slot | null }>(
      `/api/pass/${encodeURIComponent(id)}`,
    ),

  display: () =>
    request<{ slots: Slot[]; system: SystemState; entries: RecentEntry[] }>("/api/display"),

  // /api/health risponde 503 quando il database manca: leggiamo comunque il corpo.
  health: async (): Promise<Health | null> => {
    try {
      const res = await fetch("/api/health", { cache: "no-store" });
      return (await res.json()) as Health;
    } catch {
      return null;
    }
  },
};
