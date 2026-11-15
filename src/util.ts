import type { Country } from './config';

export const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
export const flagImg = (d: Country) => `<img src="/flags/${d.f}.svg" alt="" loading="lazy">`;
export const fmt = (n: number) => n.toLocaleString('cs-CZ');
export const pct = (k: number, n: number) => (n ? Math.round((k / n) * 100) : 0);
export function shuffle<T>(a: T[]): T[] {
  for (let i = a.length - 1; i > 0; i--) { const j = (Math.random() * (i + 1)) | 0; [a[i], a[j]] = [a[j]!, a[i]!]; }
  return a;
}
export const sample = <T>(a: readonly T[], n: number) => shuffle(a.slice()).slice(0, n);
export const pick = <T>(a: readonly T[]): T => a[(Math.random() * a.length) | 0]!;
