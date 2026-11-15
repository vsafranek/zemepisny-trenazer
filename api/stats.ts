import { sql, init, json, noDb } from './_db.js';
import { UUID, type Stats, type Tally, type RoundRec } from './_shared.js';

// Returns aggregated stats for one device code: per country, per question type, recent rounds.
export async function GET(req: Request) {
  if (!sql) return noDb();
  const uid = new URL(req.url).searchParams.get('uid') ?? '';
  if (!UUID.test(uid)) return json({ error: 'Neplatný kód zařízení.' }, 400);
  await init(sql);
  const [cs, ts, rs, tot] = await Promise.all([
    sql`select c, count(*)::int n, (count(*) filter (where ok))::int k from answers where uid = ${uid} group by c`,
    sql`select t, count(*)::int n, (count(*) filter (where ok))::int k from answers where uid = ${uid} group by t`,
    sql`select mode, reg, score, total, ts from rounds where uid = ${uid} order by ts desc limit 10`,
    sql`select count(*)::int n from rounds where uid = ${uid}`,
  ]);
  const tally = (r: Record<string, unknown>): Tally => [r.n as number, r.k as number];
  const out: Stats = {
    c: Object.fromEntries(cs.map(r => [String(r.c).trim(), tally(r)])),
    t: Object.fromEntries(ts.map(r => [r.t, tally(r)])),
    rounds: rs.map(r => ({ ...r, ts: new Date(r.ts as string).toISOString() }) as RoundRec),
    nRounds: (tot[0]?.n as number) ?? 0,
  };
  return json(out);
}
