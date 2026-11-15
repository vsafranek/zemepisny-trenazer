import { neon } from '@neondatabase/serverless';

const url = process.env.DATABASE_URL || process.env.POSTGRES_URL;
export const sql = url ? neon(url) : null;

// Tables are created on first use, so a freshly connected Neon database needs no manual migration.
let ready;
export const init = () => ready ||= (async () => {
  await sql`create table if not exists batches (id uuid primary key, uid uuid not null, at timestamptz not null default now())`;
  await sql`create table if not exists answers (
    id bigint generated always as identity primary key, uid uuid not null, c char(3) not null,
    t text not null, ok boolean not null, ts timestamptz not null)`;
  await sql`create index if not exists answers_uid_c on answers (uid, c)`;
  await sql`create table if not exists rounds (
    id bigint generated always as identity primary key, uid uuid not null, mode text not null,
    reg text not null, score int not null, total int not null, ts timestamptz not null)`;
  await sql`create index if not exists rounds_uid_ts on rounds (uid, ts desc)`;
})().catch(e => { ready = null; throw e; });

export const json = (data, status = 200) => Response.json(data, { status, headers: { 'cache-control': 'no-store' } });
export const noDb = () => json({ error: 'Databáze není připojená.' }, 503);
export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const TYPES = new Set(['flag2name', 'name2flag', 'cap', 'cap2name', 'map2name', 'find', 'cont', 'area', 'nb', 'll', 'cur']);
export const MODES = new Set(['mix', 'flags', 'caps', 'map', 'facts', 'weak']);
