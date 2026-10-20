/** Pannello scuro con doppia cornice dorata e ornamento in alto. */
export function GoldFrame({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`relative rounded-[28px] border border-gold/40 bg-pine-deep/80 p-5 shadow-[0_30px_80px_-20px_rgba(0,0,0,0.75)] backdrop-blur-md sm:p-7 ${className}`}
    >
      <span
        aria-hidden
        className="pointer-events-none absolute inset-[6px] rounded-[22px] border border-gold/15"
      />
      {/* Angoli decorativi */}
      <span aria-hidden className="pointer-events-none absolute left-3 top-3 h-5 w-5 rounded-tl-lg border-l border-t border-gold/70" />
      <span aria-hidden className="pointer-events-none absolute right-3 top-3 h-5 w-5 rounded-tr-lg border-r border-t border-gold/70" />
      <span aria-hidden className="pointer-events-none absolute bottom-3 left-3 h-5 w-5 rounded-bl-lg border-b border-l border-gold/70" />
      <span aria-hidden className="pointer-events-none absolute bottom-3 right-3 h-5 w-5 rounded-br-lg border-b border-r border-gold/70" />
      <span
        aria-hidden
        className="pointer-events-none absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-pine-deep px-3 text-xs tracking-[0.4em] text-gold"
      >
        ✦✦✦
      </span>
      <div className="relative">{children}</div>
    </section>
  );
}

/** Filetto dorato con stella, per separare titolo e contenuto. */
export function Ornament({ className = "" }: { className?: string }) {
  return (
    <div aria-hidden className={`flex items-center justify-center gap-3 ${className}`}>
      <span className="h-px w-12 bg-gradient-to-r from-transparent to-gold/70" />
      <span className="text-sm text-gold">✦</span>
      <span className="h-px w-12 bg-gradient-to-l from-transparent to-gold/70" />
    </div>
  );
}
