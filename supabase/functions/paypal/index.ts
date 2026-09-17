// RippleStudio · PayPal check. Reads incoming payments from the studio's PayPal
// account (read-only: the PayPal app only has Transaction search) and stores the
// new ones for matching in Finance. Deploy with JWT verification off; this
// function checks the caller itself.
//
// Secrets: PAYPAL_CLIENT_ID, PAYPAL_CLIENT_SECRET, PAYPAL_SYNC_TOKEN, OWNER_USER_ID.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const PAYPAL = 'https://api-m.paypal.com'
const DAY = 86400000
const cors = {
  'access-control-allow-origin': '*',
  'access-control-allow-headers': 'authorization, x-client-info, apikey, content-type, x-sync-token',
  'access-control-allow-methods': 'POST, OPTIONS',
}
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, 'content-type': 'application/json' } })
const cents = (value: unknown) => Math.round(Number(value || 0) * 100) / 100
const paypalDate = (date: Date) => `${date.toISOString().slice(0, 19)}-0000`

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  const mapped = JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS') || '{}')
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || mapped.service_role || mapped.secret
  if (!serviceKey) return json({ error: 'Missing Supabase service key' }, 500)
  const admin = createClient(Deno.env.get('SUPABASE_URL')!, serviceKey, { auth: { persistSession: false } })

  // Who is asking: the hourly schedule with its token, or you, signed in to Studio.
  let owner: string | null = null
  const syncToken = Deno.env.get('PAYPAL_SYNC_TOKEN')
  if (syncToken && request.headers.get('x-sync-token') === syncToken) {
    owner = Deno.env.get('OWNER_USER_ID') ?? null
  } else {
    const jwt = (request.headers.get('authorization') || '').replace(/^Bearer\s+/i, '')
    if (jwt) owner = (await admin.auth.getUser(jwt)).data.user?.id ?? null
  }
  if (!owner) return json({ error: 'Unauthorized' }, 401)

  const clientId = Deno.env.get('PAYPAL_CLIENT_ID')
  const clientSecret = Deno.env.get('PAYPAL_CLIENT_SECRET')
  if (!clientId || !clientSecret) return json({ error: 'PayPal is not connected yet' }, 500)
  const tokenResponse = await fetch(`${PAYPAL}/v1/oauth2/token`, {
    method: 'POST',
    headers: { authorization: `Basic ${btoa(`${clientId}:${clientSecret}`)}`, 'content-type': 'application/x-www-form-urlencoded' },
    body: 'grant_type=client_credentials',
  })
  if (!tokenResponse.ok) return json({ error: 'PayPal refused the app credentials' }, 502)
  const { access_token } = await tokenResponse.json()

  // From a little before the newest payment already stored (PayPal can list new
  // transactions a few hours late), or the last 30 days on the very first check.
  const { data: newest } = await admin.from('paypal_transactions').select('happened_at').eq('user_id', owner).order('happened_at', { ascending: false }).limit(1)
  const end = new Date()
  const start = newest?.[0] ? new Date(new Date(newest[0].happened_at).getTime() - 3 * DAY) : new Date(end.getTime() - 30 * DAY)

  // PayPal answers at most 31 days per question, in pages.
  const details: any[] = []
  for (let from = start; from < end; from = new Date(from.getTime() + 31 * DAY)) {
    const to = new Date(Math.min(from.getTime() + 31 * DAY, end.getTime()))
    for (let page = 1, pages = 1; page <= pages; page++) {
      const query = new URLSearchParams({ start_date: paypalDate(from), end_date: paypalDate(to), fields: 'all', page_size: '500', page: String(page) })
      const response = await fetch(`${PAYPAL}/v1/reporting/transactions?${query}`, { headers: { authorization: `Bearer ${access_token}` } })
      const body = await response.json()
      if (!response.ok) {
        const notYet = body.name === 'NOT_AUTHORIZED'
        return json({ error: notYet ? 'PayPal has not switched on Transaction search for this app yet' : `PayPal: ${body.message || response.status}` }, 502)
      }
      details.push(...(body.transaction_details || []))
      pages = body.total_pages || 1
    }
  }

  // A currency conversion is booked as extra lines pointing back at the payment;
  // the positive euro line is what actually landed in the account.
  const euroFor = new Map<string, number>()
  for (const { transaction_info: t } of details) {
    if (!String(t.transaction_event_code).startsWith('T02') || !t.paypal_reference_id) continue
    if (t.transaction_amount?.currency_code === 'EUR' && Number(t.transaction_amount?.value) > 0) euroFor.set(t.paypal_reference_id, cents(t.transaction_amount.value))
  }

  // Only money coming in: completed payments received (T00xx with a positive amount).
  const { data: senders } = await admin.from('paypal_senders').select('email, client_id').eq('user_id', owner)
  const clientFor = new Map((senders || []).map((sender) => [sender.email, sender.client_id]))
  const rows = details
    .filter(({ transaction_info: t }) => String(t.transaction_event_code).startsWith('T00') && Number(t.transaction_amount?.value) > 0 && t.transaction_status === 'S')
    .map(({ transaction_info: t, payer_info: payer = {} }) => {
      const gross = cents(t.transaction_amount.value)
      const fee = cents(t.fee_amount?.value)
      const currency = t.transaction_amount.currency_code
      const email = payer.email_address ? String(payer.email_address).toLowerCase() : null
      const name = payer.payer_name?.alternate_full_name || [payer.payer_name?.given_name, payer.payer_name?.surname].filter(Boolean).join(' ') || null
      return {
        id: t.transaction_id,
        user_id: owner,
        happened_at: t.transaction_initiation_date,
        payer_email: email,
        payer_name: name,
        gross,
        fee,
        currency,
        received_eur: currency === 'EUR' ? cents(gross + fee) : (euroFor.get(t.transaction_id) ?? null),
        note: t.transaction_note || t.transaction_subject || null,
        client_id: email ? clientFor.get(email) ?? null : null,
        status: 'new',
        payment_id: null as number | null,
      }
    })

  const { data: known } = rows.length
    ? await admin.from('paypal_transactions').select('id, received_eur').eq('user_id', owner).in('id', rows.map((row) => row.id))
    : { data: [] }
  const knownById = new Map((known || []).map((row) => [row.id, row]))
  // A conversion can appear a little after its payment: fill the euro amount in later.
  for (const row of rows) {
    const stored = knownById.get(row.id)
    if (stored && stored.received_eur == null && row.received_eur != null) await admin.from('paypal_transactions').update({ received_eur: row.received_eur }).eq('id', row.id)
  }
  const fresh = rows.filter((row) => !knownById.has(row.id))

  // Payments already logged by hand are recognised (same euro amount within three
  // days), so history does not show up as new, and the sender is remembered.
  let recognised = 0
  if (fresh.length) {
    const since = new Date(start.getTime() - 5 * DAY).toISOString().slice(0, 10)
    const { data: payments } = await admin.from('payments').select('id, amount, date, client_id').eq('user_id', owner).gte('date', since)
    const { data: taken } = await admin.from('paypal_transactions').select('payment_id').eq('user_id', owner).not('payment_id', 'is', null)
    const used = new Set((taken || []).map((row) => Number(row.payment_id)))
    const learned: { user_id: string, email: string, client_id: number }[] = []
    for (const row of fresh) {
      if (row.received_eur == null) continue
      const when = new Date(row.happened_at).getTime()
      const hit = (payments || []).find((payment) => !used.has(Number(payment.id))
        && Math.abs(Number(payment.amount) - row.received_eur!) < 0.02
        && Math.abs(new Date(payment.date).getTime() - when) <= 3 * DAY)
      if (!hit) continue
      used.add(Number(hit.id))
      Object.assign(row, { status: 'matched', payment_id: hit.id, client_id: hit.client_id })
      recognised++
      if (row.payer_email && hit.client_id) learned.push({ user_id: owner, email: row.payer_email, client_id: hit.client_id })
    }
    const { error } = await admin.from('paypal_transactions').insert(fresh)
    if (error) return json({ error: error.message }, 500)
    if (learned.length) await admin.from('paypal_senders').upsert(learned, { onConflict: 'user_id,email', ignoreDuplicates: true })
  }

  return json({ ok: true, checked: details.length, added: fresh.length - recognised, recognised })
})
