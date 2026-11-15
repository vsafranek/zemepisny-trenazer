// Types and constants shared by the frontend (src/) and the API functions.
export const QTYPES = ['flag2name', 'name2flag', 'cap', 'cap2name', 'map2name', 'find', 'cont', 'area', 'nb', 'll', 'cur'] as const;
export type QType = (typeof QTYPES)[number];

export const MODES = ['mix', 'weak', 'flags', 'caps', 'map', 'facts'] as const;
export type Mode = (typeof MODES)[number];

export interface AnswerRec { c: string; t: QType; ok: boolean; ts: string }
export interface RoundRec { mode: Mode; reg: string; score: number; total: number; ts: string }
/** [answered, correct] */
export type Tally = [number, number];
export interface Stats { c: Record<string, Tally>; t: Partial<Record<QType, Tally>>; rounds: RoundRec[]; nRounds: number }
export interface SyncBatch { id: string; answers: AnswerRec[]; rounds: RoundRec[] }

export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const LIMITS = { answers: 2000, rounds: 200 } as const;
