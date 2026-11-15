import { sql, init, json, noDb } from './_db.js';
import { UUID, QTYPES, MODES, LIMITS, type AnswerRec, type RoundRec } from './_shared.js';

const qtypes = new Set<unknown>(QTYPES), modes = new Set<unknown>(MODES);
const isTs = (v: unknown): v is string => typeof v === 'string' && !Number.isNaN(Date.parse(v));
type Loose = Record<string, unknown> | null | undefined;
const isAnswer = (a: Loose): a is AnswerRec & Loose =>
  typeof a?.c === 'string' && /^[A-Z]{3}$/.test(a.c) && qtypes.has(a.t) && typeof a.ok === 'boolean' && isTs(a.ts);
const isRound = (r: Loose): r is RoundRec & Loose =>
  modes.has(r?.mode) && typeof r?.reg === 'string' && r.reg.length <= 40
  && Number.isInteger(r.score) && Number.isInteger(r.total) && (r.total as number) > 0 && (r.total as number) <= 500
  && (r.score as number) >= 0 && (r.score as number) <= (r.total as number) && isTs(r.ts);

// Saves one batch of answers and finished rounds. The batch id makes retries idempotent.
export async function POST(req: Request) {
  if (!sql) return noDb();
  let b: Loose;
  try { b = await req.json(); } catch { return json({ error: 'Neplatný JSON.' }, 400); }
  const { id, uid, answers = [], rounds = [] } = b ?? {};
  if (typeof id !== 'string' || !UUID.test(id) || typeof uid !== 'string' || !UUID.test(uid)
    || !Array.isArray(answers) || !Array.isArray(rounds)
    || answers.length > LIMITS.answers || rounds.length > LIMITS.rounds) return json({ error: 'Neplatná data.' }, 400);

  const A = answers.filter(isAnswer), R = rounds.filter(isRound);
  await init(sql);
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
  return json({ ok: true, duplicate: res?.fresh === 0, answers: res?.answers, rounds: res?.rounds });
}
