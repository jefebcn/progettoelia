"use client";

import { useEffect, useState } from "react";
import { QRCodeCanvas } from "qrcode.react";
import { Loader2, Users, Baby, Clock, ArrowLeft } from "lucide-react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import type { Reservation, Slot } from "@/lib/types";
import {
  formatPass,
  formatSlotTime,
  reservationStatusLabel,
  currentSlotTime,
} from "@/lib/format";

export default function PassPage({ params }: { params: { id: string } }) {
  const { id } = params;
  const [reservation, setReservation] = useState<Reservation | null>(null);
  const [slot, setSlot] = useState<Slot | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [nowTick, setNowTick] = useState(0);

  useEffect(() => {
    let active = true;

    async function load() {
      const { data: res } = await supabase
        .from("reservations")
        .select("*")
        .eq("id", id)
        .maybeSingle();
      if (!active) return;
      if (!res) {
        setNotFound(true);
        setLoading(false);
        return;
      }
      setReservation(res as Reservation);
      const { data: s } = await supabase
        .from("slots")
        .select("*")
        .eq("id", (res as Reservation).slot_id)
        .maybeSingle();
      if (!active) return;
      if (s) setSlot(s as Slot);
      setLoading(false);
    }

    load();

    const channel = supabase
      .channel(`pass-${id}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "reservations",
          filter: `id=eq.${id}`,
        },
        (payload) => setReservation(payload.new as Reservation),
      )
      .subscribe();

    // Aggiorna l'indicazione "è il tuo turno" col passare del tempo.
    const interval = setInterval(() => setNowTick((t) => t + 1), 30_000);

    return () => {
      active = false;
      supabase.removeChannel(channel);
      clearInterval(interval);
    };
  }, [id]);

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center text-slate-400">
        <Loader2 className="h-8 w-8 animate-spin" />
      </main>
    );
  }

  if (notFound || !reservation) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-4 px-6 text-center">
        <p className="text-lg font-semibold text-slate-700">
          Prenotazione non trovata.
        </p>
        <Link href="/" className="text-brand underline">
          Torna alla prenotazione
        </Link>
      </main>
    );
  }

  const status = reservation.status;
  let display = reservationStatusLabel(status);

  // "È il tuo turno!" se lo slot è quello attualmente in chiamata e non ancora entrato.
  const isCalling =
    slot && currentSlotTime() === slot.slot_time && status === "booked";
  if (isCalling) display = { label: "È il tuo turno!", tone: "turn" };

  const toneStyles: Record<string, string> = {
    wait: "bg-amber-50 text-amber-700 border-amber-200",
    turn: "bg-emerald-50 text-emerald-700 border-emerald-200 animate-pulse",
    done: "bg-blue-50 text-blue-700 border-blue-200",
    muted: "bg-slate-100 text-slate-500 border-slate-200",
  };

  // Il QR contiene l'ID prenotazione: lo scanner operatore lo legge per il check-in.
  const qrValue = reservation.id;

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col px-4 py-6">
      <Link
        href="/"
        className="mb-4 inline-flex items-center gap-1 text-sm text-slate-400 hover:text-slate-600"
      >
        <ArrowLeft className="h-4 w-4" /> Nuova prenotazione
      </Link>

      <div className="flex flex-col items-center rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <span className="text-sm font-medium uppercase tracking-wide text-slate-400">
          Pass ingresso
        </span>
        <span className="text-5xl font-black tracking-tight text-brand">
          {formatPass(reservation.pass_number)}
        </span>

        <div className="my-5 rounded-2xl border border-slate-100 bg-white p-3">
          <QRCodeCanvas value={qrValue} size={200} level="M" includeMargin />
        </div>

        <div
          className={`w-full rounded-xl border px-4 py-3 text-center text-base font-semibold ${toneStyles[display.tone]}`}
        >
          {display.label}
        </div>

        <div className="mt-5 grid w-full grid-cols-2 gap-3 text-sm">
          <Info
            icon={<Clock className="h-4 w-4" />}
            label="Orario"
            value={slot ? formatSlotTime(slot.slot_time) : "—"}
          />
          <Info
            label="Nome"
            value={`${reservation.first_name} ${reservation.last_name}`}
          />
          <Info
            icon={<Users className="h-4 w-4" />}
            label="Adulti"
            value={String(reservation.adults_count)}
          />
          <Info
            icon={<Baby className="h-4 w-4" />}
            label="Bambini"
            value={String(reservation.children_count)}
          />
        </div>

        <p className="mt-5 text-center text-xs text-slate-400">
          Mostra questo QR Code all&apos;operatore all&apos;ingresso. La pagina si
          aggiorna da sola in tempo reale.
        </p>
      </div>
    </main>
  );
}

function Info({
  icon,
  label,
  value,
}: {
  icon?: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl bg-slate-50 px-3 py-2">
      <div className="flex items-center gap-1 text-xs text-slate-400">
        {icon}
        {label}
      </div>
      <div className="mt-0.5 font-semibold text-slate-700">{value}</div>
    </div>
  );
}
