import { sql, init, json, noDb, UUID } from './_db.js';

// Returns aggregated stats for one device code: per country, per question type, recent rounds.
export async function GET(req) {
  if (!sql) return noDb();
  const uid = new URL(req.url).searchParams.get('uid') || '';
  if (!UUID.test(uid)) return json({ error: 'Neplatný kód zařízení.' }, 400);
  await init();
  const [cs, ts, rs, [tot]] = await Promise.all([
    sql`select c, count(*)::int n, (count(*) filter (where ok))::int k from answers where uid = ${uid} group by c`,
    sql`select t, count(*)::int n, (count(*) filter (where ok))::int k from answers where uid = ${uid} group by t`,
    sql`select mode, reg, score, total, ts from rounds where uid = ${uid} order by ts desc limit 10`,
    sql`select count(*)::int n from rounds where uid = ${uid}`,
  ]);
  return json({
    c: Object.fromEntries(cs.map(r => [r.c.trim(), [r.n, r.k]])),
    t: Object.fromEntries(ts.map(r => [r.t, [r.n, r.k]])),
    rounds: rs.map(r => ({ ...r, ts: new Date(r.ts).toISOString() })),
    nRounds: tot.n,
  });
}
