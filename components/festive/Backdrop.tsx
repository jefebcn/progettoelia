import { Snow } from "@/components/Snow";

// Luci dorate sfocate sullo sfondo (bokeh), posizioni fisse.
const LIGHTS = [
  // Tenute verso i bordi, così non finiscono sopra titoli e testo.
  { x: 3, y: 6, s: 9, o: 0.6, d: 0 },
  { x: 10, y: 22, s: 5, o: 0.4, d: 2 },
  { x: 6, y: 41, s: 7, o: 0.35, d: 4 },
  { x: 2, y: 63, s: 5, o: 0.3, d: 1 },
  { x: 8, y: 84, s: 8, o: 0.3, d: 3 },
  { x: 92, y: 5, s: 7, o: 0.55, d: 5 },
  { x: 97, y: 19, s: 10, o: 0.5, d: 2 },
  { x: 89, y: 36, s: 5, o: 0.35, d: 6 },
  { x: 96, y: 58, s: 7, o: 0.3, d: 3 },
  { x: 91, y: 80, s: 6, o: 0.3, d: 1 },
  { x: 22, y: 2, s: 4, o: 0.4, d: 4 },
  { x: 78, y: 2, s: 4, o: 0.4, d: 0 },
];

/** Sfondo "notte di Natale": verde abete, luci dorate e neve. */
export function Backdrop({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative min-h-screen overflow-x-hidden bg-pine-deep text-cream">
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 bg-[radial-gradient(ellipse_80%_60%_at_50%_0%,#1f5141_0%,#123329_45%,#0b2019_100%)]"
      />
      <div aria-hidden className="pointer-events-none fixed inset-0">
        {LIGHTS.map((l, i) => (
          <span
            key={i}
            className="absolute animate-bokeh rounded-full"
            style={
              {
                left: `${l.x}%`,
                top: `${l.y}%`,
                width: l.s * 2,
                height: l.s * 2,
                background:
                  "radial-gradient(circle at 35% 35%, #fbe7b0 0%, #d4a548 45%, rgba(212,165,72,0) 72%)",
                filter: "blur(1.5px)",
                animationDelay: `${l.d}s`,
                "--o": l.o,
              } as React.CSSProperties
            }
          />
        ))}
      </div>
      <Snow />
      <div className="relative">{children}</div>
    </div>
  );
}
