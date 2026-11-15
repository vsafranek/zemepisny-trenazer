import type { Mode, QType } from '../api/_shared';

export interface Country {
  id: string; c: string; f: string; n: string; cap: string; k: Continent; s: string;
  a: number; ll: boolean; b: string[]; cur: string; p: [number, number];
}

export const CONTS = ['Evropa', 'Asie', 'Afrika', 'Severní Amerika', 'Jižní Amerika', 'Oceánie'] as const;
export type Continent = (typeof CONTS)[number];
export type Region = 'all' | Continent;
export const REGS: [Region, string][] = [['all', 'Celý svět'], ...CONTS.map(c => [c, c] as [Region, string])];
export const regName = (r: string) => REGS.find(x => x[0] === r)?.[1] ?? r;

export const MODES: [Mode, string][] = [['mix', 'Všechno'], ['weak', 'Slabé státy'], ['flags', 'Vlajky'], ['caps', 'Hlavní města'], ['map', 'Poloha na mapě'], ['facts', 'Charakteristiky']];
export const MODE_NAMES = Object.fromEntries(MODES) as Record<Mode, string>;
export const LENS: [number, string][] = [[10, '10'], [20, '20'], [0, 'Všechny státy']];

export const CATS = {
  flags: ['flag2name', 'name2flag'],
  caps: ['cap', 'cap2name'],
  map: ['map2name', 'find'],
  facts: ['cont', 'area', 'nb', 'll', 'cur'],
} as const satisfies Record<string, readonly QType[]>;
export const CAT_NAMES: Record<keyof typeof CATS, string> = { flags: 'Vlajky', caps: 'Hlavní města', map: 'Poloha na mapě', facts: 'Charakteristiky' };
const ALL: readonly QType[] = Object.values(CATS).flat();
export const TYPES: Record<Mode, readonly QType[]> = { ...CATS, mix: ALL, weak: ALL };

export interface Settings { mode: Mode; reg: Region; len: number }
