/**
 * Crea e scarica un'immagine PNG del pass (stile del sito): QR, numero pass,
 * giorno, orario, nome e gruppo. Tutto nel browser, niente server.
 * L'immagine salvata sul telefono si può mostrare all'ingresso anche offline.
 */
export type PassImageData = {
  qr: HTMLCanvasElement;
  passLabel: string; // "#101"
  dayLabel: string; // "Mercoledì 21 ottobre"
  timeLabel: string; // "10:00"
  name: string;
  people: string; // "2 adulti · 1 bambino"
  fileName: string; // "pass-101.png"
};

const W = 900;
const H = 1350;
const PINE = "#0b2019";
const PINE_LIGHT = "#1b4537";
const GOLD = "#d4a548";
const GOLD_LIGHT = "#ecc97a";
const CREAM = "#f6efe2";

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** Scrive un testo centrato, riducendo il corpo finché ci sta nella larghezza. */
function fitText(
  ctx: CanvasRenderingContext2D,
  text: string,
  y: number,
  font: (size: number) => string,
  size: number,
  maxWidth: number,
) {
  let s = size;
  ctx.font = font(s);
  while (ctx.measureText(text).width > maxWidth && s > 18) {
    s -= 2;
    ctx.font = font(s);
  }
  ctx.fillText(text, W / 2, y);
}

export async function downloadPassImage(d: PassImageData): Promise<void> {
  // Stesso font con grazie del sito (next/font lo espone come variabile CSS).
  const serifVar = getComputedStyle(document.documentElement).getPropertyValue("--font-serif").trim();
  const serif = `${serifVar ? `${serifVar}, ` : ""}Georgia, serif`;
  const sans = `system-ui, -apple-system, "Segoe UI", Roboto, sans-serif`;
  try {
    await document.fonts?.load(`600 64px ${serif}`);
  } catch {
    /* in mancanza del font si usa Georgia */
  }

  const c = document.createElement("canvas");
  c.width = W;
  c.height = H;
  const ctx = c.getContext("2d");
  if (!ctx) throw new Error("Canvas non disponibile");

  // Sfondo verde abete con alone in alto
  const bg = ctx.createRadialGradient(W / 2, 0, 40, W / 2, 0, H);
  bg.addColorStop(0, "#1f5141");
  bg.addColorStop(0.45, "#123329");
  bg.addColorStop(1, PINE);
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  // Luci dorate ai lati
  for (const [x, y, r, a] of [
    [70, 110, 18, 0.55],
    [835, 170, 14, 0.45],
    [50, 760, 10, 0.3],
    [860, 980, 16, 0.35],
    [120, 1240, 9, 0.3],
  ]) {
    const g = ctx.createRadialGradient(x, y, 0, x, y, r * 2.2);
    g.addColorStop(0, `rgba(251,231,176,${a})`);
    g.addColorStop(1, "rgba(212,165,72,0)");
    ctx.fillStyle = g;
    ctx.fillRect(x - r * 3, y - r * 3, r * 6, r * 6);
  }

  // Doppia cornice dorata
  ctx.strokeStyle = GOLD;
  ctx.globalAlpha = 0.8;
  ctx.lineWidth = 3;
  roundRect(ctx, 40, 40, W - 80, H - 80, 46);
  ctx.stroke();
  ctx.globalAlpha = 0.3;
  ctx.lineWidth = 2;
  roundRect(ctx, 56, 56, W - 112, H - 112, 36);
  ctx.stroke();
  ctx.globalAlpha = 1;

  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";

  // Intestazione
  ctx.fillStyle = GOLD;
  ctx.font = `600 26px ${sans}`;
  ctx.fillText("✦  IL TUO PASS  ✦", W / 2, 140);

  const goldText = ctx.createLinearGradient(0, 160, 0, 290);
  goldText.addColorStop(0, "#f6dfa2");
  goldText.addColorStop(0.55, GOLD);
  goldText.addColorStop(1, "#a97c2c");
  ctx.fillStyle = goldText;
  ctx.font = `600 132px ${serif}`;
  ctx.fillText(d.passLabel, W / 2, 278);

  // Filetto con stella
  ctx.strokeStyle = GOLD;
  ctx.lineWidth = 2;
  ctx.globalAlpha = 0.7;
  ctx.beginPath();
  ctx.moveTo(W / 2 - 150, 318);
  ctx.lineTo(W / 2 - 30, 318);
  ctx.moveTo(W / 2 + 30, 318);
  ctx.lineTo(W / 2 + 150, 318);
  ctx.stroke();
  ctx.globalAlpha = 1;
  ctx.fillStyle = GOLD;
  ctx.font = `28px ${sans}`;
  ctx.fillText("✦", W / 2, 328);

  // Riquadro crema con il QR (scuro su chiaro: si scansiona bene)
  const box = 560;
  const bx = (W - box) / 2;
  const by = 360;
  ctx.fillStyle = CREAM;
  roundRect(ctx, bx, by, box, box, 40);
  ctx.fill();
  ctx.strokeStyle = GOLD;
  ctx.lineWidth = 3;
  ctx.stroke();
  ctx.imageSmoothingEnabled = false;
  const q = box - 70;
  ctx.drawImage(d.qr, bx + 35, by + 35, q, q);
  ctx.imageSmoothingEnabled = true;

  // Giorno e orario
  ctx.fillStyle = CREAM;
  fitText(ctx, d.dayLabel, 1010, (s) => `600 ${s}px ${serif}`, 52, W - 180);
  ctx.fillStyle = GOLD_LIGHT;
  ctx.font = `600 64px ${serif}`;
  ctx.fillText(`ore ${d.timeLabel}`, W / 2, 1088);

  // Nome e gruppo su una "pillola"
  ctx.fillStyle = PINE_LIGHT;
  roundRect(ctx, 110, 1124, W - 220, 116, 58);
  ctx.fill();
  ctx.strokeStyle = "rgba(212,165,72,0.35)";
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.fillStyle = CREAM;
  fitText(ctx, d.name, 1176, (s) => `600 ${s}px ${sans}`, 38, W - 280);
  ctx.fillStyle = "rgba(246,239,226,0.7)";
  ctx.font = `28px ${sans}`;
  ctx.fillText(d.people, W / 2, 1220);

  ctx.fillStyle = "rgba(246,239,226,0.55)";
  ctx.font = `24px ${sans}`;
  ctx.fillText("Mostra questo QR all'ingresso · Buone Feste", W / 2, 1278);

  const blob = await new Promise<Blob | null>((resolve) => c.toBlob(resolve, "image/png"));
  if (!blob) throw new Error("Impossibile creare l'immagine");
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = d.fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
