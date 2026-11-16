// Setup screen, quiz round flow and round summary.
import type { Mode } from '../api/_shared';
import { LENS, MODES, REGS, TYPES, regName, type Country, type Region, type Settings } from './config';
import { DATA, byC, poolOf } from './data';
import { countryBox, paint, regionBox, setFind, setMapSize, setTag, setView, type Mark } from './map';
import { pickQuestion, type Ctx, type Question } from './questions';
import { mastery, record, recordRound, saveSettings, settings, stats } from './store';
import { $, flagImg, fmt, pct, shuffle } from './util';
import { show } from './view';

interface Round {
  list: Country[]; i: number; score: number; streak: number; miss: Country[]; mode: Mode;
  ctx: Ctx; Q?: Question; answered: boolean; pick?: string; ok?: boolean; over?: boolean;
}
let R: Round | null = null;
const poolSet = () => new Set((R?.ctx.pool ?? poolOf(settings.reg)).map(d => d.c));

/* ---------- setup ---------- */
type Key = keyof Settings;
function chips(id: string, list: [string | number, string][], key: Key) {
  const el = $(id);
  el.innerHTML = list.map(([v, t]) => `<button class="chip" data-v="${v}" aria-pressed="${settings[key] == v}">${t}</button>`).join('');
  el.onclick = e => {
    const b = (e.target as HTMLElement).closest<HTMLButtonElement>('.chip');
    if (!b) return;
    const v = b.dataset.v!;
    if (key === 'len') settings.len = +v; else if (key === 'mode') settings.mode = v as Mode; else settings.reg = v as Region;
    saveSettings();
    el.querySelectorAll('.chip').forEach(x => x.setAttribute('aria-pressed', String(x === b)));
    showSetup();
  };
}
export const renderChips = () => { chips('cMode', MODES, 'mode'); chips('cReg', REGS, 'reg'); chips('cLen', LENS, 'len'); };

export function showSetup() {
  show('setup');
  const pool = poolOf(settings.reg), name = regName(settings.reg);
  const seen = pool.filter(d => stats().c[d.c]).length;
  $('poolInfo').textContent = settings.mode === 'weak'
    ? `Vybere státy, které ti v oblasti „${name}“ jdou nejhůř, a pak ty, které jsi ještě neviděl (zatím ${seen} z ${pool.length}).`
    : `${pool.length} států v oblasti „${name}“. Po každé odpovědi uvidíš kartu státu a jeho polohu na mapě.`;
  setTag(name);
  paint(new Set(pool.map(d => d.c)));
  setView(regionBox(settings.reg));
}

/* ---------- round ---------- */
function weakest(list: Country[], n: number) { // worst known first, then unseen, then the rest
  const score = (d: Country) => mastery(d.c) ?? 0.45 + Math.random() * 0.1;
  return list.map(d => [score(d) + Math.random() * 0.02, d] as const).sort((a, b) => a[0] - b[0]).slice(0, n).map(x => x[1]);
}

export function startRound(targets?: Country[]) {
  const pool = poolOf(settings.reg), n = settings.len || pool.length;
  const list = targets ?? (settings.mode === 'weak' ? shuffle(weakest(pool, n)) : shuffle(pool.slice()).slice(0, n));
  R = { list, i: 0, score: 0, streak: 0, miss: [], mode: settings.mode, answered: false,
    ctx: { all: DATA, byC, pool, reg: settings.reg } };
  show('quiz');
  ask();
}

/** Back to the quiz tab: resumes an unfinished round, otherwise opens the setup. */
export function resume() {
  if (!R || R.over) return showSetup();
  show('quiz');
  renderQuestion();
  if (R.answered) renderAnswer();
}

function ask() {
  const r = R!;
  r.Q = pickQuestion(TYPES[r.mode], r.list[r.i]!, r.ctx);
  r.answered = false;
  renderQuestion();
}

function renderQuestion() {
  const r = R!, Q = r.Q!, t = r.list[r.i]!;
  renderMeta();
  $('bar').style.width = (r.i / r.list.length) * 100 + '%';
  setMapSize(Q.find || Q.focus ? 'normal' : 'compact');
  scrollTo({ top: 0 });
  $('q').innerHTML = Q.q;
  $('flag').innerHTML = Q.flag ? flagImg(Q.flag) : '';
  $('flag').hidden = !Q.flag;
  $('opts').className = 'opts ' + (Q.kind === 'flags' ? 'flags' : 'text');
  $('opts').innerHTML = Q.opts.map((o, i) => `<button class="opt" id="o${i}" data-c="${o.c}"><kbd>${i + 1}</kbd><span>${o.label}</span></button>`).join('');
  $('opts').hidden = !Q.opts.length;
  $('fb').innerHTML = ''; $('nextRow').hidden = true;

  setFind(!!Q.find);
  setTag(Q.find ? 'Klepni na stát' : regName(r.ctx.reg));
  if (Q.focus) { paint(poolSet(), { [t.c]: 'hl' }); setView(countryBox(t)); }
  else { paint(poolSet()); setView(regionBox(Q.find ? t.k : r.ctx.reg)); }
}

export function answer(c: string) {
  const r = R;
  if (!r?.Q || r.answered || $('quiz').hidden) return;
  if (r.Q.find && !r.ctx.pool.some(d => d.c === c)) return; // clicks outside the region don't count
  const Q = r.Q, t = r.list[r.i]!, ok = c === Q.target.c;
  r.answered = true; r.pick = c; r.ok = ok;
  if (ok) { r.score++; r.streak++; } else { r.streak = 0; if (!r.miss.includes(t)) r.miss.push(t); }
  record({ c: t.c, t: Q.type, ok, ts: new Date().toISOString() });
  if (!ok) navigator.vibrate?.(60);
  renderAnswer();
}
export const answerFind = (c: string) => { if (R?.Q?.find) answer(c); };

function renderMeta() {
  const r = R!;
  $('qmeta').innerHTML = `<b>${r.i + 1}</b>/${r.list.length} · správně <b>${r.score}</b>${r.streak > 1 ? ` · série <b>${r.streak}</b>` : ''}`;
}

/** Leaves the round early; answers given so far are already saved. */
export function quitRound() {
  if (!R || R.over) return;
  R.over = true;
  showSetup();
}

function renderAnswer() {
  const r = R!, Q = r.Q!, c = r.pick!, ok = !!r.ok;
  renderMeta();
  document.querySelectorAll<HTMLButtonElement>('.opt').forEach(b => {
    b.disabled = true;
    b.classList.add(b.dataset.c === Q.target.c ? 'ok' : b.dataset.c === c ? 'bad' : 'fade');
  });
  setFind(false);
  const mk: Record<string, Mark> = { [Q.target.c]: 'ok' };
  if (!ok && byC[c]) mk[c] = 'bad';
  if (Q.about !== Q.target) mk[Q.about.c] = 'hl';
  paint(poolSet(), mk);
  setView(countryBox(Q.target));
  setTag(Q.target.n);
  card(Q.target, ok, !ok && Q.type === 'find' ? byC[c] : undefined);
  $('nextRow').hidden = false;
  $('next').textContent = r.i + 1 < r.list.length ? 'Další otázka' : 'Výsledek';
  $('next').focus({ preventScroll: true });
}

function card(d: Country, ok: boolean, clicked?: Country) {
  const nb = d.b.map(c => byC[c]?.n).filter(Boolean);
  const v = stats().c[d.c];
  $('fb').innerHTML = `<div class="fb ${ok ? 'ok' : 'bad'}">${flagImg(d)}<div>
    <div class="verdict">${ok ? 'Správně!' : clicked ? `Tohle je ${clicked.n}.` : 'Špatně.'}</div>
    <h3>${d.n}</h3>
    <dl class="facts">
      <dt>Hlavní město</dt><dd>${d.cap}</dd>
      <dt>Poloha</dt><dd>${d.k}, ${d.s}</dd>
      <dt>Rozloha</dt><dd>${fmt(d.a)} km²</dd>
      ${d.cur ? `<dt>Měna</dt><dd>${d.cur}</dd>` : ''}
      <dt>Sousedé</dt><dd>${nb.length ? nb.join(', ') : d.ll ? '—' : 'žádní, jen moře'}</dd>
      ${d.ll ? '<dt>Moře</dt><dd>vnitrozemský stát</dd>' : ''}
      ${v ? `<dt>Tvoje bilance</dt><dd>${v[1]} z ${v[0]} správně</dd>` : ''}
    </dl></div></div>`;
}

export function next() {
  const r = R;
  if (!r?.answered || $('quiz').hidden) return;
  if (++r.i < r.list.length) return ask();
  r.over = true;
  recordRound({ mode: r.mode, reg: r.ctx.reg, score: r.score, total: r.list.length, ts: new Date().toISOString() });
  show('done');
  const p = pct(r.score, r.list.length);
  $('final').textContent = `${r.score}/${r.list.length}`;
  $('finalNote').textContent = p === 100 ? 'Bez jediné chyby.' : p >= 80 ? `${p} % správně. Pár států na zopakování:` : `${p} % správně. Tyhle státy si projdi znovu:`;
  $('miss').innerHTML = r.miss.map(d => `<li>${flagImg(d)}<b>${d.n}</b><span>${d.cap}</span></li>`).join('');
  $('retry').hidden = !r.miss.length;
  $('bar').style.width = '100%';
  paint(poolSet(), Object.fromEntries(r.miss.map(d => [d.c, 'bad' as const])));
  setView(regionBox(r.ctx.reg));
  setTag(r.miss.length ? 'Červeně: chyby v tomto kole' : 'Všechno správně');
}

export const retryMisses = () => { if (R) startRound(shuffle(R.miss.slice())); };
export const isAnswered = () => !!R?.answered;
