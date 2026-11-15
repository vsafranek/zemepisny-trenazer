import type { Topology, GeometryCollection } from 'topojson-specification';
import type { Country } from './config';

const get = <T>(url: string): Promise<T> => fetch(url).then(r => r.json() as Promise<T>);

export const [DATA, WORLD] = await Promise.all([
  get<Country[]>('/data/countries.json'),
  get<Topology<{ countries: GeometryCollection }>>('/data/world.json'),
]);
export const byC: Record<string, Country> = Object.fromEntries(DATA.map(d => [d.c, d]));
export const poolOf = (reg: string) => DATA.filter(d => reg === 'all' || d.k === reg);
