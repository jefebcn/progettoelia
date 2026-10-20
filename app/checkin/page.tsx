"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ScanLine,
  Search,
  UserPlus,
  Pause,
  Play,
  CheckCircle2,
  XCircle,
  Loader2,
  X,
  RotateCcw,
  AlertTriangle,
  Lock,
  LogOut,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import type { Reservation, Slot, SystemState } from "@/lib/types";
import {
  formatPass,
  formatSlotTime,
  currentSlotTime,
  eventMinutesNow,
  slotMinutes,
} from "@/lib/format";
import { errorMessage } from "@/lib/errors";
import { getStoredPin, staffRpc, storePin } from "@/lib/staff";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Errori che invalidano la sessione operatore. */
const AUTH_ERRORS = ["BAD_PIN", "PIN_NOT_SET", "TOO_MANY_ATTEMPTS"];
import { QrScanner } from "@/components/QrScanner";
import { ConfigNotice } from "@/components/ConfigNotice";

type Tab = "scan" | "manual";

export default function CheckinPage() {
  const [pin, setPin] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setPin(getStoredPin());
    setReady(true);
  }, []);

  if (!ready) return null;
  if (!pin)
    return (
      <PinGate
        onSuccess={(p) => {
          storePin(p);
          setPin(p);
        }}
      />
    );
  return (
    <CheckinDashboard
      pin={pin}
      onLogout={() => {
        storePin(null);
        setPin(null);
      }}
    />
  );
}

function PinGate({ onSuccess }: { onSuccess: (pin: string) => void }) {
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!value || busy) return;
    setBusy(true);
    setErr(null);
    const res = await staffRpc("staff_login", value);
    setBusy(false);
    if (res.ok) onSuccess(value);
    else setErr(errorMessage(res.error, "Accesso non riuscito."));
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <form
        onSubmit={submit}
        className="w-full max-w-xs rounded-3xl border border-slate-200 bg-white p-6 shadow-sm"
      >
        <h1 className="mb-1 flex items-center gap-2 text-lg font-bold">
          <Lock className="h-5 w-5" /> Area operatore
        </h1>
        <p className="mb-4 text-sm text-slate-500">Inserisci il PIN per continuare.</p>
        <input
          type="password"
          inputMode="numeric"
          autoComplete="current-password"
          autoFocus
          value={value}
          onChange={(e) => setValue(e.target.value)}
          className="w-full rounded-xl border border-slate-300 px-3 py-3 text-center text-lg tracking-widest outline-none focus:border-brand"
          placeholder="••••••"
        />
        {err && <p className="mt-3 text-center text-sm text-red-600">{err}</p>}
        <button
          type="submit"
          disabled={!value || busy}
          className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-slate-800 px-4 py-3 font-semibold text-white disabled:opacity-40"
        >
          {busy && <Loader2 className="h-4 w-4 animate-spin" />} Entra
        </button>
      </form>
    </main>
  );
}

function CheckinDashboard({
  pin,
  onLogout,
}: {
  pin: string;
  onLogout: () => void;
}) {
  const [tab, setTab] = useState<Tab>("scan");
  const [slots, setSlots] = useState<Slot[]>([]);
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [intakeSuspended, setIntakeSuspended] = useState(false);
  const [active, setActive] = useState<Reservation | null>(null);
  const [feedback, setFeedback] = useState<{ msg: string; ok: boolean } | null>(
    null,
  );
  const [showQuickEntry, setShowQuickEntry] = useState(false);
  const [showReset, setShowReset] = useState(false);
  const [search, setSearch] = useState("");
  const [offline, setOffline] = useState(false);
  const lastScanRef = useRef<{ id: string; at: number }>({ id: "", at: 0 });
  const flashTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  /** Esegue una funzione staff; se il PIN non è più valido esce. */
  const call = useCallback(
    async <T,>(fn: string, params: Record<string, unknown> = {}) => {
      const res = await staffRpc<T>(fn, pin, params);
      if (!res.ok && AUTH_ERRORS.some((e) => res.error.includes(e))) onLogout();
      return res;
    },
    [pin, onLogout],
  );

  const loadAll = useCallback(async () => {
    const [{ data: s, error: sErr }, r, { data: st }] = await Promise.all([
      supabase.from("slots").select("*").order("slot_time", { ascending: true }),
      call<Reservation[]>("staff_list_reservations"),
      supabase.from("system_state").select("*").eq("id", true).maybeSingle(),
    ]);
    setOffline(!!sErr || !r.ok);
    if (s) setSlots(s as Slot[]);
    if (r.ok) setReservations(r.data ?? []);
    if (st) setIntakeSuspended((st as SystemState).intake_suspended);
  }, [call]);

  useEffect(() => {
    loadAll();
    const channel = supabase
      .channel("checkin-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "slots" },
        () => loadAll(),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "system_state" },
        (payload) =>
          setIntakeSuspended((payload.new as SystemState).intake_suspended),
      )
      .subscribe();
    // I check-in fatti da altri tablet arrivano con il polling.
    const poll = setInterval(loadAll, 5_000);
    return () => {
      supabase.removeChannel(channel);
      clearInterval(poll);
    };
  }, [loadAll]);

  const flash = useCallback((msg: string, ok: boolean) => {
    setFeedback({ msg, ok });
    if (flashTimer.current) clearTimeout(flashTimer.current);
    flashTimer.current = setTimeout(() => setFeedback(null), 3500);
  }, []);

  const openReservation = useCallback(
    async (id: string) => {
      // Un QR qualsiasi (es. un link) non deve generare errori dal database.
      if (!UUID_RE.test(id)) {
        flash("QR non valido: non è un pass di questo evento.", false);
        return;
      }
      const res = await call<Reservation>("staff_get_reservation", { p_id: id });
      if (res.ok) setActive(res.data);
      else flash(errorMessage(res.error, "Pass non riconosciuto."), false);
    },
    [flash, call],
  );

  const handleScan = useCallback(
    (value: string) => {
      const id = value.trim();
      const now = Date.now();
      // Anti-rimbalzo: ignora lo stesso QR entro 3 secondi.
      if (lastScanRef.current.id === id && now - lastScanRef.current.at < 3000)
        return;
      lastScanRef.current = { id, at: now };
      openReservation(id);
    },
    [openReservation],
  );

  async function checkIn(res: Reservation) {
    const r = await call("staff_check_in", { p_id: res.id });
    if (!r.ok) flash(errorMessage(r.error, "Errore durante il check-in."), false);
    else {
      flash(`Ingresso ${formatPass(res.pass_number)} confermato.`, true);
      setActive(null);
      loadAll();
    }
  }

  async function markNoShow(res: Reservation) {
    // Ora "Assente" restituisce anche i posti allo slot.
    const r = await call("staff_mark_no_show", { p_id: res.id });
    if (!r.ok) flash(errorMessage(r.error, "Errore."), false);
    else {
      flash(`${formatPass(res.pass_number)} assente: ${res.total_people} posti liberati.`, true);
      setActive(null);
      loadAll();
    }
  }

  async function toggleSuspend() {
    const next = !intakeSuspended;
    const r = await call("staff_set_intake", { p_suspended: next });
    if (!r.ok) flash(errorMessage(r.error, "Impossibile aggiornare lo stato."), false);
    else {
      setIntakeSuspended(next);
      flash(next ? "Prenotazioni sospese." : "Prenotazioni riattivate.", true);
    }
  }

  async function toggleSlotSuspend(slot: Slot) {
    const r = await call("staff_set_slot_suspended", {
      p_slot_id: slot.id,
      p_suspended: slot.status !== "suspended",
    });
    if (!r.ok) flash(errorMessage(r.error, "Errore aggiornamento slot."), false);
    else loadAll();
  }

  async function resetDay() {
    const r = await call("staff_reset_day", { p_reset_numbers: true });
    if (!r.ok) {
      flash(errorMessage(r.error, "Errore durante il reset. Riprova."), false);
      return false;
    }
    await loadAll();
    flash("Giornata azzerata. Tutto pronto per ripartire.", true);
    return true;
  }

  const filteredReservations = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return reservations;
    return reservations.filter(
      (r) =>
        `${r.first_name} ${r.last_name}`.toLowerCase().includes(q) ||
        String(r.pass_number).includes(q),
    );
  }, [reservations, search]);

  return (
    <main className="mx-auto max-w-5xl px-4 py-5">
      <ConfigNotice />

      {/* Header + azioni globali */}
      <header className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold">🎅 Check-in operatore</h1>
          <p className="text-sm text-slate-500">
            Convalida i pass, gestisci walk-in e sospensioni. Buone feste!
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setShowQuickEntry(true)}
            className="inline-flex items-center gap-2 rounded-xl bg-slate-800 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-900"
          >
            <UserPlus className="h-4 w-4" /> Ingresso rapido
          </button>
          <button
            onClick={toggleSuspend}
            className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-white ${
              intakeSuspended
                ? "bg-emerald-600 hover:bg-emerald-700"
                : "bg-red-600 hover:bg-red-700"
            }`}
          >
            {intakeSuspended ? (
              <>
                <Play className="h-4 w-4" /> Riattiva
              </>
            ) : (
              <>
                <Pause className="h-4 w-4" /> Sospendi prenotazioni
              </>
            )}
          </button>
          <button
            onClick={onLogout}
            title="Esci"
            className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50"
          >
            <LogOut className="h-4 w-4" />
          </button>
          <button
            onClick={() => setShowReset(true)}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50"
          >
            <RotateCcw className="h-4 w-4" /> Reset
          </button>
        </div>
      </header>

      {offline && (
        <div className="mb-4 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-800">
          ⚠️ Connessione al database assente: i dati potrebbero non essere aggiornati.
        </div>
      )}

      {intakeSuspended && (
        <div className="mb-4 rounded-xl border border-red-300 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
          🔴 Prenotazioni self-service sospese. Gli operatori possono comunque
          registrare ingressi rapidi.
        </div>
      )}

      {feedback && (
        <div
          className={`mb-4 flex items-center gap-2 rounded-xl px-4 py-3 text-sm font-medium ${
            feedback.ok
              ? "bg-emerald-50 text-emerald-700"
              : "bg-red-50 text-red-700"
          }`}
        >
          {feedback.ok ? (
            <CheckCircle2 className="h-4 w-4" />
          ) : (
            <XCircle className="h-4 w-4" />
          )}
          {feedback.msg}
        </div>
      )}

      {/* Tab */}
      <div className="mb-4 inline-flex rounded-xl border border-slate-200 bg-white p-1">
        <TabButton
          active={tab === "scan"}
          onClick={() => setTab("scan")}
          icon={<ScanLine className="h-4 w-4" />}
          label="Scanner QR"
        />
        <TabButton
          active={tab === "manual"}
          onClick={() => setTab("manual")}
          icon={<Search className="h-4 w-4" />}
          label="Ricerca manuale"
        />
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        <section className="lg:col-span-2">
          {tab === "scan" ? (
            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <QrScanner onScan={handleScan} paused={!!active} />
              <p className="mt-3 text-center text-sm text-slate-500">
                Inquadra il QR Code del visitatore per convalidare l&apos;ingresso.
              </p>
            </div>
          ) : (
            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <div className="mb-3 flex items-center gap-2 rounded-xl border border-slate-300 px-3 py-2">
                <Search className="h-4 w-4 text-slate-400" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Cerca per nome o numero pass…"
                  className="w-full outline-none"
                />
              </div>
              <ul className="max-h-[60vh] divide-y divide-slate-100 overflow-y-auto">
                {filteredReservations.map((r) => {
                  const slot = slots.find((s) => s.id === r.slot_id);
                  return (
                    <li
                      key={r.id}
                      className="flex items-center justify-between gap-3 py-2.5"
                    >
                      <div>
                        <div className="font-semibold text-slate-800">
                          {formatPass(r.pass_number)} · {r.first_name}{" "}
                          {r.last_name}
                        </div>
                        <div className="text-xs text-slate-400">
                          {slot ? formatSlotTime(slot.slot_time) : "—"} ·{" "}
                          {r.total_people} pers. · {statusText(r.status)}
                        </div>
                      </div>
                      <button
                        onClick={() => setActive(r)}
                        className="rounded-lg bg-slate-100 px-3 py-1.5 text-sm font-medium hover:bg-slate-200"
                      >
                        Apri
                      </button>
                    </li>
                  );
                })}
                {filteredReservations.length === 0 && (
                  <li className="py-8 text-center text-sm text-slate-400">
                    Nessuna prenotazione trovata.
                  </li>
                )}
              </ul>
            </div>
          )}
        </section>

        {/* Pannello slot */}
        <aside className="rounded-2xl border border-slate-200 bg-white p-4">
          <h2 className="mb-3 text-sm font-semibold text-slate-700">
            Slot &amp; capienza
          </h2>
          <ul className="max-h-[60vh] space-y-1.5 overflow-y-auto">
            {slots.map((slot) => (
              <li
                key={slot.id}
                className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 text-sm"
              >
                <span className="font-semibold">
                  {formatSlotTime(slot.slot_time)}
                </span>
                <span className="text-xs text-slate-500">
                  {slot.current_booked}/{slot.max_capacity}
                </span>
                <button
                  onClick={() => toggleSlotSuspend(slot)}
                  className={`rounded-md px-2 py-1 text-xs font-medium ${
                    slot.status === "suspended"
                      ? "bg-amber-100 text-amber-700"
                      : slot.status === "full"
                        ? "bg-slate-200 text-slate-500"
                        : "bg-emerald-100 text-emerald-700"
                  }`}
                >
                  {slot.status === "suspended"
                    ? "Sospeso"
                    : slot.status === "full"
                      ? "Pieno"
                      : "Attivo"}
                </button>
              </li>
            ))}
          </ul>
        </aside>
      </div>

      {/* Modale dettaglio prenotazione */}
      {active && (
        <ReservationModal
          reservation={active}
          slot={slots.find((s) => s.id === active.slot_id) ?? null}
          onClose={() => setActive(null)}
          onCheckIn={() => checkIn(active)}
          onNoShow={() => markNoShow(active)}
        />
      )}

      {/* Modale ingresso rapido */}
      {showQuickEntry && (
        <QuickEntryModal
          slots={slots}
          call={call}
          onClose={() => setShowQuickEntry(false)}
          onDone={(msg, ok) => {
            flash(msg, ok);
            setShowQuickEntry(false);
            loadAll();
          }}
        />
      )}

      {/* Modale reset giornata */}
      {showReset && (
        <ResetModal
          reservationsCount={reservations.length}
          onClose={() => setShowReset(false)}
          onConfirm={resetDay}
        />
      )}
    </main>
  );
}

function ResetModal({
  reservationsCount,
  onClose,
  onConfirm,
}: {
  reservationsCount: number;
  onClose: () => void;
  onConfirm: () => Promise<boolean>;
}) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const canReset = text.trim().toUpperCase() === "RESET";

  async function handle() {
    if (!canReset || busy) return;
    setBusy(true);
    const ok = await onConfirm();
    setBusy(false);
    if (ok) onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center">
      <div className="w-full max-w-sm rounded-3xl bg-white p-6 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="flex items-center gap-2 text-lg font-bold text-red-600">
            <AlertTriangle className="h-5 w-5" /> Reset giornata
          </h3>
          <button
            onClick={onClose}
            className="rounded-full p-1 text-slate-400 hover:bg-slate-100"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <p className="text-sm text-slate-600">
          Questa azione <strong>cancella tutte le prenotazioni</strong> (
          {reservationsCount} attuali), azzera i posti di ogni slot, riattiva
          tutti gli slot e riporta la numerazione pass a #101.
        </p>
        <p className="mt-2 text-sm font-medium text-red-600">
          L&apos;operazione non è reversibile.
        </p>

        <label className="mt-4 block text-sm text-slate-600">
          Scrivi <span className="font-mono font-bold">RESET</span> per
          confermare:
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="RESET"
            className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5 uppercase outline-none focus:border-red-500"
          />
        </label>

        <div className="mt-5 flex gap-2">
          <button
            onClick={onClose}
            className="flex-1 rounded-xl border border-slate-300 px-4 py-3 text-sm font-semibold text-slate-600 hover:bg-slate-50"
          >
            Annulla
          </button>
          <button
            onClick={handle}
            disabled={!canReset || busy}
            className="flex-[2] inline-flex items-center justify-center gap-2 rounded-xl bg-red-600 px-4 py-3 text-sm font-semibold text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {busy ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <RotateCcw className="h-5 w-5" />
            )}
            Azzera tutto
          </button>
        </div>
      </div>
    </div>
  );
}

function statusText(status: string): string {
  return (
    {
      booked: "prenotato",
      checked_in: "entrato",
      no_show: "assente",
      manual_entry: "walk-in",
    }[status] ?? status
  );
}

function TabButton({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium ${
        active ? "bg-brand text-white" : "text-slate-600 hover:bg-slate-100"
      }`}
    >
      {icon}
      {label}
    </button>
  );
}

function ReservationModal({
  reservation,
  slot,
  onClose,
  onCheckIn,
  onNoShow,
}: {
  reservation: Reservation;
  slot: Slot | null;
  onClose: () => void;
  onCheckIn: () => void;
  onNoShow: () => void;
}) {
  const alreadyIn =
    reservation.status === "checked_in" || reservation.status === "manual_entry";
  // Avviso per chi arriva molto prima o dopo il proprio slot.
  const diff = slot ? eventMinutesNow() - slotMinutes(slot.slot_time) : 0;
  const timing =
    !slot || alreadyIn
      ? null
      : diff < -15
        ? `⏰ In anticipo di ${-diff} min`
        : diff > 30
          ? `⏰ In ritardo di ${diff - 15} min`
          : null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center">
      <div className="w-full max-w-sm rounded-3xl bg-white p-6 shadow-xl">
        <div className="mb-4 flex items-start justify-between">
          <div>
            <div className="text-3xl font-black text-brand">
              {formatPass(reservation.pass_number)}
            </div>
            <div className="text-lg font-semibold text-slate-800">
              {reservation.first_name} {reservation.last_name}
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-full p-1 text-slate-400 hover:bg-slate-100"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="mb-5 grid grid-cols-3 gap-2 text-center text-sm">
          <Stat label="Orario" value={slot ? formatSlotTime(slot.slot_time) : "—"} />
          <Stat label="Adulti" value={String(reservation.adults_count)} />
          <Stat label="Bambini" value={String(reservation.children_count)} />
        </div>

        <div
          className={`mb-4 rounded-lg px-3 py-2 text-center text-sm font-medium ${
            alreadyIn
              ? "bg-blue-50 text-blue-700"
              : reservation.status === "no_show"
                ? "bg-slate-100 text-slate-500"
                : "bg-amber-50 text-amber-700"
          }`}
        >
          Stato: {statusText(reservation.status)}
        </div>
        {timing && (
          <div className="mb-4 rounded-lg bg-orange-50 px-3 py-2 text-center text-sm font-medium text-orange-700">
            {timing}
          </div>
        )}

        {alreadyIn ? (
          <p className="text-center text-sm text-slate-500">
            Ingresso già registrato.
          </p>
        ) : (
          <div className="flex gap-2">
            <button
              onClick={onNoShow}
              className="flex-1 rounded-xl border border-slate-300 px-4 py-3 text-sm font-semibold text-slate-600 hover:bg-slate-50"
            >
              Assente
            </button>
            <button
              onClick={onCheckIn}
              className="flex-[2] rounded-xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white hover:bg-emerald-700"
            >
              Conferma ingresso
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-slate-50 py-2">
      <div className="text-xs text-slate-400">{label}</div>
      <div className="font-semibold text-slate-700">{value}</div>
    </div>
  );
}

function QuickEntryModal({
  slots,
  call,
  onClose,
  onDone,
}: {
  slots: Slot[];
  call: (
    fn: string,
    params?: Record<string, unknown>,
  ) => Promise<{ ok: true; data: unknown } | { ok: false; error: string }>;
  onClose: () => void;
  onDone: (msg: string, ok: boolean) => void;
}) {
  const current = currentSlotTime();
  const defaultSlot =
    slots.find((s) => s.slot_time === current)?.id ?? slots[0]?.id ?? "";
  const [slotId, setSlotId] = useState(defaultSlot);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [adults, setAdults] = useState(1);
  const [children, setChildren] = useState(0);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit() {
    if (!slotId || !firstName.trim() || !lastName.trim()) {
      setErr("Compila nome, cognome e slot.");
      return;
    }
    setErr(null);
    setSaving(true);
    const res = await call("staff_quick_entry", {
      p_slot_id: slotId,
      p_first_name: firstName.trim(),
      p_last_name: lastName.trim(),
      p_adults: adults,
      p_children: children,
      p_force: true,
    });
    setSaving(false);
    if (!res.ok) setErr(errorMessage(res.error, "Errore durante la registrazione."));
    else onDone("Ingresso rapido registrato.", true);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center">
      <div className="w-full max-w-sm rounded-3xl bg-white p-6 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-bold">Ingresso rapido</h3>
          <button
            onClick={onClose}
            className="rounded-full p-1 text-slate-400 hover:bg-slate-100"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex flex-col gap-3">
          <div className="grid grid-cols-2 gap-2">
            <input
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              placeholder="Nome"
              className="rounded-xl border border-slate-300 px-3 py-2.5 outline-none focus:border-brand"
            />
            <input
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              placeholder="Cognome"
              className="rounded-xl border border-slate-300 px-3 py-2.5 outline-none focus:border-brand"
            />
          </div>
          <label className="text-sm text-slate-600">
            Slot
            <select
              value={slotId}
              onChange={(e) => setSlotId(e.target.value)}
              className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5 outline-none focus:border-brand"
            >
              {slots.map((s) => (
                <option key={s.id} value={s.id}>
                  {formatSlotTime(s.slot_time)} ({s.current_booked}/
                  {s.max_capacity})
                </option>
              ))}
            </select>
          </label>
          <div className="grid grid-cols-2 gap-2">
            <label className="text-sm text-slate-600">
              Adulti
              <input
                type="number"
                min={1}
                value={adults}
                onChange={(e) => setAdults(Math.max(1, Number(e.target.value)))}
                className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5 outline-none focus:border-brand"
              />
            </label>
            <label className="text-sm text-slate-600">
              Bambini
              <input
                type="number"
                min={0}
                value={children}
                onChange={(e) =>
                  setChildren(Math.max(0, Number(e.target.value)))
                }
                className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5 outline-none focus:border-brand"
              />
            </label>
          </div>
          {err && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-center text-sm text-red-600">
              {err}
            </p>
          )}
          <button
            onClick={submit}
            disabled={saving}
            className="mt-1 flex items-center justify-center gap-2 rounded-xl bg-slate-800 px-4 py-3 font-semibold text-white hover:bg-slate-900 disabled:opacity-50"
          >
            {saving ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <UserPlus className="h-5 w-5" />
            )}
            Registra ingresso
          </button>
        </div>
      </div>
    </div>
  );
}
