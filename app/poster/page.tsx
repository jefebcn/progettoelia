"use client";

import { useEffect, useState } from "react";
import { QRCodeCanvas } from "qrcode.react";
import { Printer, Smartphone } from "lucide-react";
import { Village } from "@/components/festive/Village";

/**
 * Poster stampabile con il QR Code che apre il form di prenotazione (route "/").
 * Il QR punta all'origine corrente, così funziona su qualunque dominio/deploy.
 * Fondo chiaro: le stampanti di solito non stampano gli sfondi scuri.
 */
export default function PosterPage() {
  const [url, setUrl] = useState("");

  useEffect(() => {
    // Il QR apre la home (form di prenotazione) del dominio corrente.
    setUrl(`${window.location.origin}/`);
  }, []);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-[#efe6d6] px-6 py-10 text-center text-pine-deep print:bg-white print:py-0">
      <div className="relative flex w-full max-w-md flex-col items-center rounded-[32px] border-2 border-gold bg-cream px-8 pb-0 pt-10 shadow-[0_30px_60px_-30px_rgba(11,32,25,0.5)] print:shadow-none">
        <span aria-hidden className="pointer-events-none absolute inset-[7px] rounded-[25px] border border-gold/40" />
        <span aria-hidden className="absolute -top-3.5 left-1/2 -translate-x-1/2 rounded-full bg-cream px-3 text-sm tracking-[0.4em] text-gold-dark">
          ✦✦✦
        </span>

        <p className="text-xs font-semibold uppercase tracking-[0.35em] text-holly">
          ✦ Buone Feste ✦
        </p>
        <h1 className="mt-3 font-serif text-[2.6rem] font-semibold leading-[1.05] text-pine">
          Prenota il tuo ingresso
        </h1>
        <p className="mt-3 flex items-center gap-2 text-base text-pine/70">
          <Smartphone className="h-5 w-5 text-holly" />
          Inquadra il QR con la fotocamera
        </p>

        <div className="my-7 rounded-3xl border-2 border-gold/70 bg-white p-3">
          {url ? (
            <QRCodeCanvas value={url} size={260} level="M" includeMargin fgColor="#0b2019" />
          ) : (
            <div className="h-[260px] w-[260px]" />
          )}
        </div>

        <ol className="w-full space-y-2 text-left text-[15px] text-pine/85">
          {[
            "Apri la fotocamera del telefono",
            "Inquadra il QR Code qui sopra",
            "Scrivi nome, cognome e quanti siete",
            "Scegli l'orario e conferma",
          ].map((t, i) => (
            <li key={t} className="flex items-center gap-3">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-gold bg-gold/15 font-serif text-sm text-pine">
                {i + 1}
              </span>
              {t}
            </li>
          ))}
        </ol>

        <p className="mt-5 break-all text-xs text-pine/45">{url}</p>

        <Village className="mt-4 block h-auto w-[calc(100%+4rem)] max-w-none rounded-b-[30px]" />
      </div>

      <button
        onClick={() => window.print()}
        className="mt-8 inline-flex items-center gap-2 rounded-full border border-gold/60 bg-gradient-to-b from-[#cf3a42] to-holly-dark px-6 py-3 font-semibold text-cream shadow-[inset_0_1px_0_rgba(255,255,255,0.25)] transition hover:brightness-110 active:scale-[0.98] print:hidden"
      >
        <Printer className="h-5 w-5" />
        Stampa il poster
      </button>
    </main>
  );
}
