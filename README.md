# ChatPOS

ChatPOS is a Next.js application using the App Router, React, TypeScript, and Oxlint. The existing merchant, customer, booking, catalog, payment, and developer views are mounted through an optional catch-all route so their existing URLs continue to work.

## Development

```bash
npm install
npm run dev
```

The Next.js application runs at `http://localhost:3000`. The PostgreSQL-backed API process runs alongside it at port `3001`; Next rewrites `/api/db/*` and `/api/v1/*` to that process.

Set `CHATPOS_API_URL` when the API process is hosted elsewhere. Database settings remain in `.env` and are read by `server.cjs`.

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
