"use client";

import { useEffect, useState } from "react";
import { QRCodeCanvas } from "qrcode.react";
import { Printer, Smartphone } from "lucide-react";

/**
 * Poster stampabile con il QR Code che apre il form di prenotazione (route "/").
 * Il QR punta all'origine corrente, così funziona su qualunque dominio/deploy.
 */
export default function PosterPage() {
  const [url, setUrl] = useState("");

  useEffect(() => {
    // Il QR apre la home (form di prenotazione) del dominio corrente.
    setUrl(`${window.location.origin}/`);
  }, []);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-white px-6 py-10 text-center text-slate-900">
      <div className="flex w-full max-w-md flex-col items-center rounded-3xl border border-slate-200 p-8 shadow-sm print:border-0 print:shadow-none">
        <div className="text-4xl">🎄🎅🎁</div>
        <span className="mt-2 text-sm font-semibold uppercase tracking-widest text-holly">
          Ingresso · Buone Feste
        </span>
        <h1 className="mt-2 text-4xl font-black leading-tight text-brand">
          Prenota il tuo ingresso
        </h1>
        <p className="mt-3 flex items-center gap-2 text-lg text-slate-500">
          <Smartphone className="h-5 w-5" />
          Inquadra il QR con la fotocamera
        </p>

        <div className="my-8 rounded-2xl border border-slate-100 p-4">
          {url ? (
            <QRCodeCanvas value={url} size={280} level="M" includeMargin />
          ) : (
            <div className="h-[280px] w-[280px]" />
          )}
        </div>

        <ol className="space-y-1 text-left text-slate-600">
          <li>1. Apri la fotocamera del telefono</li>
          <li>2. Inquadra il QR Code qui sopra</li>
          <li>3. Compila nome, cognome e numero di persone</li>
          <li>4. Scegli l&apos;orario e conferma</li>
        </ol>

        <p className="mt-6 break-all text-xs text-slate-400">{url}</p>
      </div>

      <button
        onClick={() => window.print()}
        className="mt-8 inline-flex items-center gap-2 rounded-xl bg-brand px-5 py-3 font-semibold text-white hover:bg-brand-dark print:hidden"
      >
        <Printer className="h-5 w-5" />
        Stampa il poster
      </button>
    </main>
  );
}
