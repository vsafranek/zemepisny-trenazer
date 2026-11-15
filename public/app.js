const $ = id => document.getElementById(id);
const [DATA, WORLD] = await Promise.all(['/data/countries.json', '/data/world.json'].map(u => fetch(u).then(r => r.json())));
const byC = Object.fromEntries(DATA.map(d => [d.c, d]));
const flagImg = d => `<img src="/flags/${d.f}.svg" alt="" loading="lazy">`;
const fmt = n => n.toLocaleString('cs-CZ');
const pct = (k, n) => n ? Math.round(k / n * 100) : 0;
const shuffle = a => { for (let i = a.length - 1; i > 0; i--) { const j = Math.random() * (i + 1) | 0; [a[i], a[j]] = [a[j], a[i]]; } return a; };
const sample = (a, n) => shuffle(a.slice()).slice(0, n);
const pick = a => a[Math.random() * a.length | 0];

const MODES = [['mix','Všechno'],['weak','Slabé státy'],['flags','Vlajky'],['caps','Hlavní města'],['map','Poloha na mapě'],['facts','Charakteristiky']];
const CATS = { flags:['flag2name','name2flag'], caps:['cap','cap2name'], map:['map2name','find'], facts:['cont','area','nb','ll','cur'] };
const CAT_NAMES = { flags:'Vlajky', caps:'Hlavní města', map:'Poloha na mapě', facts:'Charakteristiky' };
const TYPES = { ...CATS, mix: Object.values(CATS).flat() };
TYPES.weak = TYPES.mix;
const CONTS = ['Evropa','Asie','Afrika','Severní Amerika','Jižní Amerika','Oceánie'];
const REGS = [['all','Celý svět'], ...CONTS.map(c => [c, c])];
const regName = r => REGS.find(x => x[0] === r)?.[1] || r;
const LENS = [[10,'10'],[20,'20'],[0,'Všechny státy']];

/* ---------- local storage + sync ---------- */
const store = {
  get(k, d) { try { return JSON.parse(localStorage.getItem('zt.' + k)) ?? d; } catch { return d; } },
  set(k, v) { try { localStorage.setItem('zt.' + k, JSON.stringify(v)); } catch {} },
};
const set = store.get('settings', { mode: 'mix', reg: 'Evropa', len: 10 });
let uid = store.get('uid') || crypto.randomUUID(); store.set('uid', uid);
const emptyStats = () => ({ c: {}, t: {}, rounds: [], nRounds: 0 });
let S = store.get('stats', emptyStats());
let queue = store.get('queue', { answers: [], rounds: [] });
let inflight = store.get('inflight', null);
let syncState = 'pending';

const bump = (s, a) => { for (const [m, k] of [[s.c, a.c], [s.t, a.t]]) { const v = m[k] ||= [0, 0]; v[0]++; if (a.ok) v[1]++; } };
const addRound = (s, r) => { s.rounds.unshift(r); s.rounds.length = Math.min(s.rounds.length, 10); s.nRounds++; };
function saveLocal() { store.set('stats', S); store.set('queue', queue); }

function setSync(st) {
  syncState = st;
  const el = $('sync');
  el.textContent = { ok: 'Uloženo na serveru', offline: 'Offline, uloží se po připojení', nodb: 'Server zatím bez databáze, ukládá se jen tady', error: 'Server neodpovídá, zkusím to znovu', pending: 'Ukládám…' }[st];
  el.className = 'sync ' + (st === 'ok' ? 'ok' : st === 'pending' ? '' : 'warn');
}

let flushing = false, flushTimer;
const scheduleFlush = () => { clearTimeout(flushTimer); flushTimer = setTimeout(flush, 1500); };
async function flush() {
  if (flushing) return;
  flushing = true;
  try {
    for (;;) {
      if (!inflight) {
        if (!queue.answers.length && !queue.rounds.length) break;
        inflight = { id: crypto.randomUUID(), answers: queue.answers.splice(0, 2000), rounds: queue.rounds.splice(0, 200) };
        store.set('inflight', inflight); saveLocal();
      }
      const r = await fetch('/api/sync', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ ...inflight, uid }) });
      if (r.status === 400) { inflight = null; store.set('inflight', null); continue; } // unrecoverable batch, drop it
      if (!r.ok) { setSync(r.status === 503 ? 'nodb' : 'error'); return; }
      inflight = null; store.set('inflight', null);
    }
    setSync('ok');
  } catch { setSync('offline'); }
  finally { flushing = false; }
}
async function pull() {
  try {
    const r = await fetch('/api/stats?uid=' + uid);
    if (!r.ok) return setSync(r.status === 503 ? 'nodb' : 'error'), false;
    const s = await r.json();
    const pend = [inflight, queue].filter(Boolean);
    pend.forEach(p => p.answers.forEach(a => bump(s, a)));
    pend.forEach(p => p.rounds.forEach(x => addRound(s, x)));
    S = s; saveLocal();
    if (syncState !== 'nodb') setSync(pend.some(p => p.answers.length || p.rounds.length) ? 'pending' : 'ok');
    return true;
  } catch { setSync('offline'); return false; }
}
addEventListener('online', () => flush());

function record(a) { queue.answers.push(a); bump(S, a); saveLocal(); scheduleFlush(); }
function recordRound(r) { queue.rounds.push(r); addRound(S, r); saveLocal(); flush(); }
const mastery = c => { const v = S.c[c]; return v ? (v[1] + 1) / (v[0] + 2) : null; };
const mClass = c => { const v = S.c[c]; if (!v) return ''; const p = v[1] / v[0]; return p >= .8 ? 'm-good' : p >= .5 ? 'm-mid' : 'm-bad'; };

/* ---------- map ---------- */
const W = 960, H = 500;
const proj = d3.geoNaturalEarth1().rotate([-10, 0]).fitExtent([[2,2],[W-2,H-2]], {type:'Sphere'});
const gpath = d3.geoPath(proj);
const svg = d3.select('#map').insert('svg', ':first-child').attr('viewBox', `0 0 ${W} ${H}`).attr('preserveAspectRatio','xMidYMid meet');
const L = svg.append('g');
L.append('path').datum({type:'Sphere'}).attr('d', gpath).attr('fill','var(--sea)');
L.append('path').datum(d3.geoGraticule10()).attr('class','grat').attr('d', gpath);
const feats = topojson.feature(WORLD, WORLD.objects.countries).features;
const ccnToC = Object.fromEntries(DATA.map(d => [d.id, d.c]));
const paths = L.append('g').selectAll('path').data(feats).join('path')
  .attr('class','cty').attr('d', gpath).attr('data-c', f => ccnToC[f.id] || null);
const hasPath = new Set(feats.map(f => ccnToC[f.id]).filter(Boolean));
const xy = d => proj([d.p[1], d.p[0]]);
const marks = L.append('g').selectAll('circle').data(DATA.filter(d => d.a < 25000 || !hasPath.has(d.c))).join('circle')
  .attr('class','mk').attr('data-c', d => d.c).attr('cx', d => xy(d)[0]).attr('cy', d => xy(d)[1]);
const ringG = L.append('g');
const pxPerDeg = proj.scale() * Math.PI / 180;
let vb = [0, 0, W, H], zk = 1;
const markR = () => 7 * vb[2] / ($('map').clientWidth || W) / zk;
function sizeMarks() { marks.attr('r', markR()); ringG.selectAll('circle').attr('r', markR() * 2.6); }
// Pinch/wheel/drag zoom; on touch, one finger pans only in find mode so the page still scrolls otherwise.
const zoom = d3.zoom().scaleExtent([1, 16]).clickDistance(6)
  .filter(e => e.type === 'wheel' || (e.type.startsWith('touch') ? ($('map').classList.contains('find') || e.touches.length > 1) : !e.button))
  .on('zoom', e => { L.attr('transform', e.transform); zk = e.transform.k; sizeMarks(); });
svg.call(zoom).on('dblclick.zoom', null).style('touch-action', 'pan-y');
const zoomBy = f => svg.transition().duration(250).call(zoom.scaleBy, f);

function setView(box, instant) { // box = [x0,y0,x1,y1] in svg units, fitted to container aspect
  const el = $('map'), asp = el.clientWidth / el.clientHeight || 16/9;
  let [x0, y0, x1, y1] = box, w = x1 - x0, h = y1 - y0;
  if (w / h < asp) { const nw = h * asp; x0 -= (nw - w) / 2; w = nw; } else { const nh = w / asp; y0 -= (nh - h) / 2; h = nh; }
  vb = [x0, y0, w, h];
  svg.interrupt().call(zoom.transform, d3.zoomIdentity);
  sizeMarks();
  (instant ? svg : svg.transition().duration(650).ease(d3.easeCubicInOut)).attr('viewBox', vb.join(' '));
}
function regionBox(reg) {
  if (reg === 'all') return [0, 0, W, H];
  const pts = DATA.filter(d => d.k === reg).map(xy);
  const xs = pts.map(p => p[0]), ys = pts.map(p => p[1]), pad = 40;
  return [d3.min(xs) - pad, d3.min(ys) - pad, d3.max(xs) + pad, d3.max(ys) + pad];
}
function countryBox(d) {
  const [x, y] = xy(d);
  const half = Math.min(60, Math.max(7, Math.sqrt(d.a) / 111 * 1.4)) * pxPerDeg;
  return [x - half, y - half * .7, x + half, y + half * .7];
}
function paint(pool, marksCls = {}, extra = () => '') { // pool: Set of codes; marksCls: {code: 'hl'|'ok'|'bad'}
  const cls = c => [pool.has(c) ? 'pool' : '', marksCls[c] || '', extra(c)].join(' ');
  paths.attr('class', function () { return 'cty ' + cls(this.dataset.c); });
  marks.attr('class', function () { return 'mk ' + cls(this.dataset.c); });
  ringG.selectAll('circle').remove();
  for (const [c, k] of Object.entries(marksCls)) {
    const d = byC[c];
    if (k === 'bad' || (d.a >= 25000 && hasPath.has(c))) continue;
    const [x, y] = xy(d);
    ringG.append('circle').attr('class', 'ring').attr('cx', x).attr('cy', y).attr('r', markR() * 2.6);
  }
}
function setFind(on) { $('map').classList.toggle('find', on); svg.style('touch-action', on ? 'none' : 'pan-y'); }

/* ---------- views ---------- */
function show(view) {
  for (const id of ['setup', 'quiz', 'done', 'statsView']) $(id).hidden = id !== view;
  $('stats').hidden = view !== 'quiz';
  document.querySelectorAll('#tabs button').forEach(b => b.setAttribute('aria-selected', b.dataset.v === (view === 'statsView' ? 'stats' : 'play')));
  setFind(false);
}
$('tabs').onclick = e => {
  const v = e.target.closest('button')?.dataset.v;
  if (v === 'stats') { show('statsView'); renderStats(); pull().then(ok => ok && !$('statsView').hidden && renderStats()); }
  else if (v === 'play') { if (R && !R.over) { show('quiz'); ask(true); } else { show('setup'); showSetup(); } }
};

/* ---------- setup ---------- */
function chips(el, list, key) {
  $(el).innerHTML = list.map(([v, t]) => `<button class="chip" data-v="${v}" aria-pressed="${set[key] == v}">${t}</button>`).join('');
  $(el).onclick = e => {
    const b = e.target.closest('.chip'); if (!b) return;
    set[key] = key === 'len' ? +b.dataset.v : b.dataset.v;
    store.set('settings', set);
    $(el).querySelectorAll('.chip').forEach(x => x.setAttribute('aria-pressed', x === b));
    showSetup();
  };
}
const poolOf = reg => DATA.filter(d => reg === 'all' || d.k === reg);
function showSetup() {
  const pool = poolOf(set.reg);
  const seen = pool.filter(d => S.c[d.c]).length;
  $('poolInfo').textContent = set.mode === 'weak'
    ? `Vybere státy, které ti v oblasti „${regName(set.reg)}“ jdou nejhůř, a pak ty, které jsi ještě neviděl (zatím ${seen} z ${pool.length}).`
    : `${pool.length} států v oblasti „${regName(set.reg)}“. Po každé odpovědi uvidíš kartu státu a jeho polohu na mapě.`;
  $('maptag').textContent = regName(set.reg);
  paint(new Set(pool.map(d => d.c)));
  setView(regionBox(set.reg));
}
chips('cMode', MODES, 'mode'); chips('cReg', REGS, 'reg'); chips('cLen', LENS, 'len');

/* ---------- question builders ---------- */
let pool = [];
function others(t, n, ok = () => true, key = d => d.c) { // distractors, same continent first, unique by key
  const same = pool.filter(d => d !== t && ok(d)), rest = DATA.filter(d => d !== t && d.k !== t.k && ok(d) && !same.includes(d));
  const near = same.filter(d => d.k === t.k);
  const seen = new Set([key(t)]);
  return [...shuffle(near), ...shuffle(same.filter(d => d.k !== t.k)), ...shuffle(rest)]
    .filter(d => !seen.has(key(d)) && seen.add(key(d))).slice(0, n);
}
const opt = (d, label) => ({ c: d.c, label });
const B = {
  flag2name: t => ({ q: 'Která země má tuto vlajku?', flag: t, opts: [t, ...others(t, 3)].map(d => opt(d, d.n)) }),
  name2flag: t => ({ q: `Která vlajka patří státu <b>${t.n}</b>?`, kind: 'flags', opts: [t, ...others(t, 3)].map(d => opt(d, flagImg(d))) }),
  cap: t => ({ q: `Jaké je hlavní město státu <b>${t.n}</b>?`, opts: [t, ...others(t, 3, undefined, d => d.cap)].map(d => opt(d, d.cap)) }),
  cap2name: t => ({ q: `<b>${t.cap}</b> je hlavní město kterého státu?`, opts: [t, ...others(t, 3)].map(d => opt(d, d.n)) }),
  map2name: t => ({ q: 'Který stát je na mapě zvýrazněný?', focus: t, opts: [t, ...others(t, 3)].map(d => opt(d, d.n)) }),
  find: t => ({ q: `Klepni na mapě na stát <b>${t.n}</b>`, find: true, opts: [] }),
  cont: t => ({ q: `Na kterém kontinentu leží <b>${t.n}</b>?`, opts: [t.k, ...sample(CONTS.filter(k => k !== t.k), 3)].map(k => ({ c: k === t.k ? t.c : '-' + k, label: k })) }),
  area: t => {
    const set4 = [t, ...others(t, 3, d => d.a !== t.a)], max = set4.reduce((a, b) => a.a > b.a ? a : b);
    return { q: 'Který z těchto států má největší rozlohu?', target: max, opts: set4.map(d => opt(d, d.n)) };
  },
  nb: t => {
    const nb = byC[pick(t.b.filter(c => byC[c]))];
    return { q: `Se kterým státem sousedí <b>${t.n}</b>?`, target: nb, about: t,
      opts: [nb, ...others(t, 3, d => !t.b.includes(d.c) && d !== nb)].map(d => opt(d, d.n)) };
  },
  ll: t => ({ q: 'Který z těchto států nemá přístup k moři?', opts: [t, ...others(t, 3, d => !d.ll)].map(d => opt(d, d.n)) }),
  cur: t => ({ q: `Jakou měnu používá <b>${t.n}</b>?`, opts: [t, ...others(t, 3, d => d.cur, d => d.cur)].map(d => opt(d, d.cur)) }),
};
const can = { cont: () => set.reg === 'all', nb: t => t.b.some(c => byC[c]), ll: t => t.ll, cur: t => !!t.cur };

/* ---------- round ---------- */
let R; // round state
function weakList(list, n) { // worst known first, then unseen, then the rest
  const score = d => mastery(d.c) ?? 0.45 + Math.random() * 0.1;
  return list.map(d => [score(d) + Math.random() * 0.02, d]).sort((a, b) => a[0] - b[0]).slice(0, n).map(x => x[1]);
}
function startRound(targets) {
  pool = poolOf(set.reg);
  const n = set.len || pool.length;
  const list = targets || (set.mode === 'weak' ? shuffle(weakList(pool, n)) : shuffle(pool.slice()).slice(0, n));
  R = { list, i: 0, score: 0, streak: 0, miss: [], mode: set.mode };
  show('quiz');
  ask();
}
function ask(resume) {
  const t = R.list[R.i];
  if (!resume) {
    const types = TYPES[R.mode].filter(k => !can[k] || can[k](t));
    const type = pick(types);
    const Q = B[type](t);
    Q.type = type; Q.target = Q.target || t; Q.about = Q.about || Q.target;
    Q.opts = shuffle(Q.opts);
    R.Q = Q; R.answered = false;
  }
  const Q = R.Q;
  $('sScore').textContent = R.score; $('sStreak').textContent = R.streak;
  $('sPos').textContent = R.i + 1; $('sTot').textContent = R.list.length;
  $('bar').style.width = (R.i / R.list.length * 100) + '%';
  if (resume && R.answered) return answerView(R.lastPick);
  $('q').innerHTML = Q.q;
  $('flag').innerHTML = Q.flag ? flagImg(Q.flag) : '';
  $('flag').hidden = !Q.flag;
  $('opts').className = 'opts ' + (Q.kind === 'flags' ? 'flags' : 'text');
  $('opts').innerHTML = Q.opts.map((o, i) => `<button class="opt" id="o${i}" data-c="${o.c}"><kbd>${i + 1}</kbd><span>${o.label}</span></button>`).join('');
  $('opts').hidden = !Q.opts.length;
  $('fb').innerHTML = ''; $('nextRow').hidden = true;

  const poolSet = new Set(pool.map(d => d.c));
  setFind(!!Q.find);
  $('maptag').textContent = Q.find ? 'Klepni na stát' : regName(set.reg);
  if (Q.focus) { paint(poolSet, { [t.c]: 'hl' }); setView(countryBox(t)); }
  else { paint(poolSet); setView(regionBox(Q.find ? t.k : set.reg)); }
}
function answer(c) {
  if (R.answered) return;
  R.answered = true; R.lastPick = c;
  const Q = R.Q, ok = c === Q.target.c, t = R.list[R.i];
  if (ok) { R.score++; R.streak++; } else { R.streak = 0; if (!R.miss.includes(t)) R.miss.push(t); }
  R.lastOk = ok;
  record({ c: t.c, t: Q.type, ok, ts: new Date().toISOString() });
  answerView(c);
}
function answerView(c) {
  const Q = R.Q, ok = R.lastOk;
  $('sScore').textContent = R.score; $('sStreak').textContent = R.streak;
  $('q').innerHTML = Q.q;
  $('flag').innerHTML = Q.flag ? flagImg(Q.flag) : ''; $('flag').hidden = !Q.flag;
  $('opts').hidden = !Q.opts.length;
  document.querySelectorAll('.opt').forEach(b => {
    b.disabled = true;
    b.classList.add(b.dataset.c === Q.target.c ? 'ok' : b.dataset.c === c ? 'bad' : 'fade');
  });
  setFind(false);
  const mk = { [Q.target.c]: 'ok' };
  if (!ok && byC[c]) mk[c] = 'bad';
  if (Q.about !== Q.target) mk[Q.about.c] = 'hl';
  paint(new Set(pool.map(d => d.c)), mk);
  setView(countryBox(Q.target));
  $('maptag').textContent = Q.target.n;
  card(Q.target, ok, !ok && byC[c] && Q.type === 'find' ? byC[c] : null);
  $('nextRow').hidden = false;
  $('next').textContent = R.i + 1 < R.list.length ? 'Další otázka' : 'Výsledek';
  $('next').focus({ preventScroll: true });
}
function card(d, ok, clicked) {
  const nb = d.b.map(c => byC[c]?.n).filter(Boolean);
  const v = S.c[d.c];
  $('fb').innerHTML = `<div class="fb ${ok ? 'ok' : 'bad'}">${flagImg(d)}<div>
    <div class="verdict">${ok ? 'Správně!' : clicked ? `Tohle je ${clicked.n}.` : 'Špatně.'}</div>
    <h3>${d.n}</h3>
    <dl class="facts">
      <dt>Hlavní město</dt><dd>${d.cap}</dd>
      <dt>Poloha</dt><dd>${d.k}, ${d.s}</dd>
      <dt>Rozloha</dt><dd>${fmt(d.a)} km²</dd>
      ${d.cur ? `<dt>Měna</dt><dd>${d.cur}</dd>` : ''}
      <dt>Sousedé</dt><dd>${nb.length ? nb.join(', ') : (d.ll ? '—' : 'žádní, jen moře')}</dd>
      ${d.ll ? '<dt>Moře</dt><dd>vnitrozemský stát</dd>' : ''}
      ${v ? `<dt>Tvoje bilance</dt><dd>${v[1]} z ${v[0]} správně</dd>` : ''}
    </dl></div></div>`;
}
function next() {
  if (!R.answered) return;
  if (++R.i < R.list.length) return ask();
  R.over = true;
  recordRound({ mode: R.mode, reg: set.reg, score: R.score, total: R.list.length, ts: new Date().toISOString() });
  show('done');
  const p = pct(R.score, R.list.length);
  $('final').textContent = `${R.score}/${R.list.length}`;
  $('finalNote').textContent = p === 100 ? 'Bez jediné chyby.' : p >= 80 ? `${p} % správně. Pár států na zopakování:` : `${p} % správně. Tyhle státy si projdi znovu:`;
  $('miss').innerHTML = R.miss.map(d => `<li>${flagImg(d)}<b>${d.n}</b><span>${d.cap}</span></li>`).join('');
  $('retry').hidden = !R.miss.length;
  $('bar').style.width = '100%';
  paint(new Set(pool.map(d => d.c)), Object.fromEntries(R.miss.map(d => [d.c, 'bad'])));
  setView(regionBox(set.reg));
  $('maptag').textContent = R.miss.length ? 'Červeně: chyby v tomto kole' : 'Všechno správně';
}

/* ---------- stats ---------- */
const bar = (label, k, n, txt) => `<div class="bar"><span>${label}</span><div class="tr"><i style="width:${pct(k, n)}%"></i></div><em>${txt}</em></div>`;
const isMastered = c => { const v = S.c[c]; return v && v[0] >= 3 && v[1] / v[0] >= .8; };
const MODE_NAMES = Object.fromEntries(MODES);
function renderStats() {
  const vals = Object.values(S.c), n = vals.reduce((s, v) => s + v[0], 0), k = vals.reduce((s, v) => s + v[1], 0);
  const mastered = DATA.filter(d => isMastered(d.c)).length;
  $('tiles').innerHTML = [[fmt(n), 'odpovědí'], [n ? pct(k, n) + ' %' : '–', 'úspěšnost'], [fmt(S.nRounds), 'odehraných kol'], [`${mastered}/${DATA.length}`, 'zvládnutých států']]
    .map(([b, s]) => `<div class="tile"><b>${b}</b><span>${s}</span></div>`).join('');
  $('byType').innerHTML = Object.entries(CATS).map(([cat, ts]) => {
    const [cn, ck] = ts.reduce((a, t) => { const v = S.t[t]; return v ? [a[0] + v[0], a[1] + v[1]] : a; }, [0, 0]);
    return bar(CAT_NAMES[cat], ck, cn, cn ? `${pct(ck, cn)} %` : '–');
  }).join('');
  $('byCont').innerHTML = CONTS.map(c => { const all = DATA.filter(d => d.k === c); const m = all.filter(d => isMastered(d.c)).length; return bar(c, m, all.length, `${m}/${all.length}`); }).join('');
  const weak = DATA.filter(d => S.c[d.c] && S.c[d.c][1] < S.c[d.c][0]).sort((a, b) => mastery(a.c) - mastery(b.c)).slice(0, 8);
  $('weakList').innerHTML = weak.length ? weak.map(d => `<li>${flagImg(d)}<b>${d.n}</b><span>${S.c[d.c][1]} z ${S.c[d.c][0]}</span></li>`).join('') : '<li class="hint">Zatím žádné chyby. Odehraj pár kol.</li>';
  $('roundList').innerHTML = S.rounds.length ? S.rounds.map(r => `<tr><td>${new Date(r.ts).toLocaleDateString('cs-CZ', { day: 'numeric', month: 'numeric' })} · ${MODE_NAMES[r.mode] || r.mode} · ${regName(r.reg)}</td><td>${r.score}/${r.total}</td></tr>`).join('') : '<tr><td class="hint">Zatím žádné odehrané kolo.</td></tr>';
  $('uid').textContent = uid;
  setSync(syncState);
  paint(new Set(), {}, mClass);
  setView(regionBox(set.reg));
  $('maptag').textContent = 'Co už umíš';
}
$('weakGo').onclick = () => { set.mode = 'weak'; store.set('settings', set); chips('cMode', MODES, 'mode'); startRound(); };
$('copyUid').onclick = () => {
  navigator.clipboard?.writeText(uid).then(() => $('uidMsg').textContent = 'Kód zkopírován.',
    () => { getSelection().selectAllChildren($('uid')); $('uidMsg').textContent = 'Kód je označený, zkopíruj ho ručně.'; });
};
$('useUid').onclick = async () => {
  const v = $('uidIn').value.trim().toLowerCase();
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(v)) return $('uidMsg').textContent = 'Tohle není platný kód. Má tvar xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx.';
  if (v === uid) return $('uidMsg').textContent = 'Tento kód už používáš.';
  await flush(); // send this device's pending answers under the old code first
  const old = uid; uid = v; store.set('uid', uid);
  if (await pull()) { $('uidIn').value = ''; $('uidMsg').textContent = 'Hotovo, zobrazuji statistiky z druhého zařízení.'; renderStats(); }
  else { uid = old; store.set('uid', uid); $('uidMsg').textContent = 'Kód se nepodařilo načíst. Zkontroluj připojení a zkus to znovu.'; }
};

/* ---------- events ---------- */
$('start').onclick = () => startRound();
$('again').onclick = () => { show('setup'); showSetup(); };
$('retry').onclick = () => startRound(shuffle(R.miss.slice()));
$('next').onclick = next;
$('opts').onclick = e => { const b = e.target.closest('.opt'); if (b) answer(b.dataset.c); };
$('zIn').onclick = () => zoomBy(2);
$('zOut').onclick = () => zoomBy(.5);
$('zReset').onclick = () => svg.transition().duration(300).call(zoom.transform, d3.zoomIdentity);
svg.on('click', e => {
  if (!R || R.answered || !R.Q?.find || $('quiz').hidden) return;
  const c = e.target.dataset?.c;
  if (c && pool.some(d => d.c === c)) answer(c);
});
document.addEventListener('keydown', e => {
  if ($('quiz').hidden || !R || e.target.tagName === 'INPUT') return;
  if (!R.answered && /^[1-4]$/.test(e.key)) $('o' + (e.key - 1))?.click();
  else if (R.answered && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); next(); }
});
addEventListener('resize', () => setView([vb[0], vb[1], vb[0] + vb[2], vb[1] + vb[3]], true));

let installEvt;
addEventListener('beforeinstallprompt', e => { e.preventDefault(); installEvt = e; $('install').hidden = false; });
$('install').onclick = async () => { $('install').hidden = true; installEvt?.prompt(); installEvt = null; };
if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(() => {});

showSetup();
flush().then(pull);
