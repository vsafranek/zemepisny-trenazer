import { PGlite } from '@electric-sql/pglite';
import { describe, expect, it, vi } from 'vitest';
import type { Stats } from '../api/_shared';

// Run the real handlers against an in-process Postgres instead of Neon.
const db = new PGlite();
vi.mock('@neondatabase/serverless', () => ({
  neon: () => (strings: TemplateStringsArray, ...vals: unknown[]) =>
    db.query(strings.reduce((a, s, i) => a + '$' + i + s), vals).then(r => r.rows),
}));
vi.stubEnv('DATABASE_URL', 'postgres://test');
const { POST } = await import('../api/sync');
const { GET } = await import('../api/stats');

const post = (b: unknown) => POST(new Request('http://x/api/sync', { method: 'POST', body: JSON.stringify(b) }));
const get = (uid: string) => GET(new Request('http://x/api/stats?uid=' + uid));

describe('api', () => {
  const uid = crypto.randomUUID(), ts = new Date().toISOString();
  const batch = {
    id: crypto.randomUUID(), uid,
    answers: [
      { c: 'CZE', t: 'cap', ok: true, ts }, { c: 'CZE', t: 'find', ok: false, ts },
      { c: 'AUT', t: 'cap', ok: true, ts }, { c: 'bad', t: 'cap', ok: true, ts }, { c: 'DEU', t: 'nope', ok: true, ts },
    ],
    rounds: [{ mode: 'mix', reg: 'Evropa', score: 2, total: 3, ts }, { mode: 'mix', reg: 'Evropa', score: 5, total: 3, ts }],
  };

  it('saves valid records and skips invalid ones', async () => {
    expect(await (await post(batch)).json()).toEqual({ ok: true, duplicate: false, answers: 3, rounds: 1 });
  });
  it('ignores a retried batch', async () => {
    expect(await (await post(batch)).json()).toMatchObject({ duplicate: true, answers: 0, rounds: 0 });
  });
  it('rejects malformed requests', async () => {
    expect((await post({ uid })).status).toBe(400);
    expect((await post({ ...batch, id: 'x' })).status).toBe(400);
    expect((await get('nope')).status).toBe(400);
  });
  it('aggregates stats per country, type and round', async () => {
    const s = (await (await get(uid)).json()) as Stats;
    expect(s.c).toEqual({ CZE: [2, 1], AUT: [1, 1] });
    expect(s.t).toEqual({ cap: [2, 2], find: [1, 0] });
    expect(s.nRounds).toBe(1);
    expect(s.rounds[0]).toMatchObject({ mode: 'mix', reg: 'Evropa', score: 2, total: 3 });
  });
  it('keeps devices apart', async () => {
    expect(await (await get(crypto.randomUUID())).json()).toEqual({ c: {}, t: {}, rounds: [], nRounds: 0 });
  });
});
