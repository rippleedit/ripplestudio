import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })

Deno.serve(async (request) => {
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405)
  const expected = Deno.env.get('BACKUP_TOKEN')
  if (!expected || request.headers.get('x-backup-token') !== expected) return json({ error: 'Unauthorized' }, 401)

  const url = Deno.env.get('SUPABASE_URL')!
  const mapped = JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS') || '{}')
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || mapped.service_role || mapped.secret
  if (!serviceKey) return json({ error: 'Missing Supabase service key' }, 500)
  const dropboxKey = Deno.env.get('DROPBOX_APP_KEY')
  const refreshToken = Deno.env.get('DROPBOX_REFRESH_TOKEN')
  if (!dropboxKey || !refreshToken) return json({ error: 'Missing Dropbox credentials' }, 500)

  const supabase = createClient(url, serviceKey, { auth: { persistSession: false } })
  const tables = ['profiles','clients','projects','payments','payment_projects','time_entries','paypal_transactions','paypal_senders']
  const backup: Record<string, unknown> = { exported_at: new Date().toISOString(), version: 2 }
  // Supabase returns at most 1,000 rows per request, so read each table page by page.
  for (const table of tables) {
    const rows: unknown[] = []
    for (let from = 0; ; from += 1000) {
      const { data, error } = await supabase.from(table).select('*').range(from, from + 999)
      if (error) return json({ error: `${table}: ${error.message}` }, 500)
      rows.push(...data)
      if (data.length < 1000) break
    }
    backup[table] = rows
  }

  const tokenResponse = await fetch('https://api.dropboxapi.com/oauth2/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'refresh_token', refresh_token: refreshToken, client_id: dropboxKey }),
  })
  if (!tokenResponse.ok) return json({ error: 'Dropbox token refresh failed' }, 502)
  const { access_token } = await tokenResponse.json()
  const stamp = new Date().toISOString().slice(0, 10)
  const path = `/backups/ripplestudio-${stamp}.json`
  const upload = await fetch('https://content.dropboxapi.com/2/files/upload', {
    method: 'POST',
    headers: {
      authorization: `Bearer ${access_token}`,
      'content-type': 'application/octet-stream',
      'dropbox-api-arg': JSON.stringify({ path, mode: 'overwrite', autorename: false, mute: true }),
    },
    body: JSON.stringify(backup, null, 2),
  })
  if (!upload.ok) return json({ error: `Dropbox upload failed: ${await upload.text()}` }, 502)
  return json({ ok: true, path, tables: tables.length })
})

