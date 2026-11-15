# Zeměpisný trenažér

PWA kvíz na 194 států světa (vlajky, hlavní města, poloha na mapě, charakteristiky) se statistikami v serverless Postgresu (Neon). Vite + TypeScript, bez UI frameworku, API jako Vercel Functions.

## Struktura

- `src/` – frontend
  - `main.ts` – zapojení událostí, service worker, instalace
  - `quiz.ts` – výběr kola, průběh kvízu, výsledek
  - `questions.ts` – generátory otázek (čisté funkce, testované)
  - `map.ts` – mapa v d3 (projekce, zvýraznění, zoom)
  - `stats.ts` – záložka Statistiky, kód zařízení
  - `store.ts` – nastavení, lokální statistiky a fronta synchronizace (offline-first)
  - `config.ts`, `data.ts`, `util.ts`, `view.ts`, `style.css`
- `api/` – Vercel Functions
  - `sync.ts` – POST, uloží dávku odpovědí a kol (idempotentně podle id dávky)
  - `stats.ts` – GET `?uid=`, agregované statistiky
  - `_shared.ts` – typy a konstanty sdílené s frontendem, `_db.ts` – Neon + tvorba tabulek
- `scripts/data.mjs` – před buildem vygeneruje do `public/` data států, vlajky, mapu a ikony z npm balíčků
- `scripts/sw.mjs` – po buildu vygeneruje `dist/sw.js` s precache celé appky
- `test/` – Vitest: generátory otázek přes všechny státy a API proti in-process Postgresu (PGlite)

Tabulky v databázi se vytvoří samy při prvním volání API.

## Příkazy

- `npm run dev` – vývojový server (API lokálně běží přes `vercel dev`)
- `npm test` – testy
- `npm run build` – data → typecheck → testy → vite build → service worker. Když testy neprojdou, build (i deploy na Vercelu) selže.

## Nasazení

1. Vercel dashboard → **Add New → Project** → importovat tento repozitář. Nastavení se načte z `vercel.json`.
2. Projekt → **Storage → Create Database → Neon**, region Frankfurt, připojit k projektu (nastaví `DATABASE_URL`).
3. **Redeploy**. Od té doby se každý push do `main` nasadí sám.

Bez databáze aplikace funguje dál, statistiky drží jen v prohlížeči a odešle je, jakmile databáze bude.
