import { neon } from '@neondatabase/serverless';

const url = process.env.DATABASE_URL || process.env.POSTGRES_URL;
export const sql = url ? neon(url) : null;

// Tables are created on first use, so a freshly connected Neon database needs no manual migration.
let ready: Promise<void> | null = null;
export const init = (db: NonNullable<typeof sql>) => ready ??= (async () => {
  await db`create table if not exists batches (id uuid primary key, uid uuid not null, at timestamptz not null default now())`;
  await db`create table if not exists answers (
    id bigint generated always as identity primary key, uid uuid not null, c char(3) not null,
    t text not null, ok boolean not null, ts timestamptz not null)`;
  await db`create index if not exists answers_uid_c on answers (uid, c)`;
  await db`create table if not exists rounds (
    id bigint generated always as identity primary key, uid uuid not null, mode text not null,
    reg text not null, score int not null, total int not null, ts timestamptz not null)`;
  await db`create index if not exists rounds_uid_ts on rounds (uid, ts desc)`;
})().catch(e => { ready = null; throw e; });

export const json = (data: unknown, status = 200) => Response.json(data, { status, headers: { 'cache-control': 'no-store' } });
export const noDb = () => json({ error: 'Databáze není připojená.' }, 503);
