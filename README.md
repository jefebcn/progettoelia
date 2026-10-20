# Gestione Ingressi & Code Virtuali in Loco

Web app snella per gestire l'afflusso di visitatori in una location fisica.
L'accesso avviene **esclusivamente tramite scansione di un QR Code** all'ingresso,
con prenotazioni a slot di 15 minuti, capienza massima per slot e aggiornamento
automatico (ogni pochi secondi) tra telefono utente, tablet operatore e display pubblico.

## Principi di progettazione

- **Zero frizione / GDPR-friendly** — nessun login, nessun dato di contatto (no email, no telefono). Si prenota in ~5 secondi con Nome, Cognome, n° adulti e n° bambini.
- **Prenotazione anche in anticipo** — si sceglie il giorno (tra quelli del periodo dell'evento) e poi l'orario; il QR all'ingresso funziona anche per prenotare in giornata.
- **Niente overbooking** — slot da 15 minuti dalle 10:00 alle 16:45 (chiusura 17:00) per ogni giorno, capienza massima tassativa di **15 persone** per slot, garantita dal database con un lock di riga anche con richieste simultanee.
- **Dati protetti** — il browser parla solo con le API dell'app: il database e i nomi dei visitatori non sono mai esposti. L'area operatore è protetta da PIN.
- **Gestione imprevisti** — l'operatore può sospendere le prenotazioni, segnare assenti (i posti tornano liberi) e registrare walk-in al volo.

## Stack tecnico

- **Next.js** (App Router, TypeScript, Tailwind CSS) — pagine + API (`app/api/*`)
- **Postgres su Neon**, collegato al progetto Vercel (il database si risveglia da solo dopo l'inattività: niente pause da riattivare a mano)
- **Vercel** (hosting + deploy automatico da GitHub)
- Librerie: `pg` (driver Postgres), `qrcode.react` (generazione QR), `html5-qrcode` (scanner fotocamera), `lucide-react` (icone)

## Rotte dell'applicazione

| Route         | Dispositivo        | Funzione |
|---------------|--------------------|----------|
| `/`           | Smartphone utente  | Form di prenotazione minimale con selezione slot |
| `/pass/[id]`  | Smartphone utente  | Pass con QR Code e stato ingresso aggiornato da solo |
| `/checkin`    | Tablet operatore   | PIN, giorno visualizzato, periodo dell'evento, scanner QR, ricerca manuale, ingresso rapido, sospensione, azzeramento |
| `/display`    | TV / Monitor sala  | Display pubblico full-screen con slot in chiamata e ultimi ingressi |
| `/poster`     | Stampa             | Poster con il QR che apre il form di prenotazione |

API (usate dalle pagine): `/api/state`, `/api/book`, `/api/pass/[id]`, `/api/display`,
`/api/staff` (richiede il PIN), `/api/health` (diagnosi).

## Database

Lo schema è in [`lib/server/schema.ts`](lib/server/schema.ts) e **viene creato dall'app da sola**
al primo accesso: non serve eseguire SQL a mano. Tabelle `slots`, `reservations`,
`system_state`, `pin_failures` e funzioni:

- **`insert_reservation(...)`** — prenotazione atomica (`SELECT … FOR UPDATE` sullo slot):
  `current_booked` non supera **mai** `max_capacity`. Rifiuta slot sospesi o già conclusi
  (ora di Roma), gruppi oltre la capienza e nomi vuoti.
- **`staff_check_in` / `staff_mark_no_show`** — check-in e assenze; un assente libera i posti,
  il suo check-in tardivo li rioccupa.
- **`ensure_period_slots`** — crea gli slot di ogni giorno del periodo dell'evento
  (`system_state.event_start` / `event_end`) senza toccare quelli esistenti.
- **`reset_day`** — "Azzera tutto": cancella le prenotazioni di **tutte** le date, azzera i
  contatori e riporta la numerazione a #101. Serve a ripulire le prove: tra un giorno e
  l'altro non è necessario, perché ogni giorno ha i suoi slot.

Per modificare lo schema: aggiorna l'SQL (sempre idempotente) e incrementa `SCHEMA_VERSION`.

## Configurazione su Vercel (una volta sola)

1. **Database** — progetto `progettoelia` su Vercel → **Storage** → **Create Database** →
   **Neon** (piano Free) → regione **Frankfurt (eu-central-1)** → collega al progetto per
   tutti gli ambienti. Vercel aggiunge da solo la variabile `DATABASE_URL`.
2. **PIN operatore** — **Settings → Environment Variables** → aggiungi `STAFF_PIN`
   (almeno 6 caratteri), per Production e Preview.
3. **Redeploy** dell'ultimo deploy di `main` (le variabili valgono dal build successivo).

Al primo accesso al sito le tabelle e gli slot vengono creati automaticamente, con un
periodo **provvisorio** (da oggi per 30 giorni). Imposta quello vero da `/checkin` →
**Periodo evento**: il pubblico può prenotare ogni giorno di quel periodo, senza limiti di anticipo.
Ogni `git push` sul branch di produzione pubblica poi una nuova versione.

## Sviluppo in locale

```bash
npm install
cp .env.example .env.local   # inserisci DATABASE_URL (anche un Postgres locale) e STAFF_PIN
npm run dev                  # http://localhost:3000
```

## Diagnosi

```bash
npm run healthcheck -- https://progettoelia.vercel.app
```

Verifica che l'app risponda, che il database sia collegato, che il PIN sia impostato
e che gli orari siano disponibili. Fa solo letture.

## Nota sulla sicurezza

Le operazioni dell'operatore passano da `/api/staff`, che verifica `STAFF_PIN` sul server
(10 tentativi errati ogni 15 minuti per IP, poi blocco temporaneo). Tutti i tablet dietro
la stessa rete Wi-Fi condividono lo stesso IP, quindi un PIN sbagliato più volte li blocca
tutti per 15 minuti. Per un evento più grande conviene passare a utenti operatore veri.
La prenotazione resta pubblica: per limitare prenotazioni false si può aggiungere un
CAPTCHA (es. Cloudflare Turnstile) davanti a `/api/book`.
