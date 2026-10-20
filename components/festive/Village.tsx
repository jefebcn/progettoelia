import { useId } from "react";

/**
 * Villaggio di Natale illustrato (SVG): abeti innevati, casette di pan di
 * zenzero con finestre illuminate, palline e prato di neve.
 * Decorativo: nessun testo, nascosto agli screen reader.
 */
export function Village({ className = "" }: { className?: string }) {
  const id = useId().replace(/:/g, "");
  const warm = `${id}-warm`;
  const glow = `${id}-glow`;
  const snow = `${id}-snow`;
  const gold = `${id}-gold`;
  const red = `${id}-red`;
  const ground = `${id}-ground`;

  return (
    <svg
      viewBox="0 0 600 210"
      className={className}
      aria-hidden
      focusable="false"
      preserveAspectRatio="xMidYMax meet"
      // Bordi laterali sfumati: niente "taglio" netto del prato.
      style={{
        maskImage: "linear-gradient(to right, transparent 0%, #000 9%, #000 91%, transparent 100%)",
        WebkitMaskImage: "linear-gradient(to right, transparent 0%, #000 9%, #000 91%, transparent 100%)",
      }}
    >
      <defs>
        <radialGradient id={warm} cx="50%" cy="45%" r="65%">
          <stop offset="0%" stopColor="#fff4c9" />
          <stop offset="55%" stopColor="#ffc35a" />
          <stop offset="100%" stopColor="#e58a2a" />
        </radialGradient>
        <filter id={glow} x="-80%" y="-80%" width="260%" height="260%">
          <feGaussianBlur stdDeviation="4" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <linearGradient id={snow} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="100%" stopColor="#e7ded0" />
        </linearGradient>
        {/* Il prato sfuma verso il basso: si fonde con qualunque sfondo. */}
        <linearGradient id={ground} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="45%" stopColor="#efe7da" />
          <stop offset="100%" stopColor="#efe7da" stopOpacity="0" />
        </linearGradient>
        <radialGradient id={gold} cx="35%" cy="30%" r="70%">
          <stop offset="0%" stopColor="#fff1c2" />
          <stop offset="45%" stopColor="#d4a548" />
          <stop offset="100%" stopColor="#7d5a1c" />
        </radialGradient>
        <radialGradient id={red} cx="35%" cy="30%" r="70%">
          <stop offset="0%" stopColor="#ff8a8f" />
          <stop offset="45%" stopColor="#c62f37" />
          <stop offset="100%" stopColor="#6e1218" />
        </radialGradient>
      </defs>

      {/* Abeti lontani (silhouette) */}
      <g fill="#0f2c23" opacity="0.9">
        {[40, 95, 250, 330, 505, 565].map((x, i) => (
          <polygon key={i} points={`${x},${70 + (i % 2) * 14} ${x - 26},170 ${x + 26},170`} />
        ))}
      </g>

      {/* Stelline */}
      <g fill="#ecc97a">
        {[
          [120, 26, 3],
          [300, 14, 2.4],
          [455, 30, 3],
          [560, 18, 2],
          [30, 38, 2],
        ].map(([x, y, r], i) => (
          <path
            key={i}
            d={`M${x} ${y - r * 2} L${x + r * 0.5} ${y - r * 0.5} L${x + r * 2} ${y} L${x + r * 0.5} ${y + r * 0.5} L${x} ${y + r * 2} L${x - r * 0.5} ${y + r * 0.5} L${x - r * 2} ${y} L${x - r * 0.5} ${y - r * 0.5} Z`}
            opacity="0.85"
          />
        ))}
      </g>

      {/* Abeti principali */}
      <Tree x={58} base={176} h={118} w={74} ornaments={[[48, 120, red], [70, 145, gold], [52, 160, gold]]} />
      <Tree x={268} base={174} h={104} w={62} ornaments={[[262, 128, gold], [278, 152, red]]} />
      <Tree x={318} base={176} h={84} w={50} ornaments={[[322, 150, gold]]} />
      <Tree x={548} base={178} h={126} w={80} ornaments={[[536, 118, gold], [560, 140, red], [544, 162, gold]]} />

      {/* Casetta di pan di zenzero (sinistra) */}
      <g>
        <rect x="120" y="116" width="10" height="22" fill="#7a4424" />
        <rect x="117" y="112" width="16" height="7" rx="2" fill={`url(#${snow})`} />
        <rect x="112" y="128" width="84" height="50" rx="3" fill="#c98b55" />
        <path d="M112 136 h84" stroke="#f6efe2" strokeWidth="3" strokeDasharray="5 4" strokeLinecap="round" />
        <polygon points="102,132 154,88 206,132" fill="#b3262e" />
        <path d="M100 133 L154 86 L208 133" fill="none" stroke={`url(#${snow})`} strokeWidth="8" strokeLinejoin="round" strokeLinecap="round" />
        <g filter={`url(#${glow})`}>
          <rect x="124" y="144" width="16" height="15" rx="2" fill={`url(#${warm})`} />
          <rect x="168" y="144" width="16" height="15" rx="2" fill={`url(#${warm})`} />
          <circle cx="154" cy="114" r="7" fill={`url(#${warm})`} />
        </g>
        <path d="M132 144 v15 M124 151.5 h16 M176 144 v15 M168 151.5 h16" stroke="#7a4424" strokeWidth="1.5" />
        <rect x="146" y="152" width="16" height="26" rx="8" fill="#6b3b1f" />
        <circle cx="158" cy="166" r="1.6" fill="#ecc97a" />
      </g>

      {/* Casetta grande (destra) con insegna */}
      <g>
        <rect x="474" y="96" width="12" height="26" fill="#7a4424" />
        <rect x="471" y="92" width="18" height="7" rx="2" fill={`url(#${snow})`} />
        <rect x="372" y="114" width="122" height="64" rx="3" fill="#d29862" />
        <path d="M372 123 h122" stroke="#f6efe2" strokeWidth="3" strokeDasharray="6 4" strokeLinecap="round" />
        <polygon points="360,118 433,70 506,118" fill="#a61f27" />
        <path d="M357 119 L433 67 L509 119" fill="none" stroke={`url(#${snow})`} strokeWidth="9" strokeLinejoin="round" strokeLinecap="round" />
        <rect x="408" y="92" width="50" height="16" rx="3" fill="#b3262e" stroke="#ecc97a" strokeWidth="1.5" />
        <path d="M424 100 h18" stroke="#ecc97a" strokeWidth="2" strokeLinecap="round" />
        <g filter={`url(#${glow})`}>
          <rect x="384" y="132" width="20" height="18" rx="2" fill={`url(#${warm})`} />
          <rect x="462" y="132" width="20" height="18" rx="2" fill={`url(#${warm})`} />
          <rect x="420" y="136" width="26" height="42" rx="13" fill={`url(#${warm})`} opacity="0.95" />
        </g>
        <path d="M394 132 v18 M384 141 h20 M472 132 v18 M462 141 h20" stroke="#7a4424" strokeWidth="1.5" />
        <path d="M433 136 v42" stroke="#9a5a2c" strokeWidth="1.5" />
      </g>

      {/* Prato di neve */}
      <path d="M0 172 Q 90 160 180 170 T 360 168 T 600 166 V210 H0 Z" fill={`url(#${ground})`} />

      {/* Palline sulla neve */}
      {[
        [96, 176, 8, gold],
        [112, 182, 5, red],
        [222, 178, 9, red],
        [240, 186, 5, gold],
        [350, 180, 7, gold],
        [520, 182, 9, red],
        [503, 188, 5, gold],
        [585, 184, 6, gold],
      ].map(([x, y, r, fill], i) => (
        <g key={i}>
          <circle cx={x as number} cy={y as number} r={r as number} fill={`url(#${fill})`} />
          <circle cx={(x as number) - (r as number) * 0.35} cy={(y as number) - (r as number) * 0.35} r={(r as number) * 0.25} fill="#fff" opacity="0.6" />
        </g>
      ))}
    </svg>
  );
}

function Tree({
  x,
  base,
  h,
  w,
  ornaments = [],
}: {
  x: number;
  base: number;
  h: number;
  w: number;
  ornaments?: [number, number, string][];
}) {
  const top = base - h;
  // Tre "piani" sovrapposti, dal basso verso l'alto.
  const tiers = [
    { y0: top + h * 0.42, y1: base, half: w / 2 },
    { y0: top + h * 0.2, y1: top + h * 0.72, half: w * 0.39 },
    { y0: top, y1: top + h * 0.46, half: w * 0.28 },
  ];
  return (
    <g>
      <rect x={x - 4} y={base - 6} width={8} height={10} fill="#5b3a22" />
      {tiers.map((t, i) => (
        <g key={i}>
          <polygon points={`${x},${t.y0} ${x - t.half},${t.y1} ${x + t.half},${t.y1}`} fill="#2f6b52" />
          {/* lato in ombra */}
          <polygon points={`${x},${t.y0} ${x + t.half},${t.y1} ${x + t.half * 0.15},${t.y1}`} fill="#21503d" />
          {/* neve sulla punta */}
          <polygon
            points={`${x},${t.y0} ${x - t.half * 0.32},${t.y0 + (t.y1 - t.y0) * 0.32} ${x - t.half * 0.1},${t.y0 + (t.y1 - t.y0) * 0.27} ${x + t.half * 0.08},${t.y0 + (t.y1 - t.y0) * 0.35} ${x + t.half * 0.32},${t.y0 + (t.y1 - t.y0) * 0.3}`}
            fill="#f6efe2"
          />
        </g>
      ))}
      <path
        d={`M${x} ${top - 9} l2.5 6 6 .5 -4.5 4 1.5 6 -5.5 -3.2 -5.5 3.2 1.5 -6 -4.5 -4 6 -.5 Z`}
        fill="#ecc97a"
      />
      {ornaments.map(([ox, oy, grad], i) => (
        <circle key={i} cx={ox} cy={oy} r={4.2} fill={`url(#${grad})`} />
      ))}
    </g>
  );
}
