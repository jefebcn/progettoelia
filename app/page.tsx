"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Users, Baby, Clock, Loader2, CheckCircle2, WifiOff } from "lucide-react";
import { api } from "@/lib/api";
import type { Slot } from "@/lib/types";
import {
  formatSlotTime,
  remainingSeats,
  isSlotPast,
  MAX_GROUP_SIZE,
} from "@/lib/format";
import { errorMessage } from "@/lib/errors";

const LAST_PASS_KEY = "elia-last-pass";
import { ConfigNotice } from "@/components/ConfigNotice";

export default function BookingPage() {
  const router = useRouter();
  const [slots, setSlots] = useState<Slot[]>([]);
  const [intakeSuspended, setIntakeSuspended] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [lastPassId, setLastPassId] = useState<string | null>(null);
  // Forza il ricalcolo degli slot passati col passare del tempo.
  const [, setTick] = useState(0);

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [adults, setAdults] = useState(1);
  const [children, setChildren] = useState(0);
  const [selectedSlotId, setSelectedSlotId] = useState<string | null>(null);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const groupSize = adults + children;

  const loadSlots = useCallback(async () => {
    const res = await api.state();
    if (res.ok) {
      setSlots(res.data.slots);
      setIntakeSuspended(res.data.system.intake_suspended);
      setLoadError(false);
    } else {
      // Prima il form restava vuoto senza spiegazioni: ora mostriamo un errore.
      setLoadError(true);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    try {
      setLastPassId(localStorage.getItem(LAST_PASS_KEY));
    } catch {
      /* noop */
    }
  }, []);

  useEffect(() => {
    loadSlots();

    // Posti e sospensioni si aggiornano da soli ogni 10 secondi.
    const poll = setInterval(loadSlots, 10_000);

    const interval = setInterval(() => setTick((t) => t + 1), 30_000);
    // Quando il telefono torna in primo piano, riallinea i dati.
    const onVisible = () => {
      if (document.visibilityState === "visible") loadSlots();
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      clearInterval(poll);
      clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [loadSlots]);

  // Gli slot già conclusi non si mostrano più.
  const upcomingSlots = slots.filter((s) => !isSlotPast(s));

  const isSlotSelectable = useCallback(
    (slot: Slot) =>
      slot.status === "active" &&
      !isSlotPast(slot) &&
      remainingSeats(slot) >= groupSize,
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

    const res = await api.book({
      slotId: selectedSlotId,
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      adults,
      children,
    });

    if (!res.ok) {
      setError(errorMessage(res.error, "Errore durante la prenotazione. Riprova."));
      setSubmitting(false);
      // Ricarica gli slot per riflettere lo stato più recente.
      loadSlots();
      return;
    }

    const { reservation } = res.data;
    try {
      // Così chi chiude il browser ritrova il proprio pass dalla home.
      localStorage.setItem(LAST_PASS_KEY, reservation.id);
    } catch {
      /* noop */
    }
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

      {lastPassId && (
        <Link
          href={`/pass/${lastPassId}`}
          className="mb-4 flex items-center justify-between rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800"
        >
          <span>🎟️ Hai già prenotato? Apri il tuo pass</span>
          <span aria-hidden>→</span>
        </Link>
      )}

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
            max={MAX_GROUP_SIZE - children}
            onChange={setAdults}
          />
          <Counter
            label="Bambini"
            icon={<Baby className="h-4 w-4" />}
            value={children}
            min={0}
            max={MAX_GROUP_SIZE - adults}
            onChange={setChildren}
          />
        </div>
        <p className="-mt-2 text-center text-sm text-slate-500">
          Gruppo di <span className="font-semibold text-slate-700">{groupSize}</span>{" "}
          {groupSize === 1 ? "persona" : "persone"}
          {groupSize >= MAX_GROUP_SIZE && (
            <span className="block text-xs text-amber-600">
              Massimo {MAX_GROUP_SIZE} persone per prenotazione.
            </span>
          )}
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
          ) : loadError ? (
            <div className="flex flex-col items-center gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-6 text-center text-sm text-red-700">
              <WifiOff className="h-6 w-6" />
              Non riusciamo a caricare gli orari in questo momento.
              <button
                type="button"
                onClick={() => {
                  setLoading(true);
                  loadSlots();
                }}
                className="rounded-lg bg-white px-4 py-2 font-semibold text-red-700 shadow-sm ring-1 ring-red-200"
              >
                Riprova
              </button>
            </div>
          ) : upcomingSlots.length === 0 ? (
            <p className="rounded-xl bg-slate-50 px-4 py-6 text-center text-sm text-slate-500">
              🎄 Per oggi le prenotazioni sono chiuse. Ti aspettiamo domani!
            </p>
          ) : (
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
              {upcomingSlots.map((slot) => {
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
  max,
  onChange,
}: {
  label: string;
  icon: React.ReactNode;
  value: number;
  min: number;
  max: number;
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
          onClick={() => onChange(Math.min(max, value + 1))}
          disabled={value >= max}
          className="h-9 w-9 rounded-lg bg-slate-100 text-xl font-semibold text-slate-700 active:bg-slate-200 disabled:opacity-30"
          aria-label={`Aumenta ${label}`}
        >
          +
        </button>
      </div>
    </div>
  );
}
