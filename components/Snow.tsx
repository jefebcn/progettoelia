// Neve: fiocchi morbidi con posizioni/tempi predefiniti (deterministici,
// così non ci sono mismatch di hydration). Livello non cliccabile.
const FLAKES = [
  { left: 4, size: 14, dur: 11, delay: 0, drift: 30 },
  { left: 11, size: 20, dur: 15, delay: 3, drift: -20 },
  { left: 18, size: 12, dur: 9, delay: 1, drift: 25 },
  { left: 25, size: 24, dur: 17, delay: 5, drift: -35 },
  { left: 32, size: 16, dur: 12, delay: 2, drift: 15 },
  { left: 39, size: 12, dur: 10, delay: 6, drift: -18 },
  { left: 46, size: 22, dur: 16, delay: 1, drift: 28 },
  { left: 53, size: 14, dur: 13, delay: 4, drift: -25 },
  { left: 60, size: 18, dur: 11, delay: 7, drift: 20 },
  { left: 67, size: 12, dur: 9, delay: 2, drift: -15 },
  { left: 74, size: 26, dur: 18, delay: 3, drift: 35 },
  { left: 81, size: 15, dur: 12, delay: 5, drift: -22 },
  { left: 88, size: 20, dur: 14, delay: 0, drift: 24 },
  { left: 95, size: 13, dur: 10, delay: 6, drift: -30 },
  { left: 8, size: 18, dur: 16, delay: 8, drift: 18 },
  { left: 43, size: 12, dur: 8, delay: 9, drift: -12 },
  { left: 70, size: 16, dur: 13, delay: 10, drift: 22 },
  { left: 57, size: 22, dur: 19, delay: 4, drift: -28 },
];

export function Snow() {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 overflow-hidden">
      {FLAKES.map((f, i) => {
        const d = Math.round(f.size / 4);
        return (
          <span
            key={i}
            className="snowflake rounded-full"
            style={
              {
                left: `${f.left}%`,
                width: d,
                height: d,
                background:
                  "radial-gradient(circle, rgba(255,255,255,0.95) 0%, rgba(255,255,255,0) 70%)",
                animationDuration: `${f.dur}s`,
                animationDelay: `${f.delay}s`,
                "--drift": `${f.drift}px`,
              } as React.CSSProperties
            }
          />
        );
      })}
    </div>
  );
}
