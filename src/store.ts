// Local state (settings, device code, stats) and the offline-first sync queue to /api.
import { LIMITS, type AnswerRec, type RoundRec, type Stats, type SyncBatch } from '../api/_shared';
import type { Settings } from './config';

const ls = {
  get<T>(k: string, d: T): T { try { return (JSON.parse(localStorage.getItem('zt.' + k) ?? 'null') as T) ?? d; } catch { return d; } },
  set(k: string, v: unknown) { try { localStorage.setItem('zt.' + k, JSON.stringify(v)); } catch { /* storage blocked */ } },
};

export const settings: Settings = ls.get<Settings>('settings', { mode: 'mix', reg: 'Evropa', len: 10 });
export const saveSettings = () => ls.set('settings', settings);

let uid = ls.get<string | null>('uid', null) ?? crypto.randomUUID();
ls.set('uid', uid);
export const getUid = () => uid;

const emptyStats = (): Stats => ({ c: {}, t: {}, rounds: [], nRounds: 0 });
let S = ls.get<Stats>('stats', emptyStats());
export const stats = () => S;
let queue = ls.get<{ answers: AnswerRec[]; rounds: RoundRec[] }>('queue', { answers: [], rounds: [] });
let inflight = ls.get<SyncBatch | null>('inflight', null);
const saveLocal = () => { ls.set('stats', S); ls.set('queue', queue); ls.set('inflight', inflight); };

export function bump(s: Stats, a: AnswerRec) {
  const c = (s.c[a.c] ??= [0, 0]), t = (s.t[a.t] ??= [0, 0]);
  for (const v of [c, t]) { v[0]++; if (a.ok) v[1]++; }
}
export function addRound(s: Stats, r: RoundRec) {
  s.rounds.unshift(r);
  s.rounds.length = Math.min(s.rounds.length, 10);
  s.nRounds++;
}

export type SyncState = 'ok' | 'offline' | 'nodb' | 'error' | 'pending';
let state: SyncState = 'pending';
const listeners = new Set<(s: SyncState) => void>();
const setState = (s: SyncState) => { state = s; listeners.forEach(f => f(s)); };
export const onSync = (f: (s: SyncState) => void) => { listeners.add(f); f(state); };
const failState = (status: number): SyncState => (status === 503 ? 'nodb' : 'error');

let flushing = false;
let timer: ReturnType<typeof setTimeout> | undefined;
export async function flush() {
  if (flushing) return;
  flushing = true;
  try {
    for (;;) {
      if (!inflight) {
        if (!queue.answers.length && !queue.rounds.length) break;
        inflight = { id: crypto.randomUUID(), answers: queue.answers.splice(0, LIMITS.answers), rounds: queue.rounds.splice(0, LIMITS.rounds) };
        saveLocal();
      }
      const r = await fetch('/api/sync', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ ...inflight, uid }) });
      if (r.status === 400) { inflight = null; saveLocal(); continue; } // server rejected the batch for good, drop it
      if (!r.ok) return setState(failState(r.status));
      inflight = null; saveLocal();
    }
    setState('ok');
  } catch { setState('offline'); }
  finally { flushing = false; }
}

/** Replaces local stats with the server's, plus whatever is still waiting to be sent. */
export async function pull(): Promise<boolean> {
  try {
    const r = await fetch('/api/stats?uid=' + uid);
    if (!r.ok) { setState(failState(r.status)); return false; }
    const s = (await r.json()) as Stats;
    const pending = [inflight, queue].filter(p => p !== null);
    pending.forEach(p => p.answers.forEach(a => bump(s, a)));
    pending.forEach(p => p.rounds.forEach(x => addRound(s, x)));
    S = s; saveLocal();
    setState(pending.some(p => p.answers.length || p.rounds.length) ? 'pending' : 'ok');
    return true;
  } catch { setState('offline'); return false; }
}

export function record(a: AnswerRec) {
  queue.answers.push(a); bump(S, a); saveLocal();
  clearTimeout(timer); timer = setTimeout(flush, 1500);
}
export function recordRound(r: RoundRec) { queue.rounds.push(r); addRound(S, r); saveLocal(); void flush(); }

/** Switch to another device's code; keeps the current one if the server can't confirm it. */
export async function switchUid(next: string): Promise<boolean> {
  await flush(); // this device's pending answers go under the old code first
  const old = uid;
  uid = next; ls.set('uid', uid);
  if (await pull()) return true;
  uid = old; ls.set('uid', uid);
  return false;
}

export const mastery = (c: string) => { const v = S.c[c]; return v ? (v[1] + 1) / (v[0] + 2) : null; };
export const isMastered = (c: string) => { const v = S.c[c]; return !!v && v[0] >= 3 && v[1] / v[0] >= 0.8; };
export const masteryClass = (c: string) => {
  const v = S.c[c]; if (!v) return '';
  const p = v[1] / v[0];
  return p >= 0.8 ? 'm-good' : p >= 0.5 ? 'm-mid' : 'm-bad';
};
