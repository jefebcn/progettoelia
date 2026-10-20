"use client";

import { useCallback, useEffect, useState } from "react";
import { api, type RecentEntry } from "@/lib/api";
import type { Slot, SystemState } from "@/lib/types";
import {
  formatPass,
  formatSlotTime,
  currentSlotTime,
  EVENT_TIME_ZONE,
} from "@/lib/format";
import { Backdrop } from "@/components/festive/Backdrop";
import { GoldFrame, Ornament } from "@/components/festive/GoldFrame";
import { Village } from "@/components/festive/Village";

// Un ingresso resta visibile nel display per questo tempo, poi sparisce.
const ENTRY_VISIBLE_MS = 10 * 60 * 1000; // 10 minuti (filtrati anche dal server)

export default function DisplayPage() {
  const [slots, setSlots] = useState<Slot[]>([]);
  const [recent, setRecent] = useState<RecentEntry[]>([]);
  const [offline, setOffline] = useState(false);
  const [state, setState] = useState<SystemState | null>(null);
  const [now, setNow] = useState<string | null>(currentSlotTime());
  const [nowMs, setNowMs] = useState<number>(0);

  const loadAll = useCallback(async () => {
    // Solo pass, nome e iniziale del cognome: il server non manda altro.
    const res = await api.display();
    setOffline(!res.ok);
    if (!res.ok) return;
    setSlots(res.data.slots);
    setRecent(res.data.entries);
    setState(res.data.system);
  }, []);

  useEffect(() => {
    loadAll();
    setNowMs(Date.now());
    // Aggiornamento leggero ogni 5 secondi.
    const poll = setInterval(loadAll, 5_000);
    const interval = setInterval(() => {
      setNow(currentSlotTime());
      setNowMs(Date.now());
    }, 15_000);

    return () => {
      clearInterval(interval);
      clearInterval(poll);
    };
  }, [loadAll]);

  const callingSlot = slots.find((s) => s.slot_time === now) ?? null;
  const suspended = state?.intake_suspended;

  // Mostra solo gli ingressi convalidati negli ultimi 10 minuti.
  const visibleEntries = recent
    .filter(
      (r) =>
        r.checked_in_at &&
        nowMs > 0 &&
        nowMs - Date.parse(r.checked_in_at) <= ENTRY_VISIBLE_MS,
    )
    .slice(0, 8);

  return (
    <Backdrop>
      <main className="flex min-h-screen flex-col px-10 pb-0 pt-8">
        <header className="flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.35em] text-gold">
              ✦ Buone Feste ✦
            </p>
            <h1 className="mt-1 font-serif text-5xl font-semibold text-cream">Area ingressi</h1>
          </div>
          <Clock />
        </header>

        {offline && (
          <div className="mt-6 rounded-3xl border border-amber-300/40 bg-amber-500/20 px-6 py-3 text-center text-xl text-amber-100">
            Connessione al server persa — riprovo automaticamente…
          </div>
        )}

        {suspended && (
          <div className="mt-6 animate-pulse rounded-3xl border border-holly-light/60 bg-holly/40 px-8 py-6 text-center">
            <p className="font-serif text-4xl text-cream">Ingressi temporaneamente sospesi</p>
            {state?.message ? <p className="mt-2 text-2xl text-cream/85">{state.message}</p> : null}
          </div>
        )}

        <div className="mt-8 grid flex-1 gap-8 lg:grid-cols-2">
          {/* Slot in chiamata */}
          <GoldFrame className="flex flex-col items-center justify-center !p-10 text-center">
            <p className="text-xl uppercase tracking-[0.3em] text-gold">Turno in ingresso</p>
            <p className="text-gold-shine my-4 font-serif text-[9rem] font-semibold leading-none tabular-nums">
              {callingSlot ? formatSlotTime(callingSlot.slot_time) : "—"}
            </p>
            <Ornament />
            <p className="mt-4 text-2xl text-cream/80">
              {callingSlot
                ? `${callingSlot.current_booked} persone prenotate`
                : "Nessun turno attivo in questo momento"}
            </p>
          </GoldFrame>

          {/* Ultimi ingressi convalidati */}
          <GoldFrame className="!p-8">
            <h2 className="text-center text-xl uppercase tracking-[0.3em] text-gold">Ultimi ingressi</h2>
            <Ornament className="mt-3" />
            <ul className="mt-6 space-y-3">
              {visibleEntries.map((r, idx) => (
                <li
                  key={r.pass_number}
                  className={[
                    "flex items-center justify-between rounded-full border px-7 py-3",
                    idx === 0
                      ? "border-gold/70 bg-gold/15 shadow-[0_0_30px_-8px_rgba(212,165,72,0.7)]"
                      : "border-gold/20 bg-pine/60",
                  ].join(" ")}
                >
                  <span className="font-serif text-4xl font-semibold text-gold-light">
                    {formatPass(r.pass_number)}
                  </span>
                  <span className="text-2xl text-cream/85">
                    {r.first_name} {r.last_initial}.
                  </span>
                </li>
              ))}
              {visibleEntries.length === 0 && (
                <li className="py-12 text-center font-serif text-3xl text-cream/45">
                  In attesa dei primi ingressi…
                </li>
              )}
            </ul>
          </GoldFrame>
        </div>

        <Village className="mx-auto -mb-1 mt-6 block h-auto w-full max-w-5xl" />
      </main>
    </Backdrop>
  );
}

function Clock() {
  const [time, setTime] = useState<string>("");
  useEffect(() => {
    const tick = () =>
      setTime(
        new Date().toLocaleTimeString("it-IT", {
          hour: "2-digit",
          minute: "2-digit",
          timeZone: EVENT_TIME_ZONE,
        }),
      );
    tick();
    const i = setInterval(tick, 1000);
    return () => clearInterval(i);
  }, []);
  return (
    <span className="rounded-full border border-gold/40 bg-pine-deep/70 px-6 py-2 font-serif text-4xl tabular-nums text-cream">
      {time}
    </span>
  );
}
