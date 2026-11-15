# Zeměpisný trenažér

PWA kvíz na 194 států světa (vlajky, hlavní města, poloha na mapě, charakteristiky) se statistikami v serverless Postgresu (Neon).

## Struktura

- `public/` – statická aplikace (index.html, app.js, style.css, manifest, ikona)
- `api/sync.js` – POST, uloží dávku odpovědí a kol (idempotentně podle id dávky)
- `api/stats.js` – GET `?uid=`, vrátí agregované statistiky
- `scripts/build.mjs` – při buildu vygeneruje data států, vlajky, mapu, ikony a service worker z npm balíčků

Tabulky v databázi se vytvoří samy při prvním volání API, žádná migrace není potřeba.

## Nasazení

1. `npm i -g vercel` (nebo používej `npx vercel`)
2. Ve složce projektu: `vercel --prod`. Při dotazech potvrď nový projekt `zemepisny-trenazer`, nastavení z `vercel.json` se načte samo.
3. Ve Vercel dashboardu: projekt → **Storage** → **Create Database** → **Neon** → region **Frankfurt (eu-central-1)** → Connect k projektu. Tím se nastaví `DATABASE_URL`.
4. Znovu `vercel --prod` (env proměnné se projeví až v novém deployi).

Bez databáze aplikace funguje dál, statistiky drží jen v prohlížeči a pošle je na server, jakmile databáze bude.

## Lokálně

`npm i && npm run build && vercel dev`
