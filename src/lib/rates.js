// A rough euro value for payments received in another currency, so the books show
// what actually lands: the amount after PayPal's fee, at the European Central
// Bank's reference rate for that day (frankfurter.dev: free, no account). If the
// balance is later converted inside PayPal, PayPal's rate is a little worse, so
// treat this as close rather than exact.
const cache = new Map()

const localDay = (value) => {
  const date = new Date(value)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

export function euroEstimate({ gross, fee = 0, currency, happened_at }) {
  const day = localDay(happened_at)
  const key = `${currency}:${day}`
  if (!cache.has(key)) {
    cache.set(key, fetch(`https://api.frankfurter.dev/v1/${day}?from=${encodeURIComponent(currency)}&to=EUR`)
      .then((response) => { if (!response.ok) throw new Error('No exchange rate for that day'); return response.json() })
      .then((body) => ({ rate: body.rates.EUR, rateDate: body.date }))
      .catch((error) => { cache.delete(key); throw error }))
  }
  const net = Math.round((Number(gross) + Number(fee)) * 100) / 100
  return cache.get(key).then(({ rate, rateDate }) => ({ net, rate, rateDate, eur: Math.round(net * rate * 100) / 100 }))
}

export const estimateNote = (item, estimate) => `${estimate.net.toFixed(2)} ${item.currency} after fees × ${estimate.rate} (ECB rate, ${estimate.rateDate})`
