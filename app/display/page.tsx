"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { Reservation, Slot, SystemState } from "@/lib/types";
import { formatPass, formatSlotTime, currentSlotTime } from "@/lib/format";

export default function DisplayPage() {
  const [slots, setSlots] = useState<Slot[]>([]);
  const [recent, setRecent] = useState<Reservation[]>([]);
  const [state, setState] = useState<SystemState | null>(null);
  const [now, setNow] = useState<string | null>(currentSlotTime());

  const loadAll = useCallback(async () => {
    const [{ data: s }, { data: r }, { data: st }] = await Promise.all([
      supabase.from("slots").select("*").order("slot_time", { ascending: true }),
      supabase
        .from("reservations")
        .select("*")
        .in("status", ["checked_in", "manual_entry"])
        .order("checked_in_at", { ascending: false })
        .limit(8),
      supabase.from("system_state").select("*").eq("id", true).maybeSingle(),
    ]);
    if (s) setSlots(s as Slot[]);
    if (r) setRecent(r as Reservation[]);
    if (st) setState(st as SystemState);
  }, []);

  useEffect(() => {
    loadAll();
    const channel = supabase
      .channel("display-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "reservations" },
        () => loadAll(),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "slots" },
        () => loadAll(),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "system_state" },
        (payload) => setState(payload.new as SystemState),
      )
      .subscribe();

    const interval = setInterval(() => setNow(currentSlotTime()), 20_000);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(interval);
    };
  }, [loadAll]);

  const callingSlot = slots.find((s) => s.slot_time === now) ?? null;
  const suspended = state?.intake_suspended;

  return (
    <main className="flex min-h-screen flex-col bg-slate-900 p-8 text-white">
      <header className="mb-8 flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-slate-300">Area ingressi</h1>
        <Clock />
      </header>

      {suspended && (
        <div className="mb-8 animate-pulse rounded-2xl bg-red-600 px-8 py-6 text-center text-3xl font-bold">
          ⛔ Ingressi temporaneamente sospesi
          {state?.message ? (
            <div className="mt-2 text-xl font-normal">{state.message}</div>
          ) : null}
        </div>
      )}

      <div className="grid flex-1 gap-8 lg:grid-cols-2">
        {/* Slot in chiamata */}
        <section className="flex flex-col items-center justify-center rounded-3xl bg-slate-800 p-10 text-center">
          <span className="text-xl uppercase tracking-widest text-slate-400">
            Slot in ingresso
          </span>
          <span className="my-4 text-8xl font-black text-emerald-400">
            {callingSlot ? formatSlotTime(callingSlot.slot_time) : "—"}
          </span>
          {callingSlot ? (
            <span className="text-2xl text-slate-300">
              {callingSlot.current_booked} persone attese
            </span>
          ) : (
            <span className="text-2xl text-slate-400">
              Nessuno slot attivo in questo momento
            </span>
          )}
        </section>

        {/* Ultimi ingressi convalidati */}
        <section className="rounded-3xl bg-slate-800 p-8">
          <h2 className="mb-5 text-xl uppercase tracking-widest text-slate-400">
            Ultimi ingressi
          </h2>
          <ul className="space-y-3">
            {recent.map((r) => (
              <li
                key={r.id}
                className="flex items-center justify-between rounded-2xl bg-slate-700/60 px-6 py-4 text-3xl font-bold"
              >
                <span className="text-emerald-400">
                  {formatPass(r.pass_number)}
                </span>
                <span className="text-xl font-normal text-slate-300">
                  {r.first_name} {r.last_name.charAt(0)}.
                </span>
              </li>
            ))}
            {recent.length === 0 && (
              <li className="py-10 text-center text-2xl text-slate-500">
                In attesa dei primi ingressi…
              </li>
            )}
          </ul>
        </section>
      </div>

      <footer className="mt-8 text-center text-lg text-slate-500">
        Gli aggiornamenti sono in tempo reale
      </footer>
    </main>
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
        }),
      );
    tick();
    const i = setInterval(tick, 1000);
    return () => clearInterval(i);
  }, []);
  return <span className="text-2xl font-semibold tabular-nums">{time}</span>;
}
