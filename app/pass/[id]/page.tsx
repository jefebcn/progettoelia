"use client";

import { useEffect, useState } from "react";
import { QRCodeCanvas } from "qrcode.react";
import {
  ArrowLeft,
  Baby,
  BellRing,
  CheckCircle2,
  Clock,
  Hourglass,
  Loader2,
  Users,
  XCircle,
} from "lucide-react";
import Link from "next/link";
import { api } from "@/lib/api";
import type { Reservation, Slot } from "@/lib/types";
import {
  formatPass,
  formatSlotTime,
  reservationStatusLabel,
  currentSlotTime,
  eventToday,
  formatDayLong,
} from "@/lib/format";
import { Backdrop } from "@/components/festive/Backdrop";
import { GoldFrame, Ornament } from "@/components/festive/GoldFrame";
import { Village } from "@/components/festive/Village";

export default function PassPage({ params }: { params: { id: string } }) {
  const { id } = params;
  const [reservation, setReservation] = useState<Reservation | null>(null);
  const [slot, setSlot] = useState<Slot | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [nowTick, setNowTick] = useState(0);

  const [offline, setOffline] = useState(false);

  useEffect(() => {
    let active = true;

    async function load() {
      // Il pass si legge solo conoscendo il suo UUID.
      const res = await api.pass(id);
      if (!active) return;
      if (!res.ok && res.error !== "NOT_FOUND") {
        // Errore di rete: teniamo a schermo l'ultimo pass noto.
        setOffline(true);
        setLoading(false);
        return;
      }
      setOffline(false);
      if (!res.ok) {
        setNotFound(true);
        setLoading(false);
        try {
          if (localStorage.getItem("elia-last-pass") === id)
            localStorage.removeItem("elia-last-pass");
        } catch {
          /* noop */
        }
        return;
      }
      setReservation(res.data.reservation);
      setSlot(res.data.slot);
      setNotFound(false);
      setLoading(false);
    }

    load();

    // Aggiornamento dello stato (check-in) ogni 5 secondi + "è il tuo turno".
    const poll = setInterval(load, 5_000);
    const interval = setInterval(() => setNowTick((t) => t + 1), 30_000);

    return () => {
      active = false;
      clearInterval(poll);
      clearInterval(interval);
    };
  }, [id]);

  if (loading) {
    return (
      <Shell>
        <div className="flex flex-1 items-center justify-center text-gold">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      </Shell>
    );
  }

  if (!reservation && offline) {
    return (
      <Shell>
        <Message title="Connessione assente">
          Riprova tra qualche secondo: la pagina si aggiorna da sola.
        </Message>
      </Shell>
    );
  }

  if (notFound || !reservation) {
    return (
      <Shell>
        <Message title="Prenotazione non trovata">
          <Link
            href="/"
            className="mt-2 inline-flex rounded-full border border-gold/50 bg-gold/10 px-5 py-2.5 font-semibold text-gold-light transition hover:bg-gold/20"
          >
            Torna alla prenotazione
          </Link>
        </Message>
      </Shell>
    );
  }

  const status = reservation.status;
  let display = reservationStatusLabel(status);

  // "È il tuo turno!" se lo slot è quello attualmente in chiamata e non ancora entrato.
  const isCalling =
    slot &&
    slot.slot_date === eventToday() &&
    currentSlotTime() === slot.slot_time &&
    status === "booked";
  if (isCalling) display = { label: "È il tuo turno!", tone: "turn" };

  const tones = {
    wait: { cls: "border-gold/45 bg-gold/10 text-gold-light", icon: <Hourglass className="h-5 w-5" /> },
    turn: { cls: "animate-glow border-emerald-300/70 bg-emerald-500/20 text-emerald-100", icon: <BellRing className="h-5 w-5" /> },
    done: { cls: "border-emerald-400/50 bg-emerald-600/20 text-emerald-100", icon: <CheckCircle2 className="h-5 w-5" /> },
    muted: { cls: "border-cream/15 bg-cream/5 text-cream/60", icon: <XCircle className="h-5 w-5" /> },
  } as const;
  const tone = tones[display.tone];

  // Il QR contiene l'ID prenotazione: lo scanner operatore lo legge per il check-in.
  const qrValue = reservation.id;

  return (
    <Shell>
      <header className="text-center">
        <p className="text-xs font-semibold uppercase tracking-[0.3em] text-gold">
          ✦ Il tuo pass ✦
        </p>
        <p className="text-gold-shine mt-1 font-serif text-6xl font-semibold leading-tight">
          {formatPass(reservation.pass_number)}
        </p>
        <Ornament className="mt-1" />
      </header>

      <GoldFrame className="mt-6">
        <div
          role="status"
          className={`flex items-center justify-center gap-2 rounded-full border px-4 py-3 text-base font-semibold ${tone.cls}`}
        >
          {tone.icon}
          {display.label}
        </div>

        <div className="mx-auto mt-5 w-fit rounded-3xl border border-gold/50 bg-cream p-3 shadow-[0_12px_30px_-10px_rgba(0,0,0,0.7)]">
          <QRCodeCanvas
            value={qrValue}
            size={208}
            level="M"
            includeMargin
            bgColor="#f6efe2"
            fgColor="#0b2019"
          />
        </div>
        <p className="mt-3 text-center text-sm text-cream/75">
          Mostra questo QR all&apos;operatore all&apos;ingresso.
        </p>

        {/* Linea tratteggiata da biglietto, con le "tacche" ai lati */}
        <div aria-hidden className="relative my-5">
          <div className="border-t border-dashed border-gold/35" />
          <span className="absolute -left-8 -top-3 h-6 w-6 rounded-full border border-gold/40 bg-pine-deep sm:-left-10" />
          <span className="absolute -right-8 -top-3 h-6 w-6 rounded-full border border-gold/40 bg-pine-deep sm:-right-10" />
        </div>

        <dl className="grid grid-cols-2 gap-3">
          {slot && (
            <div className="col-span-2 rounded-2xl border border-gold/30 bg-gold/10 px-3 py-2.5 text-center">
              <dt className="text-[11px] font-medium uppercase tracking-wider text-gold/90">
                {slot.slot_date === eventToday() ? "Oggi" : "Giorno della visita"}
              </dt>
              <dd className="mt-0.5 font-serif text-xl first-letter:uppercase text-cream">
                {formatDayLong(slot.slot_date)}
              </dd>
            </div>
          )}
          <Info icon={<Clock className="h-4 w-4" />} label="Orario" value={slot ? formatSlotTime(slot.slot_time) : "—"} big />
          <Info label="Nome" value={`${reservation.first_name} ${reservation.last_name}`} />
          <Info icon={<Users className="h-4 w-4" />} label="Adulti" value={String(reservation.adults_count)} />
          <Info icon={<Baby className="h-4 w-4" />} label="Bambini" value={String(reservation.children_count)} />
        </dl>

        {offline && (
          <p className="mt-4 rounded-2xl border border-amber-300/40 bg-amber-400/10 px-3 py-2 text-center text-xs text-amber-100">
            Connessione instabile: il pass resta valido, lo stato si aggiornerà da solo.
          </p>
        )}

        <p className="mt-5 text-center text-xs text-cream/45">
          Questa pagina si aggiorna da sola: puoi tenerla aperta fino all&apos;ingresso.
        </p>
      </GoldFrame>

      <Link
        href="/"
        className="mx-auto mt-6 inline-flex items-center gap-1.5 text-sm text-cream/55 transition hover:text-cream"
      >
        <ArrowLeft className="h-4 w-4" /> Nuova prenotazione
      </Link>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <Backdrop>
      <main className="mx-auto flex min-h-screen w-full max-w-md flex-col px-4 pb-6 pt-8">
        {children}
        <Village className="mt-auto block h-auto w-full pt-8 opacity-90" />
      </main>
    </Backdrop>
  );
}

function Message({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center">
      <p className="font-serif text-3xl text-cream">{title}</p>
      <Ornament />
      <div className="text-sm text-cream/70">{children}</div>
    </div>
  );
}

function Info({
  icon,
  label,
  value,
  big,
}: {
  icon?: React.ReactNode;
  label: string;
  value: string;
  big?: boolean;
}) {
  return (
    <div className="rounded-2xl border border-gold/15 bg-pine/60 px-3 py-2.5">
      <dt className="flex items-center gap-1 text-[11px] font-medium uppercase tracking-wider text-gold/90">
        {icon}
        {label}
      </dt>
      <dd className={`mt-0.5 font-semibold text-cream ${big ? "font-serif text-2xl text-gold-light" : ""}`}>
        {value}
      </dd>
    </div>
  );
}
