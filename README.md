# RippleStudio Online

RippleEdit's private studio operations app for projects, time, clients and finance.

```sh
npm install
npm run dev
```

With no `.env`, the app opens with synthetic demo data for safe visual development. See `SETUP.md` for the Supabase, migration, backup, GitHub Pages and MFA sequence.


## Analytics

The Analytics screen at `/analytics` uses the existing authenticated workspace data; no database changes are required. Filter by client and 4, 12, 26 or 52 weeks, or all time. Click a weekly bar to inspect sessions and deliveries; search, sort and export the project detail table.

- Weekly hours use saved session durations, assigned to their start day. Running timers are excluded. The average week includes zero-log weeks and excludes the current partial week.
- Project effort uses lifetime logged hours for tracked projects delivered in the selected period. Turnaround uses actual footage-received and delivery dates, including waiting time. Missing dates or tracking are never replaced with zero.
- Receipts remain in their original currencies. Effective hourly rate uses linked EUR receipts on paid, tracked projects delivered in the selected period. Shared payments are allocated by quoted price, or evenly when unquoted.

Run `npm run test:analytics` for calculation checks, including week boundaries, daylight saving, missing data, client filters, payment allocation and CSV escaping. The publish workflow runs these tests before building.
