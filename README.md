# progettoelia

Progetto iniziale con deploy automatico su [Vercel](https://vercel.com).

Ogni push sul branch principale genera in automatico un nuovo deploy in produzione.

## Contenuto

- `index.html` — pagina statica di partenza servita da Vercel.
- `vercel.json` — configurazione del deploy statico.

## Deploy automatico su Vercel

Il deploy è collegato al repository GitHub tramite l'integrazione Git di Vercel:

1. Vai su [vercel.com/new](https://vercel.com/new) e accedi con l'account GitHub.
2. Seleziona il repository **`jefebcn/progettoelia`** e clicca **Import**.
3. Non serve configurare alcun framework: è un sito statico, lascia le impostazioni predefinite e clicca **Deploy**.
4. Da questo momento, ogni `git push` verso il branch principale pubblica automaticamente una nuova versione in produzione; ogni push su altri branch o Pull Request crea una **Preview Deployment**.

### Sviluppo in locale (opzionale)

Con la [Vercel CLI](https://vercel.com/docs/cli):

```bash
npm i -g vercel
vercel        # anteprima
vercel --prod # deploy in produzione
```
