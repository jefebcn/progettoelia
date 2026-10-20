"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Scanner QR basato su html5-qrcode. La libreria usa `window`, quindi viene
 * importata dinamicamente lato client dentro useEffect.
 */
export function QrScanner({
  onScan,
  paused,
}: {
  onScan: (value: string) => void;
  paused?: boolean;
}) {
  const containerId = "qr-reader";
  const scannerRef = useRef<unknown>(null);
  const onScanRef = useRef(onScan);
  onScanRef.current = onScan;
  const pausedRef = useRef(paused);
  pausedRef.current = paused;
  const [camError, setCamError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    let scanner: {
      start: (
        cam: { facingMode: string },
        config: { fps: number; qrbox: number },
        success: (decoded: string) => void,
        error: (msg: string) => void,
      ) => Promise<void>;
      stop: () => Promise<void>;
      clear: () => void;
      getState?: () => number;
    } | null = null;

    (async () => {
      const { Html5Qrcode } = await import("html5-qrcode");
      if (cancelled) return;
      scanner = new Html5Qrcode(containerId) as unknown as typeof scanner;
      scannerRef.current = scanner;
      try {
        await scanner!.start(
          { facingMode: "environment" },
          { fps: 10, qrbox: 250 },
          (decodedText: string) => {
            // Mentre il modale è aperto ignora le letture (evita doppi pass).
            if (!pausedRef.current) onScanRef.current(decodedText);
          },
          () => {
            /* ignora i frame senza QR */
          },
        );
        if (!cancelled) setCamError(null);
      } catch (err) {
        // Prima l'errore veniva ignorato e l'operatore vedeva solo un riquadro nero.
        if (cancelled) return;
        const msg = String(err);
        if (!window.isSecureContext) {
          setCamError("La fotocamera funziona solo su HTTPS.");
        } else if (/NotAllowed|Permission/i.test(msg)) {
          setCamError(
            "Permesso fotocamera negato. Consentilo dalle impostazioni del browser (icona del lucchetto) e premi Riprova.",
          );
        } else if (/NotFound|Requested device not found/i.test(msg)) {
          setCamError("Nessuna fotocamera trovata su questo dispositivo.");
        } else if (/NotReadable|in use/i.test(msg)) {
          setCamError("La fotocamera è usata da un'altra app. Chiudila e premi Riprova.");
        } else {
          setCamError("Impossibile avviare la fotocamera. Usa la ricerca manuale.");
        }
      }
    })();

    return () => {
      cancelled = true;
      const s = scannerRef.current as {
        stop: () => Promise<void>;
        clear: () => void;
        getState?: () => number;
      } | null;
      if (!s) return;
      // stop() lancia un'eccezione se lo scanner non è in esecuzione
      // (es. permesso fotocamera negato). La gestiamo per non far crashare
      // la pagina al cambio scheda/smontaggio.
      try {
        // Html5QrcodeScannerState: 2 = SCANNING, 3 = PAUSED
        const state = typeof s.getState === "function" ? s.getState() : 2;
        if (state === 2 || state === 3) {
          s.stop()
            .then(() => {
              try {
                s.clear();
              } catch {
                /* noop */
              }
            })
            .catch(() => {
              /* già fermo */
            });
        } else {
          try {
            s.clear();
          } catch {
            /* noop */
          }
        }
      } catch {
        /* stato non recuperabile: ignora */
      }
    };
  }, [attempt]);

  return (
    <div className="relative">
      <div
        id={containerId}
        className="min-h-[240px] overflow-hidden rounded-2xl bg-black"
      />
      {camError && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 rounded-2xl bg-slate-900 p-6 text-center text-sm text-white">
          <span>📷 {camError}</span>
          <button
            type="button"
            onClick={() => {
              setCamError(null);
              setAttempt((a) => a + 1);
            }}
            className="rounded-lg bg-white px-4 py-2 font-semibold text-slate-800"
          >
            Riprova
          </button>
        </div>
      )}
      {paused && !camError && (
        <div className="absolute inset-0 flex items-center justify-center rounded-2xl bg-black/60 text-sm font-medium text-white">
          Scanner in pausa
        </div>
      )}
    </div>
  );
}
