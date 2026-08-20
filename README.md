# ChatPOS

ChatPOS is a Next.js application using the App Router, React, TypeScript, and Oxlint. The existing merchant, customer, booking, catalog, payment, and developer views are mounted through an optional catch-all route so their existing URLs continue to work.

สำหรับภาพรวมความสามารถ สถาปัตยกรรม route, API, database, KYC และแนวทางพัฒนาต่อ ดูที่ [Developer Guide](docs/DEVELOPER_GUIDE.md)

## Development

```bash
npm install
npm run dev
```

The Next.js application runs at `http://localhost:3000`. The PostgreSQL-backed API process runs alongside it at port `3001`; Next rewrites `/api/db/*` and `/api/v1/*` to that process.

Set `CHATPOS_API_URL` when the API process is hosted elsewhere. Database settings remain in `.env` and are read by `server.cjs`.

## Database setup

Run migrations first, then load the repeatable demo dataset:

```bash
npm run db:migrate
npm run db:seed
```

The seed creates demo accounts for Merchant, Agent, PD, Compliance, and Admin, plus KYC, assignment, catalog, payment, settlement, webhook, and audit data. The default password is `ChatPOS123!`; set `SEED_PASSWORD` before running the seed to use another password. Seed accounts use the `@chatpos.local` domain and should only be used in development or a disposable staging database.

## Production

```bash
npm run build
npm run start

- Source: **Github**
- Repository: `haiphee-por/chatpos-react`
- Branch: `ikkyu`
- Build Path: `/`
- Build method: **Dockerfile**
- Port: `80`

The Nginx configuration includes SPA fallback, so routes such as `/merchant`, `/customer`, and `/pd` continue to work after a page refresh.
