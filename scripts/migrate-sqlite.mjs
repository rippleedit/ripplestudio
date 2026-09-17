import Database from 'better-sqlite3'
import { createClient } from '@supabase/supabase-js'

const required = ['SUPABASE_URL','SUPABASE_SERVICE_ROLE_KEY','OWNER_USER_ID','RIPPLESTUDIO_DB_PATH']
for (const name of required) if (!process.env[name]) throw new Error(`Missing ${name}`)

const db = new Database(process.env.RIPPLESTUDIO_DB_PATH, { readonly: true, fileMustExist: true })
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })
const owner = process.env.OWNER_USER_ID

const read = (table) => db.prepare(`select * from ${table}`).all()
const chunks = (rows, size = 100) => Array.from({ length: Math.ceil(rows.length / size) }, (_, i) => rows.slice(i * size, (i + 1) * size))
const bool = (value) => Boolean(Number(value || 0))
const json = (value, fallback) => { try { return value ? JSON.parse(value) : fallback } catch { return fallback } }

const source = {
  clients: read('clients').map((row) => ({ ...row, user_id: owner })),
  projects: read('projects').map((row) => ({ ...row, user_id: owner, services: json(row.services, []), vsl_package: json(row.vsl_package, null), footage_downloaded: bool(row.footage_downloaded), track_time: bool(row.track_time) })),
  payments: read('payments').map(({ project_id: _legacy, ...row }) => ({ ...row, user_id: owner })),
  payment_projects: read('payment_projects').map((row) => ({ ...row, user_id: owner })),
  time_entries: read('time_entries').map((row) => ({ ...row, user_id: owner })),
}

for (const table of ['clients','projects','payments','payment_projects','time_entries']) {
  for (const batch of chunks(source[table])) {
    const { error } = await supabase.from(table).upsert(batch)
    if (error) throw new Error(`${table}: ${error.message}`)
  }
  const { count, error } = await supabase.from(table).select('*', { count: 'exact', head: true }).eq('user_id', owner)
  if (error) throw new Error(`${table} count: ${error.message}`)
  const expected = source[table].length
  console.log(`${table.padEnd(20)} SQLite ${String(expected).padStart(4)} · Supabase ${String(count).padStart(4)} · ${count === expected ? 'OK' : 'MISMATCH'}`)
  if (count !== expected) process.exitCode = 1
}

db.close()

