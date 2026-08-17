"use client";

import { useEffect, useRef } from "react";

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
          (decodedText: string) => onScanRef.current(decodedText),
          () => {
            /* ignora i frame senza QR */
          },
        );
      } catch {
        /* fotocamera non disponibile / permesso negato */
      }
    })();

    return () => {
      cancelled = true;
      const s = scannerRef.current as { stop: () => Promise<void>; clear: () => void } | null;
      if (s) {
        s.stop()
          .then(() => s.clear())
          .catch(() => {
            /* già fermo */
          });
      }
    };
  }, []);

  return (
    <div className="relative">
      <div id={containerId} className="overflow-hidden rounded-2xl bg-black" />
      {paused && (
        <div className="absolute inset-0 flex items-center justify-center rounded-2xl bg-black/60 text-sm font-medium text-white">
          Scanner in pausa
        </div>
      )}
    </div>
  );
}
