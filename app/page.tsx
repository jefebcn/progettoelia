"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Users, Baby, Clock, Loader2, CheckCircle2 } from "lucide-react";
import { supabase } from "@/lib/supabase";
import type { Reservation, Slot, SystemState } from "@/lib/types";
import { formatSlotTime, remainingSeats } from "@/lib/format";
import { ConfigNotice } from "@/components/ConfigNotice";

const BOOKING_ERRORS: Record<string, string> = {
  SLOT_FULL: "Lo slot selezionato non ha posti sufficienti. Scegline un altro.",
  SLOT_SUSPENDED: "Questo slot è temporaneamente sospeso.",
  INTAKE_SUSPENDED:
    "Le prenotazioni sono momentaneamente sospese. Riprova tra poco.",
  SLOT_NOT_FOUND: "Slot non valido. Aggiorna la pagina e riprova.",
};

export default function BookingPage() {
  const router = useRouter();
  const [slots, setSlots] = useState<Slot[]>([]);
  const [intakeSuspended, setIntakeSuspended] = useState(false);
  const [loading, setLoading] = useState(true);

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [adults, setAdults] = useState(1);
  const [children, setChildren] = useState(0);
  const [selectedSlotId, setSelectedSlotId] = useState<string | null>(null);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const groupSize = adults + children;

  const loadSlots = useCallback(async () => {
    const { data } = await supabase
      .from("slots")
      .select("*")
      .order("slot_time", { ascending: true });
    if (data) setSlots(data as Slot[]);
    const { data: state } = await supabase
      .from("system_state")
      .select("*")
      .eq("id", true)
      .maybeSingle();
    if (state) setIntakeSuspended((state as SystemState).intake_suspended);
    setLoading(false);
  }, []);

  useEffect(() => {
    loadSlots();

    const channel = supabase
      .channel("booking-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "slots" },
        (payload) => {
          setSlots((prev) => {
            const next = [...prev];
            const row = payload.new as Slot;
            const idx = next.findIndex((s) => s.id === row.id);
            if (idx >= 0) next[idx] = row;
            else next.push(row);
            return next.sort((a, b) => a.slot_time.localeCompare(b.slot_time));
          });
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "system_state" },
        (payload) => {
          setIntakeSuspended((payload.new as SystemState).intake_suspended);
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [loadSlots]);

  const isSlotSelectable = useCallback(
    (slot: Slot) =>
      slot.status === "active" && remainingSeats(slot) >= groupSize,
    [groupSize],
  );

  // Deseleziona uno slot che è diventato non prenotabile (es. si è riempito).
  useEffect(() => {
    if (!selectedSlotId) return;
    const slot = slots.find((s) => s.id === selectedSlotId);
    if (slot && !isSlotSelectable(slot)) setSelectedSlotId(null);
  }, [slots, selectedSlotId, isSlotSelectable]);

  const canSubmit = useMemo(
    () =>
      firstName.trim().length > 0 &&
      lastName.trim().length > 0 &&
      adults >= 1 &&
      children >= 0 &&
      !!selectedSlotId &&
      !submitting &&
      !intakeSuspended,
    [firstName, lastName, adults, children, selectedSlotId, submitting, intakeSuspended],
  );

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit || !selectedSlotId) return;
    setSubmitting(true);
    setError(null);

    const { data, error: rpcError } = await supabase.rpc("book_reservation", {
      p_slot_id: selectedSlotId,
      p_first_name: firstName.trim(),
      p_last_name: lastName.trim(),
      p_adults: adults,
      p_children: children,
    });

    if (rpcError) {
      const key = Object.keys(BOOKING_ERRORS).find((k) =>
        rpcError.message.includes(k),
      );
      setError(key ? BOOKING_ERRORS[key] : "Errore durante la prenotazione. Riprova.");
      setSubmitting(false);
      // Ricarica gli slot per riflettere lo stato più recente.
      loadSlots();
      return;
    }

    const reservation = data as Reservation;
    router.push(`/pass/${reservation.id}`);
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col px-4 py-6">
      <header className="mb-6 text-center">
        <div className="mb-1 text-3xl">🎄🎅🎁</div>
        <h1 className="text-2xl font-bold tracking-tight text-holly">
          Prenota il tuo ingresso
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Buone feste! Bastano 5 secondi, nessun account e nessun dato di contatto.
        </p>
      </header>

      <ConfigNotice />

      {intakeSuspended && (
        <div className="mb-4 rounded-xl border border-red-300 bg-red-50 p-4 text-center text-sm font-medium text-red-700">
          🔴 Prenotazioni temporaneamente sospese. Attendi la riapertura.
        </div>
      )}

      <form onSubmit={handleSubmit} className="flex flex-col gap-5">
        {/* Dati anagrafici */}
        <div className="grid grid-cols-2 gap-3">
          <label className="col-span-2 sm:col-span-1 flex flex-col gap-1 text-sm font-medium text-slate-700">
            Nome
            <input
              type="text"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              required
              maxLength={60}
              className="rounded-xl border border-slate-300 px-3 py-3 text-base outline-none focus:border-brand focus:ring-2 focus:ring-brand/30"
              placeholder="Mario"
            />
          </label>
          <label className="col-span-2 sm:col-span-1 flex flex-col gap-1 text-sm font-medium text-slate-700">
            Cognome
            <input
              type="text"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              required
              maxLength={60}
              className="rounded-xl border border-slate-300 px-3 py-3 text-base outline-none focus:border-brand focus:ring-2 focus:ring-brand/30"
              placeholder="Rossi"
            />
          </label>
        </div>

        {/* Contatori persone */}
        <div className="grid grid-cols-2 gap-3">
          <Counter
            label="Adulti"
            icon={<Users className="h-4 w-4" />}
            value={adults}
            min={1}
            onChange={setAdults}
          />
          <Counter
            label="Bambini"
            icon={<Baby className="h-4 w-4" />}
            value={children}
            min={0}
            onChange={setChildren}
          />
        </div>
        <p className="-mt-2 text-center text-sm text-slate-500">
          Gruppo di <span className="font-semibold text-slate-700">{groupSize}</span>{" "}
          {groupSize === 1 ? "persona" : "persone"}
        </p>

        {/* Selezione slot */}
        <div>
          <div className="mb-2 flex items-center gap-2 text-sm font-medium text-slate-700">
            <Clock className="h-4 w-4" /> Scegli l&apos;orario
          </div>
          {loading ? (
            <div className="flex justify-center py-8 text-slate-400">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
              {slots.map((slot) => {
                const selectable = isSlotSelectable(slot);
                const remaining = remainingSeats(slot);
                const selected = slot.id === selectedSlotId;
                return (
                  <button
                    type="button"
                    key={slot.id}
                    disabled={!selectable}
                    onClick={() => setSelectedSlotId(slot.id)}
                    className={[
                      "flex flex-col items-center rounded-xl border px-2 py-2 text-sm transition",
                      selected
                        ? "border-brand bg-brand text-white shadow"
                        : selectable
                          ? "border-slate-300 bg-white hover:border-brand"
                          : "cursor-not-allowed border-slate-200 bg-slate-100 text-slate-400",
                    ].join(" ")}
                  >
                    <span className="font-semibold">
                      {formatSlotTime(slot.slot_time)}
                    </span>
                    <span
                      className={[
                        "text-[11px]",
                        selected ? "text-white/80" : "text-slate-400",
                      ].join(" ")}
                    >
                      {slot.status === "suspended"
                        ? "sospeso"
                        : remaining <= 0
                          ? "pieno"
                          : `${remaining} posti`}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {error && (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-center text-sm text-red-600">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={!canSubmit}
          className="mt-1 flex items-center justify-center gap-2 rounded-xl bg-brand px-4 py-3.5 text-base font-semibold text-white shadow-sm transition enabled:hover:bg-brand-dark disabled:cursor-not-allowed disabled:opacity-40"
        >
          {submitting ? (
            <>
              <Loader2 className="h-5 w-5 animate-spin" /> Prenotazione…
            </>
          ) : (
            <>
              <CheckCircle2 className="h-5 w-5" /> 🎁 Conferma prenotazione
            </>
          )}
        </button>
      </form>

      <footer className="mt-auto pt-8 text-center text-xs text-slate-400">
        🎄 Ingressi a slot di 15 minuti · capienza massima 15 persone per slot ❄️
      </footer>
    </main>
  );
}

function Counter({
  label,
  icon,
  value,
  min,
  onChange,
}: {
  label: string;
  icon: React.ReactNode;
  value: number;
  min: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="flex flex-col gap-1">
      <span className="flex items-center gap-1.5 text-sm font-medium text-slate-700">
        {icon}
        {label}
      </span>
      <div className="flex items-center justify-between rounded-xl border border-slate-300 px-2 py-2">
        <button
          type="button"
          onClick={() => onChange(Math.max(min, value - 1))}
          className="h-9 w-9 rounded-lg bg-slate-100 text-xl font-semibold text-slate-700 active:bg-slate-200"
          aria-label={`Diminuisci ${label}`}
        >
          −
        </button>
        <span className="min-w-[2ch] text-center text-lg font-semibold">
          {value}
        </span>
        <button
          type="button"
          onClick={() => onChange(value + 1)}
          className="h-9 w-9 rounded-lg bg-slate-100 text-xl font-semibold text-slate-700 active:bg-slate-200"
          aria-label={`Aumenta ${label}`}
        >
          +
        </button>
      </div>
    </div>
  );
}
