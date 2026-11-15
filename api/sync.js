import { sql, init, json, noDb, UUID, TYPES, MODES } from './_db.js';

const isTs = v => typeof v === 'string' && !Number.isNaN(Date.parse(v));

// Saves one batch of answers and finished rounds. The batch id makes retries idempotent.
export async function POST(req) {
  if (!sql) return noDb();
  let b;
  try { b = await req.json(); } catch { return json({ error: 'Neplatný JSON.' }, 400); }
  const { id, uid, answers = [], rounds = [] } = b || {};
  if (!UUID.test(id || '') || !UUID.test(uid || '') || !Array.isArray(answers) || !Array.isArray(rounds)
    || answers.length > 2000 || rounds.length > 200) return json({ error: 'Neplatná data.' }, 400);

  const A = answers.filter(a => /^[A-Z]{3}$/.test(a?.c) && TYPES.has(a.t) && typeof a.ok === 'boolean' && isTs(a.ts));
  const R = rounds.filter(r => MODES.has(r?.mode) && typeof r.reg === 'string' && r.reg.length <= 40
    && Number.isInteger(r.score) && Number.isInteger(r.total) && r.total > 0 && r.total <= 500
    && r.score >= 0 && r.score <= r.total && isTs(r.ts));

  await init();
  const [res] = await sql`
    with b as (insert into batches (id, uid) values (${id}, ${uid}) on conflict do nothing returning id),
    a as (
      insert into answers (uid, c, t, ok, ts)
      select ${uid}::uuid, x.c, x.t, x.ok, x.ts
      from unnest(${A.map(a => a.c)}::text[], ${A.map(a => a.t)}::text[], ${A.map(a => a.ok)}::bool[], ${A.map(a => a.ts)}::timestamptz[]) as x(c, t, ok, ts)
      where exists (select 1 from b) returning 1)
    , r as (
      insert into rounds (uid, mode, reg, score, total, ts)
      select ${uid}::uuid, x.mode, x.reg, x.score, x.total, x.ts
      from unnest(${R.map(r => r.mode)}::text[], ${R.map(r => r.reg)}::text[], ${R.map(r => r.score)}::int[], ${R.map(r => r.total)}::int[], ${R.map(r => r.ts)}::timestamptz[]) as x(mode, reg, score, total, ts)
      where exists (select 1 from b) returning 1)
    select (select count(*) from b)::int as fresh, (select count(*) from a)::int as answers, (select count(*) from r)::int as rounds`;
  return json({ ok: true, duplicate: res.fresh === 0, answers: res.answers, rounds: res.rounds });
}
