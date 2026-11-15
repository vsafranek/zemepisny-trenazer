import type { QType } from '../api/_shared';
import { CONTS, type Country, type Region } from './config';
import { flagImg, pick, sample, shuffle } from './util';

export interface Ctx { all: Country[]; byC: Record<string, Country>; pool: Country[]; reg: Region }
export interface Opt { c: string; label: string }
export interface Question {
  type: QType; q: string; target: Country; about: Country; opts: Opt[];
  flag?: Country; focus?: Country; find?: boolean; kind?: 'flags';
}
type Draft = Omit<Question, 'type' | 'target' | 'about'> & { target?: Country; about?: Country };

/** Distractors: same continent first, then the rest of the pool, then the world; unique by `key`. */
function others(ctx: Ctx, t: Country, n: number, ok: (d: Country) => boolean = () => true, key: (d: Country) => string = d => d.c) {
  const same = ctx.pool.filter(d => d !== t && ok(d));
  const rest = ctx.all.filter(d => d !== t && d.k !== t.k && ok(d) && !same.includes(d));
  const seen = new Set([key(t)]);
  return [...shuffle(same.filter(d => d.k === t.k)), ...shuffle(same.filter(d => d.k !== t.k)), ...shuffle(rest)]
    .filter(d => !seen.has(key(d)) && !!seen.add(key(d))).slice(0, n);
}
const opt = (d: Country, label: string): Opt => ({ c: d.c, label });

const builders: Record<QType, (t: Country, ctx: Ctx) => Draft> = {
  flag2name: (t, x) => ({ q: 'Která země má tuto vlajku?', flag: t, opts: [t, ...others(x, t, 3)].map(d => opt(d, d.n)) }),
  name2flag: (t, x) => ({ q: `Která vlajka patří státu <b>${t.n}</b>?`, kind: 'flags', opts: [t, ...others(x, t, 3)].map(d => opt(d, flagImg(d))) }),
  cap: (t, x) => ({ q: `Jaké je hlavní město státu <b>${t.n}</b>?`, opts: [t, ...others(x, t, 3, undefined, d => d.cap)].map(d => opt(d, d.cap)) }),
  cap2name: (t, x) => ({ q: `<b>${t.cap}</b> je hlavní město kterého státu?`, opts: [t, ...others(x, t, 3)].map(d => opt(d, d.n)) }),
  map2name: (t, x) => ({ q: 'Který stát je na mapě zvýrazněný?', focus: t, opts: [t, ...others(x, t, 3)].map(d => opt(d, d.n)) }),
  find: t => ({ q: `Klepni na mapě na stát <b>${t.n}</b>`, find: true, opts: [] }),
  cont: t => ({ q: `Na kterém kontinentu leží <b>${t.n}</b>?`,
    opts: [t.k, ...sample(CONTS.filter(k => k !== t.k), 3)].map(k => ({ c: k === t.k ? t.c : '-' + k, label: k })) }),
  area: (t, x) => {
    const four = [t, ...others(x, t, 3, d => d.a !== t.a)];
    return { q: 'Který z těchto států má největší rozlohu?', target: four.reduce((a, b) => (a.a > b.a ? a : b)), opts: four.map(d => opt(d, d.n)) };
  },
  nb: (t, x) => {
    const nb = x.byC[pick(t.b.filter(c => x.byC[c]))]!;
    return { q: `Se kterým státem sousedí <b>${t.n}</b>?`, target: nb, about: t,
      opts: [nb, ...others(x, t, 3, d => !t.b.includes(d.c) && d !== nb)].map(d => opt(d, d.n)) };
  },
  ll: (t, x) => ({ q: 'Který z těchto států nemá přístup k moři?', opts: [t, ...others(x, t, 3, d => !d.ll)].map(d => opt(d, d.n)) }),
  cur: (t, x) => ({ q: `Jakou měnu používá <b>${t.n}</b>?`, opts: [t, ...others(x, t, 3, d => !!d.cur, d => d.cur)].map(d => opt(d, d.cur)) }),
};

export function canAsk(type: QType, t: Country, ctx: Ctx): boolean {
  switch (type) {
    case 'cont': return ctx.reg === 'all';
    case 'nb': return t.b.some(c => ctx.byC[c]);
    case 'll': return t.ll;
    case 'cur': return !!t.cur;
    default: return true;
  }
}

export function buildQuestion(type: QType, t: Country, ctx: Ctx): Question {
  const d = builders[type](t, ctx);
  const target = d.target ?? t;
  return { ...d, type, target, about: d.about ?? target, opts: shuffle(d.opts) };
}

export const pickQuestion = (types: readonly QType[], t: Country, ctx: Ctx) =>
  buildQuestion(pick(types.filter(k => canAsk(k, t, ctx))), t, ctx);
