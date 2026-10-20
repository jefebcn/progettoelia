/** Codici d'errore restituiti dalle funzioni SQL -> messaggi in italiano. */
export const ERROR_MESSAGES: Record<string, string> = {
  // Prenotazione utente
  SLOT_FULL: "Lo slot selezionato non ha posti sufficienti. Scegline un altro.",
  SLOT_SUSPENDED: "Questo slot è temporaneamente sospeso.",
  SLOT_PAST: "Questo orario è già passato. Scegline uno successivo.",
  DATE_CLOSED: "Questo giorno non è prenotabile. Scegline un altro.",
  INVALID_PERIOD: "Periodo non valido: controlla le date (massimo 400 giorni).",
  INTAKE_SUSPENDED: "Le prenotazioni sono momentaneamente sospese. Riprova tra poco.",
  SLOT_NOT_FOUND: "Slot non valido. Aggiorna la pagina e riprova.",
  GROUP_TOO_LARGE: "Il gruppo è troppo numeroso per un solo slot (max 15). Dividetevi in due prenotazioni.",
  INVALID_NAME: "Inserisci nome e cognome (massimo 60 caratteri).",
  INVALID_ADULTS: "Serve almeno un adulto.",
  INVALID_CHILDREN: "Numero di bambini non valido.",
  // Operatore
  BAD_PIN: "PIN operatore errato.",
  PIN_NOT_SET: "PIN operatore non ancora impostato: aggiungi la variabile STAFF_PIN su Vercel (vedi README).",
  TOO_MANY_ATTEMPTS: "Troppi tentativi errati. Riprova tra 15 minuti.",
  NOT_FOUND: "Pass non riconosciuto.",
  ALREADY_IN: "Ingresso già registrato per questo pass.",
  NOT_BOOKED: "Questo pass non è in stato «prenotato».",
  // Server / rete
  DB_NOT_CONFIGURED: "Il database non è ancora collegato (vedi README).",
  SERVER_ERROR: "Errore temporaneo del server. Riprova tra qualche secondo.",
  NETWORK: "Impossibile contattare il server. Controlla la connessione e riprova.",
};

export function errorMessage(raw: string | null | undefined, fallback: string): string {
  if (!raw) return fallback;
  const key = Object.keys(ERROR_MESSAGES).find((k) => raw.includes(k));
  if (key) return ERROR_MESSAGES[key];
  if (/fetch|network|Failed to fetch|503|502|504/i.test(raw)) return ERROR_MESSAGES.NETWORK;
  return fallback;
}
