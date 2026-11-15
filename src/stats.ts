// Statistics tab: totals, per-category and per-continent bars, mastery map, weak states, device code.
import { UUID } from '../api/_shared';
import { CATS, CAT_NAMES, CONTS, MODE_NAMES, regName } from './config';
import { DATA } from './data';
import { paint, regionBox, setTag, setView } from './map';
import { getUid, isMastered, mastery, masteryClass, onSync, pull, settings, stats, switchUid, type SyncState } from './store';
import { $, flagImg, fmt, pct } from './util';
import { show } from './view';

const SYNC_TEXT: Record<SyncState, string> = {
  ok: 'Uloženo na serveru',
  offline: 'Offline, uloží se po připojení',
  nodb: 'Server zatím bez databáze, ukládá se jen tady',
  error: 'Server neodpovídá, zkusím to znovu',
  pending: 'Ukládám…',
};
onSync(s => {
  $('sync').textContent = SYNC_TEXT[s];
  $('sync').className = 'sync ' + (s === 'ok' ? 'ok' : s === 'pending' ? '' : 'warn');
});

const bar = (label: string, k: number, n: number, txt: string) =>
  `<div class="bar"><span>${label}</span><div class="tr"><i style="width:${pct(k, n)}%"></i></div><em>${txt}</em></div>`;

export function renderStats() {
  const S = stats();
  const vals = Object.values(S.c), n = vals.reduce((s, v) => s + v[0], 0), k = vals.reduce((s, v) => s + v[1], 0);
  const mastered = DATA.filter(d => isMastered(d.c)).length;
  $('tiles').innerHTML = ([[fmt(n), 'odpovědí'], [n ? pct(k, n) + ' %' : '–', 'úspěšnost'], [fmt(S.nRounds), 'odehraných kol'], [`${mastered}/${DATA.length}`, 'zvládnutých států']] as const)
    .map(([b, s]) => `<div class="tile"><b>${b}</b><span>${s}</span></div>`).join('');
  $('byType').innerHTML = (Object.keys(CATS) as (keyof typeof CATS)[]).map(cat => {
    const [cn, ck] = CATS[cat].reduce<[number, number]>((a, t) => { const v = S.t[t]; return v ? [a[0] + v[0], a[1] + v[1]] : a; }, [0, 0]);
    return bar(CAT_NAMES[cat], ck, cn, cn ? `${pct(ck, cn)} %` : '–');
  }).join('');
  $('byCont').innerHTML = CONTS.map(c => {
    const all = DATA.filter(d => d.k === c), m = all.filter(d => isMastered(d.c)).length;
    return bar(c, m, all.length, `${m}/${all.length}`);
  }).join('');
  const weak = DATA.filter(d => { const v = S.c[d.c]; return v && v[1] < v[0]; }).sort((a, b) => mastery(a.c)! - mastery(b.c)!).slice(0, 8);
  $('weakList').innerHTML = weak.length
    ? weak.map(d => `<li>${flagImg(d)}<b>${d.n}</b><span>${S.c[d.c]![1]} z ${S.c[d.c]![0]}</span></li>`).join('')
    : '<li class="hint">Zatím žádné chyby. Odehraj pár kol.</li>';
  $('roundList').innerHTML = S.rounds.length
    ? S.rounds.map(r => `<tr><td>${new Date(r.ts).toLocaleDateString('cs-CZ', { day: 'numeric', month: 'numeric' })} · ${MODE_NAMES[r.mode] ?? r.mode} · ${regName(r.reg)}</td><td>${r.score}/${r.total}</td></tr>`).join('')
    : '<tr><td class="hint">Zatím žádné odehrané kolo.</td></tr>';
  $('uid').textContent = getUid();
  paint(new Set(), {}, masteryClass);
  setView(regionBox(settings.reg));
  setTag('Co už umíš');
}

export async function openStats() {
  show('statsView');
  renderStats();
  if (await pull() && !$('statsView').hidden) renderStats();
}

const msg = (t: string) => { $('uidMsg').textContent = t; };
$('copyUid').onclick = () => {
  navigator.clipboard?.writeText(getUid()).then(() => msg('Kód zkopírován.'),
    () => { getSelection()?.selectAllChildren($('uid')); msg('Kód je označený, zkopíruj ho ručně.'); });
};
$('useUid').onclick = async () => {
  const input = $<HTMLInputElement>('uidIn'), v = input.value.trim().toLowerCase();
  if (!UUID.test(v)) return msg('Tohle není platný kód. Má tvar xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx.');
  if (v === getUid()) return msg('Tento kód už používáš.');
  if (await switchUid(v)) { input.value = ''; msg('Hotovo, zobrazuji statistiky z druhého zařízení.'); renderStats(); }
  else msg('Kód se nepodařilo načíst. Zkontroluj připojení a zkus to znovu.');
};
