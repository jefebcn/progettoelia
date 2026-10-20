"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Baby, Check, Loader2, Sparkles, Users, WifiOff } from "lucide-react";
import { api } from "@/lib/api";
import type { DaySummary, Slot } from "@/lib/types";
import {
  formatDayLong,
  formatDayParts,
  formatSlotTime,
  remainingSeats,
  isSlotPast,
  MAX_GROUP_SIZE,
} from "@/lib/format";
import { errorMessage } from "@/lib/errors";
import { ConfigNotice } from "@/components/ConfigNotice";
import { Backdrop } from "@/components/festive/Backdrop";
import { GoldFrame, Ornament } from "@/components/festive/GoldFrame";
import { Village } from "@/components/festive/Village";

const LAST_PASS_KEY = "elia-last-pass";
/** Sotto questa soglia lo slot è segnalato come "ultimi posti". */
const FEW_SEATS = 4;

export default function BookingPage() {
  const router = useRouter();
  const [slots, setSlots] = useState<Slot[]>([]);
  const [days, setDays] = useState<DaySummary[]>([]);
  const [today, setToday] = useState<string | null>(null);
  // Giorno scelto: finché è null lo propone il server (primo giorno con posti).
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const dateRef = useRef(selectedDate);
  dateRef.current = selectedDate;
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
    const res = await api.state(selectedDate);
    // Risposta di un giorno non più selezionato: la ignoriamo.
    if (res.ok && dateRef.current && res.data.date !== dateRef.current) return;
    if (res.ok) {
      setSlots(res.data.slots);
      setDays(res.data.days);
      setToday(res.data.today);
      if (!selectedDate) setSelectedDate(res.data.date);
      setIntakeSuspended(res.data.system.intake_suspended);
      setLoadError(false);
    } else {
      setLoadError(true);
    }
    setLoading(false);
  }, [selectedDate]);

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

  // Gli slot già conclusi non si mostrano più; solo quelli del giorno scelto.
  const upcomingSlots = slots.filter((s) => s.slot_date === selectedDate && !isSlotPast(s));

  function chooseDay(date: string) {
    if (date === selectedDate) return;
    setSelectedDate(date);
    setSelectedSlotId(null);
    setSlots([]);
    setLoading(true);
  }

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

  const nameDone = firstName.trim().length > 0 && lastName.trim().length > 0;
  const selectedSlot = slots.find((s) => s.id === selectedSlotId) ?? null;
  const firstFree = upcomingSlots.find(isSlotSelectable) ?? null;

  const canSubmit = useMemo(
    () => nameDone && !!selectedSlotId && !submitting && !intakeSuspended,
    [nameDone, selectedSlotId, submitting, intakeSuspended],
  );

  // Il pulsante dice sempre cosa manca, invece di restare grigio e muto.
  const ctaLabel = intakeSuspended
    ? "Prenotazioni sospese"
    : !nameDone
      ? "Inserisci nome e cognome"
      : !selectedSlotId
        ? "Scegli un orario"
        : "Conferma prenotazione";

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
    <Backdrop>
      <main className="mx-auto flex min-h-screen w-full max-w-xl flex-col px-4 pb-8 pt-8">
        <header className="text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-gold">
            ✦ Buone Feste ✦
          </p>
          <h1 className="mt-3 font-serif text-[2.4rem] font-semibold leading-[1.05] text-cream sm:text-5xl">
            Prenota il tuo ingresso
          </h1>
          <Ornament className="mt-4" />
          <p className="mx-auto mt-3 max-w-xs text-sm text-cream/70">
            Pochi secondi, nessun account e nessun dato di contatto.
          </p>
        </header>

        <Village className="mb-5 mt-1 block h-auto w-full drop-shadow-[0_12px_18px_rgba(0,0,0,0.45)]" />

        <GoldFrame className="z-10">
          <ConfigNotice />

          {lastPassId && (
            <Link
              href={`/pass/${lastPassId}`}
              className="mb-5 flex items-center justify-between rounded-2xl border border-gold/40 bg-gold/10 px-4 py-3 text-sm font-medium text-gold-light transition hover:bg-gold/15"
            >
              <span>🎟️ Hai già prenotato? Apri il tuo pass</span>
              <span aria-hidden>→</span>
            </Link>
          )}

          {intakeSuspended && (
            <div
              role="status"
              className="mb-5 rounded-2xl border border-holly-light/50 bg-holly/25 p-4 text-center text-sm font-medium text-cream"
            >
              Le prenotazioni sono sospese per qualche minuto. La pagina si
              riaprirà da sola.
            </div>
          )}

          <form onSubmit={handleSubmit} className="flex flex-col gap-7">
            {/* 1 · Chi siete */}
            <Step n={1} title="Chi siete" done={nameDone}>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Field label="Nome" value={firstName} onChange={setFirstName} placeholder="Mario" autoComplete="given-name" />
                <Field label="Cognome" value={lastName} onChange={setLastName} placeholder="Rossi" autoComplete="family-name" />
              </div>
            </Step>

            {/* 2 · Quanti siete */}
            <Step
              n={2}
              title="Quanti siete"
              done
              aside={
                <span className="rounded-full border border-gold/30 px-3 py-1 text-xs text-gold-light">
                  {groupSize} {groupSize === 1 ? "persona" : "persone"}
                </span>
              }
            >
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
              {groupSize >= MAX_GROUP_SIZE && (
                <p className="mt-2 text-center text-xs text-gold-light">
                  Massimo {MAX_GROUP_SIZE} persone per prenotazione.
                </p>
              )}
            </Step>

            {/* 3 · Quando */}
            <Step
              n={3}
              title="Quando"
              done={!!selectedSlotId}
              aside={
                firstFree && firstFree.id !== selectedSlotId ? (
                  <button
                    type="button"
                    onClick={() => setSelectedSlotId(firstFree.id)}
                    className="inline-flex items-center gap-1.5 rounded-full border border-gold/40 bg-gold/10 px-3 py-1 text-xs font-medium text-gold-light transition hover:bg-gold/20 active:scale-95"
                  >
                    <Sparkles className="h-3.5 w-3.5" /> Primo libero:{" "}
                    {formatSlotTime(firstFree.slot_time)}
                  </button>
                ) : null
              }
            >
              {days.length > 1 && (
                <DayStrip days={days} today={today} selected={selectedDate} onSelect={chooseDay} />
              )}
              {selectedDate && (
                <p className="mb-3 text-center font-serif text-lg first-letter:uppercase text-gold-light">
                  {selectedDate === today ? "Oggi, " : ""}
                  {formatDayLong(selectedDate)}
                </p>
              )}
              {loading ? (
                <SlotSkeleton />
              ) : loadError ? (
                <div className="flex flex-col items-center gap-3 rounded-2xl border border-holly-light/40 bg-holly/15 px-4 py-6 text-center text-sm text-cream/90">
                  <WifiOff className="h-6 w-6 text-holly-light" />
                  Non riusciamo a caricare gli orari in questo momento.
                  <button
                    type="button"
                    onClick={() => {
                      setLoading(true);
                      loadSlots();
                    }}
                    className="rounded-full border border-cream/30 px-5 py-2 font-semibold text-cream transition hover:bg-cream/10"
                  >
                    Riprova
                  </button>
                </div>
              ) : days.length === 0 ? (
                <p className="rounded-2xl border border-gold/20 bg-pine/60 px-4 py-6 text-center text-sm text-cream/80">
                  🎄 Al momento non ci sono giorni prenotabili. Torna a trovarci presto!
                </p>
              ) : upcomingSlots.length === 0 ? (
                <p className="rounded-2xl border border-gold/20 bg-pine/60 px-4 py-6 text-center text-sm text-cream/80">
                  🎄 Per {selectedDate === today ? "oggi" : "questo giorno"} non ci sono più orari.
                  {days.some((d) => d.date !== selectedDate && d.free > 0) && " Scegli un altro giorno qui sopra."}
                </p>
              ) : (
                <>
                  <SlotBoard
                    slots={upcomingSlots}
                    groupSize={groupSize}
                    selectedId={selectedSlotId}
                    isSelectable={isSlotSelectable}
                    onSelect={setSelectedSlotId}
                  />
                  <Legend />
                </>
              )}
            </Step>

            {error && (
              <p role="alert" className="rounded-2xl border border-holly-light/40 bg-holly/20 px-4 py-3 text-center text-sm text-cream">
                {error}
              </p>
            )}

            {/* Barra di conferma: resta visibile mentre si scorre */}
            <div className="sticky bottom-3 z-20 -mx-1 rounded-3xl border border-gold/25 bg-pine-deep/90 p-2 shadow-[0_18px_40px_-12px_rgba(0,0,0,0.8)] backdrop-blur-md">
              {selectedSlot && nameDone && (
                <p className="px-3 pb-2 pt-1 text-center text-xs text-cream/75">
                  <span className="font-semibold text-gold-light">
                    {selectedSlot.slot_date === today
                      ? "Oggi"
                      : (() => {
                          const p = formatDayParts(selectedSlot.slot_date);
                          return `${p.weekday} ${p.day} ${p.month}`;
                        })()}{" "}
                    {formatSlotTime(selectedSlot.slot_time)}
                  </span>{" "}
                  · {groupSize} {groupSize === 1 ? "persona" : "persone"} ·{" "}
                  {firstName.trim()} {lastName.trim()}
                </p>
              )}
              <button
                type="submit"
                disabled={!canSubmit}
                className="flex w-full items-center justify-center gap-2 rounded-full border border-gold/50 bg-gradient-to-b from-[#cf3a42] to-holly-dark px-6 py-4 text-base font-semibold text-cream shadow-[inset_0_1px_0_rgba(255,255,255,0.25),0_12px_28px_-10px_rgba(179,38,46,0.9)] transition enabled:hover:brightness-110 enabled:active:scale-[0.98] disabled:cursor-not-allowed disabled:border-cream/10 disabled:from-cream/10 disabled:to-cream/5 disabled:text-cream/55 disabled:shadow-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold focus-visible:ring-offset-2 focus-visible:ring-offset-pine-deep"
              >
                {submitting ? (
                  <>
                    <Loader2 className="h-5 w-5 animate-spin" /> Prenotazione in corso…
                  </>
                ) : (
                  <>
                    {canSubmit && <span aria-hidden>🎁</span>} {ctaLabel}
                  </>
                )}
              </button>
            </div>
          </form>
        </GoldFrame>

        <footer className="mt-8 text-center text-xs text-cream/45">
          Ingressi ogni 15 minuti · massimo 15 persone per turno
        </footer>
      </main>
    </Backdrop>
  );
}

function Step({
  n,
  title,
  done,
  aside,
  children,
}: {
  n: number;
  title: string;
  done: boolean;
  aside?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    // min-w-0: per default un fieldset non si restringe sotto il suo contenuto,
    // e la fila di giorni scorrevole allargherebbe tutta la pagina.
    <fieldset className="min-w-0">
      <legend className="mb-3 flex w-full items-center justify-between gap-2">
        <span className="flex items-center gap-3">
          <span
            className={[
              "flex h-8 w-8 items-center justify-center rounded-full border font-serif text-sm transition",
              done
                ? "border-gold bg-gold text-pine-deep"
                : "border-gold/50 text-gold",
            ].join(" ")}
          >
            {done ? <Check className="h-4 w-4" strokeWidth={3} /> : n}
          </span>
          <span className="font-serif text-xl text-cream">{title}</span>
        </span>
        {aside}
      </legend>
      {children}
    </fieldset>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  autoComplete,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  autoComplete: string;
}) {
  return (
    <label className="flex flex-col gap-1.5 text-xs font-medium uppercase tracking-wider text-gold/90">
      {label}
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required
        maxLength={60}
        autoComplete={autoComplete}
        placeholder={placeholder}
        className="rounded-2xl border border-gold/25 bg-pine/70 px-4 py-3.5 text-base normal-case tracking-normal text-cream outline-none transition placeholder:text-cream/30 focus:border-gold focus:bg-pine focus:ring-2 focus:ring-gold/30"
      />
    </label>
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
  const btn =
    "flex h-11 w-11 items-center justify-center rounded-full border border-gold/35 bg-cream/5 text-xl text-cream transition hover:border-gold hover:bg-gold/15 active:scale-90 disabled:pointer-events-none disabled:opacity-25";
  return (
    <div className="rounded-2xl border border-gold/20 bg-pine/60 p-3">
      <span className="flex items-center gap-1.5 text-sm font-medium text-cream">
        <span className="text-gold">{icon}</span>
        {label}
      </span>
      <div className="mt-2 flex items-center justify-between">
        <button
          type="button"
          onClick={() => onChange(Math.max(min, value - 1))}
          disabled={value <= min}
          className={btn}
          aria-label={`Diminuisci ${label}`}
        >
          −
        </button>
        <span className="min-w-[2ch] text-center font-serif text-3xl text-gold-light" aria-live="polite">
          {value}
        </span>
        <button
          type="button"
          onClick={() => onChange(Math.min(max, value + 1))}
          disabled={value >= max}
          className={btn}
          aria-label={`Aumenta ${label}`}
        >
          +
        </button>
      </div>
    </div>
  );
}

/** Tabellone orari: una riga per ora, colonne :00 :15 :30 :45. */
function SlotBoard({
  slots,
  groupSize,
  selectedId,
  isSelectable,
  onSelect,
}: {
  slots: Slot[];
  groupSize: number;
  selectedId: string | null;
  isSelectable: (s: Slot) => boolean;
  onSelect: (id: string) => void;
}) {
  const rows = new Map<string, Slot[]>();
  for (const s of slots) {
    const h = s.slot_time.slice(0, 2);
    rows.set(h, [...(rows.get(h) ?? []), s]);
  }

  return (
    <div className="space-y-2" role="radiogroup" aria-label="Orario di ingresso">
      {Array.from(rows, ([hour, list]) => (
        <div key={hour} className="grid grid-cols-4 gap-2">
          {list.map((slot) => (
            <SlotChip
              key={slot.id}
              slot={slot}
              groupSize={groupSize}
              selected={slot.id === selectedId}
              selectable={isSelectable(slot)}
              onSelect={() => onSelect(slot.id)}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

function SlotChip({
  slot,
  groupSize,
  selected,
  selectable,
  onSelect,
}: {
  slot: Slot;
  groupSize: number;
  selected: boolean;
  selectable: boolean;
  onSelect: () => void;
}) {
  const remaining = remainingSeats(slot);
  const quarter = Math.floor(Number(slot.slot_time.slice(3, 5)) / 15);
  const ratio = Math.max(0, Math.min(1, remaining / slot.max_capacity));

  let note: string;
  let tone: "ok" | "few" | "off";
  if (slot.status === "suspended") {
    note = "Sospeso";
    tone = "off";
  } else if (remaining <= 0) {
    note = "Pieno";
    tone = "off";
  } else if (remaining < groupSize) {
    note = `Solo ${remaining}`;
    tone = "off";
  } else if (remaining <= FEW_SEATS) {
    note = `Ultimi ${remaining}`;
    tone = "few";
  } else {
    note = `${remaining} posti`;
    tone = "ok";
  }

  const bar = tone === "few" ? "bg-amber-400" : tone === "ok" ? "bg-emerald-400" : "bg-cream/25";

  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      aria-label={`${formatSlotTime(slot.slot_time)}, ${note}`}
      disabled={!selectable}
      onClick={onSelect}
      style={{ gridColumnStart: quarter + 1 }}
      className={[
        "relative flex min-h-[64px] flex-col items-center justify-center gap-1 rounded-2xl border px-1 pb-2 pt-2.5 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold",
        selected
          ? "border-gold bg-gradient-to-b from-gold-light to-gold text-pine-deep shadow-[0_0_0_3px_rgba(236,201,122,0.25),0_10px_24px_-8px_rgba(212,165,72,0.8)]"
          : selectable
            ? "border-gold/25 bg-pine-light/60 text-cream hover:-translate-y-0.5 hover:border-gold/70 hover:bg-pine-light active:translate-y-0"
            : "cursor-not-allowed border-cream/5 bg-cream/[0.03] text-cream/35",
      ].join(" ")}
    >
      {selected && (
        <span className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-holly text-cream shadow">
          <Check className="h-3 w-3" strokeWidth={3} />
        </span>
      )}
      <span className="text-[15px] font-semibold tabular-nums leading-none">
        {formatSlotTime(slot.slot_time)}
      </span>
      <span
        className={[
          "text-[10px] leading-none",
          selected ? "text-pine-deep/75" : tone === "few" ? "text-amber-300" : "",
        ].join(" ")}
      >
        {note}
      </span>
      <span className={`mt-0.5 h-1 w-3/4 overflow-hidden rounded-full ${selected ? "bg-pine-deep/20" : "bg-cream/10"}`}>
        <span
          className={`block h-full rounded-full ${selected ? "bg-pine-deep/70" : bar}`}
          style={{ width: `${ratio * 100}%` }}
        />
      </span>
    </button>
  );
}

function Legend() {
  const item = (cls: string, text: string) => (
    <span className="flex items-center gap-1.5">
      <span className={`h-2 w-2 rounded-full ${cls}`} />
      {text}
    </span>
  );
  return (
    <div className="mt-3 flex flex-wrap justify-center gap-x-4 gap-y-1 text-[11px] text-cream/55">
      {item("bg-emerald-400", "Disponibile")}
      {item("bg-amber-400", "Ultimi posti")}
      {item("bg-cream/30", "Pieno o troppo piccolo per il gruppo")}
    </div>
  );
}

/** Fila di giorni scorrevole: giorno della settimana, data e posti liberi. */
function DayStrip({
  days,
  today,
  selected,
  onSelect,
}: {
  days: DaySummary[];
  today: string | null;
  selected: string | null;
  onSelect: (date: string) => void;
}) {
  return (
    <div
      className="-mx-1 mb-3 flex snap-x gap-2 overflow-x-auto px-1 pb-2 pt-1 [scrollbar-width:thin]"
      role="radiogroup"
      aria-label="Giorno di visita"
    >
      {days.map((d) => {
        const p = formatDayParts(d.date);
        const isSel = d.date === selected;
        const closed = d.upcoming === 0;
        const full = closed || d.free <= 0;
        return (
          <button
            key={d.date}
            type="button"
            role="radio"
            aria-checked={isSel}
            aria-label={`${formatDayLong(d.date)}, ${closed ? "chiuso" : full ? "pieno" : `${d.free} posti liberi`}`}
            onClick={() => onSelect(d.date)}
            className={[
              "flex min-w-[64px] shrink-0 snap-start flex-col items-center rounded-2xl border px-2 py-2 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold",
              isSel
                ? "border-gold bg-gradient-to-b from-gold-light to-gold text-pine-deep shadow-[0_8px_20px_-8px_rgba(212,165,72,0.8)]"
                : full
                  ? "border-cream/5 bg-cream/[0.03] text-cream/35"
                  : "border-gold/25 bg-pine-light/60 text-cream hover:border-gold/70",
            ].join(" ")}
          >
            <span className="text-[10px] uppercase tracking-wider">
              {d.date === today ? "oggi" : p.weekday}
            </span>
            <span className="font-serif text-2xl leading-tight">{p.day}</span>
            <span className="text-[10px] uppercase">{p.month}</span>
            <span
              className={[
                "mt-1 text-[10px] leading-none",
                isSel ? "text-pine-deep/75" : full ? "" : "text-emerald-300",
              ].join(" ")}
            >
              {closed ? "chiuso" : full ? "pieno" : `${d.free} posti`}
            </span>
          </button>
        );
      })}
    </div>
  );
}

function SlotSkeleton() {
  return (
    <div className="grid grid-cols-4 gap-2" aria-label="Caricamento orari">
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="h-16 animate-pulse rounded-2xl border border-gold/10 bg-cream/5" />
      ))}
    </div>
  );
}
