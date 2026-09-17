import { createClient } from '@supabase/supabase-js'

if (!process.env.SUPABASE_URL || !process.env.SUPABASE_PUBLISHABLE_KEY) throw new Error('Missing SUPABASE_URL or SUPABASE_PUBLISHABLE_KEY')
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_PUBLISHABLE_KEY, { auth: { persistSession: false } })
let safe = true
for (const table of ['profiles','clients','projects','payments','payment_projects','time_entries']) {
  const { data, error } = await supabase.from(table).select('*').limit(1)
  const blocked = Boolean(error) || !data?.length
  console.log(`${table.padEnd(20)} ${blocked ? 'BLOCKED' : 'EXPOSED'}`)
  if (!blocked) safe = false
}
if (!safe) throw new Error('Anonymous access test failed')

