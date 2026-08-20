import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Snow } from "@/components/Snow";

export const metadata: Metadata = {
  title: "🎄 Gestione Ingressi di Natale",
  description:
    "Prenotazione ingressi tramite QR Code con slot da 15 minuti e aggiornamenti in tempo reale. Buone feste!",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: "#15803d",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="it">
      <body className="min-h-screen bg-gradient-to-b from-red-50 via-white to-green-50 text-slate-900 antialiased">
        <Snow />
        {children}
      </body>
    </html>
  );
}
