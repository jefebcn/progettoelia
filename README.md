# Gestione Ingressi & Code Virtuali in Loco

Web app snella per gestire l'afflusso di visitatori in una location fisica.
L'accesso avviene **esclusivamente tramite scansione di un QR Code** all'ingresso,
con prenotazioni a slot di 15 minuti, capienza massima per slot e sincronizzazione
**in tempo reale** tra telefono utente, tablet operatore e display pubblico.

## Principi di progettazione

- **Zero frizione / GDPR-friendly** — nessun login, nessun dato di contatto (no email, no telefono). Si prenota in ~5 secondi con Nome, Cognome, n° adulti e n° bambini.
- **Niente overbooking** — slot da 15 minuti dalle 10:00 alle 16:45 (chiusura 17:00), capienza massima tassativa di **15 persone** per slot, garantita a livello di database con transazioni atomiche.
- **Realtime** — tutti i client si sincronizzano via Supabase Realtime (WebSocket).
- **Gestione imprevisti** — l'operatore può sospendere le prenotazioni e registrare walk-in al volo.

## Stack tecnico

- **Next.js** (App Router, TypeScript, Tailwind CSS)
- **Supabase** (PostgreSQL + Realtime Subscriptions)
- **Vercel** (hosting + deploy automatico da GitHub)
- Librerie: `@supabase/supabase-js`, `qrcode.react` (generazione QR), `html5-qrcode` (scanner fotocamera), `lucide-react` (icone)

## Rotte dell'applicazione

| Route         | Dispositivo        | Funzione |
|---------------|--------------------|----------|
| `/`           | Smartphone utente  | Form di prenotazione minimale con selezione slot |
| `/pass/[id]`  | Smartphone utente  | Pass con QR Code e stato ingresso in tempo reale |
| `/checkin`    | Tablet operatore   | Scanner QR, ricerca manuale, ingresso rapido, sospensione |
| `/display`    | TV / Monitor sala  | Display pubblico full-screen con slot in chiamata e ultimi ingressi |

## Schema database

Tre tabelle (`slots`, `reservations`, `system_state`) e due funzioni PostgreSQL
`security definer`:

- **`book_reservation(...)`** — prenotazione atomica. Blocca la riga dello slot
  con `SELECT … FOR UPDATE` e rifiuta la richiesta se la capienza verrebbe superata:
  `current_booked` non può **mai** eccedere `max_capacity`, anche con richieste simultanee.
- **`quick_entry(...)`** — ingresso rapido (walk-in) registrato dall'operatore.

La migrazione completa è in [`supabase/migrations/0001_init.sql`](supabase/migrations/0001_init.sql).

## Setup locale

### 1. Dipendenze

```bash
npm install
```

### 2. Crea il progetto Supabase ed esegui la migrazione

- Crea un progetto su [supabase.com](https://supabase.com).
- Apri **SQL Editor**, incolla il contenuto di `supabase/migrations/0001_init.sql` ed esegui.
  (In alternativa, con la Supabase CLI: `supabase db push`.)

### 3. Variabili d'ambiente

Copia `.env.example` in `.env.local` e inserisci le credenziali del progetto
(**Project Settings → API**):

```bash
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
```

### 4. Avvio

```bash
npm run dev
```

App su [http://localhost:3000](http://localhost:3000).

## Deploy su Vercel (automatico da GitHub)

1. Su [vercel.com/new](https://vercel.com/new) importa il repository **`jefebcn/progettoelia`**.
2. Nelle impostazioni del progetto Vercel aggiungi le due variabili d'ambiente
   `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
3. **Deploy**. Da qui in poi ogni `git push` sul branch di produzione pubblica
   automaticamente una nuova versione; le altre branch/PR generano Preview Deployment.

## Nota sulla sicurezza

Essendo un'app pubblica senza autenticazione, le policy RLS sono volutamente
permissive per funzionare con la `anon key`. In **produzione**, le operazioni
riservate all'operatore (check-in, sospensione, modifica slot) andrebbero protette
da un ruolo/autenticazione dedicato (es. una route `/checkin` dietro Supabase Auth).
Il dettaglio è commentato nella migrazione SQL.
