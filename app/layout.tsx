import type { Metadata, Viewport } from "next";
import { Playfair_Display } from "next/font/google";
import "./globals.css";

const serif = Playfair_Display({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  variable: "--font-serif",
  display: "swap",
});

export const metadata: Metadata = {
  title: "🎄 Prenota il tuo ingresso",
  description:
    "Prenotazione ingressi tramite QR Code con slot da 15 minuti. Buone feste!",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: "#0b2019",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="it" className={serif.variable}>
      <body className="min-h-screen bg-gradient-to-b from-red-50 via-white to-green-50 text-slate-900 antialiased">
        {children}
      </body>
    </html>
  );
}
