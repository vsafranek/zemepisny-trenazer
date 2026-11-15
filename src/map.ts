// World map: d3 projection, highlight classes, zoom/pan and fitting the view to a region or country.
import { geoNaturalEarth1, geoPath, geoGraticule10 } from 'd3-geo';
import { select } from 'd3-selection';
import { zoom as d3zoom, zoomIdentity } from 'd3-zoom';
import { min, max } from 'd3-array';
import { easeCubicInOut } from 'd3-ease';
import 'd3-transition';
import { feature } from 'topojson-client';
import { DATA, WORLD, byC } from './data';
import type { Country } from './config';
import { $ } from './util';

const W = 960, H = 500;
type Box = [number, number, number, number]; // x0, y0, x1, y1 in svg units
export const WORLD_BOX: Box = [0, 0, W, H];

const el = $('map');
const proj = geoNaturalEarth1().rotate([-10, 0]).fitExtent([[2, 2], [W - 2, H - 2]], { type: 'Sphere' });
const gpath = geoPath(proj);
const xy = (d: Country) => proj([d.p[1], d.p[0]]) ?? [0, 0];
const pxPerDeg = (proj.scale() * Math.PI) / 180;

const svg = select(el).insert('svg', ':first-child').attr('viewBox', `0 0 ${W} ${H}`).attr('preserveAspectRatio', 'xMidYMid meet');
const layer = svg.append('g');
layer.append('path').datum({ type: 'Sphere' } as const).attr('d', gpath).attr('fill', 'var(--sea)');
layer.append('path').datum(geoGraticule10()).attr('class', 'grat').attr('d', gpath);
const feats = feature(WORLD, WORLD.objects.countries).features;
const ccnToC: Record<string, string> = Object.fromEntries(DATA.map(d => [d.id, d.c]));
const paths = layer.append('g').selectAll('path').data(feats).join('path')
  .attr('class', 'cty').attr('d', gpath).attr('data-c', f => ccnToC[String(f.id)] ?? null);
const hasPath = new Set(feats.map(f => ccnToC[String(f.id)]).filter(Boolean));
// Small or shapeless states get a dot so they stay clickable.
const marks = layer.append('g').selectAll('circle').data(DATA.filter(d => d.a < 25000 || !hasPath.has(d.c))).join('circle')
  .attr('class', 'mk').attr('data-c', d => d.c).attr('cx', d => xy(d)[0]).attr('cy', d => xy(d)[1]);
const rings = layer.append('g');

let vb: [number, number, number, number] = [0, 0, W, H];
let zk = 1;
const markR = () => (7 * vb[2]) / (el.clientWidth || W) / zk;
const sizeMarks = () => { marks.attr('r', markR()); rings.selectAll('circle').attr('r', markR() * 2.6); };

// Pinch/wheel/drag zoom; on touch, one finger pans only in find mode so the page still scrolls otherwise.
const zoom = d3zoom<SVGSVGElement, unknown>().scaleExtent([1, 16]).clickDistance(6)
  .filter(e => e.type === 'wheel' || (e.type.startsWith('touch') ? el.classList.contains('find') || e.touches.length > 1 : !e.button))
  .on('zoom', e => { layer.attr('transform', e.transform.toString()); zk = e.transform.k; sizeMarks(); });
svg.call(zoom).on('dblclick.zoom', null).style('touch-action', 'pan-y');
$('zIn').onclick = () => svg.transition().duration(250).call(zoom.scaleBy, 2);
$('zOut').onclick = () => svg.transition().duration(250).call(zoom.scaleBy, 0.5);
$('zReset').onclick = () => svg.transition().duration(300).call(zoom.transform, zoomIdentity);

export function setView(box: Box, instant = false) {
  const asp = el.clientWidth / el.clientHeight || 16 / 9;
  let [x0, y0, x1, y1] = box, w = x1 - x0, h = y1 - y0;
  if (w / h < asp) { const nw = h * asp; x0 -= (nw - w) / 2; w = nw; } else { const nh = w / asp; y0 -= (nh - h) / 2; h = nh; }
  vb = [x0, y0, w, h];
  svg.interrupt().call(zoom.transform, zoomIdentity);
  sizeMarks();
  (instant ? svg : svg.transition().duration(650).ease(easeCubicInOut)).attr('viewBox', vb.join(' '));
}
addEventListener('resize', () => setView([vb[0], vb[1], vb[0] + vb[2], vb[1] + vb[3]], true));

export function regionBox(reg: string): Box {
  if (reg === 'all') return WORLD_BOX;
  const pts = DATA.filter(d => d.k === reg).map(xy), xs = pts.map(p => p[0]), ys = pts.map(p => p[1]), pad = 40;
  return [min(xs)! - pad, min(ys)! - pad, max(xs)! + pad, max(ys)! + pad];
}
export function countryBox(d: Country): Box {
  const [x, y] = xy(d);
  const half = Math.min(60, Math.max(7, (Math.sqrt(d.a) / 111) * 1.4)) * pxPerDeg;
  return [x - half, y - half * 0.7, x + half, y + half * 0.7];
}

export type Mark = 'hl' | 'ok' | 'bad';
/** pool: states in play; marks: per-state highlight; extra: any additional class (mastery colours). */
export function paint(pool: Set<string>, mk: Record<string, Mark> = {}, extra: (c: string) => string = () => '') {
  const cls = (c?: string) => (c ? [pool.has(c) ? 'pool' : '', mk[c] ?? '', extra(c)].join(' ') : '');
  paths.attr('class', f => 'cty ' + cls(ccnToC[String(f.id)]));
  marks.attr('class', d => 'mk ' + cls(d.c));
  rings.selectAll('circle').remove();
  for (const [c, k] of Object.entries(mk)) {
    const d = byC[c];
    if (!d || k === 'bad' || (d.a >= 25000 && hasPath.has(c))) continue;
    const [x, y] = xy(d);
    rings.append('circle').attr('class', 'ring').attr('cx', x).attr('cy', y).attr('r', markR() * 2.6);
  }
}

export function setFind(on: boolean) {
  el.classList.toggle('find', on);
  svg.style('touch-action', on ? 'none' : 'pan-y');
}
export const setTag = (text: string) => { $('maptag').textContent = text; };
export const onStateClick = (f: (code: string) => void) =>
  svg.on('click', (e: MouseEvent) => { const c = (e.target as SVGElement).dataset?.c; if (c) f(c); });
